// Minimal signed REST helper for spikes A-C. The product client is src/strike/client.ts (P2).
import { signRequest } from "../src/strike/sign.js";
import { BASE_URL, requireEnv } from "./env.js";

export async function serverClockOffsetSeconds(): Promise<number> {
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/v2/time`);
  const { serverTime } = (await res.json()) as { serverTime: number };
  const mid = (t0 + Date.now()) / 2;
  return Math.round((serverTime - mid) / 1000);
}

export async function signed(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; json: unknown }> {
  const { SPIKE_API_PRIV } = requireEnv("SPIKE_API_PRIV", "SPIKE_API_PUB");
  const bodyStr = body === undefined ? undefined : JSON.stringify(body);
  const offset = await serverClockOffsetSeconds();
  const headers = {
    ...signRequest({
      privateKeyHex: SPIKE_API_PRIV as string,
      method,
      path,
      body: bodyStr,
      timestamp: Math.floor(Date.now() / 1000) + offset,
    }),
    ...(bodyStr === undefined ? {} : { "Content-Type": "application/json" }),
    ...extraHeaders,
  };
  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: bodyStr });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { status: res.status, json };
}

export async function publicGet(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`);
  return res.json();
}
