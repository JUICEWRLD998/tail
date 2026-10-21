// HTTP surface: the connect API, health, the optional Telegram webhook, and the built web app.
// Errors that cross this boundary are generic; internals and secrets never reach a response.
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ConnectService } from "../connect/service.js";

export interface ServerOptions {
  connect: ConnectService;
  now: () => number;
  rateLimit?: { max: number; windowMs: number };
  /** Mounted only for the deployed bot: Telegram posts updates here with a secret header. */
  webhook?: { path: string; secretToken: string; handle: (update: unknown) => Promise<void> };
  /** Built web app (Vite output). Skipped when the directory does not exist. */
  staticDir?: string;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{1,64}$/;

const challengeSchema = {
  type: "object", required: ["address", "chain"], additionalProperties: false,
  properties: { address: { type: "string", minLength: 1, maxLength: 200 }, chain: { type: "string", minLength: 1, maxLength: 20 } },
} as const;

const completeSchema = {
  type: "object", required: ["nonce", "signature"], additionalProperties: false,
  properties: { nonce: { type: "string", minLength: 1, maxLength: 100 }, signature: { type: "string", minLength: 1, maxLength: 4096 } },
} as const;

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function buildServer(o: ServerOptions): FastifyInstance {
  // Ajv coerces types by default (a number would pass as a string); input here must be exactly what the schema says.
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024, ajv: { customOptions: { coerceTypes: false, removeAdditional: false } } });
  const limit = o.rateLimit ?? { max: 20, windowMs: 60_000 };
  const hits = new Map<string, { count: number; resetAt: number }>();

  const allowed = (key: string): boolean => {
    const now = o.now();
    const h = hits.get(key);
    if (!h || now >= h.resetAt) {
      hits.set(key, { count: 1, resetAt: now + limit.windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit.max;
  };

  app.addHook("onSend", async (req, reply) => {
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    if (req.url.startsWith("/api/") || req.url === "/health") reply.header("Cache-Control", "no-store");
  });

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 400 && status < 500) return reply.code(status).send({ ok: false, error: "Bad request." });
    return reply.code(500).send({ ok: false, error: "Something went wrong. Try again." });
  });

  app.get("/health", async () => ({ ok: true }));

  app.get<{ Params: { token: string } }>("/api/connect/:token", async (req, reply) => {
    if (!TOKEN_RE.test(req.params.token)) return reply.code(404).send({ ok: false, error: "This link is not valid. Send /connect to the bot for a new one." });
    const r = o.connect.info(req.params.token);
    return r.ok ? r : reply.code(404).send(r);
  });

  const guarded = async (token: string, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) => {
    if (!TOKEN_RE.test(token)) return reply.code(404).send({ ok: false, error: "This link is not valid. Send /connect to the bot for a new one." });
    if (!allowed(token)) return reply.code(429).send({ ok: false, error: "Too many attempts. Wait a minute and try again." });
    return undefined;
  };

  app.post<{ Params: { token: string }; Body: { address: string; chain: string } }>(
    "/api/connect/:token/challenge", { schema: { body: challengeSchema } },
    async (req, reply) => {
      const blocked = await guarded(req.params.token, reply);
      if (blocked !== undefined) return blocked;
      const r = await o.connect.challenge(req.params.token, req.body as never);
      return r.ok ? r : reply.code(400).send(r);
    },
  );

  app.post<{ Params: { token: string }; Body: { nonce: string; signature: string } }>(
    "/api/connect/:token/complete", { schema: { body: completeSchema } },
    async (req, reply) => {
      const blocked = await guarded(req.params.token, reply);
      if (blocked !== undefined) return blocked;
      const r = await o.connect.complete(req.params.token, req.body);
      return r.ok ? r : reply.code(400).send(r);
    },
  );

  if (o.webhook) {
    const w = o.webhook;
    app.post(w.path, async (req, reply) => {
      const got = req.headers["x-telegram-bot-api-secret-token"];
      if (typeof got !== "string" || !sameSecret(got, w.secretToken)) return reply.code(401).send({ ok: false });
      await w.handle(req.body);
      return { ok: true };
    });
  }

  if (o.staticDir && existsSync(o.staticDir)) {
    void app.register(fastifyStatic, { root: o.staticDir, wildcard: false });
    // The connect page is a single-page app; /connect?t=... serves index.html.
    app.get("/connect", async (_req, reply) => reply.sendFile("index.html"));
  }
  return app;
}
