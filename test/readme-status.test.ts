import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// One status vocabulary in the README: every row of the status table says exactly LIVE, NEXT or NOT LIVE.
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const table = readme.slice(readme.indexOf("## Status"), readme.indexOf("## How it works"));
const rows = table.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Piece") && !l.startsWith("|---"));

describe("README status table", () => {
  it("has rows to check (so an emptied table cannot pass)", () => {
    expect(rows.length).toBeGreaterThan(10);
  });
  it.each(rows.map((r) => [r.split("|")[1]!.trim().slice(0, 50), r.split("|")[2]!.trim()]))("%s: %s", (_piece, status) => {
    expect(["LIVE", "NEXT", "NOT LIVE"]).toContain(status);
  });
});
