// Data behind the public pages. Everything is computed from stored rows; nothing is typed in. A page carries no
// Telegram ids, chat ids, raw call text or order ids: a caller publishes a record, not their followers.
import { earnings } from "../core/earnings.js";
import { resultR } from "../core/outcome.js";
import { summarize, type RecordCall, type Summary } from "../core/record.js";
import type { Store } from "../db/store.js";

const SLUG_RE = /^[a-z0-9]{10}$/;
const MAX_CALLS = 50;

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
  /** Followers with an entry fill on this call. */
  followers: number;
  tails: number;
  /** Estimated builder fee from this call's entry fills, USD. */
  fee: string;
}

export interface ChannelPage {
  title: string;
  kind: "channel" | "group";
  network: "testnet";
  since: string;
  record: Summary;
  earnings: { basis: string; fee: string; filledNotional: string; filled: number; paying: number; withoutRate: number };
  payout: "not live";
  calls: PageCall[];
}

export interface SitePage {
  network: "testnet";
  channels: number;
  calls: number;
  tailsFilled: number;
  note: string;
}

export interface Pages {
  channel(slug: string): ChannelPage | undefined;
  site(): SitePage;
}

export function createPages(store: Store): Pages {
  return {
    channel(slug) {
      if (!SLUG_RE.test(slug)) return undefined;
      const ch = store.channelBySlug(slug);
      if (!ch) return undefined;
      const calls = store.callsOfChat(ch.chatId);
      const tails = store.tailsOfChat(ch.chatId);
      const e = earnings(tails);
      const rows: RecordCall[] = calls.map((c) => ({
        symbol: c.symbol, side: c.side, entryKind: c.entryKind, entry: c.entry, tp: c.tp, sl: c.sl, enteredPrice: c.enteredPrice,
        status: c.status as RecordCall["status"],
      }));
      const followersOf = (callId: number) => new Set(tails.filter((t) => t.callId === callId && (t.status === "filled" || t.status === "closed")).map((t) => t.tgId)).size;
      const list: PageCall[] = [...calls].reverse().slice(0, MAX_CALLS).map((c) => ({
        id: c.id, symbol: c.symbol, side: c.side, entry: c.entry, entryKind: c.entryKind, tp: c.tp, sl: c.sl, status: c.status,
        createdAt: c.createdAt, closedAt: c.closedAt,
        resultR: c.status === "tp_hit" || c.status === "sl_hit" ? resultR(c, c.status) : null,
        followers: followersOf(c.id), tails: tails.filter((t) => t.callId === c.id).length,
        fee: e.byCall.get(c.id)?.fee ?? "0",
      }));
      return {
        title: ch.title, kind: ch.kind, network: "testnet", since: ch.createdAt,
        record: summarize(rows, store.followersIn(ch.chatId)),
        earnings: { basis: e.basis, fee: e.fee, filledNotional: e.filledNotional, filled: e.filled, paying: e.paying, withoutRate: e.withoutRate },
        payout: "not live", calls: list,
      };
    },
    site() {
      return {
        network: "testnet", ...store.siteTotals(),
        note: "Measured from this server's own database. All of it is test activity on Strike testnet, not adoption.",
      };
    },
  };
}
