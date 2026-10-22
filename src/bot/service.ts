// Tail's application logic: everything a user can do, with Telegram and Strike injected.
// The model builds nothing here. Every order is parsed and sized by tested deterministic code.
import type { AiReader } from "../ai/openrouter.js";
import { fadeOf, rewardRisk } from "../core/fade.js";
import { bracketFromDraft } from "../core/order.js";
import { parseCall, type Hints, type ParseResult } from "../core/parser.js";
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

export type CallerPostResult = { type: "ignore" } | { type: "dm"; tgId: number; reply: Reply };

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
  /** Abuse limits. Defaults: 10 calls per channel per hour, 10 open tails per follower, 2 minutes to repeat a call. */
  limits?: { maxOpenTails?: number; maxCallsPerHour?: number; duplicateWindowMs?: number };
  /** Optional fallback reader for calls the parser could not read. Its output is a proposal the caller must confirm. */
  ai?: AiReader;
  /** The builder fee rate sent with a builder wallet's orders (the same value the Strike client is given). */
  builderFeeBps?: number;
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

/** A parse failure is worth an AI reading when it is a question, or free text that names a listed market and has levels. */
function worthAReading(reason: string, text: string, markets: Readonly<Record<string, unknown>>): boolean {
  if (reason !== "not_a_call") return true;
  const numbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
  const lower = text.toLowerCase();
  return numbers.length >= 3 && Object.keys(markets).some((m) => lower.includes(m.replace(/-USD$/, "").toLowerCase()));
}

export function createService(d: ServiceDeps) {
  const { store } = d;

  /** Which wallet trades a call: the follower's wallet for the caller's own code when the channel has one, else the default. */
  const traderFor = (tgId: number, chatId: number): { user: User | undefined } | { needs: { code: string; feeBps: number } } => {
    const ch = store.getChannel(chatId);
    if (ch?.builderCode && ch.feeBps !== null) {
      const w = store.walletFor(tgId, ch.builderCode);
      return w ? { user: w } : { needs: { code: ch.builderCode, feeBps: ch.feeBps } };
    }
    return { user: store.getUser(tgId) };
  };
  const attempts = d.pollAttempts ?? 20;
  const maxOpenTails = d.limits?.maxOpenTails ?? 10;
  const maxCallsPerHour = d.limits?.maxCallsPerHour ?? 10;
  const duplicateWindowMs = d.limits?.duplicateWindowMs ?? 2 * 60_000;
  const before = (ms: number) => new Date(Date.parse(d.now()) - ms).toISOString();

  const FOLLOW_UP: Record<string, string> = {
    sl: " Post the call again with it.", tp: " Post the call again with it.", entry: " Post the call again with it.",
    levels: " Post the corrected call again.", symbol: " Post the call again with the market named.",
  };

  /** Parses a call and turns the result into what the caller sees: a confirm card, a question, or nothing. */
  async function processCall(callerTgId: number, i: { chatId: number; messageId: number; text: string }, hints: Hints): Promise<CallerPostResult> {
    const ctx = { markets: await marketMap() };
    let r: ParseResult = parseCall(i.text, ctx, hints);
    let aiRead = false;
    // Only a first reading may use the AI: an answer to a question (hints) is final.
    if (!r.ok && r.reason !== "not_listed" && d.ai?.enabled && Object.keys(hints).length === 0 && worthAReading(r.reason, i.text, ctx.markets)) {
      const proposal = await d.ai.read(i.text, ctx, i.chatId);
      if (proposal.ok) {
        r = { ok: true, draft: proposal.draft };
        aiRead = true;
      }
    }
    if (!r.ok) {
      if (r.reason === "not_a_call") return { type: "ignore" };
      if (r.reason === "not_listed") {
        store.recordMiss(r.base, i.chatId);
        return { type: "dm", tgId: callerTgId, reply: { text: `🔍 Not on Strike yet: ${r.base}.` } };
      }
      const { question, options, field } = r.ask;
      if (options && options.length > 0) {
        const askId = store.createAsk({ tgId: callerTgId, chatId: i.chatId, messageId: i.messageId, rawText: i.text, field, options, createdAt: d.now() });
        return {
          type: "dm", tgId: callerTgId,
          reply: { text: `❓ ${question}`, buttons: options.map((label, n) => ({ text: label, callback: callbackData("ask", askId, n) })) },
        };
      }
      return { type: "dm", tgId: callerTgId, reply: { text: `❓ ${question}${FOLLOW_UP[field] ?? ""}` } };
    }
    const dr = r.draft;
    // Abuse limits apply only to a real call about to become a draft, never to chatter or a question.
    if (store.hasRecentCall(i.chatId, i.text, before(duplicateWindowMs))) {
      return { type: "dm", tgId: callerTgId, reply: { text: "♻️ This call was already posted a moment ago." } };
    }
    if (store.countCallsSince(i.chatId, before(3_600_000)) >= maxCallsPerHour) {
      return { type: "dm", tgId: callerTgId, reply: { text: `⚠️ Too many calls in the last hour (limit ${maxCallsPerHour}). Wait before posting another.` } };
    }
    const id = store.createDraftCall({
      chatId: i.chatId, messageId: i.messageId, rawText: i.text, symbol: dr.symbol, side: dr.side, entryKind: dr.entryKind,
      entry: dr.entry, tp: dr.tp, sl: dr.sl, leverageHint: dr.leverageHint, createdAt: d.now(),
    });
    return {
      type: "dm", tgId: callerTgId,
      reply: {
        text: callerConfirmCard({ ...dr, extraTargets: dr.extraTargets }, aiRead),
        buttons: [
          { text: "Post", callback: callbackData("post", id) },
          { text: "Drop", callback: callbackData("drop", id) },
        ],
      },
    };
  }

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
      return processCall(channel.callerTgId, i, {});
    },

    /** The caller tapped an answer to a question the parser asked. The answer fixes one field; every rule still applies. */
    async answerAsk(i: { tgId: number; askId: number; option: number }): Promise<{ ok: false; text: string } | { ok: true; chosen: string; result: CallerPostResult }> {
      const expired = { ok: false as const, text: "This question has expired. Post the call again." };
      const pending = store.peekAsk(i.askId, i.tgId, d.now());
      if (!pending || !Number.isInteger(i.option) || i.option < 0 || i.option >= pending.options.length) return expired;
      if (!store.getChannel(pending.chatId)) return expired;
      const taken = store.takeAsk(i.askId, i.tgId, d.now());
      if (!taken) return expired;
      const chosen = taken.options[i.option] as string;
      const hints: Hints =
        taken.field === "side" ? { side: chosen.toLowerCase() === "short" ? "short" : "long" } :
        taken.field === "symbol" ? { symbol: chosen } :
        taken.field === "entry" ? { entry: chosen } : {};
      return { ok: true, chosen, result: await processCall(i.tgId, { chatId: taken.chatId, messageId: taken.messageId ?? 0, text: taken.rawText }, hints) };
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
      return { text: "🗑️ Dropped." };
    },

    async quote(i: { tgId: number; callId: number; mode: "tail" | "fade" }): Promise<{ ok: false; text: string; needsLink?: true; connectCode?: { code: string; feeBps: number } } | { ok: true; tailId: number; reply: Reply }> {
      const call = store.getCall(i.callId);
      const t = call ? traderFor(i.tgId, call.chatId) : { user: store.getUser(i.tgId) };
      if ("needs" in t) {
        return { ok: false, text: "🔗 This caller is paid through their own Strike builder code. Connect once for their calls with /connect.", needsLink: true, connectCode: t.needs };
      }
      const user = t.user;
      if (!user) return { ok: false, text: "Link your Strike account first with /link.", needsLink: true };
      if (!call || call.status !== "open") return { ok: false, text: "This call is closed." };
      if (store.findLiveTail(call.id, i.tgId)) return { ok: false, text: "You already took this call." };
      if (store.countLiveTails(i.tgId) >= maxOpenTails) {
        return { ok: false, text: `You have ${maxOpenTails} open Tail positions. Wait for one to close first.` };
      }

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
        // A caller-code wallet carries that caller's rate; the default wallet carries the server's, if it is a builder wallet.
        feeBps: user.feeBps ?? (user.builderCode && d.builderFeeBps ? d.builderFeeBps : 0),
        builderCode: user.feeBps !== undefined ? user.builderCode : null, createdAt: d.now(),
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
      // The quote may be minutes old; the call can have hit its target or stop since. Never trade a finished call.
      const live = store.getCall(tail.callId);
      if (!live || live.status !== "open") {
        store.updateTail(tail.id, { status: "cancelled" });
        return { text: "This call is closed." };
      }
      // Claim before any await: a double tap, or two taps in flight, can send at most one order.
      if (!store.claimTail(tail.id)) return { text: "Already placed." };

      // The same wallet that was quoted: the caller's code if the tail carries one, else the default.
      const user = tail.builderCode ? store.walletFor(i.tgId, tail.builderCode) : store.getUser(i.tgId);
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

      let created: { primary_client_order_id?: string; tp_client_order_id?: string; sl_client_order_id?: string };
      try {
        created = await strike.placeBracket(bracket);
      } catch (e) {
        if (e instanceof StrikeError) {
          store.updateTail(tail.id, { status: "rejected", error: e.strikeError });
          return { text: rejectionText(e.strikeError) };
        }
        // The request may or may not have reached Strike. Keep the tail live so a blind retry cannot double up.
        store.updateTail(tail.id, { error: "unconfirmed" });
        return { text: "⚠️ Could not confirm with Strike. Check your open orders on Strike before trying again." };
      }

      // A 201 only means "sequenced". Strike can still reject the primary afterwards, so read its final status.
      const clientId = created.primary_client_order_id as string;
      // Kept so the reconciliation job can tell when a protective leg has closed the position.
      const legs = {
        ...(created.tp_client_order_id ? { tpClientOrderId: created.tp_client_order_id } : {}),
        ...(created.sl_client_order_id ? { slClientOrderId: created.sl_client_order_id } : {}),
      };
      let primary: any;
      try {
        for (let n = 0; n < attempts; n++) {
          primary = await strike.order({ symbol: call.symbol, clientOrderId: clientId });
          if (primary.Status !== "pending") break;
          await d.sleep(500);
        }
      } catch {
        store.updateTail(tail.id, { primaryClientOrderId: clientId, error: "unconfirmed", ...legs });
        return { text: "⚠️ Sent to Strike, but could not read its status. Check your open orders on Strike." };
      }
      if (primary.Status === "rejected") {
        const code = (primary.CloseReason as string) || "rejected";
        store.updateTail(tail.id, { status: "rejected", error: code, primaryClientOrderId: clientId, ...legs });
        return { text: rejectionText(code) };
      }
      const filled = primary.Status === "filled";
      store.updateTail(tail.id, {
        status: filled ? "filled" : "placed", orderId: String(primary.ID), primaryClientOrderId: clientId, ...legs,
        ...(filled ? { filledAt: d.now() } : {}),
      });
      const text = filled
        ? `✅ <b>Filled</b>\nStrike order <code>${primary.ID}</code> filled.`
        : primary.Status === "pending"
          ? `⏳ <b>Sent</b>\nStrike order <code>${primary.ID}</code> is pending.`
          : `📨 <b>Placed</b>\nStrike order <code>${primary.ID}</code> is open.`;
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
      return { text: "🚫 Cancelled." };
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
      return { ok: true, text: `✅ <b>Linked</b> ${short(acct.blockchain_address)}\n💼 Equity ${acct.margin_balance} USD` };
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
        "👤 <b>Your account</b>",
        `🔗 Linked ${short(user.address)} (${user.chain})`,
        `💼 Equity ${equity} USD`,
        "",
        "⚙️ <b>Limits</b>",
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
