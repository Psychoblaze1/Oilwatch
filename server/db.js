// SQLite-backed persistence for Oilwatch.
// One file (oilwatch.db) lives next to the server. On first start
// (or when the file is empty) we seed it from the same generator that
// originally lived in public/src/data.jsx so the demo never starts
// blank.

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.OILWATCH_DB || path.join(__dirname, "..", "oilwatch.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY, code TEXT, name TEXT, region TEXT,
    assets_count INTEGER, samples28d INTEGER
  );
  CREATE TABLE IF NOT EXISTS engines (
    id TEXT PRIMARY KEY, tag TEXT, name TEXT,
    site TEXT REFERENCES sites(id),
    class TEXT, class_label TEXT, oem TEXT,
    oil_brand TEXT, oil_name TEXT, oil_iso TEXT,
    run_hours INTEGER, criticality TEXT,
    health INTEGER, code INTEGER,
    dimensions_json TEXT,
    last_sample TEXT, next_due TEXT, rul_days INTEGER
  );
  CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    engine_id TEXT REFERENCES engines(id),
    component TEXT, oil_name TEXT,
    received_at TEXT,
    status TEXT, priority TEXT,
    score INTEGER, code INTEGER,
    analyst TEXT,
    flags_json TEXT,
    results_json TEXT,
    sample_type TEXT DEFAULT 'piston-oil',
    filter_patch TEXT,
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_samples_engine ON samples(engine_id);
  CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);

  CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    engine_id TEXT REFERENCES engines(id),
    severity TEXT, code INTEGER, rule TEXT,
    raised_at TEXT, rul_days INTEGER,
    acknowledged INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS limits (
    scope TEXT, param_code TEXT,
    warn REAL, alarm REAL, target REAL,
    PRIMARY KEY (scope, param_code)
  );
  CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT, enabled INTEGER, severity TEXT,
    scope_json TEXT, conditions_json TEXT, action TEXT,
    created_at TEXT, last_triggered TEXT
  );
`);

// Live-migrate older DBs that pre-date the diesel columns. SQLite's
// IF NOT EXISTS on CREATE TABLE skips adding columns, so we ALTER.
(function migrateSamples() {
  const cols = db.prepare("PRAGMA table_info(samples)").all().map(c => c.name);
  if (!cols.includes("sample_type")) {
    db.exec("ALTER TABLE samples ADD COLUMN sample_type TEXT DEFAULT 'piston-oil'");
    db.exec("UPDATE samples SET sample_type = 'piston-oil' WHERE sample_type IS NULL");
  }
  if (!cols.includes("filter_patch")) db.exec("ALTER TABLE samples ADD COLUMN filter_patch TEXT");
  if (!cols.includes("note"))         db.exec("ALTER TABLE samples ADD COLUMN note TEXT");
})();

function isSeeded() {
  return db.prepare("SELECT COUNT(*) AS n FROM engines").get().n > 0;
}

function getBootstrap() {
  const sites = db.prepare("SELECT id, code, name, region, assets_count AS assets, samples28d FROM sites").all();
  const engines = db.prepare(`
    SELECT e.id, e.tag, e.name, e.site, s.name AS siteName, e.class, e.class_label AS classLabel, e.oem,
           e.oil_brand AS oil_brand, e.oil_name AS oil_name, e.oil_iso AS oil_iso,
           e.run_hours AS runHours, e.criticality, e.health, e.code,
           e.dimensions_json AS dimensions_json,
           e.last_sample AS lastSample, e.next_due AS nextDue, e.rul_days AS rulDays
    FROM engines e LEFT JOIN sites s ON e.site = s.id
  `).all().map(r => ({
    id: r.id, tag: r.tag, name: r.name, site: r.site, siteName: r.siteName,
    class: r.class, classLabel: r.classLabel, oem: r.oem,
    oil: { brand: r.oil_brand, name: r.oil_name, iso: r.oil_iso },
    runHours: r.runHours, criticality: r.criticality, health: r.health, code: r.code,
    dimensions: JSON.parse(r.dimensions_json || "[]"),
    lastSample: r.lastSample, nextDue: r.nextDue, rulDays: r.rulDays,
  }));
  const samples = db.prepare(`
    SELECT sa.id, sa.barcode, sa.engine_id AS assetId, e.name AS assetName, e.tag AS assetTag,
           si.name AS siteName, sa.component, sa.oil_name AS oil,
           sa.received_at AS receivedAt, sa.status, sa.priority,
           sa.score, sa.code, sa.analyst, sa.flags_json, sa.results_json,
           sa.sample_type AS sampleType, sa.filter_patch AS filterPatch, sa.note
    FROM samples sa
    LEFT JOIN engines e ON sa.engine_id = e.id
    LEFT JOIN sites si ON e.site = si.id
    ORDER BY datetime(sa.received_at) DESC
  `).all().map(r => ({
    id: r.id, barcode: r.barcode, assetId: r.assetId, assetName: r.assetName, assetTag: r.assetTag,
    siteName: r.siteName, component: r.component, oil: r.oil,
    receivedAt: r.receivedAt, status: r.status, priority: r.priority,
    score: r.score, code: r.code, analyst: r.analyst,
    flags: JSON.parse(r.flags_json || "[]"),
    results: JSON.parse(r.results_json || "null"),
    sampleType: r.sampleType || "piston-oil",
    filterPatch: r.filterPatch || null,
    note: r.note || null,
  }));
  const alarms = db.prepare(`
    SELECT a.id, a.engine_id AS assetId, e.name AS assetName, e.tag AS assetTag,
           si.name AS site, a.severity, a.code, a.rule,
           a.raised_at AS raisedAt, a.rul_days AS rulDays, a.acknowledged
    FROM alarms a
    LEFT JOIN engines e ON a.engine_id = e.id
    LEFT JOIN sites si ON e.site = si.id
  `).all().map(r => ({ ...r, acknowledged: !!r.acknowledged }));
  const limits = db.prepare("SELECT scope, param_code AS paramCode, warn, alarm, target FROM limits").all();
  const rules = db.prepare(`
    SELECT id, name, enabled, severity, scope_json, conditions_json, action,
           created_at AS createdAt, last_triggered AS lastTriggered
    FROM rules ORDER BY datetime(created_at) DESC
  `).all().map(r => ({
    id: r.id, name: r.name, enabled: !!r.enabled, severity: r.severity,
    scope: JSON.parse(r.scope_json || "{}"),
    conditions: JSON.parse(r.conditions_json || "[]"),
    action: r.action, createdAt: r.createdAt, lastTriggered: r.lastTriggered,
  }));
  return { sites, engines, samples, alarms, limits, rules };
}

// ---- Mutations -------------------------------------------------------

const insertSampleStmt = db.prepare(`
  INSERT INTO samples (id, barcode, engine_id, component, oil_name, received_at,
                       status, priority, score, code, analyst, flags_json, results_json,
                       sample_type, filter_patch, note)
  VALUES (@id, @barcode, @engine_id, @component, @oil_name, @received_at,
          @status, @priority, @score, @code, @analyst, @flags_json, @results_json,
          @sample_type, @filter_patch, @note)
`);
function createSample(s) {
  insertSampleStmt.run({
    id: s.id,
    barcode: s.barcode,
    engine_id: s.assetId,
    component: s.component,
    oil_name: s.oil,
    received_at: s.receivedAt,
    status: s.status || "DRAFT",
    priority: s.priority || "STD",
    score: s.score,
    code: s.code,
    analyst: s.analyst || "—",
    flags_json: JSON.stringify(s.flags || []),
    results_json: s.results ? JSON.stringify(s.results) : null,
    sample_type: s.sampleType || "piston-oil",
    filter_patch: s.filterPatch || null,
    note: s.note || null,
  });
}

const updateFilterPatchStmt = db.prepare("UPDATE samples SET filter_patch = ? WHERE id = ?");
function setFilterPatch(id, dataUrl) { updateFilterPatchStmt.run(dataUrl || null, id); }

function nextSampleId() {
  const row = db.prepare("SELECT id FROM samples ORDER BY id DESC LIMIT 1").get();
  const n = row ? parseInt(String(row.id).replace(/\D/g, ""), 10) : 50230;
  return "S-" + (n + 1);
}

const updateSampleStatusStmt = db.prepare("UPDATE samples SET status = ? WHERE id = ?");
function setSampleStatus(id, status) { updateSampleStatusStmt.run(status, id); }

const updateAlarmAckStmt = db.prepare("UPDATE alarms SET acknowledged = ? WHERE id = ?");
function setAlarmAck(id, ack) { updateAlarmAckStmt.run(ack ? 1 : 0, id); }
function ackAllAlarms() { db.prepare("UPDATE alarms SET acknowledged = 1").run(); }

const upsertLimitStmt = db.prepare(`
  INSERT INTO limits (scope, param_code, warn, alarm, target) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(scope, param_code) DO UPDATE SET warn = excluded.warn, alarm = excluded.alarm, target = excluded.target
`);
const deleteLimitStmt = db.prepare("DELETE FROM limits WHERE scope = ? AND param_code = ?");
function setLimit(scope, paramCode, patch) {
  if (patch == null) { deleteLimitStmt.run(scope, paramCode); return; }
  upsertLimitStmt.run(scope, paramCode, patch.warn ?? null, patch.alarm ?? null, patch.target ?? null);
}
function resetLimits(scope) {
  db.prepare("DELETE FROM limits WHERE scope = ?").run(scope);
}

const upsertRuleStmt = db.prepare(`
  INSERT INTO rules (id, name, enabled, severity, scope_json, conditions_json, action, created_at, last_triggered)
  VALUES (@id, @name, @enabled, @severity, @scope_json, @conditions_json, @action, @created_at, @last_triggered)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name, enabled = excluded.enabled, severity = excluded.severity,
    scope_json = excluded.scope_json, conditions_json = excluded.conditions_json,
    action = excluded.action, last_triggered = excluded.last_triggered
`);
function saveRule(r) {
  upsertRuleStmt.run({
    id: r.id, name: r.name || "", enabled: r.enabled ? 1 : 0, severity: r.severity || "WARN",
    scope_json: JSON.stringify(r.scope || { classes: "all" }),
    conditions_json: JSON.stringify(r.conditions || []),
    action: r.action || "alarm",
    created_at: r.createdAt || new Date().toISOString(),
    last_triggered: r.lastTriggered || null,
  });
}
function deleteRule(id) { db.prepare("DELETE FROM rules WHERE id = ?").run(id); }
function nextRuleId() {
  const row = db.prepare("SELECT id FROM rules ORDER BY id DESC LIMIT 1").get();
  const n = row ? parseInt(String(row.id).split("-")[1] || "0", 10) : 0;
  return "R-" + String(n + 1).padStart(3, "0");
}

module.exports = {
  db,
  isSeeded,
  getBootstrap,
  createSample, nextSampleId,
  setSampleStatus,
  setFilterPatch,
  setAlarmAck, ackAllAlarms,
  setLimit, resetLimits,
  saveRule, deleteRule, nextRuleId,
};
