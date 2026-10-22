import { beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/web/server.js";

let calls: { fn: string; args: any[] }[];
let connect: any;

beforeEach(() => {
  calls = [];
  connect = {
    info: (t: string) => (calls.push({ fn: "info", args: [t] }), t === "good" ? { ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum", "solana", "cardano"] } : { ok: false, error: "This link is not valid. Send /connect to the bot for a new one." }),
    challenge: async (t: string, b: any) => (calls.push({ fn: "challenge", args: [t, b] }), { ok: true, nonce: "n1", message: "sign me" }),
    complete: async (t: string, b: any) => (calls.push({ fn: "complete", args: [t, b] }), { ok: true, address: "0x0C3a…741d" }),
  };
});

const app = (over = {}) => buildServer({ connect, now: () => 1_000_000, rateLimit: { max: 5, windowMs: 60_000 }, ...over });
const tok = "good";

describe("health", () => {
  it("answers without touching the connect service", async () => {
    const r = await app().inject({ method: "GET", url: "/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
    expect(calls.length).toBe(0);
  });
});

describe("GET /api/connect/:token", () => {
  it("returns builder info for a valid token", async () => {
    const r = await app().inject({ method: "GET", url: `/api/connect/${tok}` });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, builderCode: "sigma", feeCapBps: 10, chains: ["ethereum", "solana", "cardano"] });
  });
  it("returns 404 with the plain message for a bad token", async () => {
    const r = await app().inject({ method: "GET", url: "/api/connect/bad" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ ok: false, error: "This link is not valid. Send /connect to the bot for a new one." });
  });
});

describe("POST challenge and complete", () => {
  it("passes the wallet address and chain to the service", async () => {
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: { address: "0xabc", chain: "ethereum" } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, nonce: "n1", message: "sign me" });
    expect(calls.at(-1)).toEqual({ fn: "challenge", args: [tok, { address: "0xabc", chain: "ethereum" }] });
  });

  it("passes the nonce and signature to complete", async () => {
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/complete`, payload: { nonce: "n1", signature: "0xsig" } });
    expect(r.json()).toEqual({ ok: true, address: "0x0C3a…741d" });
    expect(calls.at(-1)).toEqual({ fn: "complete", args: [tok, { nonce: "n1", signature: "0xsig" }] });
  });

  it("maps a service failure to 400 with its message", async () => {
    connect.challenge = async () => ({ ok: false, error: "That wallet address does not look right for the chosen network." });
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: { address: "x", chain: "ethereum" } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("That wallet address does not look right for the chosen network.");
  });

  it.each([
    [{ address: 1, chain: "ethereum" }],
    [{ address: "0xabc" }],
    [{ address: "0xabc", chain: ["ethereum"] }],
    [{ address: "a".repeat(300), chain: "ethereum" }],
    ["not json"],
  ])("rejects a malformed challenge body %j before the service", async (payload) => {
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: payload as never, ...(typeof payload === "string" ? { headers: { "content-type": "application/json" } } : {}) });
    expect(r.statusCode).toBe(400);
    expect(calls.length).toBe(0);
  });

  it.each([[{ nonce: "n" }], [{ signature: "s" }], [{ nonce: 1, signature: "s" }], [{ nonce: "n", signature: "s".repeat(5000) }]])(
    "rejects a malformed complete body %j", async (payload) => {
      const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/complete`, payload });
      expect(r.statusCode).toBe(400);
      expect(calls.length).toBe(0);
    },
  );

  it("accepts a CIP-30 signature, which is two hex strings joined by a colon", async () => {
    const sig = `${"ab".repeat(200)}:${"cd".repeat(40)}`;
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/complete`, payload: { nonce: "n1", signature: sig } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 with a generic message when the service throws, never the error text", async () => {
    connect.challenge = async () => { throw new Error("db password is hunter2"); };
    const r = await app().inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: { address: "0xabc", chain: "ethereum" } });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("hunter2");
    expect(r.json()).toEqual({ ok: false, error: "Something went wrong. Try again." });
  });
});

describe("rate limiting", () => {
  it("limits attempts per token, then recovers after the window", async () => {
    let now = 1_000_000;
    const a = app({ now: () => now });
    const hit = () => a.inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: { address: "0xabc", chain: "ethereum" } });
    for (let i = 0; i < 5; i++) expect((await hit()).statusCode).toBe(200);
    const blocked = await hit();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toEqual({ ok: false, error: "Too many attempts. Wait a minute and try again." });
    now += 61_000;
    expect((await hit()).statusCode).toBe(200);
  });

  it("does not let one token's attempts block another", async () => {
    const a = app();
    for (let i = 0; i < 6; i++) await a.inject({ method: "POST", url: `/api/connect/${tok}/challenge`, payload: { address: "0xabc", chain: "ethereum" } });
    const other = await a.inject({ method: "POST", url: "/api/connect/other/challenge", payload: { address: "0xabc", chain: "ethereum" } });
    expect(other.statusCode).toBe(200);
  });
});

describe("headers", () => {
  it("API responses are never cached and never leak the token through the referrer", async () => {
    const r = await app().inject({ method: "GET", url: `/api/connect/${tok}` });
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.headers["referrer-policy"]).toBe("no-referrer");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
  });
});

describe("telegram webhook route", () => {
  it("is mounted only when configured, requires the secret header, and passes the update on", async () => {
    const got: any[] = [];
    const a = app({ webhook: { path: "/telegram/abc", secretToken: "s3cret", handle: async (u: unknown) => void got.push(u) } });
    const ok = await a.inject({ method: "POST", url: "/telegram/abc", headers: { "x-telegram-bot-api-secret-token": "s3cret" }, payload: { update_id: 1 } });
    expect(ok.statusCode).toBe(200);
    expect(got).toEqual([{ update_id: 1 }]);
    const bad = await a.inject({ method: "POST", url: "/telegram/abc", headers: { "x-telegram-bot-api-secret-token": "nope" }, payload: { update_id: 2 } });
    expect(bad.statusCode).toBe(401);
    const none = await a.inject({ method: "POST", url: "/telegram/abc", payload: { update_id: 3 } });
    expect(none.statusCode).toBe(401);
    expect(got.length).toBe(1);
    expect((await app().inject({ method: "POST", url: "/telegram/abc", payload: {} })).statusCode).toBe(404);
  });
});

describe("static web app", () => {
  it("serves index.html at /connect and assets from a RELATIVE staticDir, with the security headers", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join, relative } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "tail-web-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>Connect wallet</title>");
    writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
    const a = app({ staticDir: relative(process.cwd(), dir) });
    const page = await a.inject({ method: "GET", url: "/connect?t=whatever" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Connect wallet");
    expect(page.headers["referrer-policy"]).toBe("no-referrer");
    expect((await a.inject({ method: "GET", url: "/assets/app.js" })).body).toBe("console.log(1)");
    expect((await a.inject({ method: "GET", url: "/assets/missing.js" })).statusCode).toBe(404);
  });

  it("does not serve files outside the static directory", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "tail-web-"));
    writeFileSync(join(dir, "index.html"), "ok");
    const a = app({ staticDir: dir });
    for (const url of ["/../package.json", "/%2e%2e/package.json", "/assets/../../package.json"]) {
      const r = await a.inject({ method: "GET", url });
      expect(r.body).not.toContain('"name": "tail"');
    }
  });

  it("is skipped quietly when the directory does not exist (API-only runs)", async () => {
    const a = app({ staticDir: "does/not/exist" });
    expect((await a.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await a.inject({ method: "GET", url: "/connect" })).statusCode).toBe(404);
  });
});

describe("public page API", () => {
  const pages = {
    channel: (slug: string) => (slug === "abcdefghij" ? { title: "Alpha", network: "testnet" } : undefined),
    site: () => ({ network: "testnet", channels: 1, calls: 2, tailsFilled: 3, note: "test activity" }),
  };

  it("serves a published channel's page data", async () => {
    const r = await app({ pages }).inject({ method: "GET", url: "/api/channel/abcdefghij" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true, page: { title: "Alpha", network: "testnet" } });
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("answers an unknown, private and malformed slug with the same 404", async () => {
    const a = app({ pages });
    const bodies = [];
    for (const slug of ["zzzzzzzzzz", "short", "' OR 1=1 --", "A".repeat(200)]) {
      const r = await a.inject({ method: "GET", url: `/api/channel/${encodeURIComponent(slug)}` });
      expect(r.statusCode).toBe(404);
      bodies.push(r.body);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(JSON.parse(bodies[0]!)).toEqual({ ok: false, error: "This page does not exist or is not public." });
  });

  it("serves site totals", async () => {
    const r = await app({ pages }).inject({ method: "GET", url: "/api/site" });
    expect(r.json()).toEqual({ ok: true, site: { network: "testnet", channels: 1, calls: 2, tailsFilled: 3, note: "test activity" } });
  });

  it("page reads have their own, roomier limit than the connect flow", async () => {
    const a = app({ pages, rateLimit: { max: 2, windowMs: 60_000 } });
    const codes = [];
    for (let i = 0; i < 10; i++) codes.push((await a.inject({ method: "GET", url: "/api/site" })).statusCode);
    expect(codes.every((c) => c === 200)).toBe(true);
  });

  it("is not mounted when no pages service is given", async () => {
    expect((await app().inject({ method: "GET", url: "/api/site" })).statusCode).toBe(404);
  });

  it("rate-limits one client across the page routes", async () => {
    const a = app({ pages, pageRateLimit: { max: 3, windowMs: 60_000 } });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await a.inject({ method: "GET", url: "/api/site" })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it("serves the single-page app for / and /c/<slug> when a built app exists", async () => {
    const a = app({ pages, staticDir: "web/dist" });
    for (const url of ["/", "/c/abcdefghij"]) {
      const r = await a.inject({ method: "GET", url });
      if (r.statusCode === 404) continue; // web/dist is built in CI by `npm run web:build`; skip when absent
      expect(r.headers["content-type"]).toContain("text/html");
    }
  });
});

describe("Content-Security-Policy on the web app", () => {
  it("every HTML page is served with a strict policy: own scripts only, no framing, no plugins", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "tail-csp-"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>x</title>");
    const a = app({ staticDir: dir, pages: { channel: () => undefined, site: () => ({}) as never } });
    for (const url of ["/", "/connect", "/c/abcdefghij"]) {
      const r = await a.inject({ method: "GET", url });
      const csp = String(r.headers["content-security-policy"] ?? "");
      expect(csp, url).toContain("default-src 'self'");
      expect(csp, url).toContain("script-src 'self'");
      expect(csp, url).not.toMatch(/script-src[^;]*unsafe/);
      expect(csp, url).toContain("frame-ancestors 'none'");
      expect(csp, url).toContain("object-src 'none'");
      expect(csp, url).toContain("base-uri 'none'");
    }
  });

  it("API responses are JSON and carry no page policy they do not need", async () => {
    const r = await app().inject({ method: "GET", url: "/health" });
    expect(r.headers["content-security-policy"]).toBeUndefined();
  });
});
