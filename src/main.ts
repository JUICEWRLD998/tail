// Entrypoint. Dev: long polling with the dev bot token. Prod: HTTP server plus Telegram webhook.
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const app = await createApp(loadConfig(process.env));

const stop = async () => {
  await app.stop();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

await app.start();
