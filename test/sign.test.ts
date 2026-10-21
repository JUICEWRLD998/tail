import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bodyHash,
  derivePublicKeyHex,
  signMessage,
  signRequest,
  signingMessage,
} from "../src/strike/sign.js";

// RFC 8032 section 7.1, test 1 (empty message).
const RFC_SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const RFC_PUB = "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC_SIG =
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";

describe("Ed25519 primitive", () => {
  it("derives the RFC 8032 public key from the seed", () => {
    expect(derivePublicKeyHex(RFC_SEED)).toBe(RFC_PUB);
  });

  it("signs the RFC 8032 empty message to the published signature", () => {
    expect(signMessage(RFC_SEED, "")).toBe(RFC_SIG);
  });

  it("accepts a 128-hex expanded key and uses the first 32 bytes as the seed", () => {
    expect(derivePublicKeyHex(RFC_SEED + RFC_PUB)).toBe(RFC_PUB);
  });

  it("rejects a key of any other length", () => {
    expect(() => derivePublicKeyHex("abcd")).toThrow(/64 or 128 hex/);
    expect(() => derivePublicKeyHex("zz".repeat(32))).toThrow(/hex/);
  });
});

describe("body hash", () => {
  it("hashes an absent body as sha256 of the empty string", () => {
    expect(bodyHash(undefined)).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes the exact body string it is given", () => {
    const body = '{"symbol":"ADA-USD","size":"10"}';
    expect(bodyHash(body)).toBe(createHash("sha256").update(body).digest("hex"));
  });
});

describe("signing message", () => {
  it("is METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH with the method upper-cased", () => {
    expect(
      signingMessage({
        method: "get",
        path: "/v2/positions?symbol=ADA-USD",
        timestamp: 1704067200,
        nonce: "550e8400-e29b-41d4-a716-446655440000",
        body: undefined,
      }),
    ).toBe(
      "GET:/v2/positions?symbol=ADA-USD:1704067200:550e8400-e29b-41d4-a716-446655440000:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("signRequest", () => {
  const input = {
    privateKeyHex: RFC_SEED,
    method: "POST",
    path: "/v2/order/strategy",
    body: '{"a":1}',
    timestamp: 1704067200,
    nonce: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("returns the four headers, with the public key derived from the seed", () => {
    const h = signRequest(input);
    expect(h["X-API-Wallet-Public-Key"]).toBe(RFC_PUB);
    expect(h["X-API-Wallet-Timestamp"]).toBe("1704067200");
    expect(h["X-API-Wallet-Nonce"]).toBe(input.nonce);
    expect(h["X-API-Wallet-Signature"]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("is deterministic for the same input", () => {
    expect(signRequest(input)).toEqual(signRequest(input));
  });

  it("signs exactly the documented message", () => {
    const h = signRequest(input);
    expect(h["X-API-Wallet-Signature"]).toBe(signMessage(RFC_SEED, signingMessage(input)));
  });

  it("changes the signature when the body changes by one byte", () => {
    const a = signRequest(input)["X-API-Wallet-Signature"];
    const b = signRequest({ ...input, body: '{"a":2}' })["X-API-Wallet-Signature"];
    expect(a).not.toBe(b);
  });

  it("generates a fresh UUID nonce and current time when none are given", () => {
    const { nonce: _n, timestamp: _t, ...rest } = input;
    const h = signRequest(rest);
    expect(h["X-API-Wallet-Nonce"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(Math.abs(Number(h["X-API-Wallet-Timestamp"]) - Date.now() / 1000)).toBeLessThan(5);
  });
});
