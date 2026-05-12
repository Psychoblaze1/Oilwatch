// ============================================================
// Mock domain data for Oilwatch — piston aviation oil analysis
// (Lycoming / Continental / Rotax fleets, 100LL avgas chemistry,
//  cam/lifter wear patterns, mail-in sample lifecycle.)
// ============================================================

// Sites = customer operators that send samples to the lab.
const SITES = [
  { id: "ctn-01", code: "KAPA", name: "Centennial Flight Academy", region: "Denver, CO",   assets: 38, samples28d: 412 },
  { id: "sun-02", code: "KSUN", name: "Sun Valley FBO",            region: "Hailey, ID",   assets: 22, samples28d: 198 },
  { id: "hef-03", code: "KHEF", name: "Cirrus East Charter",       region: "Manassas, VA", assets: 28, samples28d: 251 },
  { id: "ict-04", code: "KICT", name: "Beechwood Aero Service",    region: "Wichita, KS",  assets: 54, samples28d: 537 },
  { id: "hwd-05", code: "KHWD", name: "Pacific Coast Flying Club", region: "Hayward, CA",  assets: 44, samples28d: 489 },
  { id: "afa-06", code: "PAFA", name: "Alaska Bush Operators",     region: "Fairbanks, AK",assets: 18, samples28d: 142 },
];

// Asset class = piston engine family. Stays internally consistent
// with asset.class throughout the app (heatmap, filters, rules scope).
const ASSET_CLASSES = [
  { id: "lyco4",  label: "Lycoming 4-cyl", icon: "engine" },
  { id: "lyco6",  label: "Lycoming 6-cyl", icon: "engine" },
  { id: "conto4", label: "Continental 4",  icon: "engine" },
  { id: "conto6", label: "Continental 6",  icon: "engine" },
  { id: "rotax",  label: "Rotax",          icon: "engine" },
  { id: "radial", label: "Radial",         icon: "engine" },
];

const ROLES = [
  { id: "TECH",    label: "Technician",  hint: "Receive & log" },
  { id: "ANALYST", label: "Analyst",     hint: "QC & publish"  },
  { id: "MANAGER", label: "Manager",     hint: "Review & sign-off" },
  { id: "ADMIN",   label: "Admin",       hint: "Config & access" },
];

// Condition codes (score → 1..4) — same scale as before.
const COND = {
  1: { label: "Normal",   short: "OK",   color: "ok",   range: "75–100", icon: "●" },
  2: { label: "Caution",  short: "WARN", color: "warn", range: "50–74",  icon: "●" },
  3: { label: "Critical", short: "CRIT", color: "crit", range: "25–49",  icon: "●" },
  4: { label: "Severe",   short: "SEV",  color: "sev",  range: "0–24",   icon: "●" },
};

function scoreToCode(s) {
  if (s >= 75) return 1;
  if (s >= 50) return 2;
  if (s >= 25) return 3;
  return 4;
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Aircraft pool per engine class. Format: "<N-number> · <Airframe>".
const ASSET_NAMES = {
  lyco4: [
    "N7251X · Cessna 172S","N9412A · Piper PA-28-180","N3308G · Diamond DA40",
    "N5572K · Citabria 7ECA","N8841J · Maule M-7-235","N6620B · American Champion Decathlon",
  ],
  lyco6: [
    "N4419C · Cirrus SR22","N7785M · Mooney M20TN","N2207V · Piper Saratoga",
    "N5530W · Beechcraft A36 Bonanza","N9912T · Piper Cherokee Six 300","N1147H · Mooney M20R",
  ],
  conto4: [
    "N3015F · Cessna 152","N6608R · Cirrus SR20","N4421P · Mooney M20E",
    "N7780Q · Diamond DA20-C1","N1183Y · Grumman AA-5A Cheetah","N5519N · Cessna 150",
  ],
  conto6: [
    "N3458S · Beechcraft V35 Bonanza","N7790T · Cessna T210M","N1234U · Piper Twin Comanche",
    "N5687V · Beechcraft Baron 58","N9012W · Cessna 310R","N4451B · Cessna P210N",
  ],
  rotax: [
    "N7716X · Diamond DA20-A1","N3320Y · Tecnam P2008","N4408Z · CTLS Flight Design",
    "N9981A · ICON A5","N5527B · Aeroprakt A22","N6620C · Pipistrel Sinus",
  ],
  radial: [
    "N1198CC · Cessna 195","N5512DD · DC-3","N9022EE · T-28B Trojan","N3340FF · Antonov An-2",
  ],
};

// Engine model "dash numbers" used as asset.tag.
const ENGINE_TAGS = {
  lyco4:  ["O-320-D3G","O-360-A1A","IO-360-L2A","IO-320-A2A","O-320-H2AD","IO-360-M1A"],
  lyco6:  ["IO-540-AB1A5","IO-540-K1A5","TIO-540-AE2A","IO-580-B1A","IO-540-C4B5"],
  conto4: ["O-200-A","IO-240-B","IO-360-ES","O-200-D"],
  conto6: ["IO-470-N","IO-520-D","IO-550-G","TSIO-550-K","IO-550-N"],
  rotax:  ["912 ULS-2","912 iS Sport","914 UL","915 iSc3 A"],
  radial: ["R-985-AN-14B","R-1340-AN-1","R-2800-CB16"],
};

const OEMS = ["Lycoming","Continental Motors","Rotax","Pratt & Whitney","Curtiss-Wright","Jabiru"];

// Aviation oils. Keep `iso` field name for backward compat with screen
// JSX; it carries the SAE grade label.
const OILS = [
  { brand: "AeroShell",  name: "AeroShell W100",            iso: "SAE 50" },
  { brand: "AeroShell",  name: "AeroShell W100 Plus",       iso: "SAE 50" },
  { brand: "AeroShell",  name: "AeroShell W80",             iso: "SAE 40" },
  { brand: "AeroShell",  name: "AeroShell 15W-50",          iso: "SAE 15W-50" },
  { brand: "Phillips 66",name: "Phillips X/C 20W-50",       iso: "SAE 20W-50" },
  { brand: "ExxonMobil", name: "Exxon Elite 20W-50",        iso: "SAE 20W-50" },
  { brand: "AeroShell",  name: "AeroShell Sport Plus 4",    iso: "SAE 10W-40" },
];

// Build the engine fleet.
const ASSETS = [];
{
  const rng = mulberry32(7);
  let id = 1000;
  for (const site of SITES) {
    const count = Math.max(6, Math.min(14, Math.floor(site.assets / 4)));
    for (let i = 0; i < count; i++) {
      const cls = ASSET_CLASSES[Math.floor(rng() * ASSET_CLASSES.length)];
      const aircraft = ASSET_NAMES[cls.id];
      const baseName = aircraft[Math.floor(rng() * aircraft.length)];
      const tag = ENGINE_TAGS[cls.id][Math.floor(rng() * ENGINE_TAGS[cls.id].length)];
      const r = rng();
      let score;
      if (r < 0.55)      score = 78 + Math.floor(rng() * 20);
      else if (r < 0.82) score = 55 + Math.floor(rng() * 22);
      else if (r < 0.95) score = 28 + Math.floor(rng() * 20);
      else               score = 6  + Math.floor(rng() * 18);

      ASSETS.push({
        id: "A-" + (id++),
        tag,                                     // engine model dash-number
        name: baseName,                          // tail # + airframe
        site: site.id,
        siteName: site.name,
        class: cls.id,
        classLabel: cls.label,
        oem: cls.id.startsWith("lyco") ? "Lycoming"
           : cls.id.startsWith("conto") ? "Continental Motors"
           : cls.id === "rotax" ? "Rotax"
           : cls.id === "radial" ? "Pratt & Whitney"
           : OEMS[Math.floor(rng() * OEMS.length)],
        oil: pickOilForClass(cls.id, rng),
        runHours: 80 + Math.floor(rng() * 2400),       // hours since major overhaul (TSMOH)
        criticality: rng() < 0.25 ? "A" : (rng() < 0.6 ? "B" : "C"),
        health: score,
        code: scoreToCode(score),
        dimensions: makeDimensions(rng, score, cls.id),
        lastSample: daysAgo(Math.floor(rng() * 26)),
        nextDue:    daysFromNow(Math.floor(rng() * 60) - 5),
        rulDays:    Math.max(8, Math.floor(score * 1.6) + Math.floor(rng() * 30)),
      });
    }
  }
}

function pickOilForClass(cls, rng) {
  if (cls === "rotax") return { brand: "AeroShell", name: "AeroShell Sport Plus 4", iso: "SAE 10W-40" };
  // Most cert'd piston engines fly straight SAE 50 or 20W-50.
  const pool = [
    { brand: "AeroShell",  name: "AeroShell W100 Plus",  iso: "SAE 50" },
    { brand: "AeroShell",  name: "AeroShell 15W-50",     iso: "SAE 15W-50" },
    { brand: "Phillips 66",name: "Phillips X/C 20W-50",  iso: "SAE 20W-50" },
    { brand: "ExxonMobil", name: "Exxon Elite 20W-50",   iso: "SAE 20W-50" },
  ];
  return pool[Math.floor(rng() * pool.length)];
}

function makeDimensions(rng, base, cls) {
  // N-dimensional health, tailored to engine type.
  const sets = {
    lyco4:  ["Wear","Cylinders","Contamination"],
    lyco6:  ["Wear","Cam/Lifter","Cylinders","Contamination"],
    conto4: ["Wear","Cylinders","Contamination"],
    conto6: ["Wear","Cylinders","Cam","Contamination"],
    rotax:  ["Wear","Coolant","Gearbox","Contamination"],
    radial: ["Wear","Master Rod","Cylinders","Oxidation"],
  };
  const dims = sets[cls] || ["Wear","Contamination","Chemistry"];
  return dims.map((d) => {
    const jitter = (rng() - 0.5) * 30;
    const score = Math.max(2, Math.min(99, Math.floor(base + jitter)));
    return { label: d, score, code: scoreToCode(score) };
  });
}

function daysAgo(d)    { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function daysFromNow(d){ const x = new Date(); x.setDate(x.getDate() + d); return x; }
function fmtDate(d) {
  if (!(d instanceof Date)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function fmtShortDate(d) {
  if (!(d instanceof Date)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
function fmtTime(d) {
  if (!(d instanceof Date)) return "—";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

const SAMPLE_STATUS = ["DRAFT","QC","APPROVED","PUBLISHED","REJECTED"];

const SAMPLES = [];
{
  const rng = mulberry32(13);
  let id = 50231;
  for (const a of ASSETS) {
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const ageDays = Math.floor(rng() * 28);
      const status = ageDays < 1 ? "DRAFT"
                    : ageDays < 3 ? (rng() < 0.5 ? "QC" : "DRAFT")
                    : ageDays < 6 ? (rng() < 0.6 ? "APPROVED" : "QC")
                    : (rng() < 0.08 ? "REJECTED" : "PUBLISHED");
      const noise = (rng() - 0.5) * 12;
      const score = Math.max(4, Math.min(99, Math.floor(a.health + noise)));
      SAMPLES.push({
        id: "S-" + (id++),
        barcode: "AOA" + (240000 + Math.floor(rng() * 9999)),    // mail-in lab barcode
        assetId: a.id,
        assetName: a.name,
        assetTag: a.tag,
        siteName: a.siteName,
        component: pickComponent(rng, a.class),
        oil: a.oil.name,
        receivedAt: daysAgo(ageDays),
        status,
        priority: rng() < 0.12 ? "RUSH" : "STD",
        score,
        code: scoreToCode(score),
        analyst: pickAnalyst(rng),
        flags: pickFlags(rng, score),
      });
    }
  }
  SAMPLES.sort((a, b) => b.receivedAt - a.receivedAt);
}

// Piston engine oil samples almost always come from the sump on drain.
// Filter cuts and suction-screen finds are the other common sources.
function pickComponent(rng, cls) {
  const opts = {
    lyco4:  ["Sump Drain","Filter Cut","Suction Screen"],
    lyco6:  ["Sump Drain","Filter Cut","Suction Screen","Quick-Drain"],
    conto4: ["Sump Drain","Filter Cut","Suction Screen"],
    conto6: ["Sump Drain","Filter Cut","Suction Screen","Quick-Drain"],
    rotax:  ["Sump Drain","Filter Cut","Gearbox Drain"],
    radial: ["Sump Drain","Filter Cut","Suction Screen","Tank Drain"],
  };
  const arr = opts[cls] || ["Sump Drain"];
  return arr[Math.floor(rng() * arr.length)];
}
function pickAnalyst(rng) {
  // Aviation oil-analysis lab staff (fictional).
  const list = ["M. Okafor","R. Pillai","S. Henningsen","T. Reyes","D. Vaughn","J. Park"];
  return list[Math.floor(rng() * list.length)];
}
function pickFlags(rng, score) {
  const flags = [];
  if (score < 55 && rng() < 0.7) flags.push("Fe↑");
  if (score < 50 && rng() < 0.55) flags.push("Cr↑");
  if (score < 60 && rng() < 0.40) flags.push("Al↑");
  if (score < 60 && rng() < 0.50) flags.push("H₂O");
  if (score < 50 && rng() < 0.45) flags.push("Fuel%");
  if (score < 55 && rng() < 0.35) flags.push("Si↑");
  if (score < 35 && rng() < 0.4)  flags.push("Visc Δ");
  return flags;
}

// Alarms — seeded from the worst-health assets with aviation-flavored
// rule strings.
const ALARMS = [];
{
  const rng = mulberry32(101);
  const candidates = ASSETS.filter(a => a.health < 70).sort((a,b) => a.health - b.health);
  for (const a of candidates.slice(0, 14)) {
    const t = rng();
    let rule;
    if (a.health < 25)      rule = "Condemning limits exceeded — recommend immediate pull, borescope, and oil-filter cut.";
    else if (a.health < 50) rule = (t < 0.5
      ? "Cam/lifter wear signature — Fe + Cr running together (Lycoming pattern)."
      : "Iron trend +3 consecutive · ΔFe 22 ppm in 1 interval — cylinder or cam.");
    else                    rule = (t < 0.5
      ? "Viscosity dropped ~15% — possible fuel dilution from mag drop or rich operation."
      : "Z-score anomaly on Cu (2.6σ above baseline) — possible oil-cooler corrosion.");
    ALARMS.push({
      id: "AL-" + Math.floor(10000 + rng()*89999),
      assetId: a.id,
      assetName: a.name,
      assetTag: a.tag,
      site: a.siteName,
      severity: a.health < 25 ? "SEVERE" : a.health < 50 ? "CRITICAL" : "WARN",
      code: a.code,
      rule,
      raisedAt: daysAgo(Math.floor(rng() * 9)),
      rulDays: a.rulDays,
      acknowledged: rng() < 0.3,
    });
  }
}

// ============================================================
// Limit sets — aviation parameters with typical Blackstone-style
// universal-average warn/alarm thresholds. Lead is intentionally
// high-tolerance because all 100LL avgas engines carry ~4,000–7,000
// ppm Pb as a baseline — that is normal, not alarming.
// ============================================================
const PARAM_DEFS = [
  { code: "Fe",      name: "Iron",             unit: "ppm",      method: "ASTM D5185",  warn: 35,    alarm: 65,    target: null, kind: "num" },
  { code: "Cr",      name: "Chromium",         unit: "ppm",      method: "ASTM D5185",  warn: 5,     alarm: 10,    target: null, kind: "num" },
  { code: "Al",      name: "Aluminum",         unit: "ppm",      method: "ASTM D5185",  warn: 8,     alarm: 15,    target: null, kind: "num" },
  { code: "Cu",      name: "Copper",           unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 35,    target: null, kind: "num" },
  { code: "Pb",      name: "Lead (100LL)",     unit: "ppm",      method: "ASTM D5185",  warn: 8000,  alarm: 12000, target: null, kind: "num" },
  { code: "Ni",      name: "Nickel",           unit: "ppm",      method: "ASTM D5185",  warn: 3,     alarm: 6,     target: null, kind: "num" },
  { code: "Si",      name: "Silicon",          unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 30,    target: null, kind: "num" },
  { code: "Visc100", name: "Visc @ 100°C",     unit: "cSt",      method: "ASTM D445",   warn: "±10%",alarm: "±15%",target: 19,   kind: "pct" },
  { code: "H2O",     name: "Water",            unit: "ppm",      method: "ASTM D6304",  warn: 200,   alarm: 500,   target: null, kind: "num" },
  { code: "Fuel",    name: "Fuel Dilution",    unit: "%",        method: "GC",          warn: 2,     alarm: 4,     target: null, kind: "num" },
];

const LIMITS_KEY = "oilwatch.limits";
const RULES_KEY  = "oilwatch.rules";

function readLimitOverrides() {
  try { return JSON.parse(localStorage.getItem(LIMITS_KEY) || "{}"); }
  catch (_) { return {}; }
}
function writeLimitOverrides(o) {
  try { localStorage.setItem(LIMITS_KEY, JSON.stringify(o)); } catch (_) {}
}
function getLimits(assetClass) {
  const o = readLimitOverrides();
  const out = {};
  for (const p of PARAM_DEFS) {
    const key = `${assetClass || "all"}.${p.code}`;
    const ov = o[key] || {};
    out[p.code] = { ...p, warn: ov.warn ?? p.warn, alarm: ov.alarm ?? p.alarm, target: ov.target ?? p.target };
  }
  return out;
}
function setLimit(assetClass, paramCode, patch) {
  const o = readLimitOverrides();
  const key = `${assetClass || "all"}.${paramCode}`;
  o[key] = { ...(o[key] || {}), ...patch };
  const def = PARAM_DEFS.find(p => p.code === paramCode);
  if (def && o[key].warn === def.warn && o[key].alarm === def.alarm && (o[key].target ?? def.target) === def.target) {
    delete o[key];
  }
  writeLimitOverrides(o);
}
function resetLimits(assetClass) {
  const o = readLimitOverrides();
  for (const k of Object.keys(o)) if (k.startsWith(`${assetClass || "all"}.`)) delete o[k];
  writeLimitOverrides(o);
}

// ============================================================
// Rules engine — aviation-flavored seed rules.
// ============================================================
const RULE_SEED = [
  {
    id: "R-001", name: "Cam/lifter wear pattern (Lycoming)",
    enabled: true, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6"] },
    conditions: [
      { param: "Fe", op: ">", value: 35 },
      { param: "Cr", op: ">", value: 5  },
    ],
    action: "alarm",
    createdAt: "2026-04-12T14:00:00Z", lastTriggered: "2026-05-08T06:14:00Z",
  },
  {
    id: "R-002", name: "Viscosity drop > 15% — fuel dilution suspected",
    enabled: true, severity: "CRITICAL",
    scope: { classes: "all" },
    conditions: [{ param: "Visc100", op: "abs%>", value: 15 }],
    action: "alarm",
    createdAt: "2026-03-30T10:00:00Z", lastTriggered: "2026-05-10T22:01:00Z",
  },
  {
    id: "R-003", name: "Aluminum spike — piston scuff",
    enabled: true, severity: "SEVERE",
    scope: { classes: "all" },
    conditions: [{ param: "Al", op: ">", value: 15 }],
    action: "alarm",
    createdAt: "2026-02-18T09:00:00Z", lastTriggered: "2026-05-11T03:22:00Z",
  },
  {
    id: "R-004", name: "Water > 500 ppm — short-flight condensation",
    enabled: true, severity: "WARN",
    scope: { classes: "all" },
    conditions: [{ param: "H2O", op: ">", value: 500 }],
    action: "notify",
    createdAt: "2026-02-05T12:00:00Z", lastTriggered: "2026-04-29T16:00:00Z",
  },
  {
    id: "R-005", name: "Fuel dilution > 4% — mag check needed",
    enabled: true, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6","conto4","conto6"] },
    conditions: [{ param: "Fuel", op: ">", value: 4 }],
    action: "alarm",
    createdAt: "2026-01-22T09:00:00Z", lastTriggered: null,
  },
  {
    id: "R-006", name: "Copper Z-score anomaly (oil-cooler corrosion)",
    enabled: false, severity: "WARN",
    scope: { classes: "all" },
    conditions: [{ param: "Cu", op: "z>", value: 2.0 }],
    action: "flag",
    createdAt: "2026-01-09T08:00:00Z", lastTriggered: null,
  },
];

function readRules() {
  try {
    const v = JSON.parse(localStorage.getItem(RULES_KEY) || "null");
    if (Array.isArray(v) && v.length) return v;
  } catch (_) {}
  return RULE_SEED.slice();
}
function writeRules(rules) {
  try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch (_) {}
}
function getRules() { return readRules(); }
function saveRule(rule) {
  const list = readRules();
  const i = list.findIndex(r => r.id === rule.id);
  if (i >= 0) list[i] = rule; else list.unshift(rule);
  writeRules(list);
  return list;
}
function deleteRule(id) {
  const list = readRules().filter(r => r.id !== id);
  writeRules(list);
  return list;
}
function nextRuleId() {
  const list = readRules();
  const nums = list.map(r => parseInt((r.id || "R-0").split("-")[1], 10)).filter(n => !isNaN(n));
  return "R-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
}

function evalRule(rule, results) {
  if (!rule.enabled) return { ...rule, triggered: false, reasons: [] };
  const reasons = [];
  for (const c of rule.conditions || []) {
    const r = results.find(x => x.code === c.param);
    if (!r) { reasons.push(`${c.param}: no data`); continue; }
    const v = typeof r.value === "number" ? r.value : null;
    if (c.op === ">"  && v != null && v >  c.value) { reasons.push(`${c.param} ${v} > ${c.value}`); continue; }
    if (c.op === ">=" && v != null && v >= c.value) { reasons.push(`${c.param} ${v} ≥ ${c.value}`); continue; }
    if (c.op === "<"  && v != null && v <  c.value) { reasons.push(`${c.param} ${v} < ${c.value}`); continue; }
    if (c.op === "<=" && v != null && v <= c.value) { reasons.push(`${c.param} ${v} ≤ ${c.value}`); continue; }
    if (c.op === "abs%>" && v != null && r.target) {
      const pct = Math.abs(v - r.target) / r.target * 100;
      if (pct > c.value) { reasons.push(`${c.param} Δ${pct.toFixed(1)}% > ${c.value}%`); continue; }
    }
    return { ...rule, triggered: false, reasons };
  }
  return { ...rule, triggered: reasons.length === (rule.conditions || []).length, reasons };
}

// Test parameters per sample — values pulled from typical piston-aircraft
// wear-metal ranges; limits flow through getLimits(class).
function makeTestResults(sample) {
  const rng = mulberry32(parseInt(sample.id.slice(2), 10));
  const asset = ASSETS.find(a => a.id === sample.assetId);
  const limits = getLimits(asset?.class);
  const bad = sample.score < 55;
  const sev = sample.score < 30;
  // Baseline lead carries 100LL combustion residue — present even on
  // healthy engines (~4-6k ppm).
  const baseValues = {
    Fe:      sev ? 78    : bad ? 42    : 12 + Math.floor(rng()*14),
    Cr:      sev ? 14    : bad ? 7     : 1  + Math.floor(rng()*3),
    Al:      sev ? 22    : bad ? 11    : 2  + Math.floor(rng()*4),
    Cu:      sev ? 48    : bad ? 22    : 4  + Math.floor(rng()*8),
    Pb:      4000 + Math.floor(rng() * 3500) + (bad ? 1500 : 0),  // 100LL avgas baseline
    Ni:      sev ? 8     : bad ? 3     : Math.floor(rng()*2),
    Si:      sev ? 36    : bad ? 18    : 4  + Math.floor(rng()*7),
    Visc100: bad ? 16.4  : 19.0 + (rng()-0.5)*1.2,                 // SAE 50 nominal
    H2O:     sev ? 720   : bad ? 320   : 40 + Math.floor(rng()*80),
    Fuel:    sev ? 5.2   : bad ? 2.4   : Number(((rng()*0.8)).toFixed(2)),
  };
  return PARAM_DEFS.map(p => {
    const lim = limits[p.code];
    const row = { ...p, value: baseValues[p.code], warn: lim.warn, alarm: lim.alarm, target: lim.target ?? p.target };
    row.status = evalStatus(row);
    return row;
  });
}

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

// Trends for asset drill-down. Targets/limits tuned to the aviation params.
function makeTrend(asset, paramKey) {
  const rng = mulberry32(asset.id.charCodeAt(2) + paramKey.length);
  const target = paramKey === "Fe" ? 18
               : paramKey === "Cr" ? 3
               : paramKey === "Al" ? 5
               : paramKey === "Visc100" ? 19
               : paramKey === "H2O" ? 100
               : 8;
  const warn   = paramKey === "Fe" ? 35
               : paramKey === "Cr" ? 5
               : paramKey === "Al" ? 8
               : paramKey === "Visc100" ? 21
               : paramKey === "H2O" ? 200
               : 18;
  const alarm  = paramKey === "Fe" ? 65
               : paramKey === "Cr" ? 10
               : paramKey === "Al" ? 15
               : paramKey === "Visc100" ? 22
               : paramKey === "H2O" ? 500
               : 30;
  const unit   = paramKey === "Visc100" ? "cSt" : (paramKey === "H2O" || paramKey === "Fe" || paramKey === "Cr" || paramKey === "Al") ? "ppm" : "ppm";
  const bad = asset.health < 60;
  const points = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    let v = target + (rng() - 0.5) * target * 0.18;
    if (bad) v += t * (warn * (asset.health < 35 ? 2 : 1.0)) * 0.85;
    points.push({
      i,
      date: daysAgo((11 - i) * 14),
      value: paramKey === "Visc100" ? Number(v.toFixed(1)) : Math.round(v),
    });
  }
  return { points, target, warn, alarm, unit };
}

function fleetCounts() {
  const total = ASSETS.length;
  const byCode = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const a of ASSETS) byCode[a.code]++;
  return { total, byCode };
}

function recentPublished(n = 6) {
  return SAMPLES.filter(s => s.status === "PUBLISHED").slice(0, n);
}

Object.assign(window, {
  SITES, ASSETS, ASSET_CLASSES, ROLES, SAMPLES, ALARMS, COND, OILS, PARAM_DEFS,
  scoreToCode, fmtDate, fmtShortDate, fmtTime,
  makeTestResults, makeTrend, fleetCounts, recentPublished,
  getLimits, setLimit, resetLimits,
  getRules, saveRule, deleteRule, nextRuleId, evalRule,
});
