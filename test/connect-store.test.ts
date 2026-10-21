import { describe, expect, it } from "vitest";
import { openStore } from "../src/db/store.js";

const T0 = "2026-10-21T12:00:00.000Z";
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString();

describe("connect tokens", () => {
  it("creates an unguessable url-safe token", () => {
    const s = openStore(":memory:");
    const t = s.createConnectToken(111, T0);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 100 }, () => s.createConnectToken(1, T0))).size).toBe(100);
  });

  it("peek reads the owner without consuming the token", () => {
    const s = openStore(":memory:");
    const t = s.createConnectToken(111, T0);
    expect(s.peekConnectToken(t, at(1))).toBe(111);
    expect(s.peekConnectToken(t, at(2))).toBe(111);
  });

  it("is single use", () => {
    const s = openStore(":memory:");
    const t = s.createConnectToken(111, T0);
    expect(s.consumeConnectToken(t, at(1))).toBe(111);
    expect(s.consumeConnectToken(t, at(2))).toBeUndefined();
    expect(s.peekConnectToken(t, at(2))).toBeUndefined();
  });

  it("expires after 10 minutes", () => {
    const s = openStore(":memory:");
    const t = s.createConnectToken(111, T0);
    expect(s.peekConnectToken(t, at(9))).toBe(111);
    expect(s.peekConnectToken(t, at(11))).toBeUndefined();
    expect(s.consumeConnectToken(t, at(11))).toBeUndefined();
  });

  it("rejects unknown and malformed tokens", () => {
    const s = openStore(":memory:");
    for (const bad of ["", "nope", "x".repeat(43), "'; DROP TABLE users;--"]) {
      expect(s.peekConnectToken(bad, at(1))).toBeUndefined();
      expect(s.consumeConnectToken(bad, at(1))).toBeUndefined();
    }
  });

  it("a new token for the same user retires the older unused one", () => {
    const s = openStore(":memory:");
    const a = s.createConnectToken(111, T0);
    const b = s.createConnectToken(111, at(1));
    expect(s.peekConnectToken(a, at(2))).toBeUndefined();
    expect(s.peekConnectToken(b, at(2))).toBe(111);
  });

  it("does not retire another user's token", () => {
    const s = openStore(":memory:");
    const a = s.createConnectToken(111, T0);
    s.createConnectToken(222, at(1));
    expect(s.peekConnectToken(a, at(2))).toBe(111);
  });
});

describe("pending connects (the API key waiting for the wallet signature)", () => {
  const pending = (over = {}) => ({
    nonce: "n-1", token: "tok", tgId: 111, address: "0xabc", chain: "ethereum", apiPub: "pub", apiPrivEnc: "v1:a:b:c", createdAt: T0, ...over,
  });

  it("is returned once, only for the same token and before it expires", () => {
    const s = openStore(":memory:");
    s.savePending(pending());
    expect(s.takePending("n-1", "other", at(1))).toBeUndefined();
    expect(s.takePending("n-1", "tok", at(1))).toMatchObject({ tgId: 111, address: "0xabc", apiPrivEnc: "v1:a:b:c" });
    expect(s.takePending("n-1", "tok", at(1))).toBeUndefined();
  });

  it("expires after 5 minutes, matching Strike's nonce lifetime", () => {
    const s = openStore(":memory:");
    s.savePending(pending());
    expect(s.takePending("n-1", "tok", at(6))).toBeUndefined();
  });

  it("a wrong-token attempt does not burn the pending record", () => {
    const s = openStore(":memory:");
    s.savePending(pending());
    s.takePending("n-1", "other", at(1));
    expect(s.takePending("n-1", "tok", at(2))).toBeDefined();
  });
});
