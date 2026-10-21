import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Built to web/dist and served by the Fastify server. In dev, /api is proxied to the local server.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: { proxy: { "/api": "http://127.0.0.1:3000" } },
});
