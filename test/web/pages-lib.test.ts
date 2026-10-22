import { describe, expect, it } from "vitest";
import { fetchChannel, fetchSite } from "../../web/src/lib/pages-api.js";
import { dayLabel, rLabel, routeOf, statusLabel, usdLabel } from "../../web/src/lib/format.js";

describe("routeOf", () => {
  it.each([
    ["/", { name: "home" }],
    ["/connect", { name: "connect" }],
    ["/c/abcdefghij", { name: "channel", slug: "abcdefghij" }],
    ["/c/abcdefghij/", { name: "channel", slug: "abcdefghij" }],
  ])("%s", (path, want) => expect(routeOf(path)).toEqual(want));

  it.each(["/c/", "/c/short", "/c/ABCDEFGHIJ", "/c/abcdefghij/extra", "/nope", "/c/abc defghij", "/c/../connect"])("%s is not found", (path) => {
    expect(routeOf(path)).toEqual({ name: "notfound" });
  });
});

describe("labels", () => {
  it("usdLabel keeps every digit that matters and never rounds a small fee to zero", () => {
    expect(usdLabel("0")).toBe("0 USD");
    expect(usdLabel("0.04464")).toBe("0.04464 USD");
    expect(usdLabel("22.32")).toBe("22.32 USD");
    expect(usdLabel("0.00000001")).toBe("0.00000001 USD");
    expect(usdLabel("1234.5")).toBe("1,234.5 USD");
  });

  it("rLabel signs a result", () => {
    expect(rLabel("-1")).toBe("−1R");
    expect(rLabel("1.33")).toBe("+1.33R");
    expect(rLabel(null)).toBe("n/a");
  });

  it("statusLabel is plain words", () => {
    expect(statusLabel("tp_hit")).toBe("Target hit");
    expect(statusLabel("sl_hit")).toBe("Stopped out");
    expect(statusLabel("open")).toBe("Open");
    expect(statusLabel("expired")).toBe("Expired");
    expect(statusLabel("weird")).toBe("weird");
  });

  it("dayLabel is a UTC date and survives junk", () => {
    expect(dayLabel("2026-10-21T23:59:00.000Z")).toBe("21 Oct 2026");
    expect(dayLabel("not a date")).toBe("unknown date");
  });
});

describe("page API client", () => {
  const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the page on success", async () => {
    const r = await fetchChannel("abcdefghij", reply(200, { ok: true, page: { title: "A" } }));
    expect(r).toEqual({ ok: true, page: { title: "A" } });
  });

  it("returns the server's plain message on 404", async () => {
    const r = await fetchChannel("abcdefghij", reply(404, { ok: false, error: "This page does not exist or is not public." }));
    expect(r).toEqual({ ok: false, error: "This page does not exist or is not public." });
  });

  it("turns a network failure and a junk body into a safe message", async () => {
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await fetchSite(down)).toEqual({ ok: false, error: "Could not reach Tail. Check your connection and try again." });
    expect(await fetchSite(reply(200, "junk"))).toMatchObject({ ok: false });
  });

  it("encodes the slug into the path", async () => {
    let url = "";
    await fetchChannel("a/b?c", (async (u: string) => { url = u; return new Response("{}", { status: 404 }); }) as unknown as typeof fetch);
    expect(url).toBe("/api/channel/a%2Fb%3Fc");
  });
});
