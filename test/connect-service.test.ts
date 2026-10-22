import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createConnectService, type ConnectService } from "../src/connect/service.js";
import { decryptSecret } from "../src/db/crypto.js";
import { openStore, type Store } from "../src/db/store.js";
import { StrikeError } from "../src/strike/client.js";
import { derivePublicKeyHex } from "../src/strike/sign.js";

const ETH = "0x0C3aD0348879998C97106Feb1d0AE9406A6A741d";
const T0 = Date.parse("2026-10-21T12:00:00.000Z");
let clock = T0;
const at = (min: number) => (clock = T0 + min * 60_000);

let store: Store;
let kek: Buffer;
let svc: ConnectService;
let requested: any[];
let verified: any[];
let notified: { tgId: number; text: string }[];
let token: string;
let failRequest: StrikeError | undefined;
let failVerify: StrikeError | undefined;
let verifyPub: (sent: string) => string;

beforeEach(() => {
  clock = T0;
  store = openStore(":memory:");
  kek = randomBytes(32);
  requested = [];
  verified = [];
  notified = [];
  failRequest = undefined;
  failVerify = undefined;
  verifyPub = (sent) => sent;
  let n = 0;
  svc = createConnectService({
    store, kek, builderCode: "sigma", feeShareBps: 10, now: () => new Date(clock).toISOString(),
    strike: {
      builderRequestSignature: async (i) => {
        if (failRequest) throw failRequest;
        requested.push(i);
        return { nonce: `nonce-${++n}`, message_to_sign: `Connect to Strike via builder "sigma". Wallet: ${i.address}` };
      },
      builderVerifySignature: async (i) => {
        if (failVerify) throw failVerify;
        verified.push(i);
        const pub = verifyPub(requested.at(-1).publicKey);
        return { account_id: "acc-1", api_wallet_public_key: pub, fee_share_bps: 10, builder_code: "sigma" };
      },
    },
    notify: async (tgId, text) => void notified.push({ tgId, text }),
  });
  token = store.createConnectToken(111, new Date(clock).toISOString());
});

describe("info", () => {
  it("returns the builder code and the fee cap for a valid token", () => {
    expect(svc.info(token)).toEqual({ ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum", "solana", "cardano"] });
  });
  it("rejects an unknown or expired token", () => {
    expect(svc.info("x".repeat(43))).toEqual({ ok: false, error: "This link is not valid. Send /connect to the bot for a new one." });
    at(11);
    expect(svc.info(token)).toMatchObject({ ok: false });
  });
});

describe("challenge", () => {
  it("generates a key, asks Strike for the challenge with that key's public half, and returns only the nonce and message", async () => {
    const r = await svc.challenge(token, { address: ETH, chain: "ethereum" });
    expect(r).toEqual({ ok: true, nonce: "nonce-1", message: `Connect to Strike via builder "sigma". Wallet: ${ETH}` });
    expect(requested[0]).toMatchObject({ address: ETH, chain: "ethereum", code: "sigma", feeShareBps: 10 });
    expect(requested[0].publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(r)).not.toContain(requested[0].publicKey);
  });

  it("stores the private key encrypted, and it matches the public key sent to Strike", async () => {
    await svc.challenge(token, { address: ETH, chain: "ethereum" });
    const p = store.takePending("nonce-1", token, new Date(clock).toISOString())!;
    const priv = decryptSecret(kek, p.apiPrivEnc);
    expect(derivePublicKeyHex(priv)).toBe(requested[0].publicKey);
    expect(p.apiPrivEnc).not.toContain(priv);
  });

  it("uses a fresh key for every challenge", async () => {
    await svc.challenge(token, { address: ETH, chain: "ethereum" });
    await svc.challenge(token, { address: ETH, chain: "ethereum" });
    expect(requested[0].publicKey).not.toBe(requested[1].publicKey);
  });

  it("rejects an invalid token without calling Strike", async () => {
    expect(await svc.challenge("bad", { address: ETH, chain: "ethereum" })).toMatchObject({ ok: false });
    expect(requested.length).toBe(0);
  });

  it.each([
    ["ethereum", "0x123"],
    ["ethereum", ETH.slice(2)],
    ["solana", "0xnotsolana"],
    ["cardano", "addr1short"],
    ["bitcoin", ETH],
  ])("rejects a malformed %s address %s before calling Strike", async (chain, address) => {
    expect(await svc.challenge(token, { address, chain: chain as never })).toMatchObject({ ok: false });
    expect(requested.length).toBe(0);
  });

  it("accepts a solana and a cardano address shape", async () => {
    expect(await svc.challenge(token, { address: "8jZGYMi1UmQRdmCvfLpSFEyDiv6NBzL8CNQR95GkB1dZ", chain: "solana" })).toMatchObject({ ok: true });
    expect(await svc.challenge(token, { address: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp", chain: "cardano" })).toMatchObject({ ok: true });
  });

  it("passes Strike's error on, escaped for display, and stores nothing", async () => {
    failRequest = new StrikeError(404, "POST", "/auth/builder/request-signature", "builder code not found");
    expect(await svc.challenge(token, { address: ETH, chain: "ethereum" })).toEqual({ ok: false, error: "Strike said: builder code not found." });
    expect(store.takePending("nonce-1", token, new Date(clock).toISOString())).toBeUndefined();
  });
});

describe("complete", () => {
  async function challenged() {
    const c = await svc.challenge(token, { address: ETH, chain: "ethereum" });
    if (!c.ok) throw new Error(c.error);
    return c.nonce;
  }

  it("verifies with Strike, links the user as a builder wallet, consumes the token and tells the user", async () => {
    const nonce = await challenged();
    const r = await svc.complete(token, { nonce, signature: "0xsig" });
    expect(r).toEqual({ ok: true, address: "0x0C3a…741d" });
    expect(verified).toEqual([{ nonce, walletSignature: "0xsig" }]);
    expect(store.getUser(111)).toMatchObject({ chain: "ethereum", address: ETH, strikeAccountId: "acc-1", builderCode: "sigma", apiPub: requested[0].publicKey });
    expect(decryptSecret(kek, store.getUser(111)!.apiPrivEnc)).toMatch(/^[0-9a-f]{64}$/);
    expect(store.peekConnectToken(token, new Date(clock).toISOString())).toBeUndefined();
    expect(notified).toEqual([{ tgId: 111, text: "✅ <b>Linked</b> 0x0C3a…741d\nTap <b>Tail</b> on a call card to trade." }]);
  });

  it("the signature never reaches storage or the notification", async () => {
    const nonce = await challenged();
    await svc.complete(token, { nonce, signature: "0xSUPERSIGNATURE" });
    expect(JSON.stringify(notified)).not.toContain("SUPERSIGNATURE");
    expect(JSON.stringify(store.rawUserRow(111))).not.toContain("SUPERSIGNATURE");
  });

  it("cannot be completed twice", async () => {
    const nonce = await challenged();
    await svc.complete(token, { nonce, signature: "0xsig" });
    expect(await svc.complete(token, { nonce, signature: "0xsig" })).toMatchObject({ ok: false });
    expect(verified.length).toBe(1);
  });

  it("a different token cannot complete someone else's challenge", async () => {
    const nonce = await challenged();
    const other = store.createConnectToken(222, new Date(clock).toISOString());
    expect(await svc.complete(other, { nonce, signature: "0xsig" })).toMatchObject({ ok: false });
    expect(store.getUser(222)).toBeUndefined();
    expect(verified.length).toBe(0);
  });

  it("an expired challenge asks the user to start again", async () => {
    const nonce = await challenged();
    at(6);
    expect(await svc.complete(token, { nonce, signature: "0xsig" })).toEqual({ ok: false, error: "That request expired. Reload the page and try again." });
    expect(verified.length).toBe(0);
  });

  it("keeps the token usable after a Strike rejection so the user can retry", async () => {
    const nonce = await challenged();
    failVerify = new StrikeError(401, "POST", "/auth/builder/verify-signature", "signature verification failed");
    expect(await svc.complete(token, { nonce, signature: "0xbad" })).toEqual({ ok: false, error: "Strike said: signature verification failed." });
    expect(store.getUser(111)).toBeUndefined();
    expect(notified.length).toBe(0);
    expect(store.peekConnectToken(token, new Date(clock).toISOString())).toBe(111);
  });

  it("refuses a response whose API wallet key is not the one we generated", async () => {
    const nonce = await challenged();
    verifyPub = () => "cd".repeat(32);
    expect(await svc.complete(token, { nonce, signature: "0xsig" })).toEqual({ ok: false, error: "Strike returned a different key than expected. Nothing was linked." });
    expect(store.getUser(111)).toBeUndefined();
  });

  it("re-linking replaces an earlier personal key and keeps the user's settings", async () => {
    store.linkUser({ tgId: 111, chain: "ethereum", address: ETH, strikeAccountId: "acc-1", apiPub: "old", apiPrivEnc: "v1:a:b:c", builderCode: null, linkedAt: "t" });
    store.setSetting(111, "riskPct", "3");
    const nonce = await challenged();
    await svc.complete(token, { nonce, signature: "0xsig" });
    expect(store.getUser(111)).toMatchObject({ builderCode: "sigma", riskPct: "3" });
    expect(store.getUser(111)!.apiPub).not.toBe("old");
  });
});

describe("a connect link bound to a caller's builder code", () => {
  let coded: string;
  beforeEach(() => {
    coded = store.createConnectToken(222, new Date(clock).toISOString(), { code: "alpha", feeBps: 25 });
  });

  it("info shows the caller's code and rate, not the server default", () => {
    expect(svc.info(coded)).toMatchObject({ ok: true, builderCode: "alpha", feeCapBps: 25 });
  });

  it("asks Strike for a challenge under the caller's code", async () => {
    await svc.challenge(coded, { address: ETH, chain: "ethereum" });
    expect(requested[0]).toMatchObject({ code: "alpha", feeShareBps: 25 });
  });

  it("completing saves a wallet for that code, and also makes it the default when the follower had none", async () => {
    const c = await svc.challenge(coded, { address: ETH, chain: "ethereum" });
    if (!c.ok) throw new Error(c.error);
    expect(await svc.complete(coded, { nonce: c.nonce, signature: "0xsig" })).toMatchObject({ ok: true });
    expect(store.walletFor(222, "alpha")).toMatchObject({ builderCode: "alpha", feeBps: 25, apiPub: requested[0].publicKey });
    expect(store.getUser(222)).toMatchObject({ builderCode: "alpha", apiPub: requested[0].publicKey });
  });

  it("does not replace a follower's existing default wallet", async () => {
    store.linkUser({ tgId: 222, chain: "ethereum", address: ETH, strikeAccountId: "acc-0", apiPub: "old", apiPrivEnc: "v1:a:b:c", builderCode: "sigma", linkedAt: "t" });
    const c = await svc.challenge(coded, { address: ETH, chain: "ethereum" });
    if (!c.ok) throw new Error(c.error);
    await svc.complete(coded, { nonce: c.nonce, signature: "0xsig" });
    expect(store.getUser(222)?.apiPub).toBe("old");
    expect(store.walletFor(222, "alpha")?.apiPub).toBe(requested[0].publicKey);
  });

  it("tells the follower which caller code they connected under", async () => {
    const c = await svc.challenge(coded, { address: ETH, chain: "ethereum" });
    if (!c.ok) throw new Error(c.error);
    await svc.complete(coded, { nonce: c.nonce, signature: "0xsig" });
    expect(notified.at(-1)?.text).toContain("alpha");
  });
});
