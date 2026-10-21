export type Chain = "ethereum" | "solana" | "cardano";

export interface WalletOption {
  id: string;
  label: string;
  chain: Chain;
}

export interface Connected {
  chain: Chain;
  /** The address in the form Strike's Builder Connect expects for this chain. */
  address: string;
  /** Signs Strike's challenge text and returns the signature in Strike's per-chain wire format. */
  sign: (message: string) => Promise<string>;
}

/** The slice of `window` the adapters read. Typed loosely: injected wallets vary. */
export type WindowLike = Record<string, any>;

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}
