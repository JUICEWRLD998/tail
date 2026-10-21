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
