// Encryption at rest for API-wallet private keys: AES-256-GCM with the TAIL_KEK key-encryption key.
// Blob format: v1:<iv b64>:<tag b64>:<ciphertext b64>. Plaintext is never logged or returned by any route.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

export function loadKek(b64: string | undefined): Buffer {
  const key = b64 ? Buffer.from(b64, "base64") : Buffer.alloc(0);
  if (key.length !== 32) throw new Error("TAIL_KEK must be 32 bytes, base64-encoded");
  return key;
}

export function encryptSecret(kek: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(kek: Buffer, blob: string): string {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("unrecognised secret format");
  const [, iv, tag, ct] = parts as [string, string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", kek, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
