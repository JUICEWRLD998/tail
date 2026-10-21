import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, loadKek } from "../src/db/crypto.js";

const kek = randomBytes(32);
const SECRET = "ab".repeat(32);

describe("loadKek", () => {
  it("accepts 32 bytes of base64", () => {
    expect(loadKek(kek.toString("base64"))).toEqual(kek);
  });
  it.each([undefined, "", "short", Buffer.alloc(16).toString("base64"), Buffer.alloc(33).toString("base64")])(
    "rejects %s",
    (bad) => expect(() => loadKek(bad)).toThrow(/TAIL_KEK/),
  );
});

describe("encryptSecret / decryptSecret (AES-256-GCM)", () => {
  it("round-trips", () => {
    expect(decryptSecret(kek, encryptSecret(kek, SECRET))).toBe(SECRET);
  });

  it("does not contain the plaintext", () => {
    const blob = encryptSecret(kek, SECRET);
    expect(blob).not.toContain(SECRET);
    expect(Buffer.from(blob.split(":")[3] as string, "base64").toString("hex")).not.toContain(SECRET.slice(0, 16));
  });

  it("uses a fresh nonce each time", () => {
    expect(encryptSecret(kek, SECRET)).not.toBe(encryptSecret(kek, SECRET));
  });

  it("fails with a different key", () => {
    expect(() => decryptSecret(randomBytes(32), encryptSecret(kek, SECRET))).toThrow();
  });

  it("fails when the ciphertext is altered by one byte", () => {
    const [v, iv, tag, ct] = encryptSecret(kek, SECRET).split(":") as [string, string, string, string];
    const raw = Buffer.from(ct, "base64");
    raw[0] = (raw[0] as number) ^ 1;
    expect(() => decryptSecret(kek, [v, iv, tag, raw.toString("base64")].join(":"))).toThrow();
  });

  it("fails when the tag is altered", () => {
    const [v, iv, tag, ct] = encryptSecret(kek, SECRET).split(":") as [string, string, string, string];
    const raw = Buffer.from(tag, "base64");
    raw[0] = (raw[0] as number) ^ 1;
    expect(() => decryptSecret(kek, [v, iv, raw.toString("base64"), ct].join(":"))).toThrow();
  });

  it("rejects an unknown version or malformed blob", () => {
    expect(() => decryptSecret(kek, "v9:a:b:c")).toThrow(/format/);
    expect(() => decryptSecret(kek, "garbage")).toThrow(/format/);
  });
});
