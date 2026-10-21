// Shared helpers for spike scripts. Reads config from the environment; never prints secrets.
export const NETWORK = process.env.STRIKE_NETWORK ?? "testnet";

export const BASE_URL =
  NETWORK === "mainnet" ? "https://api.strikefinance.org" : "https://api-v2-testnet.strikefinance.org";

if (NETWORK !== "testnet" && process.env.TAIL_ALLOW_MAINNET !== "yes-he-said-go") {
  console.error("Refusing to run: STRIKE_NETWORK is not testnet and mainnet has not been explicitly approved.");
  process.exit(2);
}

export function requireEnv(...names: string[]): Record<string, string> {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    console.error(`MISSING ENV: ${missing.join(", ")}. This spike needs them; see DECISIONS.md and .env.example.`);
    process.exit(3);
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n] as string]));
}
