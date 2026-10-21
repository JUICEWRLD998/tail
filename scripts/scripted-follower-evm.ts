// Builder Connect with an Ethereum wallet and no browser: a throwaway key signs Strike's challenge with EIP-191
// personal_sign, the same call MetaMask makes. Used to pin down the exact signature format Strike accepts.
// Testnet only; the new API-wallet key is written to keys/ (git-ignored) and never printed.
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";
import { derivePublicKeyHex } from "../src/strike/sign.js";
import { StrikeClient } from "../src/strike/client.js";
import { BASE_URL, requireEnv } from "./env.js";

const code = requireEnv("BUILDER_CODE").BUILDER_CODE as string;
const feeBps = Number(process.env.BUILDER_FEE_BPS ?? "10");
const strip0x = process.env.SIG_FORMAT === "no0x";
// MetaMask returns lowercase addresses from eth_requestAccounts; ADDR_CASE=lower reproduces that.
const lower = process.env.ADDR_CASE === "lower";

const wallet = Wallet.createRandom();
const apiPriv = Buffer.from(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }).d as string, "base64url").toString("hex");
const apiPub = derivePublicKeyHex(apiPriv);
const client = new StrikeClient({ baseUrl: BASE_URL });

const address = lower ? wallet.address.toLowerCase() : wallet.address;
const ch = await client.builderRequestSignature({ address, chain: "ethereum", code, feeShareBps: feeBps, publicKey: apiPub });
console.log("challenge ok; message starts:", JSON.stringify(ch.message_to_sign.slice(0, 60)));
let sig = await wallet.signMessage(ch.message_to_sign); // EIP-191, 0x + 130 hex
if (strip0x) sig = sig.slice(2);
console.log(`signature format: ${strip0x ? "no 0x" : "0x-prefixed"}, ${sig.length} chars`);
try {
  const v = await client.builderVerifySignature({ nonce: ch.nonce, walletSignature: sig });
  console.log("verify ->", JSON.stringify({ account_id: v.account_id, fee_share_bps: v.fee_share_bps, builder_code: v.builder_code }));
  mkdirSync("keys", { recursive: true });
  writeFileSync("keys/scripted-follower-evm.json", JSON.stringify({ address: wallet.address, apiPub, apiPriv, account_id: v.account_id }, null, 2), { mode: 0o600 });
} catch (e: any) {
  console.log("verify FAILED ->", e.status, e.strikeError);
  process.exit(1);
}
