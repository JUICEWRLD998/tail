import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../web/src/styles/tokens.css", import.meta.url), "utf8");
const spec = JSON.parse(readFileSync(new URL("../../web/src/styles/pairs.json", import.meta.url), "utf8")) as {
  themes: Record<string, { colors: Record<string, string> }>;
};

// Pull `--name: value;` declarations out of one block, selected by a marker line.
function block(marker: string): Record<string, string> {
  const start = css.indexOf(marker);
  if (start < 0) throw new Error(`block not found: ${marker}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return Object.fromEntries([...css.slice(open + 1, close).matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], (m[2] as string).trim()]));
}

const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const colorsOf = (vars: Record<string, string>) => Object.fromEntries(Object.entries(vars).filter(([, v]) => v.startsWith("oklch(")).map(([k, v]) => [camel(k), v]));

describe("tokens.css matches the colours that were measured", () => {
  it("dark theme (the default) equals pairs.json", () => {
    expect(colorsOf(block(":root {"))).toEqual(spec.themes.dark!.colors);
  });
  it("light theme equals pairs.json, in both the media query and the explicit attribute", () => {
    expect(colorsOf(block("@media (prefers-color-scheme: light)"))).toEqual(spec.themes.light!.colors);
    expect(colorsOf(block(':root[data-theme="light"]'))).toEqual(spec.themes.light!.colors);
  });
  it("an explicit dark attribute restores the dark colours", () => {
    expect(colorsOf(block(':root[data-theme="dark"]'))).toEqual(spec.themes.dark!.colors);
  });
  it("uses no pure black or white and no hex colours", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/oklch\((0|1)(\.0+)?\s/);
  });
  it("keeps motion short and offers a reduced-motion path", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    const durations = [...css.matchAll(/--dur-\w+:\s*(\d+)ms/g)].map((m) => Number(m[1]));
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(d).toBeLessThanOrEqual(250);
  });
});
