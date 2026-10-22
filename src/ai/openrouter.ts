// OpenRouter chat completions (OpenAI-compatible, JSON mode). The reply is only ever a proposal for checkProposal.
import { createHash } from "node:crypto";
import type { ParseContext } from "../core/parser.js";
import { buildPrompt, checkProposal, type ProposalResult } from "./proposal.js";

export interface AiReaderOptions {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  perChannelPerHour?: number;
  now?: () => number;
}

export interface AiReader {
  enabled: boolean;
  read(text: string, ctx: ParseContext, chatId: number): Promise<ProposalResult>;
}

const URL = "https://openrouter.ai/api/v1/chat/completions";
const HOUR = 3_600_000;
const CACHE_MAX = 500;
const unavailable: ProposalResult = { ok: false, reason: "the reader is unavailable" };

export function createAiReader(opts: AiReaderOptions): AiReader {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const limit = opts.perChannelPerHour ?? 20;
  const cache = new Map<string, ProposalResult>();
  const used = new Map<number, number[]>();

  async function read(text: string, ctx: ParseContext, chatId: number): Promise<ProposalResult> {
    if (!opts.apiKey) return unavailable;
    const key = createHash("sha256").update(text).digest("hex");
    const hit = cache.get(key);
    if (hit) return hit;

    const t = now();
    const recent = (used.get(chatId) ?? []).filter((x) => t - x < HOUR);
    if (recent.length >= limit) {
      used.set(chatId, recent);
      return { ok: false, reason: "the AI reading limit for this channel is used up" };
    }
    used.set(chatId, [...recent, t]);

    const { system, user } = buildPrompt(text, Object.keys(ctx.markets));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let result: ProposalResult;
    try {
      const res = await doFetch(URL, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: ctl.signal,
      });
      if (!res.ok) return unavailable;
      const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") return { ok: false, reason: "the reader gave no answer" };
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ok: false, reason: "the reader gave an unreadable answer" };
      }
      result = checkProposal(parsed, text, ctx);
    } catch {
      return unavailable; // never echo the error: it can carry request details
    } finally {
      clearTimeout(timer);
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, result);
    return result;
  }

  return { enabled: Boolean(opts.apiKey), read };
}
