import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { synthesize } from "./server/tts";

function ttsDevMiddleware(): Plugin {
  return {
    name: "tts-dev-middleware",
    configureServer(server) {
      server.middlewares.use("/api/tts", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.from(chunk));
        }

        let text: string | undefined;
        let voice: string | undefined;
        let realtime: boolean | undefined;
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          text = body.text;
          voice = body.voice;
          realtime = body.realtime;
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON body" }));
          return;
        }

        try {
          const result = await synthesize(text ?? "", voice, realtime);

          if (realtime) {
            const json = JSON.stringify({
              audio: result.audio.toString("base64"),
              words: result.words,
            });
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(json),
            });
            res.end(json);
          } else {
            res.writeHead(200, {
              "Content-Type": "audio/mpeg",
              "Content-Length": result.audio.length,
            });
            res.end(result.audio);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "TTS synthesis failed";
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ttsDevMiddleware()],
});
