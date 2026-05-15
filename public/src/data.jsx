// ============================================================
// Lab88 — client-side data layer
//
// All dynamic data (sites, engines, samples, alarms, limits, rules)
// is loaded from /api/bootstrap and cached on window. Static domain
// constants (parameter defs, engine classes, oil catalog, instrument
// config) live here so they stay alongside the UI code that consumes
// them and can be edited without touching the server.
// ============================================================

// ---- Static reference data ------------------------------------------

const ASSET_CLASSES = [
  { id: "lyco4",  label: "Lycoming 4-cyl"   },
  { id: "lyco6",  label: "Lycoming 6-cyl"   },
  { id: "conto4", label: "Continental 4"    },
  { id: "conto6", label: "Continental 6"    },
  { id: "rotax",  label: "Rotax"            },
  { id: "radial", label: "Radial"           },
  { id: "genset", label: "Diesel Genset"    },
];

const ROLES = [
  { id: "TECH",    label: "Technician",  hint: "Receive & log" },
  { id: "ANALYST", label: "Analyst",     hint: "QC & publish"  },
  { id: "MANAGER", label: "Manager",     hint: "Review & sign-off" },
  { id: "ADMIN",   label: "Admin",       hint: "Config & access" },
];

const COND = {
  1: { label: "Normal",   short: "OK",   color: "ok",   range: "75–100" },
  2: { label: "Caution",  short: "WARN", color: "warn", range: "50–74"  },
  3: { label: "Critical", short: "CRIT", color: "crit", range: "25–49"  },
  4: { label: "Severe",   short: "SEV",  color: "sev",  range: "0–24"   },
};
function scoreToCode(s) { return s >= 75 ? 1 : s >= 50 ? 2 : s >= 25 ? 3 : 4; }

const OILS = [
  { brand: "AeroShell",  name: "AeroShell W100",            iso: "SAE 50" },
  { brand: "AeroShell",  name: "AeroShell W100 Plus",       iso: "SAE 50" },
  { brand: "AeroShell",  name: "AeroShell W80",             iso: "SAE 40" },
  { brand: "AeroShell",  name: "AeroShell 15W-50",          iso: "SAE 15W-50" },
  { brand: "Phillips 66",name: "Phillips X/C 20W-50",       iso: "SAE 20W-50" },
  { brand: "ExxonMobil", name: "Exxon Elite 20W-50",        iso: "SAE 20W-50" },
  { brand: "AeroShell",  name: "AeroShell Sport Plus 4",    iso: "SAE 10W-40" },
];

// Aviation oil parameters. Uses warn/alarm tier semantics (OK / WARN / ALARM).
const PARAM_DEFS = [
  { code: "Fe",      name: "Iron",          unit: "ppm",      method: "ASTM D5185",  warn: 35,    alarm: 65,    target: null, kind: "num", paramSet: "aviation" },
  { code: "Cr",      name: "Chromium",      unit: "ppm",      method: "ASTM D5185",  warn: 5,     alarm: 10,    target: null, kind: "num", paramSet: "aviation" },
  { code: "Al",      name: "Aluminum",      unit: "ppm",      method: "ASTM D5185",  warn: 8,     alarm: 15,    target: null, kind: "num", paramSet: "aviation" },
  { code: "Cu",      name: "Copper",        unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 35,    target: null, kind: "num", paramSet: "aviation" },
  { code: "Pb",      name: "Lead (100LL)",  unit: "ppm",      method: "ASTM D5185",  warn: 8000,  alarm: 12000, target: null, kind: "num", paramSet: "aviation" },
  { code: "Ni",      name: "Nickel",        unit: "ppm",      method: "ASTM D5185",  warn: 3,     alarm: 6,     target: null, kind: "num", paramSet: "aviation" },
  { code: "Si",      name: "Silicon",       unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 30,    target: null, kind: "num", paramSet: "aviation" },
  { code: "Visc100", name: "Visc @ 100°C",  unit: "cSt",      method: "ASTM D445",   warn: "±10%",alarm: "±15%",target: 19,   kind: "pct", paramSet: "aviation" },
  { code: "H2O",     name: "Water",         unit: "ppm",      method: "ASTM D6304",  warn: 200,   alarm: 500,   target: null, kind: "num", paramSet: "aviation" },
  { code: "Fuel",    name: "Fuel Dilution", unit: "%",        method: "GC",          warn: 2,     alarm: 4,     target: null, kind: "num", paramSet: "aviation" },
];

// Diesel fuel parameters (SANS 342:2016 panel). Uses min / max / range
// semantics with binary PASS/FAIL evaluation. `group` classifies each
// parameter into the section it renders under on the SANS-style report.
const DIESEL_PARAMS = [
  // Critical Properties (the section that drives overall PASS/FAIL).
  { code: "FlashPt",     name: "Flash Point",            unit: "°C",    method: "ASTM D93C",         group: "critical",    dir: "min",   min: 55,                paramSet: "diesel" },
  { code: "WaterCt",     name: "Water Content",          unit: "ppm",   method: "ASTM D6304",        group: "critical",    dir: "max",   max: 350,               paramSet: "diesel" },
  { code: "TotalContam", name: "Total Contamination",    unit: "mg/kg", method: "IP440",             group: "critical",    dir: "max",   max: 24,                paramSet: "diesel" },
  { code: "Sulphur",     name: "Sulphur",                unit: "ppm",   method: "ASTM D4294",        group: "critical",    dir: "max",   max: 50,                paramSet: "diesel" },
  { code: "Density20",   name: "Density (@ 20°C)",       unit: "kg/m³", method: "ASTM D7777",        group: "critical",    dir: "min",   min: 800,               paramSet: "diesel" },
  { code: "T90Dist",     name: "T90 Distillation",       unit: "°C",    method: "based on ASTM D86", group: "critical",    dir: "max",   max: 362,               paramSet: "diesel" },
  { code: "KinVisc40",   name: "Kinematic Visc @ 40°C",  unit: "mm²/s", method: "based on ASTM D445",group: "critical",    dir: "range", min: 2.0, max: 5.3,     paramSet: "diesel" },
  // Particle Count — ISO 4406
  { code: "P_4um",       name: "> 4 µm Particle Count",  unit: "",      method: "ISO 4406",          group: "particle",    dir: "info",                          paramSet: "diesel" },
  { code: "P_6um",       name: "> 6 µm Particle Count",  unit: "",      method: "ISO 4406",          group: "particle",    dir: "info",                          paramSet: "diesel" },
  { code: "P_14um",      name: "> 14 µm Particle Count", unit: "",      method: "ISO 4406",          group: "particle",    dir: "info",                          paramSet: "diesel" },
  { code: "ISO4406",     name: "ISO 4406 Code",          unit: "",      method: "ISO 4406",          group: "particle",    dir: "info",                          paramSet: "diesel" },
  // Elemental — ASTM D4294 (additives + trace metals)
  { code: "El_Sulphur",  name: "Sulphur",                unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Fe",       name: "Iron",                   unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Al",       name: "Aluminium",              unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Mg",       name: "Magnesium",              unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Zn",       name: "Zinc",                   unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Pb",       name: "Lead",                   unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Si",       name: "Silicon",                unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_Mn",       name: "Manganese",              unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  { code: "El_V",        name: "Vanadium",               unit: "ppm",   method: "ASTM D4294",        group: "elemental",   dir: "info",                          paramSet: "diesel" },
  // IR Vision (FTIR fuel suite — density, cetane index, cold-filter plug)
  { code: "IR_Density",  name: "Density",                unit: "",      method: "IR Vision",         group: "ir",          dir: "info",                          paramSet: "diesel" },
  { code: "IR_Cetane",   name: "Cetane Index",           unit: "",      method: "IR Vision",         group: "ir",          dir: "info",                          paramSet: "diesel" },
  { code: "IR_CFPP",     name: "CFPP",                   unit: "°C",    method: "IR Vision",         group: "ir",          dir: "info",                          paramSet: "diesel" },
  // Distillation curve points (used to plot the chart on the report).
  { code: "Dist_IBP",    name: "IBP — initial boiling",  unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_T10",    name: "T10 — 10% recovered",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_T50",    name: "T50 — 50% recovered",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_T65",    name: "T65 — 65% recovered",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_T85",    name: "T85 — 85% recovered",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_T95",    name: "T95 — 95% recovered",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
  { code: "Dist_FBP",    name: "FBP — final boiling",    unit: "°C",    method: "ASTM D86",          group: "distillation", dir: "info",                         paramSet: "diesel" },
];

// Lookup a parameter by code from either catalog. Codes are disjoint
// between the two catalogs by design.
function getParam(code) {
  return PARAM_DEFS.find(p => p.code === code) || DIESEL_PARAMS.find(p => p.code === code) || null;
}

// ============================================================
// Instruments — modular config that powers the Log Sample workflow
// and the Reference Library. To add a new instrument: add an entry
// below with its id, label, type, and list of parameter codes it
// measures. Sample types (further down) compose instruments into
// recipes for different oil panels.
// ============================================================
const INSTRUMENTS = [
  {
    id: "spectroil",
    brand: "Spectro Scientific",
    name: "Spectroil M/Q",
    type: "ICP-OES wear-metals",
    measures: ["Fe","Cr","Al","Cu","Pb","Ni","Si"],
    notes: "Inductively-coupled plasma spectrometer for elemental wear-metals analysis.",
  },
  {
    id: "fluidscan",
    brand: "Spectro Scientific",
    name: "FluidScan Q1100",
    type: "FTIR fluid condition",
    measures: ["H2O","Fuel"],
    notes: "Handheld infrared analyzer — water by Karl-Fischer surrogate and fuel dilution by hydrocarbon shift.",
  },
  {
    id: "minivisc",
    brand: "Spectro Scientific",
    name: "MiniVisc 3000",
    type: "Kinematic viscosity",
    measures: ["Visc100"],
    notes: "Single-cell viscometer reporting kinematic viscosity at 100 °C in cSt.",
  },
  {
    id: "manual",
    brand: "Manual",
    name: "Manual entry",
    type: "Operator entry",
    measures: PARAM_DEFS.map(p => p.code),
    notes: "Catch-all for instruments not yet integrated. Operator types the readings in.",
  },
  // --- Diesel fuel instruments (SANS 342:2016 panel) ----------------
  {
    id: "flashpoint", brand: "Atomic Oil Lab", name: "Flash Point Tester",
    type: "ASTM D93C Pensky-Martens", measures: ["FlashPt"],
    notes: "Closed-cup flash point — minimum 55 °C for SANS 342 compliance.",
  },
  {
    id: "karlfischer", brand: "Atomic Oil Lab", name: "Karl Fischer Titrator",
    type: "ASTM D6304 Coulometric", measures: ["WaterCt"],
    notes: "Coulometric Karl Fischer for water content in ppm.",
  },
  {
    id: "particle-iso", brand: "Atomic Oil Lab", name: "Particle Counter",
    type: "IP440 / ISO 4406", measures: ["TotalContam","P_4um","P_6um","P_14um","ISO4406"],
    notes: "Optical particle counter + total contamination by gravimetric filter (IP440).",
  },
  {
    id: "sulphur-xrf", brand: "Atomic Oil Lab", name: "Sulphur Analyzer",
    type: "ASTM D4294 XRF", measures: ["Sulphur"],
    notes: "Energy-dispersive X-ray fluorescence for total sulphur in ppm.",
  },
  {
    id: "densitymeter", brand: "Atomic Oil Lab", name: "Density Meter",
    type: "ASTM D7777 Oscillating-U", measures: ["Density20"],
    notes: "Oscillating-U-tube density at 20 °C — minimum 800 kg/m³ for SANS 342.",
  },
  {
    id: "distillation", brand: "Atomic Oil Lab", name: "Distillation Unit",
    type: "based on ASTM D86",
    measures: ["T90Dist","Dist_IBP","Dist_T10","Dist_T50","Dist_T65","Dist_T85","Dist_T95","Dist_FBP"],
    notes: "Atmospheric distillation reporting the IBP / T10 / T50 / T65 / T85 / T95 / FBP curve and the T90 critical limit.",
  },
  {
    id: "kinvisc-d445", brand: "Atomic Oil Lab", name: "Kinematic Viscometer",
    type: "based on ASTM D445", measures: ["KinVisc40"],
    notes: "Capillary viscometer at 40 °C — must fall in 2.00 – 5.30 mm²/s.",
  },
  {
    id: "spec-d4294", brand: "Spectro Scientific", name: "Spectroil — Elemental",
    type: "ASTM D4294 / ICP-OES",
    measures: ["El_Sulphur","El_Fe","El_Al","El_Mg","El_Zn","El_Pb","El_Si","El_Mn","El_V"],
    notes: "Elemental concentration screen for additives and trace metals.",
  },
  {
    id: "ir-vision", brand: "Atomic Oil Lab", name: "IR Vision",
    type: "FTIR Diesel Suite", measures: ["IR_Density","IR_Cetane","IR_CFPP"],
    notes: "Infrared multi-property analyzer — density, cetane index, and cold-filter plugging point.",
  },
];

// Sample types — each composes 1-N instruments into an analysis recipe.
// Adding "Turbine oil", "Hydraulic", "Coolant" etc. is a copy-paste here.
const SAMPLE_TYPES = [
  {
    id: "piston-oil",
    label: "Piston Aircraft Oil (full panel)",
    description: "Standard piston-aircraft oil analysis: wear metals + condition + viscosity.",
    instruments: ["spectroil","fluidscan","minivisc"],
    defaultComponent: "Sump Drain",
    paramSet: "aviation", report: "aviation",
  },
  {
    id: "piston-quick",
    label: "Piston Oil — wear-metals only",
    description: "Quick wear-metals screen, no condition/viscosity. Use between full panels.",
    instruments: ["spectroil"],
    defaultComponent: "Sump Drain",
    paramSet: "aviation", report: "aviation",
  },
  {
    id: "rotax",
    label: "Rotax (oil + gearbox)",
    description: "Rotax 9-series oil and gearbox drain analysis.",
    instruments: ["spectroil","fluidscan","minivisc"],
    defaultComponent: "Sump Drain",
    paramSet: "aviation", report: "aviation",
  },
  {
    id: "manual",
    label: "Manual entry (any panel)",
    description: "Hand-keyed readings for any combination of parameters.",
    instruments: ["manual"],
    defaultComponent: "Sump Drain",
    paramSet: "aviation", report: "aviation",
  },
  // --- Diesel fuel sample types (SANS 342:2016) ---------------------
  {
    id: "diesel-cf1",
    label: "Diesel — Sulphur Low Grade (CF1)",
    description: "SANS 342:2016 CF1 panel. Critical properties + ISO 4406 particle count + elemental + IR Vision + distillation curve + filter patch photo.",
    instruments: ["flashpoint","karlfischer","particle-iso","sulphur-xrf","densitymeter","distillation","kinvisc-d445","spec-d4294","ir-vision"],
    defaultComponent: "Diesel Generator",
    paramSet: "diesel", report: "diesel", standard: "SANS 342:2016",
    acceptsFilterPatch: true,
  },
];

// ---- Fmt helpers -----------------------------------------------------

function toDate(v) { return v instanceof Date ? v : (v ? new Date(v) : null); }
function fmtDate(d) {
  const x = toDate(d);
  if (!x || isNaN(x)) return "—";
  return x.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function fmtShortDate(d) {
  const x = toDate(d);
  if (!x || isNaN(x)) return "—";
  return x.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
function fmtTime(d) {
  const x = toDate(d);
  if (!x || isNaN(x)) return "—";
  return x.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ---- Live data loaded from /api/bootstrap ----------------------------

window.SITES = [];
window.LOCATIONS = [];
window.ASSET_TYPES = [];
window.ASSETS = [];
window.SAMPLES = [];
window.ALARMS = [];
let _limits = [];   // [{ scope, paramCode, warn, alarm, target }]
let _rules  = [];

// Coerce server's ISO date strings into Date objects so the existing
// formatters keep working unchanged.
function hydrateDates() {
  for (const a of window.ASSETS) {
    a.lastSample = toDate(a.lastSample);
    a.nextDue    = toDate(a.nextDue);
  }
  for (const s of window.SAMPLES) {
    s.receivedAt = toDate(s.receivedAt);
  }
  for (const al of window.ALARMS) {
    al.raisedAt = toDate(al.raisedAt);
  }
}

async function bootstrap() {
  const b = await window.api.bootstrap();
  window.SITES       = (b.sites || []).map(s => ({ ...s }));
  window.LOCATIONS   = (b.locations || []).map(l => ({ ...l }));
  window.ASSET_TYPES = (b.assetTypes || []).map(a => ({ ...a }));
  window.ASSETS      = (b.engines || []).map(e => ({ ...e }));
  window.SAMPLES     = (b.samples || []).map(s => ({ ...s }));
  window.ALARMS      = (b.alarms || []).map(a => ({ ...a }));
  window.BRANDING    = b.branding || { labName: "Lab88", accentColor: "#c2410c", logo: null, tagline: null };
  _limits = b.limits || [];
  _rules  = b.rules  || [];
  hydrateDates();
}
window.bootstrap = bootstrap;

// --- Hierarchy helpers -----------------------------------------------
function getLocationsForSite(siteId) {
  return window.LOCATIONS.filter(l => l.siteId === siteId);
}
function getAssetTypesForSite(siteId, locationId) {
  return window.ASSET_TYPES.filter(a =>
    a.siteId === siteId && (!locationId || a.locationId === locationId || a.locationId == null));
}
function getEnginesForAssetType(siteId, locationId, assetTypeId) {
  return window.ASSETS.filter(e =>
    e.site === siteId &&
    (!locationId || e.locationId === locationId) &&
    (!assetTypeId || e.assetTypeId === assetTypeId));
}

// ---- Limits (server-backed; reads cache, writes call API) ------------

function getLimits(assetClass) {
  const out = {};
  for (const p of PARAM_DEFS) {
    const ov = _limits.find(l => l.scope === (assetClass || "all") && l.paramCode === p.code) || {};
    out[p.code] = {
      ...p,
      warn:   ov.warn   ?? p.warn,
      alarm:  ov.alarm  ?? p.alarm,
      target: ov.target ?? p.target,
    };
  }
  return out;
}
async function setLimit(scope, paramCode, patch) {
  await window.api.setLimit(scope || "all", paramCode, patch);
  // Local cache update so the UI reflects immediately without a full reload.
  const i = _limits.findIndex(l => l.scope === (scope || "all") && l.paramCode === paramCode);
  const def = PARAM_DEFS.find(p => p.code === paramCode);
  const next = {
    scope: scope || "all", paramCode,
    warn:   patch.warn   ?? (i >= 0 ? _limits[i].warn   : def.warn),
    alarm:  patch.alarm  ?? (i >= 0 ? _limits[i].alarm  : def.alarm),
    target: patch.target ?? (i >= 0 ? _limits[i].target : def.target),
  };
  if (i >= 0) _limits[i] = next; else _limits.push(next);
}
async function resetLimits(scope) {
  await window.api.resetLimits(scope || "all");
  _limits = _limits.filter(l => l.scope !== (scope || "all"));
}

// ---- Rules (server-backed) -------------------------------------------

function getRules() { return _rules.slice(); }
async function saveRule(rule) {
  const r = await window.api.saveRule(rule);
  const next = { ...rule, id: rule.id || r.id };
  const i = _rules.findIndex(x => x.id === next.id);
  if (i >= 0) _rules[i] = next; else _rules.unshift(next);
  return next;
}
async function deleteRule(id) {
  await window.api.deleteRule(id);
  _rules = _rules.filter(r => r.id !== id);
}
async function nextRuleId() { return window.api.nextRuleId(); }

// ---- Results / trend helpers -----------------------------------------

function evalStatus(p) {
  if (typeof p.alarm === "number" && typeof p.value === "number") {
    if (p.value >= p.alarm) return "alarm";
    if (p.value >= p.warn)  return "warn";
    return "ok";
  }
  if (p.code === "Visc100" && typeof p.value === "number" && p.target) {
    const dev = Math.abs(p.value - p.target) / p.target;
    if (dev > 0.15) return "alarm";
    if (dev > 0.10) return "warn";
    return "ok";
  }
  return "ok";
}

// Join raw `{code, value}` readings with PARAM_DEFS + current limits.
function resolveResults(rawResults, assetClass) {
  if (!Array.isArray(rawResults)) return [];
  const limits = getLimits(assetClass);
  return PARAM_DEFS.map(p => {
    const raw = rawResults.find(r => r.code === p.code);
    if (raw == null) return null;
    const lim = limits[p.code] || p;
    const row = { ...p, warn: lim.warn, alarm: lim.alarm, target: lim.target ?? p.target, value: raw.value };
    row.status = evalStatus(row);
    return row;
  }).filter(Boolean);
}

// ---- Diesel evaluation (SANS 342:2016 PASS/FAIL semantics) ---------

function evalDieselStatus(param, value) {
  if (!param || param.dir === "info") return null;
  if (value == null || value === "" || (typeof value === "number" && isNaN(value))) return null;
  if (typeof value === "string" && param.dir !== "info") return null;  // codes like "21/19/18" — info only
  const v = Number(value);
  if (param.dir === "min")   return v >= param.min ? "pass" : "fail";
  if (param.dir === "max")   return v <= param.max ? "pass" : "fail";
  if (param.dir === "range") return (v >= param.min && v <= param.max) ? "pass" : "fail";
  return null;
}

// Mirror of resolveResults for the diesel catalog. Returns one row per
// raw reading present, joined with its DIESEL_PARAMS definition and
// the binary pass/fail evaluation. Preserves the DIESEL_PARAMS order
// so report sections render in the spec order.
function resolveDieselResults(rawResults) {
  if (!Array.isArray(rawResults)) return [];
  return DIESEL_PARAMS.map(p => {
    const raw = rawResults.find(r => r.code === p.code);
    if (raw == null) return null;
    const row = { ...p, value: raw.value };
    row.status = evalDieselStatus(row, raw.value);
    return row;
  }).filter(Boolean);
}

// Overall PASS/FAIL verdict from a resolved diesel result set. Driven
// only by the Critical Properties group — particle / elemental / IR /
// distillation are informational.
function dieselVerdict(resolved) {
  const critical = resolved.filter(r => r.group === "critical" && r.status);
  if (critical.length === 0) return null;
  return critical.every(r => r.status === "pass") ? "PASS" : "FAIL";
}

// Resolve which sample type (and therefore param set / report style)
// a sample belongs to. Defaults to piston-oil for legacy rows.
function getSampleType(sample) {
  const id = sample?.sampleType || "piston-oil";
  return SAMPLE_TYPES.find(t => t.id === id) || SAMPLE_TYPES[0];
}
function isDieselSample(sample) {
  return getSampleType(sample).paramSet === "diesel";
}

// Backwards-compatible name used by screens that haven't been switched
// to resolveResults yet.
function makeTestResults(sample) {
  const asset = window.ASSETS.find(a => a.id === sample?.assetId);
  if (sample?.results) return resolveResults(sample.results, asset?.class);
  return [];   // no results yet (DRAFT) — screens should handle empty
}

// Trend chart for an engine: walks the engine's published samples,
// pulls the requested parameter from each sample's stored results.
function makeTrend(asset, paramKey) {
  const series = window.SAMPLES
    .filter(s => s.assetId === asset.id && s.results)
    .slice().reverse();   // oldest → newest

  const points = series.map((s, i) => {
    const r = s.results.find(x => x.code === paramKey);
    return r != null ? { i, date: s.receivedAt, value: r.value } : null;
  }).filter(Boolean);

  const limits = getLimits(asset.class)[paramKey] || PARAM_DEFS.find(p => p.code === paramKey) || {};
  return {
    points,
    target: limits.target ?? null,
    warn:   typeof limits.warn  === "number" ? limits.warn  : null,
    alarm:  typeof limits.alarm === "number" ? limits.alarm : null,
    unit:   PARAM_DEFS.find(p => p.code === paramKey)?.unit || "",
  };
}

// Rule evaluator (pure, mirrors server semantics).
function evalRule(rule, results) {
  if (!rule.enabled) return { ...rule, triggered: false, reasons: [] };
  const reasons = [];
  for (const c of rule.conditions || []) {
    const r = results.find(x => x.code === c.param);
    if (!r) return { ...rule, triggered: false, reasons };
    const v = typeof r.value === "number" ? r.value : null;
    let matched = false;
    if (c.op === ">"  && v != null && v >  c.value) matched = true;
    if (c.op === ">=" && v != null && v >= c.value) matched = true;
    if (c.op === "<"  && v != null && v <  c.value) matched = true;
    if (c.op === "<=" && v != null && v <= c.value) matched = true;
    if (c.op === "abs%>" && v != null && r.target) {
      const pct = Math.abs(v - r.target) / r.target * 100;
      if (pct > c.value) matched = true;
    }
    if (!matched) return { ...rule, triggered: false, reasons };
    reasons.push(`${c.param} ${v ?? "—"} ${c.op} ${c.value}`);
  }
  return { ...rule, triggered: true, reasons };
}

function fleetCounts() {
  const byCode = { 1:0, 2:0, 3:0, 4:0 };
  for (const a of window.ASSETS) byCode[a.code]++;
  return { total: window.ASSETS.length, byCode };
}
function recentPublished(n = 6) {
  return window.SAMPLES.filter(s => s.status === "PUBLISHED").slice(0, n);
}

Object.assign(window, {
  ASSET_CLASSES, ROLES, COND, OILS, PARAM_DEFS, DIESEL_PARAMS, INSTRUMENTS, SAMPLE_TYPES,
  scoreToCode, fmtDate, fmtShortDate, fmtTime,
  resolveResults, makeTestResults, makeTrend, evalRule,
  getLimits, setLimit, resetLimits,
  getRules, saveRule, deleteRule, nextRuleId,
  fleetCounts, recentPublished,
  // Diesel helpers
  getParam, evalDieselStatus, resolveDieselResults, dieselVerdict,
  getSampleType, isDieselSample,
  // Hierarchy helpers
  getLocationsForSite, getAssetTypesForSite, getEnginesForAssetType,
});
