// Lab88 server
//  - SQLite persistence (server/db.js); seed on first run
//  - Static frontend served from public/
//  - REST API for fleet data + mutations
//  - SSE proxy to Anthropic Messages API for the in-app AI panel

require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const dbApi = require("./db");
const { seed } = require("./seed");
const parsers = require("./parsers");

const PORT  = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!dbApi.isSeeded()) {
  console.log("Empty DB — seeding rule library (fleet stays empty)…");
  seed();
  console.log("Seeded.");
}

const app = express();
// Raised limit to comfortably carry a downsized filter-patch JPEG as a
// base64 data URL inside the POST body.
app.use(express.json({ limit: "8mb" }));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));
app.get("/", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "Lab88.html")));
// Backwards-compat redirect for the legacy /Oilwatch.html bookmark.
app.get("/Oilwatch.html", (_req, res) => res.redirect(301, "/"));

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL, hasKey: !!API_KEY }));

// ---- Bootstrap: returns the full fleet snapshot in one call ----------
app.get("/api/bootstrap", (_req, res) => {
  try { res.json(dbApi.getBootstrap()); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ---- Sites / Locations / Asset Types / Engines management -----------
app.post("/api/sites", (req, res) => {
  const { name, code, region } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try { res.json(dbApi.createSite({ name, code, region })); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});
app.post("/api/sites/:siteId/locations", (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try { res.json(dbApi.createLocation(req.params.siteId, name)); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});
app.delete("/api/locations/:id", (req, res) => {
  try { dbApi.deleteLocation(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/sites/:siteId/asset-types", (req, res) => {
  const { name, locationId } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try { res.json(dbApi.createAssetType(req.params.siteId, locationId, name)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/asset-types/:id", (req, res) => {
  try { dbApi.deleteAssetType(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/asset-classes", (req, res) => {
  const { label, section } = req.body || {};
  if (!label) return res.status(400).json({ error: "label required" });
  try { res.json(dbApi.createAssetClass({ label, section })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete("/api/asset-classes/:id", (req, res) => {
  try { dbApi.deleteAssetClass(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/oils", (req, res) => {
  try { res.json(dbApi.createOil(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/oils/:id", (req, res) => {
  try { dbApi.deleteOil(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

app.post("/api/params-custom", (req, res) => {
  try { res.json(dbApi.createParam(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/params-custom/:code", (req, res) => {
  try { dbApi.deleteParam(req.params.code); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// AI library: list cached responses (with optional filters by asset
// or section, and a free-text search). The same data backs the AI
// Library screen.
app.get("/api/ai/library", (req, res) => {
  try {
    const out = dbApi.listAIResponses({
      assetId: req.query.assetId || null,
      section: req.query.section || null,
      q: req.query.q || null,
      limit: Math.min(parseInt(req.query.limit || "100", 10) || 100, 500),
    });
    res.json({ responses: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/engines", (req, res) => {
  const e = req.body || {};
  if (!e.siteId || !e.name) return res.status(400).json({ error: "siteId and name required" });
  try { res.json(dbApi.createEngine(e)); }
  catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ---- Instrument-file parsers ----------------------------------------
// Each accepts a CSV string in `csv` and returns { readings: [{code, value}] }.
function parseHandler(parserFn) {
  return (req, res) => {
    const { csv } = req.body || {};
    if (typeof csv !== "string" || !csv.trim()) {
      return res.status(400).json({ error: "csv text required" });
    }
    try { res.json(parserFn(csv)); }
    catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  };
}
app.post("/api/parse/ir-vision",   parseHandler(parsers.parseIRVisionCSV));
app.post("/api/parse/flash-point", parseHandler(parsers.parseFlashPointCSV));
app.post("/api/parse/additives",   parseHandler(parsers.parseAdditivesCSV));

// ---- Lab branding ---------------------------------------------------
// Single global branding record drives the report header (lab name,
// accent color, logo, tagline). Stored as a single-row table in SQLite.
app.get("/api/branding", (_req, res) => {
  try { res.json(dbApi.getBranding()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put("/api/branding", (req, res) => {
  try { res.json(dbApi.saveBranding(req.body || {})); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Samples ---------------------------------------------------------
app.post("/api/samples", (req, res) => {
  const s = req.body || {};
  // assetId is optional — the instrument listener can drop a draft
  // sample into the inbox before an analyst has linked it to an
  // engine. UI-driven Log Sample submissions still pass one.
  const id = s.id || dbApi.nextSampleId();
  const payload = {
    id,
    barcode: s.barcode || ("AOA" + (240000 + Math.floor(Math.random() * 9999))),
    assetId: s.assetId || null,
    component: s.component || "Sump Drain",
    oil: s.oil || "—",
    receivedAt: s.receivedAt || new Date().toISOString(),
    status: s.status || "DRAFT",
    priority: s.priority || "STD",
    score: s.score ?? 80,
    code: s.code ?? 1,
    analyst: s.analyst || "—",
    flags: s.flags || [],
    results: s.results || null,
    sampleType: s.sampleType || "piston-oil",
    filterPatch: s.filterPatch || null,
    note: s.note || null,
    irVisionData:   s.irVisionData   || null,
    flashPointData: typeof s.flashPointData === "number" ? s.flashPointData : null,
    additivesData:  s.additivesData  || null,
    irVisionFile:   s.irVisionFile   || null,
    flashPointFile: s.flashPointFile || null,
    additivesFile:  s.additivesFile  || null,
  };
  try { dbApi.createSample(payload); res.json({ ok: true, id }); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// Attach (or clear) a filter-patch image on an existing sample.
// Body: { dataUrl } — a downsized JPEG/PNG data URL, or null to clear.
app.put("/api/samples/:id/filter-patch", (req, res) => {
  const { dataUrl } = req.body || {};
  dbApi.setFilterPatch(req.params.id, dataUrl || null);
  res.json({ ok: true });
});
app.put("/api/samples/:id", (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  dbApi.setSampleStatus(req.params.id, status);
  res.json({ ok: true });
});

// ---- Alarms ----------------------------------------------------------
app.put("/api/alarms/:id", (req, res) => {
  const { acknowledged } = req.body || {};
  dbApi.setAlarmAck(req.params.id, !!acknowledged);
  res.json({ ok: true });
});
app.post("/api/alarms/ack-all", (_req, res) => {
  dbApi.ackAllAlarms();
  res.json({ ok: true });
});

// ---- Limits ----------------------------------------------------------
app.put("/api/limits/:scope/:param", (req, res) => {
  dbApi.setLimit(req.params.scope, req.params.param, req.body || {});
  res.json({ ok: true });
});
app.delete("/api/limits/:scope", (req, res) => {
  dbApi.resetLimits(req.params.scope);
  res.json({ ok: true });
});

// ---- Rules -----------------------------------------------------------
app.post("/api/rules", (req, res) => {
  const r = req.body || {};
  if (!r.id) r.id = dbApi.nextRuleId();
  if (!r.createdAt) r.createdAt = new Date().toISOString();
  dbApi.saveRule(r);
  res.json({ ok: true, id: r.id });
});
app.put("/api/rules/:id", (req, res) => {
  dbApi.saveRule({ ...req.body, id: req.params.id });
  res.json({ ok: true });
});
app.delete("/api/rules/:id", (req, res) => {
  dbApi.deleteRule(req.params.id);
  res.json({ ok: true });
});
app.get("/api/rules/next-id", (_req, res) => res.json({ id: dbApi.nextRuleId() }));

// ---- AI proxy (Claude Sonnet, SSE pass-through, with web_search + cache) ---
//
// Differences from the previous version:
//   * Server-side context enrichment — when the client tells us a
//     sample / asset is focused, we re-fetch from SQLite and append a
//     rich JSON blob to the system prompt so the model knows the
//     engine, recent samples, and current limits without trusting the
//     client.
//   * Equipment-aware system prompt — aviation classes get an FAA AD
//     directive; industrial / diesel classes get OEM service-bulletin
//     framing.
//   * `web_search` tool enabled — Claude can hit the internet during a
//     response. Allowed domains are scoped per asset.
//   * Cache — every (queryHash, asset, section) tuple is persisted
//     alongside the model's response and any citations. Re-asking the
//     same question replays the cached text token-by-token instead of
//     burning credits.

const AVIATION_CLASSES = new Set(["lyco4","lyco6","conto4","conto6","rotax","radial"]);
const AVIATION_DOMAINS = [
  "faa.gov","drs.faa.gov","easa.europa.eu","ntsb.gov",
  "lycoming.com","continental.aero","rotax-owner.com","aopa.org",
];
const INDUSTRIAL_DOMAINS = [
  "cummins.com","cat.com","mtu-solutions.com","kohlerengines.com","perkins.com",
  "sans.co.za","astm.org",
];
const CACHE_TTL_SEC = 7 * 24 * 60 * 60;  // 7 days

function normaliseQuestion(q) {
  return String(q || "").toLowerCase().replace(/\s+/g, " ").trim();
}
function queryHashFor({ question, assetId, section, domains }) {
  const blob = JSON.stringify({
    q: normaliseQuestion(question),
    a: assetId || "",
    s: section || "",
    d: (domains || []).slice().sort(),
  });
  return crypto.createHash("sha256").update(blob).digest("hex");
}
function pickDomainsForAsset(engine, section) {
  if (section === "diesel") return INDUSTRIAL_DOMAINS;
  if (engine && (AVIATION_CLASSES.has(engine.class) || engine.aircraft_reg)) return AVIATION_DOMAINS;
  return INDUSTRIAL_DOMAINS;
}
function pickGuidanceForAsset(engine, section) {
  if (section === "diesel") return "This is a SANS 342:2016 diesel-fuel context. Cite ASTM / SANS standards and Cummins / Caterpillar / MTU service bulletins where relevant.";
  if (engine && (AVIATION_CLASSES.has(engine.class) || engine.aircraft_reg)) {
    return "This is an aviation oil-analysis context"
      + (engine.aircraft_reg ? ` for tail ${engine.aircraft_reg}` : "")
      + `. When relevant, search FAA Airworthiness Directives and quote AD numbers, effective dates, and applicable models. Engine families seen in this lab: Lycoming 4/6-cyl, Continental 4/6-cyl, Rotax, radial — only invoke aviation framing when the asset actually matches.`;
  }
  return "This is an industrial / marine / hydraulic oil-analysis context. Cite OEM service bulletins (Cummins, Caterpillar, Kohler, Perkins) rather than aviation references.";
}

function buildEnrichedContext({ context }) {
  const out = { ...context, focusedDetails: null, recentSamples: [], engine: null, sample: null };
  const f = context && context.focused;
  if (!f) return out;
  if (f.kind === "asset") {
    const eng = dbApi.getEngineById(f.id);
    if (eng) {
      out.engine = eng;
      out.recentSamples = dbApi.getRecentSamplesForEngine(eng.id, 5);
    }
  } else if (f.kind === "sample") {
    const sample = dbApi.getSampleById(f.id);
    if (sample) {
      out.sample = sample;
      if (sample.engine_id) {
        out.engine = dbApi.getEngineById(sample.engine_id);
        out.recentSamples = dbApi.getRecentSamplesForEngine(sample.engine_id, 5);
      }
    }
  }
  return out;
}

// Anthropic SSE stream — strips upstream tokens into our cache layer
// AND forwards them to the client. We re-emit our own SSE lines so the
// existing client (`content_block_delta` parser in ai-panel.jsx)
// keeps working unchanged.
async function streamFromAnthropic({ res, body, onCapture }) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    res.status(upstream.status).type("text/plain").send(text || "Anthropic API error");
    return null;
  }
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("x-accel-buffering", "no");
  res.flushHeaders?.();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let accText = "";
  const citations = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const raw = Buffer.from(value);
      // Pass straight through to the client unmodified.
      res.write(raw);
      // And tap the stream to capture text + citations for the cache.
      buf += decoder.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() || "";
      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              accText += evt.delta.text;
            }
            // Anthropic streams web_search tool results as content blocks
            // with `type: "web_search_tool_result"` and a `content`
            // array of {type:"web_search_result", url, title, ...}.
            if (evt.type === "content_block_start" && evt.content_block?.type === "web_search_tool_result") {
              const results = evt.content_block.content || [];
              for (const r of results) {
                if (r.type === "web_search_result" && r.url) {
                  let domain = "";
                  try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch (_) {}
                  citations.push({ url: r.url, title: r.title || null, domain, snippet: r.encrypted_content ? null : (r.snippet || null) });
                }
              }
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
  res.end();
  if (onCapture) onCapture({ text: accText, citations });
}

app.post("/api/analyze", async (req, res) => {
  if (!API_KEY) {
    res.status(500).type("text/plain").send("ANTHROPIC_API_KEY is not set on the server.");
    return;
  }
  const { messages = [], context = {}, options = {} } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).type("text/plain").send("messages array required");
    return;
  }

  // Re-fetch focused engine / sample from the DB so the AI sees the
  // canonical state instead of whatever happened to be in the client's
  // window.* snapshot.
  const ctx = buildEnrichedContext({ context });
  const section = ctx.section || (ctx.engine && ctx.engine.section) || "oil";
  const domains = pickDomainsForAsset(ctx.engine, section);
  const guidance = pickGuidanceForAsset(ctx.engine, section);
  const branding = dbApi.getBranding();

  const userQuestion = (messages[messages.length - 1] && messages[messages.length - 1].content) || "";

  // Cache key includes the focused asset/sample, the section, and the
  // domain allowlist — so the same question about a different engine
  // gets a fresh answer, but re-opening the same sample replays.
  const focusedAssetId = (ctx.engine && ctx.engine.id) || null;
  const focusedSampleId = (ctx.sample && ctx.sample.id) || null;
  const queryHash = queryHashFor({ question: userQuestion, assetId: focusedAssetId, section, domains });

  // Cache replay path — unless the client asked for a fresh answer.
  if (!options.skipCache) {
    const cached = dbApi.findCachedAIResponse(queryHash, CACHE_TTL_SEC);
    if (cached) {
      dbApi.bumpAIReplay(cached.id);
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders?.();
      // Emit a single Lab88-only event the client uses to render the
      // "served from cache" badge.
      res.write(`event: lab88_cache\ndata: ${JSON.stringify({ id: cached.id, hits: cached.hits + 1, citations: cached.citations })}\n\n`);
      // Token-by-token replay so the UI feel matches a live call.
      res.write(`data: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`);
      const text = cached.responseText || "";
      const chunkSize = 6;
      for (let i = 0; i < text.length; i += chunkSize) {
        const piece = text.slice(i, i + chunkSize);
        res.write(`data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: piece } })}\n\n`);
        await new Promise(r => setTimeout(r, 12));
      }
      res.write(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`);
      res.end();
      return;
    }
  }

  const systemLines = [
    `You are the AI assistant for ${branding?.labName || "Lab88"}, an oil & fuel analysis lab.`,
    guidance,
    "Be concise and direct. Use plain English unless the user asks for depth.",
    "When you reference a sample, engine, or alarm, cite its ID inline (e.g. S-50250, A-1015, AL-12345).",
    "When you use web search, cite the source URL inline with the model / engine / standard you're quoting.",
    "If the user's question is ambiguous, ask one short follow-up rather than guessing.",
  ];
  // Append the structured context as a JSON block at the bottom so the
  // model has the canonical fleet state in one place.
  const compactCtx = {
    route: ctx.route, role: ctx.role, siteFilter: ctx.siteFilter, section,
    branding: { labName: branding?.labName, tagline: branding?.tagline },
    engine: ctx.engine ? {
      id: ctx.engine.id, name: ctx.engine.name, tag: ctx.engine.tag, oem: ctx.engine.oem,
      class: ctx.engine.class, classLabel: ctx.engine.class_label || ctx.engine.class_label_join,
      section: ctx.engine.section, aircraftReg: ctx.engine.aircraft_reg,
      runHours: ctx.engine.run_hours, criticality: ctx.engine.criticality,
      oil: { brand: ctx.engine.oil_brand, name: ctx.engine.oil_name, iso: ctx.engine.oil_iso },
      health: ctx.engine.health, code: ctx.engine.code,
      siteName: ctx.engine.site_name, locationName: ctx.engine.location_name, assetTypeName: ctx.engine.asset_type_name,
    } : null,
    sample: ctx.sample ? {
      id: ctx.sample.id, status: ctx.sample.status, score: ctx.sample.score, code: ctx.sample.code,
      sampleType: ctx.sample.sample_type, component: ctx.sample.component,
      receivedAt: ctx.sample.received_at, analyst: ctx.sample.analyst,
      results: JSON.parse(ctx.sample.results_json || "null"),
      flags: JSON.parse(ctx.sample.flags_json || "[]"),
    } : null,
    recentSamples: (ctx.recentSamples || []).map(s => ({
      id: s.id, receivedAt: s.received_at, status: s.status, score: s.score, code: s.code,
      sampleType: s.sample_type, results: JSON.parse(s.results_json || "null"),
    })),
  };
  const system = systemLines.join("\n") + "\n\nFleet context (JSON):\n" + JSON.stringify(compactCtx);

  const body = {
    model: MODEL,
    max_tokens: 1600,
    system,
    messages,
    stream: true,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, allowed_domains: domains }],
  };

  try {
    await streamFromAnthropic({
      res, body,
      onCapture: ({ text, citations }) => {
        // Persist whatever we captured for next time. Empty responses
        // (network error mid-stream) are skipped so we don't poison
        // the cache.
        if (!text || !text.trim()) return;
        try {
          dbApi.recordAIResponse({
            queryHash, assetId: focusedAssetId, sampleId: focusedSampleId, section,
            userQuestion, responseText: text, domains, citations,
          });
        } catch (e) { console.warn("AI cache write failed:", e.message); }
      },
    });
  } catch (e) {
    if (!res.headersSent) res.status(502).type("text/plain").send("Upstream fetch failed: " + e.message);
    else res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Lab88 → http://localhost:${PORT}  (model: ${MODEL}, key: ${API_KEY ? "set" : "MISSING"})`);
});
