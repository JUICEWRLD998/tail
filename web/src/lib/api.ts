// Thin client for the connect API. Every failure becomes `{ ok: false, error }` with a message safe to show.
export type Info = { ok: true; builderCode: string; feeCapBps: number; chains: string[] } | { ok: false; error: string };
export type Challenge = { ok: true; nonce: string; message: string } | { ok: false; error: string };
export type Complete = { ok: true; address: string } | { ok: false; error: string };

export interface ConnectApi {
  info(token: string): Promise<Info>;
  challenge(token: string, body: { address: string; chain: string }): Promise<Challenge>;
  complete(token: string, body: { nonce: string; signature: string }): Promise<Complete>;
}

const UNREACHABLE = "Could not reach Tail. Check your connection and try again.";

export function createApi(fetchFn: typeof fetch = fetch): ConnectApi {
  async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; error?: string }> {
    try {
      const body = (await (await fetchFn(path, init)).json()) as { ok?: unknown; error?: unknown } | null;
      if (body === null || typeof body !== "object" || typeof body.ok !== "boolean") return { ok: false, error: UNREACHABLE };
      if (!body.ok) return { ok: false, error: typeof body.error === "string" ? body.error : UNREACHABLE };
      return body as { ok: true };
    } catch {
      return { ok: false, error: UNREACHABLE };
    }
  }
  const base = (token: string) => `/api/connect/${encodeURIComponent(token)}`;
  const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return {
    info: (t) => call(base(t)) as Promise<Info>,
    challenge: (t, b) => call(`${base(t)}/challenge`, post(b)) as Promise<Challenge>,
    complete: (t, b) => call(`${base(t)}/complete`, post(b)) as Promise<Complete>,
  };
}
