// Does a builder code exist on Strike? There is no lookup endpoint, so ask for a connect challenge under the code with a
// throwaway Solana address and key: Strike answers 404 "builder code not found" for an unknown code (VERIFIED live,
// testnet, 2026-10-22). The challenge is never signed and expires on its own. A real code is accepted at any rate 0-100,
// so this proves the code exists, not which rate its owner registered.
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { base58Encode } from "./base58.js";
import { StrikeError, type StrikeClient } from "./client.js";
import { derivePublicKeyHex } from "./sign.js";

export async function checkBuilderCode(
  strike: Pick<StrikeClient, "builderRequestSignature">, code: string, feeBps: number,
): Promise<"ok" | "unknown" | "unreachable"> {
  const priv = Buffer.from(generateKeyPairSync("ed25519").privateKey.export({ format: "jwk" }).d as string, "base64url").toString("hex");
  try {
    await strike.builderRequestSignature({
      address: base58Encode(randomBytes(32)), chain: "solana", code, feeShareBps: feeBps, publicKey: derivePublicKeyHex(priv),
    });
    return "ok";
  } catch (e) {
    return e instanceof StrikeError && e.status === 404 ? "unknown" : "unreachable";
  }
}
