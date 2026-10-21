// Tail's application logic: everything a user can do, with Telegram and Strike injected.
// The model builds nothing here. Every order is parsed and sized by tested deterministic code.
import { fadeOf, rewardRisk } from "../core/fade.js";
import { bracketFromDraft } from "../core/order.js";
import { parseCall } from "../core/parser.js";
import { sizeTail } from "../core/sizing.js";
import { roundToTick } from "../core/tick.js";
import { decryptSecret, encryptSecret } from "../db/crypto.js";
import type { SettingKey, Store, User } from "../db/store.js";
import { StrikeError, type StrikeClient } from "../strike/client.js";
import { derivePublicKeyHex } from "../strike/sign.js";
import {
  escapeHtml, callbackData, callCard, callerConfirmCard, followerConfirmCard, refusalText, rejectionText, tailButtons,
} from "./cards.js";

export type StrikeLike = Pick<StrikeClient, "syncClock" | "markets" | "markPrice" | "account" | "placeBracket" | "order">;

export interface Button {
  text: string;
  callback?: string;
  url?: string;
}

export interface Reply {
  text: string;
  buttons?: Button[];
}

export interface ServiceDeps {
  store: Store;
  kek: Buffer;
  botUsername: string;
  /** Market data that needs no key (exchangeInfo, mark price). */
  publicStrike: Pick<StrikeLike, "markets" | "markPrice">;
  strikeFor: (user: User) => StrikeLike;
  clientForKey: (privateKeyHex: string) => StrikeLike;
  now: () => string;
  uuid: () => string;
  sleep: (ms: number) => Promise<void>;
  pollAttempts?: number;
}

const QUOTE_TTL_MS = 5 * 60_000;
const MOVED = "The price has moved past this call's stop or target. Not placing it.";

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

function strikeMessage(e: unknown): { text: string; strike: boolean } {
  if (e instanceof StrikeError) {
    const relink = e.status === 401 || e.status === 403 ? " Relink with /link." : "";
    return { text: `Strike said: ${escapeHtml(e.strikeError)}.${relink}`, strike: true };
  }
  return { text: "Could not reach Strike. Try again.", strike: false };
}

export function createService(d: ServiceDeps) {
  const { store } = d;
  const attempts = d.pollAttempts ?? 20;

  const marketMap = async () => {
    const m = await d.publicStrike.markets();
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { tickSize: v.tickSize }]));
  };

  return {
    /** `senderTgId` is set for group messages, where anyone can type; channel posts have no sender and are admin-only. */
    async onCallerPost(i: { chatId: number; messageId: number; text: string; senderTgId?: number }) {
      const channel = store.getChannel(i.chatId);
      if (!channel) return { type: "ignore" as const };
      if (i.senderTgId !== undefined && i.senderTgId !== channel.callerTgId) return { type: "ignore" as const };
      const r = parseCall(i.text, { markets: await marketMap() });
      if (!r.ok) {
        if (r.reason === "not_a_call") return { type: "ignore" as const };
        if (r.reason === "not_listed") {
          store.recordMiss(r.base, i.chatId);
          return { type: "dm" as const, tgId: channel.callerTgId, reply: { text: `Not on Strike yet: ${r.base}.` } };
        }
        return { type: "dm" as const, tgId: channel.callerTgId, reply: { text: r.ask.question } };
      }
      const dr = r.draft;
      const id = store.createDraftCall({
        chatId: i.chatId, messageId: i.messageId, rawText: i.text, symbol: dr.symbol, side: dr.side, entryKind: dr.entryKind,
        entry: dr.entry, tp: dr.tp, sl: dr.sl, leverageHint: dr.leverageHint, createdAt: d.now(),
      });
      return {
        type: "dm" as const,
        tgId: channel.callerTgId,
        reply: {
          text: callerConfirmCard({ ...dr, extraTargets: dr.extraTargets }),
          buttons: [
            { text: "Post", callback: callbackData("post", id) },
            { text: "Drop", callback: callbackData("drop", id) },
          ],
        } as Reply,
      };
    },

    postDraft(callId: number, byTgId: number) {
      const call = store.getCall(callId);
      if (!call || call.status !== "draft") return { ok: false as const, text: "This draft is no longer available." };
      if (store.getChannel(call.chatId)?.callerTgId !== byTgId) return { ok: false as const, text: "Only the caller can post this." };
      return {
        ok: true as const, callId, chatId: call.chatId,
        text: callCard(call, store.tailCounts(callId)), buttons: tailButtons(d.botUsername, callId),
      };
    },

    afterPosted(callId: number, cardMessageId: number) {
      store.openCall(callId, cardMessageId);
    },

    dropDraft(callId: number, byTgId: number) {
      const call = store.getCall(callId);
      if (!call || call.status !== "draft" || store.getChannel(call.chatId)?.callerTgId !== byTgId) {
        return { text: "This draft is no longer available." };
      }
      store.cancelDraft(callId);
      return { text: "Dropped." };
    },

    async quote(i: { tgId: number; callId: number; mode: "tail" | "fade" }): Promise<{ ok: false; text: string; needsLink?: true } | { ok: true; tailId: number; reply: Reply }> {
      const user = store.getUser(i.tgId);
      if (!user) return { ok: false, text: "Link your Strike account first with /link.", needsLink: true };
      const call = store.getCall(i.callId);
      if (!call || call.status !== "open") return { ok: false, text: "This call is closed." };
      if (store.findLiveTail(call.id, i.tgId)) return { ok: false, text: "You already took this call." };

      let equity: string;
      let mark: string | null = null;
      let market;
      try {
        equity = (await d.strikeFor(user).account()).margin_balance as string;
        market = (await d.publicStrike.markets())[call.symbol];
        if (call.entry === null) mark = await d.publicStrike.markPrice(call.symbol);
      } catch (e) {
        return { ok: false, text: strikeMessage(e).text };
      }
      if (!market) return { ok: false, text: "This market is not available on Strike." };

      const entryRef = call.entry ?? roundToTick(mark as string, market.tickSize);
      const levels = i.mode === "fade"
        ? fadeOf({ side: call.side, entry: entryRef, tp: call.tp, sl: call.sl })
        : { side: call.side, entry: entryRef, tp: call.tp, sl: call.sl };

      if (call.entry === null) {
        const e = Number(entryRef), t = Number(levels.tp), s = Number(levels.sl);
        const ordered = levels.side === "long" ? s < e && e < t : t < e && e < s;
        if (!ordered) return { ok: false, text: MOVED };
      }

      const sizing = sizeTail({
        equity, riskPct: user.riskPct, maxLeverage: user.maxLeverage, maxNotionalUsd: user.maxNotionalUsd,
        entry: entryRef, sl: levels.sl,
        market: { ...market, maxQty: call.entryKind === "market" ? market.marketMaxQty : market.maxQty },
      });
      if (!sizing.ok) return { ok: false, text: refusalText(sizing) };

      const tailId = store.createTail({
        callId: call.id, tgId: i.tgId, mode: i.mode, strategyId: d.uuid(), size: sizing.size, notionalUsd: sizing.notional,
        feeBps: 0, createdAt: d.now(),
      });
      const rr = call.entry === null ? null : rewardRisk({ side: levels.side, entry: levels.entry, tp: levels.tp, sl: levels.sl });
      return {
        ok: true, tailId,
        reply: {
          text: followerConfirmCard({ call, mode: i.mode, sizing, equity, riskPct: user.riskPct, levels, rewardRisk: rr }),
          buttons: [
            { text: "Confirm", callback: callbackData("confirm", tailId) },
            { text: "Cancel", callback: callbackData("cancel", tailId) },
          ],
        },
      };
    },

    async confirm(i: { tgId: number; tailId: number }) {
      const tail = store.getTail(i.tailId);
      if (!tail) return { text: "This quote is no longer active." };
      if (tail.tgId !== i.tgId) return { text: "This quote is not yours." };
      if (tail.status === "placed" || tail.status === "filled") return { text: "Already placed." };
      if (tail.status !== "quoted") return { text: "This quote is no longer active." };
      if (Date.parse(d.now()) - Date.parse(tail.createdAt) > QUOTE_TTL_MS) {
        store.updateTail(tail.id, { status: "cancelled" });
        return { text: "This quote expired. Tap Tail on the card again." };
      }
      // Claim before any await: a double tap, or two taps in flight, can send at most one order.
      if (!store.claimTail(tail.id)) return { text: "Already placed." };

      const user = store.getUser(i.tgId);
      const call = store.getCall(tail.callId);
      if (!user || !call) {
        store.updateTail(tail.id, { status: "rejected", error: "unavailable" });
        return { text: "Link your Strike account first with /link." };
      }
      const bracket = bracketFromDraft({
        draft: { symbol: call.symbol, side: call.side, entryKind: call.entryKind, entry: call.entry, tp: call.tp, sl: call.sl, leverageHint: call.leverageHint, extraTargets: [] },
        size: tail.size, strategyId: tail.strategyId, fade: tail.mode === "fade",
      });
      const strike = d.strikeFor(user);

      let created: { primary_client_order_id?: string };
      try {
        created = await strike.placeBracket(bracket);
      } catch (e) {
        if (e instanceof StrikeError) {
          store.updateTail(tail.id, { status: "rejected", error: e.strikeError });
          return { text: rejectionText(e.strikeError) };
        }
        // The request may or may not have reached Strike. Keep the tail live so a blind retry cannot double up.
        store.updateTail(tail.id, { error: "unconfirmed" });
        return { text: "Could not confirm with Strike. Check your open orders on Strike before trying again." };
      }

      // A 201 only means "sequenced". Strike can still reject the primary afterwards, so read its final status.
      const clientId = created.primary_client_order_id as string;
      let primary: any;
      try {
        for (let n = 0; n < attempts; n++) {
          primary = await strike.order({ symbol: call.symbol, clientOrderId: clientId });
          if (primary.Status !== "pending") break;
          await d.sleep(500);
        }
      } catch {
        store.updateTail(tail.id, { primaryClientOrderId: clientId, error: "unconfirmed" });
        return { text: "Sent to Strike, but could not read its status. Check your open orders on Strike." };
      }
      if (primary.Status === "rejected") {
        const code = (primary.CloseReason as string) || "rejected";
        store.updateTail(tail.id, { status: "rejected", error: code, primaryClientOrderId: clientId });
        return { text: rejectionText(code) };
      }
      const filled = primary.Status === "filled";
      store.updateTail(tail.id, {
        status: filled ? "filled" : "placed", orderId: String(primary.ID), primaryClientOrderId: clientId,
        ...(filled ? { filledAt: d.now() } : {}),
      });
      const text = filled
        ? `Filled. Strike order ${primary.ID} filled.`
        : primary.Status === "pending"
          ? `Sent. Strike order ${primary.ID} is pending.`
          : `Placed. Strike order ${primary.ID} is open.`;
      return {
        text,
        cardEdit: call.cardMessageId === null ? undefined : {
          chatId: call.chatId, messageId: call.cardMessageId,
          text: callCard(call, store.tailCounts(call.id)), buttons: tailButtons(d.botUsername, call.id),
        },
      };
    },

    cancel(i: { tgId: number; tailId: number }) {
      const tail = store.getTail(i.tailId);
      if (!tail || tail.tgId !== i.tgId || tail.status !== "quoted") return { text: "This quote is no longer active." };
      store.updateTail(tail.id, { status: "cancelled" });
      return { text: "Cancelled." };
    },

    async link(tgId: number, privateKeyHex: string): Promise<{ ok: boolean; text: string }> {
      if (!/^(?:[0-9a-fA-F]{64}|[0-9a-fA-F]{128})$/.test(privateKeyHex)) return { ok: false, text: "That is not a valid key." };
      let acct: any;
      try {
        const client = d.clientForKey(privateKeyHex);
        await client.syncClock();
        acct = await client.account();
      } catch (e) {
        return { ok: false, text: e instanceof StrikeError ? `Strike did not accept that key: ${escapeHtml(e.strikeError)}.` : "Could not reach Strike. Try again." };
      }
      store.linkUser({
        tgId, chain: acct.blockchain, address: acct.blockchain_address, strikeAccountId: acct.account_id,
        apiPub: derivePublicKeyHex(privateKeyHex), apiPrivEnc: encryptSecret(d.kek, privateKeyHex), builderCode: null, linkedAt: d.now(),
      });
      return { ok: true, text: `Linked ${short(acct.blockchain_address)}. Equity ${acct.margin_balance} USD.` };
    },

    async me(tgId: number): Promise<string> {
      const user = store.getUser(tgId);
      if (!user) return "No Strike account linked. Use /link.";
      let equity = "unavailable";
      try {
        equity = (await d.strikeFor(user).account()).margin_balance as string;
      } catch {
        /* show the rest */
      }
      return [
        `Linked ${short(user.address)} (${user.chain})`,
        `Equity ${equity} USD`,
        `Risk ${user.riskPct}% · max leverage ${user.maxLeverage}x · max notional ${user.maxNotionalUsd} USD`,
      ].join("\n");
    },

    set(tgId: number, key: SettingKey, raw: string): { ok: boolean; text: string } {
      if (!store.getUser(tgId)) return { ok: false, text: "No Strike account linked. Use /link." };
      const limits: Record<SettingKey, { min: number; max: number; label: string; unit: string }> = {
        riskPct: { min: 0, max: 25, label: "Risk", unit: "%" },
        maxLeverage: { min: 1, max: 100, label: "Max leverage", unit: "x" },
        maxNotionalUsd: { min: 0, max: 100_000, label: "Max notional", unit: " USD" },
      };
      const l = limits[key];
      const v = raw.trim();
      const n = Number(v);
      const valid = /^\d+(\.\d+)?$/.test(v) && n <= l.max && (key === "maxLeverage" ? n >= l.min : n > l.min);
      if (!valid) return { ok: false, text: `${l.label} must be a number above ${key === "maxLeverage" ? "0.99" : "0"} and at most ${l.max}.` };
      store.setSetting(tgId, key, v);
      return { ok: true, text: `${l.label} set to ${v}${l.unit}.` };
    },

    revoke(tgId: number): string {
      store.revokeUser(tgId, d.now());
      return "Removed your key from Tail. If you no longer use it, delete the API wallet on Strike too.";
    },
  };
}

export type Service = ReturnType<typeof createService>;
