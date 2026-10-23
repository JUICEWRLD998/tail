// Builder Connect on the server side: the wallet signs once, Strike mints a trade-only API wallet for Tail.
// Flow (VERIFIED, docs.strikefinance.org/api/builder-codes/builder-connect.md and a live run, Spike E):
//   challenge: we generate an Ed25519 API key, Strike returns { nonce, message_to_sign } for the wallet to sign
//   complete:  the wallet's signature goes to verify-signature; Strike activates the API wallet for our builder code
// The API private key never leaves the server: it is encrypted at rest from the moment it exists.
import { generateKeyPairSync } from "node:crypto";
import { decryptSecret, encryptSecret } from "../db/crypto.js";
import type { Store } from "../db/store.js";
import { escapeHtml } from "../bot/cards.js";
import { StrikeError, type StrikeClient } from "../strike/client.js";
import { derivePublicKeyHex } from "../strike/sign.js";

export type Chain = "ethereum" | "solana" | "cardano";
const CHAINS: Chain[] = ["ethereum", "solana", "cardano"];

const ADDRESS_RE: Record<Chain, RegExp> = {
  ethereum: /^0x[0-9a-fA-F]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  cardano: /^addr(?:_test)?1[02-9ac-hj-np-z]{50,110}$/,
};

export interface ConnectDeps {
  store: Store;
  kek: Buffer;
  builderCode: string;
  feeShareBps: number;
  strike: Pick<StrikeClient, "builderRequestSignature" | "builderVerifySignature">;
  now: () => string;
  notify: (tgId: number, text: string) => Promise<void>;
}

const INVALID = "This link is not valid. Send /connect to the bot for a new one.";
const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

const OWN_CODE = "This wallet account owns the builder code Tail uses, and Strike will not connect an account to its own code. Choose a different account in your wallet and try again.";

function strikeText(e: unknown): string {
  if (e instanceof StrikeError && /own builder code/i.test(e.strikeError)) return OWN_CODE;
  return e instanceof StrikeError ? `Strike said: ${escapeHtml(e.strikeError)}.` : "Could not reach Strike. Try again.";
}

export function createConnectService(d: ConnectDeps) {
  // A link from a caller's card carries that caller's code: the wallet it creates trades under it, so Strike pays them.
  const codeOf = (token: string) => d.store.connectTokenCode(token, d.now()) ?? { code: d.builderCode, feeBps: d.feeShareBps };
  return {
    info(token: string) {
      if (d.store.peekConnectToken(token, d.now()) === undefined) return { ok: false as const, error: INVALID };
      const c = codeOf(token);
      return { ok: true as const, builderCode: c.code, feeCapBps: c.feeBps, chains: CHAINS };
    },

    async challenge(token: string, i: { address: string; chain: Chain }): Promise<{ ok: true; nonce: string; message: string } | { ok: false; error: string }> {
      const tgId = d.store.peekConnectToken(token, d.now());
      if (tgId === undefined) return { ok: false, error: INVALID };
      if (!CHAINS.includes(i.chain) || !ADDRESS_RE[i.chain].test(i.address)) {
        return { ok: false, error: "That wallet address does not look right for the chosen network." };
      }
      const priv = Buffer.from(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }).d as string, "base64url").toString("hex");
      const pub = derivePublicKeyHex(priv);
      const c = codeOf(token);
      try {
        const r = await d.strike.builderRequestSignature({
          address: i.address, chain: i.chain, code: c.code, feeShareBps: c.feeBps, publicKey: pub,
        });
        d.store.savePending({
          nonce: r.nonce, token, tgId, address: i.address, chain: i.chain, apiPub: pub,
          apiPrivEnc: encryptSecret(d.kek, priv), createdAt: d.now(),
        });
        return { ok: true, nonce: r.nonce, message: r.message_to_sign };
      } catch (e) {
        return { ok: false, error: strikeText(e) };
      }
    },

    async complete(token: string, i: { nonce: string; signature: string }): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
      const c = codeOf(token);
      const caller = d.store.connectTokenCode(token, d.now());
      const pending = d.store.takePending(i.nonce, token, d.now());
      if (!pending) return { ok: false, error: "That request expired. Reload the page and try again." };
      let res;
      try {
        res = await d.strike.builderVerifySignature({ nonce: i.nonce, walletSignature: i.signature });
      } catch (e) {
        return { ok: false, error: strikeText(e) };
      }
      if (res.api_wallet_public_key !== pending.apiPub) {
        return { ok: false, error: "Strike returned a different key than expected. Nothing was linked." };
      }
      // Consume the token only now that the link exists; a Strike rejection above leaves it usable for a retry.
      if (d.store.consumeConnectToken(token, d.now()) === undefined) return { ok: false, error: INVALID };
      // The key was encrypted when generated; check it still opens before we rely on it.
      decryptSecret(d.kek, pending.apiPrivEnc);
      const wallet = {
        tgId: pending.tgId, chain: pending.chain, address: pending.address, strikeAccountId: res.account_id,
        apiPub: pending.apiPub, apiPrivEnc: pending.apiPrivEnc, builderCode: c.code, linkedAt: d.now(),
      };
      if (caller) {
        d.store.saveWallet({ ...wallet, feeBps: c.feeBps });
        // The first connect a follower ever makes may come from a caller's card; it then doubles as their default.
        if (!d.store.getUser(pending.tgId)) d.store.linkUser(wallet);
      } else {
        d.store.linkUser(wallet);
      }
      const address = short(pending.address);
      try {
        await d.notify(pending.tgId, caller
          ? `✅ <b>Linked</b> ${address}\nYou trade this caller's calls under their builder code <code>${escapeHtml(c.code)}</code>. Tap <b>Tail</b> again.`
          : `✅ <b>Linked</b> ${address}\nTap <b>Tail</b> on a call card to trade.`);
      } catch {
        /* the link exists; a failed DM must not undo it */
      }
      return { ok: true, address };
    },
  };
}

export type ConnectService = ReturnType<typeof createConnectService>;
