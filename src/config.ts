// Environment configuration. Fails closed: mainnet needs an explicit approval flag, and error messages never echo values.
import { createHash } from "node:crypto";
import { loadKek } from "./db/crypto.js";

export interface Config {
  network: "testnet" | "mainnet";
  baseUrl: string;
  mode: "dev" | "prod";
  token: string;
  kek: Buffer;
  dbPath: string;
  ownerTgId: number | undefined;
  /** Dev-only: the API wallet key /link installs for the owner. */
  linkKey: string | undefined;
  builderCode: string | undefined;
  builderFeeBps: number | undefined;
  /** Public origin of this service (https, or localhost for local runs). */
  publicUrl: string | undefined;
  port: number;
  /** Prod only: the secret Telegram echoes in a header on every webhook call. */
  webhookSecret: string | undefined;
  /** Prod only: an unguessable path derived from the secret and the bot token. */
  webhookPath: string | undefined;
}

const BASE_URLS = { testnet: "https://api-v2-testnet.strikefinance.org", mainnet: "https://api.strikefinance.org" } as const;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const network = env.STRIKE_NETWORK ?? "testnet";
  if (network !== "testnet" && network !== "mainnet") throw new Error("STRIKE_NETWORK must be testnet or mainnet");
  if (network === "mainnet" && env.TAIL_ALLOW_MAINNET !== "yes-he-said-go") {
    throw new Error("Refusing to start on mainnet without explicit approval from the owner");
  }
  const mode = env.TAIL_MODE ?? "dev";
  if (mode !== "dev" && mode !== "prod") throw new Error("TAIL_MODE must be dev or prod");
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const kek = loadKek(env.TAIL_KEK);

  let ownerTgId: number | undefined;
  if (env.TAIL_OWNER_TG_ID) {
    if (!/^\d{1,15}$/.test(env.TAIL_OWNER_TG_ID)) throw new Error("TAIL_OWNER_TG_ID must be a number");
    ownerTgId = Number(env.TAIL_OWNER_TG_ID);
  }
  let builderFeeBps: number | undefined;
  if (env.BUILDER_FEE_BPS) {
    const n = Number(env.BUILDER_FEE_BPS);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error("BUILDER_FEE_BPS must be an integer 0-100");
    builderFeeBps = n;
  }

  let publicUrl: string | undefined;
  if (env.PUBLIC_URL) {
    let u: URL;
    try {
      u = new URL(env.PUBLIC_URL);
    } catch {
      throw new Error("PUBLIC_URL is not a valid URL");
    }
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new Error("PUBLIC_URL must be https (http only for localhost)");
    publicUrl = u.origin;
  }

  let port = 3000;
  if (env.PORT !== undefined) {
    const n = Number(env.PORT);
    if (!/^\d{1,5}$/.test(env.PORT) || n < 1 || n > 65535) throw new Error("PORT must be 1-65535");
    port = n;
  }

  let webhookSecret: string | undefined;
  let webhookPath: string | undefined;
  if (mode === "prod") {
    if (!publicUrl) throw new Error("PUBLIC_URL is required in prod mode");
    if (!env.WEBHOOK_SECRET || !/^[A-Za-z0-9_-]{32,256}$/.test(env.WEBHOOK_SECRET)) {
      throw new Error("WEBHOOK_SECRET must be 32-256 characters of A-Z a-z 0-9 _ -");
    }
    if (!env.BUILDER_CODE) throw new Error("BUILDER_CODE is required in prod mode");
    if (builderFeeBps === undefined) throw new Error("BUILDER_FEE_BPS is required in prod mode");
    webhookSecret = env.WEBHOOK_SECRET;
    webhookPath = `/telegram/${createHash("sha256").update(`${env.WEBHOOK_SECRET}:${env.TELEGRAM_BOT_TOKEN}`).digest("hex").slice(0, 32)}`;
  }

  return {
    network, baseUrl: BASE_URLS[network], mode, token: env.TELEGRAM_BOT_TOKEN, kek,
    dbPath: env.TAIL_DB ?? "data/tail.db",
    // /link is a dev convenience that installs a server-held key. Production wallets arrive only through Builder Connect.
    ownerTgId: mode === "prod" ? undefined : ownerTgId,
    linkKey: mode === "prod" ? undefined : env.SPIKE_API_PRIV || undefined,
    builderCode: env.BUILDER_CODE || undefined, builderFeeBps, publicUrl, port, webhookSecret, webhookPath,
  };
}
