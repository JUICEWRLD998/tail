// Wallet adapters. Each returns the address and signature in the exact form Strike's Builder Connect wants:
//   Ethereum  EIP-191 personal_sign, 0x-hex          (VERIFIED live with a scripted wallet; MetaMask uses the same call)
//   Solana    Ed25519 over the UTF-8 message, base58 (VERIFIED live, scripts/scripted-follower.ts)
//   Cardano   CIP-30 signData, "{signature}:{key}"   (UNVERIFIED: needs a real Cardano wallet)
import { base58Encode } from "../../../src/strike/base58.js";
import { bytesToHex, cardanoAddressFromHex } from "../lib/bech32.js";
import { utf8ToHex } from "../lib/hex.js";
import { WalletError, type Connected, type WalletOption, type WindowLike } from "./types.js";

export { WalletError, type Connected, type WalletOption, type WindowLike } from "./types.js";

const REFUSED = "You closed the wallet prompt. Try again when you are ready.";
const FAILED = "The wallet did not complete the request. Try again.";

/** Wallets report a refusal in many shapes; show one plain message and never echo the raw error. */
export function friendlyWalletError(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const err = e as { code?: number; message?: string; info?: string } | null;
  const text = `${err?.message ?? ""} ${err?.info ?? ""}`.toLowerCase();
  if (err?.code === 4001 || err?.code === 2 || /reject|denied|declin|cancel/.test(text)) return new WalletError(REFUSED);
  return new WalletError(FAILED);
}

const phantomOf = (w: WindowLike) => {
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : undefined;
};

const cardanoWallets = (w: WindowLike): { key: string; name: string; enable: () => Promise<any> }[] =>
  Object.entries(w.cardano ?? {}).flatMap(([key, v]: [string, any]) =>
    v && typeof v === "object" && typeof v.enable === "function" && typeof v.name === "string" ? [{ key, name: v.name as string, enable: () => v.enable() }] : [],
  );

export function detectWallets(w: WindowLike): WalletOption[] {
  const out: WalletOption[] = [];
  if (w.ethereum && typeof w.ethereum.request === "function") {
    out.push({ id: "evm", label: w.ethereum.isMetaMask ? "MetaMask" : w.ethereum.isRabby ? "Rabby" : "Ethereum wallet", chain: "ethereum" });
  }
  if (phantomOf(w)) out.push({ id: "phantom", label: "Phantom", chain: "solana" });
  for (const c of cardanoWallets(w)) out.push({ id: `cardano:${c.key}`, label: c.name, chain: "cardano" });
  return out;
}

async function connectEvm(w: WindowLike): Promise<Connected> {
  const eth = w.ethereum;
  // A site stays connected to the account it was first given, and switching account in the wallet does not change that.
  // Ask the wallet to show its account chooser first so the user picks the account on purpose. A wallet that does not
  // support the request falls back to the plain connect; a refusal (4001) is a refusal and stops here.
  try {
    await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
  } catch (e) {
    if ((e as { code?: number })?.code === 4001) throw e;
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0];
  if (!address) throw new WalletError("The wallet did not share an account.");
  return {
    chain: "ethereum",
    address,
    sign: async (message) => {
      const sig = (await eth.request({ method: "personal_sign", params: [`0x${utf8ToHex(message)}`, address] })) as string;
      if (!/^0x[0-9a-fA-F]{130}$/.test(sig)) throw new WalletError("The wallet returned an unexpected signature.");
      return sig;
    },
  };
}

async function connectPhantom(w: WindowLike): Promise<Connected> {
  const p = phantomOf(w);
  const resp = await p.connect();
  const address = resp?.publicKey?.toString?.() as string | undefined;
  if (!address) throw new WalletError("The wallet did not share an account.");
  return {
    chain: "solana",
    address,
    sign: async (message) => {
      const { signature } = await p.signMessage(new TextEncoder().encode(message), "utf8");
      return base58Encode(signature);
    },
  };
}

async function connectCardano(w: WindowLike, key: string): Promise<Connected> {
  const wallet = cardanoWallets(w).find((c) => c.key === key);
  if (!wallet) throw new WalletError("That wallet is not available in this browser.");
  const api = await wallet.enable();
  const networkId = (await api.getNetworkId()) as number;
  const addrHex: string | undefined =
    (await api.getUsedAddresses())?.[0] ?? (await api.getUnusedAddresses?.())?.[0] ?? (await api.getChangeAddress?.());
  if (!addrHex) throw new WalletError("The wallet did not share an address.");
  return {
    chain: "cardano",
    address: cardanoAddressFromHex(addrHex, networkId),
    sign: async (message) => {
      const res = (await api.signData(addrHex, utf8ToHex(message))) as { signature: string; key: string };
      return `${res.signature}:${res.key}`;
    },
  };
}

export async function connectWallet(w: WindowLike, id: string): Promise<Connected> {
  const known = detectWallets(w).some((o) => o.id === id);
  if (!known) throw new WalletError("That wallet is not available in this browser.");
  if (id === "evm") return connectEvm(w);
  if (id === "phantom") return connectPhantom(w);
  return connectCardano(w, id.slice("cardano:".length));
}

export { bytesToHex };
