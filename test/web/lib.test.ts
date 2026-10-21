import { describe, expect, it } from "vitest";
import { bech32Decode, bech32Encode, cardanoAddressFromHex, toWords } from "../../web/src/lib/bech32.js";
import { bytesToHex, hexToBytes, utf8ToHex } from "../../web/src/lib/hex.js";

describe("hex helpers", () => {
  it("utf8ToHex encodes text, including multi-byte characters", () => {
    expect(utf8ToHex("hi")).toBe("6869");
    expect(utf8ToHex("é")).toBe("c3a9");
    expect(utf8ToHex("")).toBe("");
  });
  it("round-trips bytes", () => {
    const b = new Uint8Array([0, 1, 127, 128, 255]);
    expect(bytesToHex(b)).toBe("00017f80ff");
    expect(Array.from(hexToBytes("00017f80ff"))).toEqual(Array.from(b));
  });
  it("accepts upper-case hex and rejects odd length or non-hex", () => {
    expect(Array.from(hexToBytes("FF0a"))).toEqual([255, 10]);
    expect(() => hexToBytes("abc")).toThrow(/hex/);
    expect(() => hexToBytes("zz")).toThrow(/hex/);
  });
});

describe("bech32 (BIP-173)", () => {
  it("encodes the official segwit v0 example", () => {
    const program = hexToBytes("751e76e8199196d454941c45d1b3a323f1433bd6");
    expect(bech32Encode("bc", [0, ...toWords(program)])).toBe("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });

  it.each([
    "A12UEL5L",
    "a12uel5l",
    "an83characterlonghumanreadablepartthatcontainsthenumber1andtheexcludedcharactersbio1tt5tgs",
    "abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw",
    "split1checkupstagehandshakeupstreamerranterredcaperred2y9e3w",
  ])("decodes the official valid vector %s and re-encodes it identically", (s) => {
    const d = bech32Decode(s);
    expect(bech32Encode(d.hrp, d.words)).toBe(s.toLowerCase());
  });

  it.each([
    "pzry9x0s0muk",
    "x1b4n0q5v",
    "li1dgmt3",
    "A1G7SGD8",
    "10a06t8",
    "1qzzfhee",
    "a12UEL5L", // mixed case
    "abcdef1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxX", // bad checksum
  ])("rejects the invalid string %s", (s) => {
    expect(() => bech32Decode(s)).toThrow();
  });

  it("is not limited to 90 characters, because Cardano addresses are longer", () => {
    const data = new Uint8Array(57).map((_, i) => (i * 7) % 256);
    const s = bech32Encode("addr", toWords(data));
    expect(s.length).toBeGreaterThan(90);
    expect(bech32Decode(s).hrp).toBe("addr");
  });
});

describe("cardanoAddressFromHex (CIP-30 gives hex, Strike wants bech32)", () => {
  const hex = "00" + "94".repeat(28) + "ab".repeat(28); // header 0x00 + two 28-byte hashes
  it("uses the addr_test prefix on testnet (network id 0) and addr on mainnet (1)", () => {
    expect(cardanoAddressFromHex(hex, 0).startsWith("addr_test1")).toBe(true);
    expect(cardanoAddressFromHex(hex, 1).startsWith("addr1")).toBe(true);
  });
  it("round-trips the bytes through 5-bit words", () => {
    const d = bech32Decode(cardanoAddressFromHex(hex, 1));
    expect(bytesToHex(fromWordsStrict(d.words))).toBe(hex);
  });
  it("rejects an unknown network id and an empty address", () => {
    expect(() => cardanoAddressFromHex(hex, 2)).toThrow(/network/);
    expect(() => cardanoAddressFromHex("", 0)).toThrow();
  });
});

function fromWordsStrict(words: number[]): Uint8Array {
  let acc = 0, bits = 0;
  const out: number[] = [];
  for (const w of words) {
    acc = (acc << 5) | w;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
    acc &= (1 << bits) - 1;
  }
  return Uint8Array.from(out);
}
