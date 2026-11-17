import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Serves /api/assistant during `npm run dev`, the same way Vercel does in production.
function assistantApi(env: Record<string, string>): Plugin {
  return {
    name: "assistant-api",
    configureServer(server) {
      server.middlewares.use("/api/assistant", async (req, res) => {
        const { handleAssistant } = await server.ssrLoadModule("/server/assistant.ts");
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        const request = new Request(`http://${req.headers.host}/api/assistant`, { method: req.method, headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
        const response: Response = await handleAssistant(request, env);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        if (!response.body) return res.end();
        const reader = response.body.getReader();
        res.on("close", () => reader.cancel().catch(() => {}));
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "AI_");
  return { plugins: [react(), assistantApi(env)] };
});
