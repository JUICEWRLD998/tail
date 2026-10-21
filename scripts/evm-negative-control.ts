// Negative control for the Builder Connect probes: a signature from the WRONG wallet must be rejected.
// If this ever "succeeds", the positive probe (scripted-follower-evm.ts) proves nothing.
import { generateKeyPairSync } from "node:crypto";
import { Wallet } from "ethers";
import { StrikeClient } from "../src/strike/client.js";
import { derivePublicKeyHex } from "../src/strike/sign.js";
import { BASE_URL, requireEnv } from "./env.js";

const code = requireEnv("BUILDER_CODE").BUILDER_CODE as string;
const client = new StrikeClient({ baseUrl: BASE_URL });
const priv = Buffer.from(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }).d as string, "base64url").toString("hex");
const ch = await client.builderRequestSignature({ address: Wallet.createRandom().address, chain: "ethereum", code, feeShareBps: 10, publicKey: derivePublicKeyHex(priv) });
const sig = await Wallet.createRandom().signMessage(ch.message_to_sign);
try {
  await client.builderVerifySignature({ nonce: ch.nonce, walletSignature: sig });
  console.log("BROKEN CONTROL: Strike accepted a signature from the wrong wallet");
  process.exit(1);
} catch (e: any) {
  console.log(`wrong signer rejected -> ${e.status} ${e.strikeError}`);
}
