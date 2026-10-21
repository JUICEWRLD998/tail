// Bech32 (BIP-173) without the 90-character limit, which Cardano addresses exceed (CIP-19).
import { bytesToHex, hexToBytes } from "./hex.js";

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i] as number;
  }
  return chk >>> 0;
}

const hrpExpand = (hrp: string): number[] => [...Array.from(hrp, (c) => c.charCodeAt(0) >> 5), 0, ...Array.from(hrp, (c) => c.charCodeAt(0) & 31)];

/** 8-bit bytes to 5-bit words, padding the tail with zero bits. */
export function toWords(data: Uint8Array): number[] {
  let acc = 0, bits = 0;
  const out: number[] = [];
  for (const b of data) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((acc >> bits) & 31);
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out.push((acc << (5 - bits)) & 31);
  return out;
}

export function bech32Encode(hrp: string, words: number[]): string {
  const check = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (check >>> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...checksum].map((w) => CHARSET[w]).join("")}`;
}

export function bech32Decode(s: string): { hrp: string; words: number[] } {
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) throw new Error("bech32: mixed case");
  const str = s.toLowerCase();
  const sep = str.lastIndexOf("1");
  if (sep < 1 || sep + 7 > str.length) throw new Error("bech32: bad separator position");
  const hrp = str.slice(0, sep);
  for (const c of hrp) if (c.charCodeAt(0) < 33 || c.charCodeAt(0) > 126) throw new Error("bech32: bad prefix character");
  const data = Array.from(str.slice(sep + 1), (c) => {
    const v = CHARSET.indexOf(c);
    if (v < 0) throw new Error("bech32: bad data character");
    return v;
  });
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error("bech32: bad checksum");
  return { hrp, words: data.slice(0, -6) };
}

/** CIP-30 wallets return addresses as hex; Strike's Builder Connect wants the bech32 form. network 0 = testnet, 1 = mainnet. */
export function cardanoAddressFromHex(hex: string, networkId: number): string {
  if (networkId !== 0 && networkId !== 1) throw new Error("unknown Cardano network id");
  const bytes = hexToBytes(hex);
  if (bytes.length === 0) throw new Error("empty address");
  return bech32Encode(networkId === 0 ? "addr_test" : "addr", toWords(bytes));
}

export { bytesToHex };
