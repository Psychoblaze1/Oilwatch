// Atomic Capital — server
//   - Serves the static dashboard from public/ (React 18 UMD + Babel, no build step)
//   - /api/ai  : SSE streaming proxy to the Claude Messages API for the in-app
//     AI co-pilot. The model is portfolio-, risk-, and EasyEquities-aware and can
//     use web search to pull live news / market context, citing its sources.
//
// The AI is the only server-side surface — market data is mocked in the client
// (public/data.js) and shaped so a real quote feed can drop in later.

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const quotes = require("./quotes");

const PORT = process.env.PORT || 3000;
// Default to the most capable model. Override with ANTHROPIC_MODEL in .env.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const API_KEY = process.env.ANTHROPIC_API_KEY;
// Web search lets the AI pull current prices / news. Disable with WEB_SEARCH=off.
const WEB_SEARCH = (process.env.WEB_SEARCH || "on").toLowerCase() !== "off";

const client = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

const app = express();
app.use(express.json({ limit: "1mb" }));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, model: MODEL, webSearch: WEB_SEARCH, hasKey: !!API_KEY })
);

// ----------------------------------------------------------------------------
// Real market data (Yahoo Finance proxy — see server/quotes.js)
//   GET /api/bootstrap          full snapshot: prices + 90d history + intraday + FX
//   GET /api/quotes?symbols=... lightweight current quotes for polling
// ----------------------------------------------------------------------------
app.get("/api/bootstrap", async (_req, res) => {
  try { res.json(await quotes.getBootstrap()); }
  catch (e) { console.error("bootstrap error:", e.message); res.status(502).json({ error: e.message }); }
});

app.get("/api/quotes", async (req, res) => {
  const symbols = (req.query.symbols || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  try { res.json(await quotes.getQuotes(symbols)); }
  catch (e) { console.error("quotes error:", e.message); res.status(502).json({ error: e.message }); }
});

// Real holdings written by the EasyEquities "cowork" sync (cowork/sync.js).
// Personal data, kept out of git; returns {holdings:null} until you've synced.
const HOLDINGS_FILE = path.join(__dirname, "data", "holdings.json");
app.get("/api/holdings", (_req, res) => {
  try {
    if (!fs.existsSync(HOLDINGS_FILE)) return res.json({ holdings: null, source: "sample" });
    res.json(JSON.parse(fs.readFileSync(HOLDINGS_FILE, "utf8")));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ----------------------------------------------------------------------------
// System prompt — turns the model into Atomic Capital's investment co-pilot.
// Risk appetite tunes the *tone*; the portfolio JSON gives it the user's
// actual holdings so it can "check the account" and reason about balance.
// ----------------------------------------------------------------------------
const RISK_TONE = {
  cons: "CONSERVATIVE — capital preservation first. Prefer smaller position sizes, wider margins of safety, and quality over speculation. Flag downside risk prominently.",
  bal: "BALANCED — a measured mix of growth and protection. Weigh upside against risk evenly.",
  agg: "AGGRESSIVE — maximise upside. Tolerate higher volatility and conviction sizing, but still call out where the user is over-exposed.",
};

function buildSystem(ctx) {
  const risk = RISK_TONE[ctx.risk] || RISK_TONE.bal;
  const lines = [
    "You are the AI investment co-pilot for **Atomic Capital**, a live dashboard that tracks a South-African retail investor's EasyEquities portfolio.",
    "The user invests mainly in the AI, quantum-computing and semiconductor/computing themes, plus broad-market ETFs (S&P 500, Nasdaq, JSE).",
    "EasyEquities holds two sub-accounts: a USD account (US shares) and a ZAR account (JSE shares / rand-denominated ETFs). Totals are blended into Rand at the USD/ZAR rate the client provides.",
    "",
    `Risk appetite for this session: ${risk}`,
    "",
    "How to respond:",
    "- Be concise, punchy and plain-English. Lead with the call, then the reasoning. No long preambles.",
    "- When asked *when* to invest, give concrete timing/levels (e.g. 'accumulate under $172', 'wait for a close above the 50-day') rather than vague advice.",
    "- Reference the user's actual holdings and buying power when relevant — call out concentration, currency mix, and balance.",
    "- For news / sentiment, use web search to pull current headlines and summarise them with a clear bullish / bearish / neutral read, citing the source URL.",
    "- Show prices in the share's native currency, but frame portfolio-level totals in Rand (R).",
    "- End genuinely uncertain answers with one short clarifying question instead of guessing.",
    "- This is research and education, not regulated financial advice — keep that framing implicit, don't moralise on every reply.",
  ];
  if (ctx.portfolio) {
    lines.push("", "The user's current portfolio (live values, JSON):", JSON.stringify(ctx.portfolio));
  }
  if (ctx.stock) {
    lines.push("", "The stock currently in focus (live, JSON):", JSON.stringify(ctx.stock));
  }
  if (ctx.view) lines.push("", `The user is currently on the "${ctx.view}" screen.`);
  return lines.join("\n");
}

function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// ----------------------------------------------------------------------------
// POST /api/ai  →  { messages:[{role,content}], context:{...} }
// Streams the assistant's reply back as Server-Sent Events:
//   {type:"text", text}     incremental answer text
//   {type:"citation", url, title}  a web-search source
//   {type:"done"}           end of turn
//   {type:"error", message} something went wrong
// ----------------------------------------------------------------------------
app.post("/api/ai", async (req, res) => {
  if (!client) {
    res.status(500).type("text/plain").send("ANTHROPIC_API_KEY is not set on the server.");
    return;
  }
  const { messages = [], context = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).type("text/plain").send("messages array required");
    return;
  }

  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders?.();

  const tools = WEB_SEARCH
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]
    : undefined;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: buildSystem(context),
      messages,
      ...(tools ? { tools } : {}),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        sse(res, { type: "text", text: event.delta.text });
      } else if (
        event.type === "content_block_start" &&
        event.content_block?.type === "web_search_tool_result"
      ) {
        for (const r of event.content_block.content || []) {
          if (r.type === "web_search_result" && r.url) {
            let domain = "";
            try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch (_) {}
            sse(res, { type: "citation", url: r.url, title: r.title || domain, domain });
          }
        }
      }
    }
    sse(res, { type: "done" });
    res.end();
  } catch (e) {
    console.error("AI stream error:", e);
    if (!res.writableEnded) {
      // Surface a clean message to the client over the open SSE channel.
      sse(res, { type: "error", message: e?.error?.error?.message || e.message || "AI request failed" });
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(
    `Atomic Capital → http://localhost:${PORT}  (model: ${MODEL}, web search: ${WEB_SEARCH ? "on" : "off"}, key: ${API_KEY ? "set" : "MISSING"})`
  );
});
