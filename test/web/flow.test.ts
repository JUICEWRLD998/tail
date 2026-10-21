import { describe, expect, it } from "vitest";
import { createApi } from "../../web/src/lib/api.js";
import { runConnect, type ConnectApi, type Step } from "../../web/src/connect/flow.js";

describe("api client", () => {
  const mk = (handler: (url: string, init: RequestInit) => { status: number; body: unknown } | Error) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const r = handler(url, init);
      if (r instanceof Error) throw r;
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    return { api: createApi(fetchFn), calls };
  };

  it("reads info for a token", async () => {
    const { api, calls } = mk(() => ({ status: 200, body: { ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum"] } }));
    expect(await api.info("tok")).toEqual({ ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum"] });
    expect(calls[0]?.url).toBe("/api/connect/tok");
  });

  it("posts a challenge as JSON and returns the nonce and message", async () => {
    const { api, calls } = mk(() => ({ status: 200, body: { ok: true, nonce: "n", message: "m" } }));
    expect(await api.challenge("tok", { address: "0xabc", chain: "ethereum" })).toEqual({ ok: true, nonce: "n", message: "m" });
    expect(calls[0]?.url).toBe("/api/connect/tok/challenge");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ address: "0xabc", chain: "ethereum" });
    expect((calls[0]?.init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("returns the server's plain error message on a 4xx", async () => {
    const { api } = mk(() => ({ status: 400, body: { ok: false, error: "That request expired. Reload the page and try again." } }));
    expect(await api.complete("tok", { nonce: "n", signature: "s" })).toEqual({ ok: false, error: "That request expired. Reload the page and try again." });
  });

  it("turns a network failure or a non-JSON error into a generic message", async () => {
    const { api } = mk(() => new Error("fetch failed: ECONNREFUSED 10.0.0.2"));
    expect(await api.info("tok")).toEqual({ ok: false, error: "Could not reach Tail. Check your connection and try again." });
    const bad = createApi((async () => new Response("<html>502</html>", { status: 502 })) as unknown as typeof fetch);
    expect(await bad.info("tok")).toEqual({ ok: false, error: "Could not reach Tail. Check your connection and try again." });
  });

  it("encodes the token into the path", async () => {
    const { api, calls } = mk(() => ({ status: 200, body: { ok: true } }));
    await api.info("a/b?c");
    expect(calls[0]?.url).toBe("/api/connect/a%2Fb%3Fc");
  });
});

describe("runConnect", () => {
  const ETH = "0x0c3ad0348879998c97106feb1d0ae9406a6a741d";
  const stubWindow = (over: { sign?: () => Promise<string>; accounts?: string[] } = {}) => ({
    ethereum: {
      isMetaMask: true,
      request: async (r: { method: string }) => {
        if (r.method === "eth_requestAccounts") return over.accounts ?? [ETH];
        if (r.method === "personal_sign") return over.sign ? over.sign() : "0x" + "ab".repeat(65);
        throw new Error("unexpected");
      },
    },
  });

  function api(over: Partial<ConnectApi> = {}): ConnectApi & { seen: unknown[] } {
    const seen: unknown[] = [];
    return {
      seen,
      info: async () => ({ ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum"] }),
      challenge: async (t: string, b: unknown) => (seen.push(["challenge", t, b]), { ok: true, nonce: "n1", message: "Sign this" }),
      complete: async (t: string, b: unknown) => (seen.push(["complete", t, b]), { ok: true, address: "0x0c3a…741d" }),
      ...over,
    } as never;
  }

  it("runs connect, challenge, sign, link in order and reports each step", async () => {
    const steps: Step[] = [];
    const a = api();
    const r = await runConnect({ api: a, win: stubWindow(), token: "tok", walletId: "evm", onStep: (s) => steps.push(s) });
    expect(r).toEqual({ ok: true, address: "0x0c3a…741d" });
    expect(steps).toEqual(["connecting", "signing", "linking"]);
    expect(a.seen).toEqual([
      ["challenge", "tok", { address: ETH, chain: "ethereum" }],
      ["complete", "tok", { nonce: "n1", signature: "0x" + "ab".repeat(65) }],
    ]);
  });

  it("stops at a wallet refusal with the plain message and never calls the server to complete", async () => {
    const a = api();
    const r = await runConnect({
      api: a, token: "tok", walletId: "evm", onStep: () => {},
      win: stubWindow({ sign: async () => { throw { code: 4001, message: "User rejected the request." }; } }),
    });
    expect(r).toEqual({ ok: false, error: "You closed the wallet prompt. Try again when you are ready." });
    expect(a.seen.map((x) => (x as unknown[])[0])).toEqual(["challenge"]);
  });

  it("stops when the server refuses the challenge", async () => {
    const a = api({ challenge: async () => ({ ok: false, error: "That wallet address does not look right for the chosen network." }) });
    const r = await runConnect({ api: a, win: stubWindow(), token: "tok", walletId: "evm", onStep: () => {} });
    expect(r).toEqual({ ok: false, error: "That wallet address does not look right for the chosen network." });
  });

  it("reports the server's error after signing without losing it", async () => {
    const a = api({ complete: async () => ({ ok: false, error: "Strike said: wallet signature verification failed." }) });
    const r = await runConnect({ api: a, win: stubWindow(), token: "tok", walletId: "evm", onStep: () => {} });
    expect(r).toEqual({ ok: false, error: "Strike said: wallet signature verification failed." });
  });

  it("fails plainly when the wallet is missing", async () => {
    const r = await runConnect({ api: api(), win: {}, token: "tok", walletId: "evm", onStep: () => {} });
    expect(r).toEqual({ ok: false, error: "That wallet is not available in this browser." });
  });

  it("never lets a raw wallet or network exception escape", async () => {
    const r = await runConnect({
      api: api({ challenge: async () => { throw new Error("secret internal detail"); } }),
      win: stubWindow(), token: "tok", walletId: "evm", onStep: () => {},
    });
    expect(r).toEqual({ ok: false, error: "The wallet did not complete the request. Try again." });
  });
});
