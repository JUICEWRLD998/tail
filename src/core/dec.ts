// Exact decimal arithmetic on BigInt scaled by 1e18. Prices and sizes are decimal strings
// everywhere in Tail; floats are never used for money so rounding can never creep upward.

const SCALE_DIGITS = 18;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export type Dec = bigint;

function of(s: string): Dec {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`not a plain decimal: ${JSON.stringify(s)}`);
  const [, sign, int, frac = ""] = m;
  if (frac.length > SCALE_DIGITS) throw new Error(`decimal has more than ${SCALE_DIGITS} fractional digits`);
  const v = BigInt(int as string) * SCALE + BigInt(frac.padEnd(SCALE_DIGITS, "0"));
  return sign === "-" ? -v : v;
}

function str(d: Dec): string {
  const neg = d < 0n;
  const abs = neg ? -d : d;
  const int = abs / SCALE;
  const frac = (abs % SCALE).toString().padStart(SCALE_DIGITS, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${int}${frac ? `.${frac}` : ""}`;
}

const add = (a: Dec, b: Dec): Dec => a + b;
const sub = (a: Dec, b: Dec): Dec => a - b;
const mul = (a: Dec, b: Dec): Dec => (a * b) / SCALE;

function div(a: Dec, b: Dec): Dec {
  if (b === 0n) throw new Error("division by zero");
  return (a * SCALE) / b;
}

const abs = (a: Dec): Dec => (a < 0n ? -a : a);
const lt = (a: Dec, b: Dec): boolean => a < b;
const gt = (a: Dec, b: Dec): boolean => a > b;
const min = (...xs: Dec[]): Dec => xs.reduce((m, x) => (x < m ? x : m));

/** Largest multiple of `step` that is <= x (x >= 0). */
function floorToStep(x: Dec, step: Dec): Dec {
  if (step <= 0n) throw new Error("step must be positive");
  return (x / step) * step;
}

/** Nearest multiple of `step`, ties away from zero (x >= 0). */
function roundToStep(x: Dec, step: Dec): Dec {
  if (step <= 0n) throw new Error("step must be positive");
  return ((x + step / 2n) / step) * step;
}

export const D = { of, str, add, sub, mul, div, abs, lt, gt, min, floorToStep, roundToStep };
