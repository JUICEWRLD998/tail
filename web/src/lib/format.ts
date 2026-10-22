// Pure helpers for the pages: which page a path is, and how numbers and states read.
export type Route = { name: "home" } | { name: "connect" } | { name: "channel"; slug: string } | { name: "notfound" };

export function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  if (path === "/connect") return { name: "connect" };
  const m = /^\/c\/([a-z0-9]{10})$/.exec(path);
  return m ? { name: "channel", slug: m[1] as string } : { name: "notfound" };
}

/** Amounts arrive as exact decimal strings. They are grouped for reading but never rounded. */
export function usdLabel(amount: string): string {
  const [int = "0", frac] = amount.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped}${frac ? `.${frac}` : ""} USD`;
}

export function rLabel(r: string | null): string {
  if (r === null) return "n/a";
  return r.startsWith("-") ? `−${r.slice(1)}R` : `+${r}R`;
}

const STATUS: Record<string, string> = { open: "Open", tp_hit: "Target hit", sl_hit: "Stopped out", expired: "Expired" };
export const statusLabel = (s: string): string => STATUS[s] ?? s;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown date";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
