// Environment configuration. Fails closed: mainnet needs an explicit approval flag, and error messages never echo values.
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
  return {
    network, baseUrl: BASE_URLS[network], mode, token: env.TELEGRAM_BOT_TOKEN, kek,
    dbPath: env.TAIL_DB ?? "data/tail.db", ownerTgId, linkKey: env.SPIKE_API_PRIV || undefined,
    builderCode: env.BUILDER_CODE || undefined, builderFeeBps,
  };
}
