// WCAG 2.x contrast for OKLCH colours. Usage: npx tsx scripts/contrast.ts   (checks the pairs in web/src/styles/pairs.json)
// Tokens are written in OKLCH in tokens.css; this converts to linear sRGB and measures. Exit 1 if any pair misses its bar.
import { readFileSync } from "node:fs";

export function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h), b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]; // linear sRGB, may fall slightly outside 0..1 when out of gamut
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
export const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const inGamut = (rgb: number[]) => rgb.every((x) => x >= -0.0005 && x <= 1.0005);

export function parseOklch(s: string): [number, number, number] {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(s);
  if (!m) throw new Error(`not an oklch colour: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

if (process.argv[1]?.endsWith("contrast.ts")) {
  const spec = JSON.parse(readFileSync(new URL("../web/src/styles/pairs.json", import.meta.url), "utf8")) as {
    themes: Record<string, { colors: Record<string, string>; pairs: { fg: string; bg: string; min: number; use: string }[] }>;
  };
  let bad = 0;
  for (const [theme, t] of Object.entries(spec.themes)) {
    console.log(`\n${theme}`);
    for (const [name, css] of Object.entries(t.colors)) {
      const rgb = oklchToRgb(...parseOklch(css));
      if (!inGamut(rgb)) console.log(`  note: ${name} ${css} is outside sRGB and will be clipped`);
    }
    for (const p of t.pairs) {
      const r = ratio(luminance(oklchToRgb(...parseOklch(t.colors[p.fg] as string))), luminance(oklchToRgb(...parseOklch(t.colors[p.bg] as string))));
      const pass = r >= p.min;
      if (!pass) bad++;
      console.log(`  ${pass ? "ok  " : "FAIL"} ${r.toFixed(2).padStart(5)}:1  need ${p.min}  ${p.fg} on ${p.bg}  (${p.use})`);
    }
  }
  process.exit(bad ? 1 : 0);
}
