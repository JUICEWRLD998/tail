// Prints a fresh Ed25519 API-wallet key pair as raw 32-byte hex.
// Register the PUBLIC key at testnet.strikefinance.org/api-keys. Keep the private half in the environment only.
import { generateKeyPairSync } from "node:crypto";
import { derivePublicKeyHex } from "../src/strike/sign.js";

const { privateKey } = generateKeyPairSync("ed25519");
const d = privateKey.export({ format: "jwk" }).d as string;
const priv = Buffer.from(d, "base64url").toString("hex");
const pub = derivePublicKeyHex(priv);

console.log(`SPIKE_API_PUB=${pub}`);
console.log(`SPIKE_API_PRIV=${priv}`);
console.error("\nRegister the public key at https://testnet.strikefinance.org/api-keys, then set both in the environment.");
console.error("Testnet keys only. The private key is printed once and never stored by this script.");
