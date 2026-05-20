// SQLite-backed persistence for Lab88.
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
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    site_id TEXT REFERENCES sites(id),
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asset_types (
    id TEXT PRIMARY KEY,
    site_id TEXT REFERENCES sites(id),
    location_id TEXT REFERENCES locations(id),
    name TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_locations_site ON locations(site_id);
  CREATE INDEX IF NOT EXISTS idx_asset_types_site ON asset_types(site_id);
  -- User-defined asset classes (e.g. "Lycoming 4-cyl", "Caterpillar
  -- 3508 Genset"). Each belongs to a top-level section so the Oil /
  -- Diesel switcher knows where to surface it.
  CREATE TABLE IF NOT EXISTS asset_classes (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    section TEXT NOT NULL DEFAULT 'oil' CHECK (section IN ('oil','diesel')),
    is_builtin INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS engines (
    id TEXT PRIMARY KEY, tag TEXT, name TEXT,
    site TEXT REFERENCES sites(id),
    location_id TEXT REFERENCES locations(id),
    asset_type_id TEXT REFERENCES asset_types(id),
    section TEXT NOT NULL DEFAULT 'oil' CHECK (section IN ('oil','diesel')),
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
    note TEXT,
    ir_vision_data TEXT,
    flash_point_data REAL,
    additives_data TEXT,
    ir_vision_file TEXT,
    flash_point_file TEXT,
    additives_file TEXT
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
  -- Operators of the lab. There is no real auth in v1; the first row
  -- is loaded as the active user. Adding a real auth layer later is a
  -- one-place change in /api/bootstrap.
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT,
    role  TEXT NOT NULL CHECK (role IN ('TECH','ANALYST','MANAGER','ADMIN'))
  );
  -- Single-row table that stores lab-wide report branding: lab name,
  -- accent color, and a small logo (PNG/JPEG data URL).
  CREATE TABLE IF NOT EXISTS branding (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    lab_name TEXT, accent_color TEXT, logo TEXT, tagline TEXT
  );
  -- Customer-managed lubricant catalogue. Replaces the hardcoded
  -- aviation-only OILS array in data.jsx so the dropdown can show
  -- both aviation oils and industrial / marine / hydraulic / gearbox
  -- lubricants without code edits.
  CREATE TABLE IF NOT EXISTS oils (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL, name TEXT NOT NULL,
    iso TEXT,           -- viscosity grade (SAE 50, ISO VG 68, etc.)
    section TEXT NOT NULL DEFAULT 'oil' CHECK (section IN ('oil','diesel')),
    category TEXT,      -- "aviation" | "industrial" | "marine" | "hydraulic" | "gearbox" | "fuel"
    is_builtin INTEGER NOT NULL DEFAULT 0
  );
  -- Customer-defined test parameters (TBN, TAN, Soot %, etc.) that
  -- aren't in the built-in catalogue. Merges with PARAM_DEFS /
  -- DIESEL_PARAMS at bootstrap so the rest of the app sees one
  -- unified parameter list.
  CREATE TABLE IF NOT EXISTS params_custom (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL, unit TEXT, method TEXT,
    section TEXT NOT NULL DEFAULT 'oil' CHECK (section IN ('oil','diesel')),
    dir TEXT NOT NULL DEFAULT 'info' CHECK (dir IN ('info','warn','min','max','range')),
    warn REAL, alarm REAL, target REAL,
    min_v REAL, max_v REAL
  );
  -- Cache of AI responses + their web citations. Lets us replay
  -- recent answers for the same question/asset combination without
  -- re-billing the model, and powers the AI Library screen.
  CREATE TABLE IF NOT EXISTS ai_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL,
    asset_id TEXT,
    sample_id TEXT,
    section TEXT,
    user_question TEXT NOT NULL,
    response_text TEXT NOT NULL,
    domains_json TEXT,
    created_at TEXT NOT NULL,
    last_replayed_at TEXT,
    hits INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_ai_responses_hash ON ai_responses(query_hash);
  CREATE INDEX IF NOT EXISTS idx_ai_responses_asset ON ai_responses(asset_id);
  CREATE TABLE IF NOT EXISTS ai_citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER NOT NULL REFERENCES ai_responses(id) ON DELETE CASCADE,
    url TEXT NOT NULL, title TEXT, domain TEXT, snippet TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ai_citations_response ON ai_citations(response_id);
  CREATE INDEX IF NOT EXISTS idx_ai_citations_domain ON ai_citations(domain);
`);
// Make sure the single branding row exists so PUTs always have a row
// to update.
db.prepare(`
  INSERT OR IGNORE INTO branding (id, lab_name, accent_color, logo, tagline)
  VALUES (1, 'Lab88', '#c2410c', NULL, 'Lab88 - advisory report; not a substitute for proper engine maintenance.')
`).run();
// One-shot rebrand migration: bump the lab name from the legacy
// "Oilwatch" default to "Lab88" so existing installs that never
// customised branding pick up the new name. Customer-set values like
// "Atomic Oil Lab" are preserved (no row matches both predicates).
db.prepare(`
  UPDATE branding SET lab_name = 'Lab88',
                      tagline = 'Lab88 - advisory report; not a substitute for proper engine maintenance.'
  WHERE id = 1 AND lab_name = 'Oilwatch'
`).run();

// Seed the single admin user. INSERT OR IGNORE is keyed on the primary
// key so customising name/email/role later doesn't get clobbered.
db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, role)
  VALUES (1, 'Brandon Cooley', 'Brandon@atomicoil.co.za', 'ADMIN')
`).run();

// Live-migrate older DBs that pre-date later columns. SQLite skips
// adding columns on CREATE TABLE IF NOT EXISTS, so we ALTER as needed.
(function migrate() {
  const sampleCols = db.prepare("PRAGMA table_info(samples)").all().map(c => c.name);
  if (!sampleCols.includes("sample_type")) {
    db.exec("ALTER TABLE samples ADD COLUMN sample_type TEXT DEFAULT 'piston-oil'");
    db.exec("UPDATE samples SET sample_type = 'piston-oil' WHERE sample_type IS NULL");
  }
  if (!sampleCols.includes("filter_patch"))     db.exec("ALTER TABLE samples ADD COLUMN filter_patch TEXT");
  if (!sampleCols.includes("note"))             db.exec("ALTER TABLE samples ADD COLUMN note TEXT");
  if (!sampleCols.includes("ir_vision_data"))   db.exec("ALTER TABLE samples ADD COLUMN ir_vision_data TEXT");
  if (!sampleCols.includes("flash_point_data")) db.exec("ALTER TABLE samples ADD COLUMN flash_point_data REAL");
  if (!sampleCols.includes("additives_data"))   db.exec("ALTER TABLE samples ADD COLUMN additives_data TEXT");
  if (!sampleCols.includes("ir_vision_file"))   db.exec("ALTER TABLE samples ADD COLUMN ir_vision_file TEXT");
  if (!sampleCols.includes("flash_point_file")) db.exec("ALTER TABLE samples ADD COLUMN flash_point_file TEXT");
  if (!sampleCols.includes("additives_file"))   db.exec("ALTER TABLE samples ADD COLUMN additives_file TEXT");

  const engineCols = db.prepare("PRAGMA table_info(engines)").all().map(c => c.name);
  if (!engineCols.includes("location_id"))   db.exec("ALTER TABLE engines ADD COLUMN location_id TEXT");
  if (!engineCols.includes("asset_type_id")) db.exec("ALTER TABLE engines ADD COLUMN asset_type_id TEXT");
  if (!engineCols.includes("section")) {
    db.exec("ALTER TABLE engines ADD COLUMN section TEXT NOT NULL DEFAULT 'oil'");
    // Best-effort: existing diesel-genset rows go to the diesel section.
    db.exec("UPDATE engines SET section = 'diesel' WHERE class = 'genset'");
  }
  // Tail number / registration — only meaningful on aviation classes.
  if (!engineCols.includes("aircraft_reg")) db.exec("ALTER TABLE engines ADD COLUMN aircraft_reg TEXT");

  // Diesel limits use min/max/range semantics instead of warn/alarm —
  // the existing schema only had warn/alarm/target so add the rest.
  const limitCols = db.prepare("PRAGMA table_info(limits)").all().map(c => c.name);
  if (!limitCols.includes("min_v")) db.exec("ALTER TABLE limits ADD COLUMN min_v REAL");
  if (!limitCols.includes("max_v")) db.exec("ALTER TABLE limits ADD COLUMN max_v REAL");
  if (!limitCols.includes("dir"))   db.exec("ALTER TABLE limits ADD COLUMN dir TEXT");
})();

// Seed the built-in asset classes once. Customer-added rows have
// is_builtin = 0; built-ins are protected from deletion.
const BUILTIN_CLASSES = [
  // Aviation
  { id: "lyco4",   label: "Lycoming 4-cyl",       section: "oil"    },
  { id: "lyco6",   label: "Lycoming 6-cyl",       section: "oil"    },
  { id: "conto4",  label: "Continental 4",        section: "oil"    },
  { id: "conto6",  label: "Continental 6",        section: "oil"    },
  { id: "rotax",   label: "Rotax",                section: "oil"    },
  { id: "radial",  label: "Radial",               section: "oil"    },
  // Industrial / marine — the "less aviation-focused" baseline.
  { id: "ind-diesel", label: "Industrial Diesel", section: "oil"    },
  { id: "marine",     label: "Marine Diesel",     section: "oil"    },
  { id: "gearbox",    label: "Gearbox",           section: "oil"    },
  { id: "hydraulic",  label: "Hydraulic System",  section: "oil"    },
  { id: "compressor", label: "Compressor",        section: "oil"    },
  // Diesel fuel
  { id: "genset",  label: "Diesel Genset",        section: "diesel" },
];
const insertBuiltinClass = db.prepare(
  "INSERT OR IGNORE INTO asset_classes (id, label, section, is_builtin) VALUES (?, ?, ?, 1)"
);
for (const c of BUILTIN_CLASSES) insertBuiltinClass.run(c.id, c.label, c.section);

// Built-in oil / lubricant catalogue. Seeded once; customers can add
// their own via Manage. Aviation rows live alongside industrial /
// marine / hydraulic so the oil-side dropdown isn't aviation-only.
const BUILTIN_OILS = [
  // Aviation
  { id: "aeroshell-w100",     brand: "AeroShell",  name: "AeroShell W100",         iso: "SAE 50",     category: "aviation"   },
  { id: "aeroshell-w100plus", brand: "AeroShell",  name: "AeroShell W100 Plus",    iso: "SAE 50",     category: "aviation"   },
  { id: "aeroshell-w80",      brand: "AeroShell",  name: "AeroShell W80",          iso: "SAE 40",     category: "aviation"   },
  { id: "aeroshell-15w50",    brand: "AeroShell",  name: "AeroShell 15W-50",       iso: "SAE 15W-50", category: "aviation"   },
  { id: "phillips-xc-20w50",  brand: "Phillips 66",name: "Phillips X/C 20W-50",    iso: "SAE 20W-50", category: "aviation"   },
  { id: "exxon-elite-20w50",  brand: "ExxonMobil", name: "Exxon Elite 20W-50",     iso: "SAE 20W-50", category: "aviation"   },
  { id: "aeroshell-sport-4",  brand: "AeroShell",  name: "AeroShell Sport Plus 4", iso: "SAE 10W-40", category: "aviation"   },
  // Industrial / heavy-duty diesel engine oil
  { id: "delo-400-15w40",     brand: "Chevron",    name: "Delo 400 SDE",           iso: "SAE 15W-40", category: "industrial" },
  { id: "rotella-t6-15w40",   brand: "Shell",      name: "Rotella T6",             iso: "SAE 15W-40", category: "industrial" },
  { id: "mobil-delvac-1540",  brand: "ExxonMobil", name: "Mobil Delvac MX",        iso: "SAE 15W-40", category: "industrial" },
  // Marine
  { id: "mobilgard-300",      brand: "ExxonMobil", name: "Mobilgard 300C",         iso: "SAE 30",     category: "marine"     },
  { id: "shell-argina-s40",   brand: "Shell",      name: "Argina S40",             iso: "SAE 40",     category: "marine"     },
  // Hydraulic
  { id: "mobil-dte-25",       brand: "ExxonMobil", name: "Mobil DTE 25",           iso: "ISO VG 46",  category: "hydraulic"  },
  { id: "shell-tellus-s2-46", brand: "Shell",      name: "Shell Tellus S2 M 46",   iso: "ISO VG 46",  category: "hydraulic"  },
  // Gearbox
  { id: "mobilgear-600-220",  brand: "ExxonMobil", name: "Mobilgear 600 XP 220",   iso: "ISO VG 220", category: "gearbox"    },
  { id: "shell-omala-s2-220", brand: "Shell",      name: "Shell Omala S2 GX 220",  iso: "ISO VG 220", category: "gearbox"    },
];
const insertBuiltinOil = db.prepare(
  "INSERT OR IGNORE INTO oils (id, brand, name, iso, section, category, is_builtin) VALUES (?, ?, ?, ?, 'oil', ?, 1)"
);
for (const o of BUILTIN_OILS) insertBuiltinOil.run(o.id, o.brand, o.name, o.iso, o.category);

// Returns true when one-time seeds (currently just the rule library)
// have been inserted. Engines / sites / samples are intentionally
// never seeded — the user registers their own fleet via Manage and
// Log Sample.
function isSeeded() {
  return db.prepare("SELECT COUNT(*) AS n FROM rules").get().n > 0;
}

function getBootstrap() {
  const sites = db.prepare("SELECT id, code, name, region, assets_count AS assets, samples28d FROM sites").all();
  const locations = db.prepare("SELECT id, site_id AS siteId, name FROM locations").all();
  const assetTypes = db.prepare("SELECT id, site_id AS siteId, location_id AS locationId, name FROM asset_types").all();
  const assetClasses = db.prepare(
    "SELECT id, label, section, is_builtin AS isBuiltin FROM asset_classes ORDER BY is_builtin DESC, label"
  ).all().map(r => ({ ...r, isBuiltin: !!r.isBuiltin }));
  const oils = db.prepare(
    "SELECT id, brand, name, iso, section, category, is_builtin AS isBuiltin FROM oils ORDER BY category, brand, name"
  ).all().map(r => ({ ...r, isBuiltin: !!r.isBuiltin }));
  const paramsCustom = db.prepare(
    "SELECT code, name, unit, method, section, dir, warn, alarm, target, min_v AS minV, max_v AS maxV FROM params_custom ORDER BY section, name"
  ).all();
  const engines = db.prepare(`
    SELECT e.id, e.tag, e.name, e.site, s.name AS siteName,
           e.location_id AS locationId, l.name AS locationName,
           e.asset_type_id AS assetTypeId, at.name AS assetTypeName,
           e.section, e.aircraft_reg AS aircraftReg,
           e.class, e.class_label AS classLabel, e.oem,
           e.oil_brand AS oil_brand, e.oil_name AS oil_name, e.oil_iso AS oil_iso,
           e.run_hours AS runHours, e.criticality, e.health, e.code,
           e.dimensions_json AS dimensions_json,
           e.last_sample AS lastSample, e.next_due AS nextDue, e.rul_days AS rulDays
    FROM engines e
    LEFT JOIN sites       s  ON e.site = s.id
    LEFT JOIN locations   l  ON e.location_id = l.id
    LEFT JOIN asset_types at ON e.asset_type_id = at.id
  `).all().map(r => ({
    id: r.id, tag: r.tag, name: r.name, site: r.site, siteName: r.siteName,
    locationId: r.locationId, locationName: r.locationName,
    assetTypeId: r.assetTypeId, assetTypeName: r.assetTypeName,
    section: r.section || "oil",
    aircraftReg: r.aircraftReg || null,
    class: r.class, classLabel: r.classLabel, oem: r.oem,
    oil: { brand: r.oil_brand, name: r.oil_name, iso: r.oil_iso },
    runHours: r.runHours, criticality: r.criticality, health: r.health, code: r.code,
    dimensions: JSON.parse(r.dimensions_json || "[]"),
    lastSample: r.lastSample, nextDue: r.nextDue, rulDays: r.rulDays,
  }));
  const samples = db.prepare(`
    SELECT sa.id, sa.barcode, sa.engine_id AS assetId, e.name AS assetName, e.tag AS assetTag,
           si.name AS siteName,
           l.id AS locationId, l.name AS locationName,
           at.id AS assetTypeId, at.name AS assetTypeName,
           sa.component, sa.oil_name AS oil,
           sa.received_at AS receivedAt, sa.status, sa.priority,
           sa.score, sa.code, sa.analyst, sa.flags_json, sa.results_json,
           sa.sample_type AS sampleType, sa.filter_patch AS filterPatch, sa.note,
           sa.ir_vision_data AS irVisionData, sa.flash_point_data AS flashPointData, sa.additives_data AS additivesData,
           sa.ir_vision_file AS irVisionFile, sa.flash_point_file AS flashPointFile, sa.additives_file AS additivesFile
    FROM samples sa
    LEFT JOIN engines      e  ON sa.engine_id = e.id
    LEFT JOIN sites        si ON e.site = si.id
    LEFT JOIN locations    l  ON e.location_id = l.id
    LEFT JOIN asset_types  at ON e.asset_type_id = at.id
    ORDER BY datetime(sa.received_at) DESC
  `).all().map(r => ({
    id: r.id, barcode: r.barcode, assetId: r.assetId, assetName: r.assetName, assetTag: r.assetTag,
    siteName: r.siteName,
    locationId: r.locationId, locationName: r.locationName,
    assetTypeId: r.assetTypeId, assetTypeName: r.assetTypeName,
    component: r.component, oil: r.oil,
    receivedAt: r.receivedAt, status: r.status, priority: r.priority,
    score: r.score, code: r.code, analyst: r.analyst,
    flags: JSON.parse(r.flags_json || "[]"),
    results: JSON.parse(r.results_json || "null"),
    sampleType: r.sampleType || "piston-oil",
    filterPatch: r.filterPatch || null,
    note: r.note || null,
    irVisionData:    JSON.parse(r.irVisionData || "null"),
    flashPointData:  r.flashPointData != null ? Number(r.flashPointData) : null,
    additivesData:   JSON.parse(r.additivesData || "null"),
    irVisionFile:    r.irVisionFile || null,
    flashPointFile:  r.flashPointFile || null,
    additivesFile:   r.additivesFile || null,
  }));
  const alarms = db.prepare(`
    SELECT a.id, a.engine_id AS assetId, e.name AS assetName, e.tag AS assetTag,
           si.name AS site, a.severity, a.code, a.rule,
           a.raised_at AS raisedAt, a.rul_days AS rulDays, a.acknowledged
    FROM alarms a
    LEFT JOIN engines e ON a.engine_id = e.id
    LEFT JOIN sites si ON e.site = si.id
  `).all().map(r => ({ ...r, acknowledged: !!r.acknowledged }));
  const limits = db.prepare(
    "SELECT scope, param_code AS paramCode, warn, alarm, target, min_v AS minV, max_v AS maxV, dir FROM limits"
  ).all();
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
  const branding = getBranding();
  const currentUser = getCurrentUser();
  return { sites, locations, assetTypes, assetClasses, oils, paramsCustom, engines, samples, alarms, limits, rules, branding, currentUser };
}

// ---- Users --------------------------------------------------------
function getCurrentUser() {
  return db.prepare("SELECT id, name, email, role FROM users ORDER BY id LIMIT 1").get()
    || { id: 1, name: "Operator", email: null, role: "ANALYST" };
}

// ---- Branding -----------------------------------------------------
function getBranding() {
  const r = db.prepare("SELECT lab_name AS labName, accent_color AS accentColor, logo, tagline FROM branding WHERE id = 1").get();
  return r || { labName: "Lab88", accentColor: "#c2410c", logo: null, tagline: null };
}
const updateBrandingStmt = db.prepare("UPDATE branding SET lab_name = ?, accent_color = ?, logo = ?, tagline = ? WHERE id = 1");
function saveBranding(b) {
  const cur = getBranding();
  updateBrandingStmt.run(
    b.labName    != null ? b.labName    : cur.labName,
    b.accentColor!= null ? b.accentColor: cur.accentColor,
    b.logo       !== undefined ? b.logo : cur.logo,
    b.tagline    != null ? b.tagline    : cur.tagline,
  );
  return getBranding();
}

// ---- Mutations -------------------------------------------------------

const insertSampleStmt = db.prepare(`
  INSERT INTO samples (id, barcode, engine_id, component, oil_name, received_at,
                       status, priority, score, code, analyst, flags_json, results_json,
                       sample_type, filter_patch, note,
                       ir_vision_data, flash_point_data, additives_data,
                       ir_vision_file, flash_point_file, additives_file)
  VALUES (@id, @barcode, @engine_id, @component, @oil_name, @received_at,
          @status, @priority, @score, @code, @analyst, @flags_json, @results_json,
          @sample_type, @filter_patch, @note,
          @ir_vision_data, @flash_point_data, @additives_data,
          @ir_vision_file, @flash_point_file, @additives_file)
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
    ir_vision_data:   s.irVisionData ? JSON.stringify(s.irVisionData) : null,
    flash_point_data: typeof s.flashPointData === "number" ? s.flashPointData : null,
    additives_data:   s.additivesData ? JSON.stringify(s.additivesData) : null,
    ir_vision_file:   s.irVisionFile || null,
    flash_point_file: s.flashPointFile || null,
    additives_file:   s.additivesFile || null,
  });
}

// --- Locations / Asset Types / Sites / Engines management ----------

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

const insertLocStmt = db.prepare("INSERT INTO locations (id, site_id, name) VALUES (?, ?, ?)");
function createLocation(siteId, name) {
  const id = uid("loc");
  insertLocStmt.run(id, siteId, name);
  return { id, siteId, name };
}
function deleteLocation(id) { db.prepare("DELETE FROM locations WHERE id = ?").run(id); }

// --- Asset Classes (user-defined) ----------------------------------
const insertAcStmt = db.prepare(
  "INSERT INTO asset_classes (id, label, section, is_builtin) VALUES (?, ?, ?, 0)"
);
function createAssetClass({ label, section }) {
  if (!label) throw new Error("label required");
  const s = section === "diesel" ? "diesel" : "oil";
  // Slug from label, dedup against existing ids.
  const base = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "class";
  let id = base, n = 1;
  while (db.prepare("SELECT 1 FROM asset_classes WHERE id = ?").get(id)) {
    id = base + "-" + (++n);
  }
  insertAcStmt.run(id, label, s);
  return { id, label, section: s, isBuiltin: false };
}
function deleteAssetClass(id) {
  // Built-in classes are protected (deleting one would orphan engines
  // and surprise other installs).
  const row = db.prepare("SELECT is_builtin FROM asset_classes WHERE id = ?").get(id);
  if (!row) return;
  if (row.is_builtin) throw new Error("built-in class can't be deleted");
  db.prepare("DELETE FROM asset_classes WHERE id = ?").run(id);
}

const insertAtStmt = db.prepare("INSERT INTO asset_types (id, site_id, location_id, name) VALUES (?, ?, ?, ?)");
function createAssetType(siteId, locationId, name) {
  const id = uid("at");
  insertAtStmt.run(id, siteId, locationId || null, name);
  return { id, siteId, locationId: locationId || null, name };
}
function deleteAssetType(id) { db.prepare("DELETE FROM asset_types WHERE id = ?").run(id); }

const insertSiteStmt = db.prepare("INSERT INTO sites (id, code, name, region, assets_count, samples28d) VALUES (?, ?, ?, ?, 0, 0)");
function createSite({ name, code, region }) {
  const id = uid("site");
  insertSiteStmt.run(id, code || "", name, region || "");
  return { id, code: code || "", name, region: region || "", assets: 0, samples28d: 0 };
}

const insertEngineStmt = db.prepare(`
  INSERT INTO engines (id, tag, name, site, location_id, asset_type_id, section, aircraft_reg,
                       class, class_label, oem, oil_brand, oil_name, oil_iso,
                       run_hours, criticality, health, code, dimensions_json,
                       last_sample, next_due, rul_days)
  VALUES (@id, @tag, @name, @site, @location_id, @asset_type_id, @section, @aircraft_reg,
          @class, @class_label, @oem, @oil_brand, @oil_name, @oil_iso,
          @run_hours, @criticality, @health, @code, @dimensions_json,
          @last_sample, @next_due, @rul_days)
`);
function createEngine(e) {
  const id = e.id || uid("A");
  // If a class was given but no section, inherit the class's section.
  let section = e.section;
  let classLabel = e.classLabel || null;
  if (e.classId) {
    const cls = db.prepare("SELECT label, section FROM asset_classes WHERE id = ?").get(e.classId);
    if (cls) {
      if (!section) section = cls.section;
      if (!classLabel) classLabel = cls.label;
    }
  }
  if (!section) section = "oil";
  insertEngineStmt.run({
    id,
    tag: e.tag || "",
    name: e.name || "",
    site: e.siteId || null,
    location_id: e.locationId || null,
    asset_type_id: e.assetTypeId || null,
    section,
    aircraft_reg: e.aircraftReg || null,
    class: e.classId || null,
    class_label: classLabel,
    oem: e.oem || null,
    oil_brand: e.oilBrand || null,
    oil_name:  e.oilName  || null,
    oil_iso:   e.oilIso   || null,
    run_hours: e.runHours ?? 0,
    criticality: e.criticality || "C",
    health: e.health ?? 90,
    code:   e.code   ?? 1,
    dimensions_json: JSON.stringify(e.dimensions || []),
    last_sample: e.lastSample || null,
    next_due:    e.nextDue || null,
    rul_days:    e.rulDays ?? 90,
  });
  return { id };
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
  INSERT INTO limits (scope, param_code, warn, alarm, target, min_v, max_v, dir)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(scope, param_code) DO UPDATE SET
    warn   = excluded.warn,
    alarm  = excluded.alarm,
    target = excluded.target,
    min_v  = excluded.min_v,
    max_v  = excluded.max_v,
    dir    = excluded.dir
`);
const deleteLimitStmt = db.prepare("DELETE FROM limits WHERE scope = ? AND param_code = ?");
function setLimit(scope, paramCode, patch) {
  if (patch == null) { deleteLimitStmt.run(scope, paramCode); return; }
  upsertLimitStmt.run(
    scope, paramCode,
    patch.warn   ?? null,
    patch.alarm  ?? null,
    patch.target ?? null,
    patch.min    ?? null,
    patch.max    ?? null,
    patch.dir    ?? null,
  );
}
function resetLimits(scope) {
  db.prepare("DELETE FROM limits WHERE scope = ?").run(scope);
}

// --- Oils CRUD -----------------------------------------------------
function createOil({ brand, name, iso, category, section }) {
  if (!brand || !name) throw new Error("brand and name required");
  const base = (brand + "-" + name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "oil";
  let id = base, n = 1;
  while (db.prepare("SELECT 1 FROM oils WHERE id = ?").get(id)) id = base + "-" + (++n);
  db.prepare(
    "INSERT INTO oils (id, brand, name, iso, section, category, is_builtin) VALUES (?, ?, ?, ?, ?, ?, 0)"
  ).run(id, brand, name, iso || null, section === "diesel" ? "diesel" : "oil", category || "industrial");
  return { id, brand, name, iso: iso || null, section: section || "oil", category: category || "industrial", isBuiltin: false };
}
function deleteOil(id) {
  const row = db.prepare("SELECT is_builtin FROM oils WHERE id = ?").get(id);
  if (!row) return;
  if (row.is_builtin) throw new Error("built-in oil can't be deleted");
  db.prepare("DELETE FROM oils WHERE id = ?").run(id);
}

// --- Custom parameters CRUD ----------------------------------------
function createParam(p) {
  if (!p.code || !p.name) throw new Error("code and name required");
  const code = String(p.code).trim();
  db.prepare(`
    INSERT INTO params_custom (code, name, unit, method, section, dir, warn, alarm, target, min_v, max_v)
    VALUES (@code, @name, @unit, @method, @section, @dir, @warn, @alarm, @target, @min_v, @max_v)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, unit = excluded.unit, method = excluded.method,
      section = excluded.section, dir = excluded.dir,
      warn = excluded.warn, alarm = excluded.alarm, target = excluded.target,
      min_v = excluded.min_v, max_v = excluded.max_v
  `).run({
    code,
    name: p.name,
    unit: p.unit || null,
    method: p.method || null,
    section: p.section === "diesel" ? "diesel" : "oil",
    dir: ["info","warn","min","max","range"].includes(p.dir) ? p.dir : "info",
    warn: p.warn ?? null,
    alarm: p.alarm ?? null,
    target: p.target ?? null,
    min_v: p.min ?? null,
    max_v: p.max ?? null,
  });
  return { code };
}
function deleteParam(code) {
  db.prepare("DELETE FROM params_custom WHERE code = ?").run(code);
}

// --- AI response cache + citations ---------------------------------
function findCachedAIResponse(queryHash, maxAgeSec) {
  const row = db.prepare(
    "SELECT id, response_text, created_at, hits FROM ai_responses WHERE query_hash = ? ORDER BY id DESC LIMIT 1"
  ).get(queryHash);
  if (!row) return null;
  if (maxAgeSec != null) {
    const age = (Date.now() - new Date(row.created_at).getTime()) / 1000;
    if (age > maxAgeSec) return null;
  }
  const citations = db.prepare(
    "SELECT url, title, domain, snippet FROM ai_citations WHERE response_id = ? ORDER BY id"
  ).all(row.id);
  return { id: row.id, responseText: row.response_text, createdAt: row.created_at, hits: row.hits, citations };
}
function recordAIResponse({ queryHash, assetId, sampleId, section, userQuestion, responseText, domains, citations }) {
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO ai_responses (query_hash, asset_id, sample_id, section, user_question,
                              response_text, domains_json, created_at, last_replayed_at, hits)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(queryHash, assetId || null, sampleId || null, section || null, userQuestion,
          responseText, JSON.stringify(domains || []), now, now);
  const responseId = info.lastInsertRowid;
  const insCite = db.prepare(
    "INSERT INTO ai_citations (response_id, url, title, domain, snippet, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const c of (citations || [])) {
    insCite.run(responseId, c.url, c.title || null, c.domain || null, c.snippet || null, now);
  }
  return responseId;
}
function bumpAIReplay(id) {
  db.prepare(
    "UPDATE ai_responses SET hits = hits + 1, last_replayed_at = ? WHERE id = ?"
  ).run(new Date().toISOString(), id);
}
function listAIResponses({ assetId, section, q, limit = 100 } = {}) {
  const where = []; const args = [];
  if (assetId) { where.push("asset_id = ?"); args.push(assetId); }
  if (section) { where.push("section = ?"); args.push(section); }
  if (q) { where.push("(user_question LIKE ? OR response_text LIKE ?)"); args.push("%"+q+"%", "%"+q+"%"); }
  const sql = `
    SELECT id, asset_id AS assetId, sample_id AS sampleId, section, user_question AS userQuestion,
           response_text AS responseText, created_at AS createdAt, last_replayed_at AS lastReplayedAt,
           hits, domains_json AS domainsJson
    FROM ai_responses
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY id DESC LIMIT ?
  `;
  const rows = db.prepare(sql).all(...args, limit);
  const citStmt = db.prepare(
    "SELECT url, title, domain, snippet FROM ai_citations WHERE response_id = ? ORDER BY id"
  );
  return rows.map(r => ({
    ...r,
    domains: JSON.parse(r.domainsJson || "[]"),
    citations: citStmt.all(r.id),
  }));
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

// --- AI context helpers --------------------------------------------
// Cheap engine-by-id + recent-samples lookup used to enrich the AI
// payload server-side instead of trusting the client-supplied context.
function getEngineById(id) {
  if (!id) return null;
  return db.prepare(`
    SELECT e.*, s.name AS site_name, l.name AS location_name, at.name AS asset_type_name,
           ac.label AS class_label_join
    FROM engines e
    LEFT JOIN sites s ON e.site = s.id
    LEFT JOIN locations l ON e.location_id = l.id
    LEFT JOIN asset_types at ON e.asset_type_id = at.id
    LEFT JOIN asset_classes ac ON e.class = ac.id
    WHERE e.id = ?
  `).get(id);
}
function getSampleById(id) {
  if (!id) return null;
  return db.prepare("SELECT * FROM samples WHERE id = ?").get(id);
}
function getRecentSamplesForEngine(engineId, limit = 5) {
  if (!engineId) return [];
  return db.prepare(`
    SELECT id, received_at, status, score, code, sample_type, results_json
    FROM samples WHERE engine_id = ?
    ORDER BY datetime(received_at) DESC LIMIT ?
  `).all(engineId, limit);
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
  createSite,
  createLocation, deleteLocation,
  createAssetType, deleteAssetType,
  createAssetClass, deleteAssetClass,
  createOil, deleteOil,
  createParam, deleteParam,
  createEngine,
  getBranding, saveBranding,
  // AI cache
  findCachedAIResponse, recordAIResponse, bumpAIReplay, listAIResponses,
  // AI context lookups
  getEngineById, getSampleById, getRecentSamplesForEngine,
};
