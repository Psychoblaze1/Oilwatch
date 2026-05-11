// Oilwatch server
// - Serves the static prototype out of public/ (drop-in for new design exports)
// - Proxies POST /api/analyze to the Anthropic Messages API and streams SSE back

require("dotenv").config();
const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json({ limit: "1mb" }));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

// Root → the prototype entry. Keeps the URL clean on AWS.
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "Oilwatch.html")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: !!API_KEY });
});

app.post("/api/analyze", async (req, res) => {
  if (!API_KEY) {
    res.status(500).type("text/plain").send("ANTHROPIC_API_KEY is not set on the server.");
    return;
  }
  const { messages = [], context = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).type("text/plain").send("messages array required");
    return;
  }

  const system = [
    "You are the Oilwatch AI assistant for a Lab88 VU oil-analysis LIMS.",
    "You help reliability engineers, analysts and managers reason about wear metals, viscosity, water content, particle counts (ISO 4406), and failure-mode patterns across an industrial fleet.",
    "Be concise and direct. Use plain English unless the user asks for technical depth.",
    "When you reference a sample, asset, or alarm, cite its ID inline (e.g. S-50250, A-1015).",
    "If the user's question is ambiguous, ask one short follow-up rather than guessing.",
    `Session context: ${JSON.stringify(context)}`,
  ].join("\n");

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages,
        stream: true,
      }),
    });
  } catch (e) {
    res.status(502).type("text/plain").send("Upstream fetch failed: " + e.message);
    return;
  }

  if (!upstream.ok || !upstream.body) {
    const body = await upstream.text().catch(() => "");
    res.status(upstream.status).type("text/plain").send(body || "Anthropic API error");
    return;
  }

  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders?.();

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    // Client disconnected or upstream errored mid-stream; close politely.
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Oilwatch → http://localhost:${PORT}  (model: ${MODEL}, key: ${API_KEY ? "set" : "MISSING"})`);
});
