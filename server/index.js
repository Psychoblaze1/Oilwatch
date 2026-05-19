// Lab88 server
//  - SQLite persistence (server/db.js); seed on first run
//  - Static frontend served from public/
//  - REST API for fleet data + mutations
//  - SSE proxy to Anthropic Messages API for the in-app AI panel

require("dotenv").config();
const path = require("path");
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

// ---- AI proxy (Claude Sonnet, SSE pass-through) ----------------------
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
    "You are the Lab88 AI assistant for a piston-aircraft oil-analysis and SANS 342 diesel-fuel testing lab.",
    "You help A&P mechanics, owner-operators, flight schools, and lab analysts reason about wear metals (Fe, Cr, Al, Cu, Ni), silicon, lead (always high from 100LL avgas — usually NOT alarming), viscosity at 100°C, water, and fuel dilution.",
    "Engine families: Lycoming 4/6-cyl, Continental 4/6-cyl, Rotax, radial. Watch especially for the Lycoming cam/lifter corrosion-driven wear signature (Fe + Cr running together on low-utilization engines).",
    "Be concise and direct. Use plain English unless the user asks for depth.",
    "When you reference a sample, engine, or alarm, cite its ID inline (e.g. S-50250, A-1015, AL-12345).",
    "If the user's question is ambiguous, ask one short follow-up rather than guessing.",
    `Session context: ${JSON.stringify(context)}`,
  ].join("\n");
  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages, stream: true }),
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
  } catch (_) {} finally { res.end(); }
});

app.listen(PORT, () => {
  console.log(`Lab88 → http://localhost:${PORT}  (model: ${MODEL}, key: ${API_KEY ? "set" : "MISSING"})`);
});
