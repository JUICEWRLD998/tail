// The connect sequence, free of React so every branch is testable:
//   wallet connect -> server challenge -> wallet signs -> server verifies with Strike.
import type { ConnectApi } from "../lib/api.js";
import { connectWallet, friendlyWalletError, type WindowLike } from "../wallets/index.js";

export type { ConnectApi } from "../lib/api.js";
export type Step = "connecting" | "signing" | "linking";

export interface RunConnectInput {
  api: ConnectApi;
  win: WindowLike;
  token: string;
  walletId: string;
  onStep: (s: Step) => void;
}

export async function runConnect(i: RunConnectInput): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  try {
    i.onStep("connecting");
    const wallet = await connectWallet(i.win, i.walletId);
    const challenge = await i.api.challenge(i.token, { address: wallet.address, chain: wallet.chain });
    if (!challenge.ok) return challenge;

    i.onStep("signing");
    const signature = await wallet.sign(challenge.message);

    i.onStep("linking");
    return await i.api.complete(i.token, { nonce: challenge.nonce, signature });
  } catch (e) {
    // Wallet refusals and unexpected exceptions both end here; the raw error is never shown.
    return { ok: false, error: friendlyWalletError(e).message };
  }
}
