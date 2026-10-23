import { describe, expect, it } from "vitest";
import { base58Decode } from "../../src/strike/base58.js";
import { bech32Decode } from "../../web/src/lib/bech32.js";
import { connectWallet, detectWallets, friendlyWalletError, WalletError } from "../../web/src/wallets/index.js";

const ETH = "0x0c3ad0348879998c97106feb1d0ae9406a6a741d";
const SIG = "0x" + "ab".repeat(65);
const MESSAGE = 'Connect to Strike via builder "sigma".\nWallet: x';

function evmStub(over: Record<string, unknown> = {}) {
  const calls: { method: string; params?: unknown[] }[] = [];
  return {
    calls,
    isMetaMask: true,
    request: async (r: { method: string; params?: unknown[] }) => {
      calls.push(r);
      if (r.method === "eth_requestAccounts") return [ETH];
      if (r.method === "personal_sign") return SIG;
      throw new Error("unexpected " + r.method);
    },
    ...over,
  };
}

describe("detectWallets", () => {
  it("finds nothing in an empty window", () => {
    expect(detectWallets({})).toEqual([]);
  });

  it("names MetaMask and Rabby from their flags", () => {
    expect(detectWallets({ ethereum: { isMetaMask: true, request: async () => [] } })).toEqual([{ id: "evm", label: "MetaMask", chain: "ethereum" }]);
    expect(detectWallets({ ethereum: { isRabby: true, request: async () => [] } })).toEqual([{ id: "evm", label: "Rabby", chain: "ethereum" }]);
    expect(detectWallets({ ethereum: { request: async () => [] } })[0]?.label).toBe("Ethereum wallet");
  });

  it("finds Phantom via window.phantom.solana or window.solana", () => {
    const p = { isPhantom: true, connect: async () => ({}), signMessage: async () => ({}) };
    expect(detectWallets({ phantom: { solana: p } })).toEqual([{ id: "phantom", label: "Phantom", chain: "solana" }]);
    expect(detectWallets({ solana: p })).toEqual([{ id: "phantom", label: "Phantom", chain: "solana" }]);
    expect(detectWallets({ solana: { isPhantom: false } })).toEqual([]);
  });

  it("lists every CIP-30 wallet that can enable, under its own name", () => {
    const w = { cardano: { lace: { name: "Lace", enable: async () => ({}) }, eternl: { name: "Eternl", enable: async () => ({}) }, junk: { name: "No enable" }, flint: "nope" } };
    expect(detectWallets(w as never)).toEqual([
      { id: "cardano:lace", label: "Lace", chain: "cardano" },
      { id: "cardano:eternl", label: "Eternl", chain: "cardano" },
    ]);
  });
});

describe("EVM (MetaMask, Rabby): EIP-191 personal_sign", () => {
  it("connects, then signs the message as 0x-hex UTF-8 with the account address", async () => {
    const eth = evmStub();
    const c = await connectWallet({ ethereum: eth }, "evm");
    expect(c).toMatchObject({ address: ETH, chain: "ethereum" });
    expect(await c.sign(MESSAGE)).toBe(SIG);
    const sign = eth.calls.find((x) => x.method === "personal_sign")!;
    expect(sign.params).toEqual(["0x" + Buffer.from(MESSAGE, "utf8").toString("hex"), ETH]);
  });

  describe("choosing which account to connect (the site stays connected to the first account otherwise)", () => {
    const ETH2 = "0x1111111111111111111111111111111111111111";

    it("asks the wallet to show its account chooser, then reads the chosen account", async () => {
      const calls: string[] = [];
      let chosen = ETH;
      const eth = evmStub({
        request: async (r: { method: string }) => {
          calls.push(r.method);
          if (r.method === "wallet_requestPermissions") { chosen = ETH2; return [{ parentCapability: "eth_accounts" }]; }
          if (r.method === "eth_requestAccounts") return [chosen];
          throw new Error("unexpected " + r.method);
        },
      });
      const c = await connectWallet({ ethereum: eth }, "evm");
      expect(calls).toEqual(["wallet_requestPermissions", "eth_requestAccounts"]);
      expect(c.address).toBe(ETH2);
    });

    it("sends the account-permissions request first, with eth_accounts", async () => {
      const eth = evmStub();
      const orig = eth.request;
      eth.request = async (r: { method: string; params?: unknown[] }) => (r.method === "wallet_requestPermissions" ? [] : orig(r));
      await connectWallet({ ethereum: eth }, "evm");
      expect(eth.calls.find((x) => x.method === "wallet_requestPermissions")?.params).toEqual([{ eth_accounts: {} }]);
    });

    it.each([[-32601], [4200], [-32602]])("falls back to the plain connect when the wallet does not support the chooser (code %i)", async (code) => {
      const eth = evmStub({
        request: async (r: { method: string }) => {
          if (r.method === "wallet_requestPermissions") throw Object.assign(new Error("nope"), { code });
          if (r.method === "eth_requestAccounts") return [ETH];
          throw new Error("unexpected " + r.method);
        },
      });
      expect((await connectWallet({ ethereum: eth }, "evm")).address).toBe(ETH);
    });

    it("a refusal in the chooser is a refusal: it does not fall through to connecting anyway", async () => {
      const calls: string[] = [];
      const eth = evmStub({
        request: async (r: { method: string }) => {
          calls.push(r.method);
          throw Object.assign(new Error("User rejected the request."), { code: 4001 });
        },
      });
      await expect(connectWallet({ ethereum: eth }, "evm")).rejects.toMatchObject({ code: 4001 });
      expect(calls).toEqual(["wallet_requestPermissions"]);
    });
  });

  it("rejects a signature that is not 65 bytes of hex", async () => {
    const c = await connectWallet({ ethereum: evmStub({ request: async (r: { method: string }) => (r.method === "eth_requestAccounts" ? [ETH] : "0x1234") }) }, "evm");
    await expect(c.sign(MESSAGE)).rejects.toThrow(/signature/);
  });

  it("fails clearly when the wallet returns no account", async () => {
    await expect(connectWallet({ ethereum: evmStub({ request: async () => [] }) }, "evm")).rejects.toThrow(/account/);
  });
});

describe("Solana (Phantom)", () => {
  const sigBytes = Uint8Array.from({ length: 64 }, (_, i) => i + 1);
  const phantom = (over = {}) => ({
    isPhantom: true,
    connect: async () => ({ publicKey: { toString: () => "8jZGYMi1UmQRdmCvfLpSFEyDiv6NBzL8CNQR95GkB1dZ" } }),
    signMessage: async (bytes: Uint8Array) => ({ signature: sigBytes, signedBytes: bytes }),
    ...over,
  });

  it("connects and returns the signature base58-encoded", async () => {
    const c = await connectWallet({ phantom: { solana: phantom() } }, "phantom");
    expect(c).toMatchObject({ address: "8jZGYMi1UmQRdmCvfLpSFEyDiv6NBzL8CNQR95GkB1dZ", chain: "solana" });
    const sig = await c.sign(MESSAGE);
    expect(Array.from(base58Decode(sig))).toEqual(Array.from(sigBytes));
  });

  it("signs the exact UTF-8 bytes of the message", async () => {
    let seen: Uint8Array | undefined;
    const c = await connectWallet({ phantom: { solana: phantom({ signMessage: async (b: Uint8Array) => ((seen = b), { signature: sigBytes }) }) } }, "phantom");
    await c.sign(MESSAGE);
    expect(new TextDecoder().decode(seen)).toBe(MESSAGE);
  });
});

describe("Cardano (CIP-30)", () => {
  const addrHex = "00" + "94".repeat(28) + "ab".repeat(28);
  const api = (networkId: number, over = {}) => ({
    getNetworkId: async () => networkId,
    getUsedAddresses: async () => [addrHex],
    getUnusedAddresses: async () => [],
    getChangeAddress: async () => addrHex,
    signData: async (addr: string, payload: string) => ({ signature: "845846a2" + payload.length, key: "a4010103272006" }),
    ...over,
  });
  const win = (a: unknown) => ({ cardano: { lace: { name: "Lace", enable: async () => a } } });

  it("converts the hex address to bech32 for the wallet's network and signs the hex payload", async () => {
    const c = await connectWallet(win(api(0)) as never, "cardano:lace");
    expect(c.chain).toBe("cardano");
    expect(c.address.startsWith("addr_test1")).toBe(true);
    expect(bech32Decode(c.address).hrp).toBe("addr_test");
    const sig = await c.sign("hi");
    expect(sig).toBe("845846a24:a4010103272006"); // signature:key, payload "6869" is 4 hex chars
  });

  it("uses the mainnet prefix on network id 1", async () => {
    const c = await connectWallet(win(api(1)) as never, "cardano:lace");
    expect(c.address.startsWith("addr1")).toBe(true);
  });

  it("falls back to an unused address when none are used yet", async () => {
    const c = await connectWallet(win(api(0, { getUsedAddresses: async () => [], getUnusedAddresses: async () => [addrHex] })) as never, "cardano:lace");
    expect(c.address.startsWith("addr_test1")).toBe(true);
  });

  it("passes the address and the hex payload to signData", async () => {
    let args: unknown[] = [];
    const c = await connectWallet(win(api(0, { signData: async (...a: unknown[]) => ((args = a), { signature: "aa", key: "bb" }) })) as never, "cardano:lace");
    await c.sign("hi");
    expect(args).toEqual([addrHex, "6869"]);
  });
});

describe("errors", () => {
  it("rejects an unknown wallet id", async () => {
    await expect(connectWallet({}, "evm")).rejects.toThrow(/not available/);
    await expect(connectWallet({}, "nope")).rejects.toThrow(/not available/);
  });

  it.each([
    [{ code: 4001, message: "User rejected the request." }],
    [{ code: -32603, message: "User denied message signature" }],
    [new Error("User declined to sign")],
    [{ message: "Request rejected" }],
    [{ code: 2, info: "user declined" }],
  ])("maps a wallet refusal %j to a plain message", (e) => {
    const w = friendlyWalletError(e);
    expect(w).toBeInstanceOf(WalletError);
    expect(w.message).toBe("You closed the wallet prompt. Try again when you are ready.");
  });

  it("maps anything else to a generic wallet message without leaking the raw error", () => {
    expect(friendlyWalletError(new Error("rpc node 10.0.0.5 timed out")).message).toBe("The wallet did not complete the request. Try again.");
  });
});
