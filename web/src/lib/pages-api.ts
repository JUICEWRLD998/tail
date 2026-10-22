// Client for the public page API. A failure is `{ ok: false, error }` with a message safe to show.
export interface PageCall {
  id: number;
  symbol: string;
  side: "long" | "short";
  entry: string | null;
  entryKind: "limit" | "market";
  tp: string;
  sl: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
  resultR: string | null;
  followers: number;
  tails: number;
  fee: string;
}

export interface ChannelPage {
  title: string;
  kind: "channel" | "group";
  network: "testnet";
  since: string;
  record: { calls: number; open: number; tpHit: number; slHit: number; expired: number; decided: number; hitRatePct: string | null; avgR: string | null; followers: number };
  earnings: { basis: string; fee: string; filledNotional: string; filled: number; paying: number; withoutRate: number };
  payout: "not live";
  calls: PageCall[];
}

export interface FeaturedCall {
  id: number;
  symbol: string;
  side: "long" | "short";
  entry: string | null;
  tp: string;
  sl: string;
  leverageHint: number | null;
  status: string;
  resultR: string | null;
  createdAt: string;
  tails: { mode: "tail" | "fade"; status: string; atMs: number }[];
}

export interface SitePage {
  network: "testnet";
  channels: number;
  calls: number;
  tailsFilled: number;
  bot: string | null;
  note: string;
  featured: FeaturedCall | null;
}

export type Result<T> = { ok: true; page: T } | { ok: false; error: string };

const UNREACHABLE = "Could not reach Tail. Check your connection and try again.";

async function get<T>(path: string, key: "page" | "site", f: typeof fetch): Promise<Result<T>> {
  try {
    const body = (await (await f(path)).json()) as { ok?: unknown; error?: unknown } & Record<string, unknown>;
    if (body === null || typeof body !== "object" || typeof body.ok !== "boolean") return { ok: false, error: UNREACHABLE };
    if (!body.ok) return { ok: false, error: typeof body.error === "string" ? body.error : UNREACHABLE };
    return { ok: true, page: body[key] as T };
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}

export const fetchChannel = (slug: string, f: typeof fetch = fetch): Promise<Result<ChannelPage>> =>
  get<ChannelPage>(`/api/channel/${encodeURIComponent(slug)}`, "page", f);

export const fetchSite = (f: typeof fetch = fetch): Promise<Result<SitePage>> => get<SitePage>("/api/site", "site", f);
