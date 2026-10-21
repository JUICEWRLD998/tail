import { describe, expect, it } from "vitest";
import { takeToken } from "../../web/src/connect/token.js";

const mkStorage = (initial: Record<string, string> = {}, broken = false) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => { if (broken) throw new Error("denied"); return data[k] ?? null; },
    setItem: (k: string, v: string) => { if (broken) throw new Error("denied"); data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  };
};
const TOKEN = "A".repeat(43);

describe("takeToken", () => {
  it("reads t from the query string, removes it from the address bar, and remembers it for a reload", () => {
    const st = mkStorage();
    const replaced: string[] = [];
    const t = takeToken({ search: `?t=${TOKEN}`, pathname: "/connect" }, { replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) }, st);
    expect(t).toBe(TOKEN);
    expect(replaced).toEqual(["/connect"]);
    expect(st.data["tail.connect.token"]).toBe(TOKEN);
  });

  it("falls back to the remembered token after the query string was stripped", () => {
    const st = mkStorage({ "tail.connect.token": TOKEN });
    expect(takeToken({ search: "", pathname: "/connect" }, { replaceState: () => {} }, st)).toBe(TOKEN);
  });

  it("a new link replaces the remembered token", () => {
    const st = mkStorage({ "tail.connect.token": "B".repeat(43) });
    expect(takeToken({ search: `?t=${TOKEN}`, pathname: "/connect" }, { replaceState: () => {} }, st)).toBe(TOKEN);
    expect(st.data["tail.connect.token"]).toBe(TOKEN);
  });

  it("returns undefined when there is no token anywhere", () => {
    expect(takeToken({ search: "", pathname: "/connect" }, { replaceState: () => {} }, mkStorage())).toBeUndefined();
  });

  it.each(["", "short", "x".repeat(44), "has space " + "a".repeat(33), "<script>"])("ignores a malformed token %j", (bad) => {
    const st = mkStorage();
    expect(takeToken({ search: `?t=${encodeURIComponent(bad)}`, pathname: "/connect" }, { replaceState: () => {} }, st)).toBeUndefined();
    expect(st.data["tail.connect.token"]).toBeUndefined();
  });

  it("still works when storage is blocked", () => {
    expect(takeToken({ search: `?t=${TOKEN}`, pathname: "/connect" }, { replaceState: () => {} }, mkStorage({}, true))).toBe(TOKEN);
    expect(takeToken({ search: "", pathname: "/connect" }, { replaceState: () => {} }, mkStorage({}, true))).toBeUndefined();
  });

  it("works with no storage at all", () => {
    expect(takeToken({ search: `?t=${TOKEN}`, pathname: "/connect" }, { replaceState: () => {} }, undefined)).toBe(TOKEN);
  });
});
