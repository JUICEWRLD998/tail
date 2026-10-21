// Price rounding to a market's tick size. Output carries exactly the tick's number of decimals.
import { D, type Dec } from "./dec.js";

export function decimalsOf(tickSize: string): number {
  return D.str(D.of(tickSize)).split(".")[1]?.length ?? 0;
}

export function formatToTick(value: Dec, tick: Dec, decimals: number): string {
  const [int, frac = ""] = D.str(D.roundToStep(value, tick)).split(".");
  return decimals === 0 ? (int as string) : `${int}.${frac.padEnd(decimals, "0")}`;
}

export function roundToTick(value: string, tickSize: string): string {
  return formatToTick(D.of(value), D.of(tickSize), decimalsOf(tickSize));
}
