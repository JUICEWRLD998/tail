import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const KEK = randomBytes(32).toString("base64");
const base = { TELEGRAM_BOT_TOKEN: "123:abc", TAIL_KEK: KEK };

describe("loadConfig", () => {
  it("defaults to testnet, dev mode and a local database", () => {
    const c = loadConfig(base);
    expect(c).toMatchObject({ network: "testnet", mode: "dev", dbPath: "data/tail.db", baseUrl: "https://api-v2-testnet.strikefinance.org" });
    expect(c.kek.length).toBe(32);
  });

  it("refuses mainnet unless explicitly approved", () => {
    expect(() => loadConfig({ ...base, STRIKE_NETWORK: "mainnet" })).toThrow(/mainnet/);
    expect(loadConfig({ ...base, STRIKE_NETWORK: "mainnet", TAIL_ALLOW_MAINNET: "yes-he-said-go" }).baseUrl).toBe("https://api.strikefinance.org");
  });

  it("rejects an unknown network or mode", () => {
    expect(() => loadConfig({ ...base, STRIKE_NETWORK: "devnet" })).toThrow(/STRIKE_NETWORK/);
    expect(() => loadConfig({ ...base, TAIL_MODE: "staging" })).toThrow(/TAIL_MODE/);
  });

  it("requires a bot token and a valid KEK", () => {
    expect(() => loadConfig({ TAIL_KEK: KEK })).toThrow(/TELEGRAM_BOT_TOKEN/);
    expect(() => loadConfig({ TELEGRAM_BOT_TOKEN: "x" })).toThrow(/TAIL_KEK/);
    expect(() => loadConfig({ ...base, TAIL_KEK: "short" })).toThrow(/TAIL_KEK/);
  });

  it("parses the owner id and the builder fee", () => {
    const c = loadConfig({ ...base, TAIL_OWNER_TG_ID: "5150", BUILDER_FEE_BPS: "10", BUILDER_CODE: "sigma" });
    expect(c).toMatchObject({ ownerTgId: 5150, builderFeeBps: 10, builderCode: "sigma" });
    expect(() => loadConfig({ ...base, TAIL_OWNER_TG_ID: "abc" })).toThrow(/TAIL_OWNER_TG_ID/);
    expect(() => loadConfig({ ...base, BUILDER_FEE_BPS: "101" })).toThrow(/BUILDER_FEE_BPS/);
  });

  it("the error messages never contain secret values", () => {
    for (const env of [{ ...base, TAIL_KEK: "supersecretvalue" }, { ...base, TELEGRAM_BOT_TOKEN: "" }]) {
      try {
        loadConfig(env);
      } catch (e) {
        expect((e as Error).message).not.toContain("supersecretvalue");
        expect((e as Error).message).not.toContain("123:abc");
      }
    }
  });
});

describe("loadConfig: service URL, port and webhook", () => {
  it("reads PUBLIC_URL and PORT, defaulting the port", () => {
    const c = loadConfig({ ...base, PUBLIC_URL: "https://tail.example.test/", PORT: "8080" });
    expect(c).toMatchObject({ publicUrl: "https://tail.example.test", port: 8080 });
    expect(loadConfig(base)).toMatchObject({ publicUrl: undefined, port: 3000 });
  });

  it("requires https for PUBLIC_URL outside localhost", () => {
    expect(() => loadConfig({ ...base, PUBLIC_URL: "http://tail.example.test" })).toThrow(/PUBLIC_URL/);
    expect(loadConfig({ ...base, PUBLIC_URL: "http://localhost:3000" }).publicUrl).toBe("http://localhost:3000");
    expect(() => loadConfig({ ...base, PUBLIC_URL: "not a url" })).toThrow(/PUBLIC_URL/);
  });

  it("rejects a bad port", () => {
    for (const p of ["0", "70000", "abc", "-1"]) expect(() => loadConfig({ ...base, PORT: p })).toThrow(/PORT/);
  });

  it("prod mode needs PUBLIC_URL, a webhook secret and a builder code", () => {
    const prod = { ...base, TAIL_MODE: "prod" };
    expect(() => loadConfig(prod)).toThrow(/PUBLIC_URL/);
    expect(() => loadConfig({ ...prod, PUBLIC_URL: "https://t.example.test" })).toThrow(/WEBHOOK_SECRET/);
    expect(() => loadConfig({ ...prod, PUBLIC_URL: "https://t.example.test", WEBHOOK_SECRET: "a".repeat(32) })).toThrow(/BUILDER_CODE/);
    const ok = loadConfig({ ...prod, PUBLIC_URL: "https://t.example.test", WEBHOOK_SECRET: "a".repeat(32), BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10" });
    expect(ok).toMatchObject({ mode: "prod", webhookSecret: "a".repeat(32) });
  });

  it("the webhook secret must be 32+ url-safe characters and never appears in errors", () => {
    const prod = { ...base, TAIL_MODE: "prod", PUBLIC_URL: "https://t.example.test", BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10" };
    try {
      loadConfig({ ...prod, WEBHOOK_SECRET: "short secret!" });
    } catch (e) {
      expect((e as Error).message).toMatch(/WEBHOOK_SECRET/);
      expect((e as Error).message).not.toContain("short secret!");
    }
    expect(() => loadConfig({ ...prod, WEBHOOK_SECRET: "short" })).toThrow(/WEBHOOK_SECRET/);
  });

  it("derives a webhook path that is not guessable from the bot token or the secret header", () => {
    const c = loadConfig({ ...base, TAIL_MODE: "prod", PUBLIC_URL: "https://t.example.test", WEBHOOK_SECRET: "a".repeat(32), BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10" });
    expect(c.webhookPath).toMatch(/^\/telegram\/[0-9a-f]{32}$/);
    expect(c.webhookPath).not.toContain("a".repeat(32));
    expect(c.webhookPath).not.toContain("123:abc");
  });
});

describe("loadConfig: the dev-only /link key never reaches prod", () => {
  const prod = { ...base, TAIL_MODE: "prod", PUBLIC_URL: "https://t.example.test", WEBHOOK_SECRET: "a".repeat(32), BUILDER_CODE: "sigma", BUILDER_FEE_BPS: "10" };

  it("keeps SPIKE_API_PRIV in dev mode", () => {
    expect(loadConfig({ ...base, SPIKE_API_PRIV: "ab".repeat(32) }).linkKey).toBe("ab".repeat(32));
  });

  it("drops SPIKE_API_PRIV and the owner id in prod mode, even if they are set", () => {
    const c = loadConfig({ ...prod, SPIKE_API_PRIV: "ab".repeat(32), TAIL_OWNER_TG_ID: "5150" });
    expect(c.linkKey).toBeUndefined();
    expect(c.ownerTgId).toBeUndefined();
  });
});

describe("loadConfig: PUBLIC_URL falls back to the host's own variable", () => {
  it("uses RENDER_EXTERNAL_URL, then RAILWAY_PUBLIC_DOMAIN, but an explicit PUBLIC_URL wins", () => {
    expect(loadConfig({ ...base, RENDER_EXTERNAL_URL: "https://tail.onrender.com" }).publicUrl).toBe("https://tail.onrender.com");
    expect(loadConfig({ ...base, RAILWAY_PUBLIC_DOMAIN: "tail.up.railway.app" }).publicUrl).toBe("https://tail.up.railway.app");
    expect(loadConfig({ ...base, PUBLIC_URL: "https://mine.example.test", RENDER_EXTERNAL_URL: "https://tail.onrender.com" }).publicUrl).toBe("https://mine.example.test");
  });

  it("a host variable that is not a valid https URL is rejected, not silently used", () => {
    expect(() => loadConfig({ ...base, RENDER_EXTERNAL_URL: "http://tail.onrender.com" })).toThrow(/PUBLIC_URL/);
  });
});
