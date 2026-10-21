// Ed25519 request signing for Strike API wallets.
// Scheme: docs.strikefinance.org/api/getting-started.md (VERIFIED, doc).
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function seedFromHex(privateKeyHex: string): Buffer {
  if (!/^(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{128})$/.test(privateKeyHex)) {
    throw new Error("private key must be 64 or 128 hex characters");
  }
  // 128 hex = seed followed by public key; the seed is the first 32 bytes.
  return Buffer.from(privateKeyHex.slice(0, 64), "hex");
}

function privateKeyObject(privateKeyHex: string): KeyObject {
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, seedFromHex(privateKeyHex)]),
    format: "der",
    type: "pkcs8",
  });
}

export function derivePublicKeyHex(privateKeyHex: string): string {
  const jwk = createPublicKey(privateKeyObject(privateKeyHex)).export({ format: "jwk" });
  return Buffer.from(jwk.x as string, "base64url").toString("hex");
}

export function signMessage(privateKeyHex: string, message: string): string {
  return sign(null, Buffer.from(message), privateKeyObject(privateKeyHex)).toString("hex");
}

/** sha256 hex of the exact body string sent; of the empty string when there is no body. */
export function bodyHash(body: string | undefined): string {
  return createHash("sha256").update(body ?? "").digest("hex");
}

export interface SigningInput {
  method: string;
  /** Path including the query string. */
  path: string;
  /** The exact string that will be sent as the request body. */
  body?: string | undefined;
  timestamp: number;
  nonce: string;
}

export function signingMessage(i: SigningInput): string {
  return `${i.method.toUpperCase()}:${i.path}:${i.timestamp}:${i.nonce}:${bodyHash(i.body)}`;
}

export interface SignRequestInput {
  privateKeyHex: string;
  method: string;
  path: string;
  body?: string | undefined;
  /** Unix seconds. Defaults to now. Pass a clock-corrected value when the local clock drifts. */
  timestamp?: number;
  nonce?: string;
}

export function signRequest(i: SignRequestInput): Record<string, string> {
  const timestamp = i.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = i.nonce ?? randomUUID();
  const message = signingMessage({ method: i.method, path: i.path, body: i.body, timestamp, nonce });
  return {
    "X-API-Wallet-Public-Key": derivePublicKeyHex(i.privateKeyHex),
    "X-API-Wallet-Signature": signMessage(i.privateKeyHex, message),
    "X-API-Wallet-Timestamp": String(timestamp),
    "X-API-Wallet-Nonce": nonce,
  };
}
