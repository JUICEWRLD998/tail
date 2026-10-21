import { describe, expect, it } from "vitest";
import { base58Decode, base58Encode } from "../src/strike/base58.js";

describe("base58 (Bitcoin alphabet, as Solana uses)", () => {
  it.each([
    ["", ""],
    ["48656c6c6f20576f726c6421", "2NEpo7TZRRrLZSi2U"], // "Hello World!"
    ["00", "1"],
    ["000001", "112"],
    ["61", "2g"], // "a"
    ["626262", "a3gV"], // "bbb"
  ])("encodes %s", (hex, b58) => {
    expect(base58Encode(Buffer.from(hex, "hex"))).toBe(b58);
  });

  it("round-trips random bytes including leading zeros", () => {
    let seed = 5;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 200; i++) {
      const len = Math.floor(rnd() * 70);
      const bytes = Buffer.from(Array.from({ length: len }, () => (rnd() < 0.2 ? 0 : Math.floor(rnd() * 256))));
      expect(Buffer.from(base58Decode(base58Encode(bytes))).equals(bytes)).toBe(true);
    }
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => base58Decode("0OIl")).toThrow(/base58/);
  });
});
