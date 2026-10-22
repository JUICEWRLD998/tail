// Shared by the unseen-calls test and the baseline report: loads fixtures and classifies parser results.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCall, type ParseContext, type ParseResult } from "../src/core/parser.js";

export const DIR = join(import.meta.dirname, "fixtures", "unseen");

// A test context, not Strike's market list: every symbol the public examples mention.
export const CTX: ParseContext = {
  markets: {
    "XAU-USD": { tickSize: "0.01" }, "BTC-USD": { tickSize: "0.1" }, "ETH-USD": { tickSize: "0.01" },
    "SOL-USD": { tickSize: "0.01" }, "TAO-USD": { tickSize: "0.01" }, "CTK-USD": { tickSize: "0.001" },
  },
};

export type Expected =
  | { outcome: "card"; draft: { symbol: string; side: string; entryKind: string; entry: string | null; tp: string; sl: string; extraTargets: string[] } }
  | { outcome: "ask"; field: string }
  | { outcome: "ignore" };

export interface Fixture { id: string; text: string; expected: Expected; source: string }

export function loadFixtures(): Fixture[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort()
    .map((f) => {
      const id = f.replace(/\.txt$/, "");
      const raw = readFileSync(join(DIR, f), "utf8");
      const lines = raw.split("\n");
      const header = lines.filter((l) => l.startsWith("#!"));
      const text = lines.filter((l) => !l.startsWith("#!")).join("\n").trim();
      return { id, text, source: header[0] ?? "", expected: JSON.parse(readFileSync(join(DIR, `${id}.expected.json`), "utf8")) as Expected };
    });
}

export function classify(r: ParseResult): { outcome: string; detail: unknown } {
  if (r.ok) return { outcome: "card", detail: r.draft };
  if (r.reason === "not_a_call") return { outcome: "ignore", detail: null };
  if (r.reason === "not_listed") return { outcome: "not_listed", detail: r.base };
  return { outcome: "ask", detail: r.ask };
}

export function check(f: Fixture): { pass: boolean; got: ReturnType<typeof classify> } {
  const got = classify(parseCall(f.text, CTX));
  const e = f.expected;
  if (e.outcome === "ignore") return { pass: got.outcome === "ignore", got };
  if (e.outcome === "ask") return { pass: got.outcome === "ask" && (got.detail as { field: string }).field === e.field, got };
  if (got.outcome !== "card") return { pass: false, got };
  const d = got.detail as Record<string, unknown>;
  const x = e.draft;
  const pass = d.symbol === x.symbol && d.side === x.side && d.entryKind === x.entryKind && d.entry === x.entry && d.tp === x.tp && d.sl === x.sl &&
    JSON.stringify(d.extraTargets) === JSON.stringify(x.extraTargets);
  return { pass, got };
}
