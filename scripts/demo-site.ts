// Serves the web pages locally from a COPY of the real development database (SQLite backup API), for recording the demo.
// The copy holds real calls and real tails from Strike testnet; the live deployed service starts empty on every restart
// (free plan, no disk). Prints nothing secret. Usage: npx tsx scripts/demo-site.ts [port]   (stop with Ctrl+C)
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const port = Number(process.argv[2] ?? 3951);
const copy = join(mkdtempSync(join(tmpdir(), "tail-demo-")), "demo.db");
const src = new Database("data/tail.db", { readonly: true });
await src.backup(copy);
src.close();
const db = new Database(copy);
// A fixed public link for the recording; the real channel stays the real channel.
db.prepare("UPDATE channels SET slug = 'tailsample', is_public = 1 WHERE chat_id = (SELECT chat_id FROM channels ORDER BY created_at LIMIT 1)").run();
const n = db.prepare("SELECT (SELECT COUNT(*) FROM calls) calls, (SELECT COUNT(*) FROM tails) tails").get();
db.close();

const cfg = loadConfig({
  TELEGRAM_BOT_TOKEN: "123:local-recording-no-telegram", TAIL_KEK: randomBytes(32).toString("base64"), TAIL_DB: copy, TAIL_MODE: "dev",
  PORT: String(port), PUBLIC_URL: `http://localhost:${port}`,
});
const app = await createApp(cfg, { botInfo: { id: 1, is_bot: true, first_name: "Tail", username: "tailstrikebot" } as never, staticDir: "web/dist" });
await app.server.listen({ port, host: "127.0.0.1" });
console.log(`demo site on http://127.0.0.1:${port}  (copy of the dev database: ${JSON.stringify(n)}; channel page /c/tailsample)`);
