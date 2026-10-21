// Spike E: Builder Connect without a browser. A throwaway Solana keypair plays the follower's wallet.
// Flow (VERIFIED, docs.strikefinance.org/api/builder-codes/builder-connect.md):
//   POST /auth/builder/request-signature -> { nonce, message_to_sign }
//   wallet signs message_to_sign (Ed25519, base58) -> POST /auth/builder/verify-signature
// Testnet only. The new API-wallet private key is written to keys/ (git-ignored) and never printed.
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { base58Encode } from "../src/strike/base58.js";
import { derivePublicKeyHex } from "../src/strike/sign.js";
import { BASE_URL, requireEnv } from "./env.js";

const { BUILDER_CODE } = requireEnv("BUILDER_CODE");
const feeBps = Number(process.env.BUILDER_FEE_BPS ?? "10");

// The follower's Solana wallet (throwaway).
const wallet = generateKeyPairSync("ed25519");
const walletPub = Buffer.from(wallet.publicKey.export({ format: "jwk" }).x as string, "base64url");
const address = base58Encode(walletPub);

// The API wallet Tail will trade with.
const api = generateKeyPairSync("ed25519");
const apiPriv = Buffer.from(api.privateKey.export({ format: "jwk" }).d as string, "base64url").toString("hex");
const apiPub = derivePublicKeyHex(apiPriv);

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: text };
  }
}

const req = await post("/auth/builder/request-signature", {
  address,
  chain: "solana",
  code: BUILDER_CODE,
  fee_share_bps: feeBps,
  public_key: apiPub,
});
console.log("request-signature ->", req.status, JSON.stringify(req.json));
if (req.status !== 200) process.exit(1);

const message: string = req.json.message_to_sign;
const walletSig = base58Encode(sign(null, Buffer.from(message), wallet.privateKey));
const ver = await post("/auth/builder/verify-signature", { nonce: req.json.nonce, wallet_signature: walletSig });
console.log("verify-signature ->", ver.status, JSON.stringify(ver.json));
if (ver.status !== 200) process.exit(1);

mkdirSync("keys", { recursive: true });
writeFileSync(
  "keys/scripted-follower.json",
  JSON.stringify({ address, chain: "solana", apiPub, apiPriv, account_id: ver.json.account_id }, null, 2),
  { mode: 0o600 },
);
console.log(`linked. account_id=${ver.json.account_id}; API key saved to keys/scripted-follower.json (git-ignored)`);
