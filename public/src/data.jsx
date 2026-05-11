// ============================================================
// Mock domain data for Oilwatch
// ============================================================

const SITES = [
  { id: "wr-01", code: "WR-01", name: "West Refinery",       region: "TX, USA",   assets: 38, samples28d: 412 },
  { id: "px-02", code: "PX-02", name: "Permian Field Ops",   region: "NM, USA",   assets: 71, samples28d: 689 },
  { id: "gt-04", code: "GT-04", name: "Gulf Terminal",       region: "LA, USA",   assets: 22, samples28d: 198 },
  { id: "hp-07", code: "HP-07", name: "Houston Petrochem",   region: "TX, USA",   assets: 54, samples28d: 537 },
  { id: "an-09", code: "AN-09", name: "Anchorage North LNG", region: "AK, USA",   assets: 18, samples28d: 142 },
  { id: "bk-11", code: "BK-11", name: "Bakken Compressors",  region: "ND, USA",   assets: 29, samples28d: 251 },
];

const ASSET_CLASSES = [
  { id: "pump",    label: "Pumps",          icon: "pump" },
  { id: "comp",    label: "Compressors",    icon: "comp" },
  { id: "turb",    label: "Turbines",       icon: "turb" },
  { id: "gear",    label: "Gearboxes",      icon: "gear" },
  { id: "hyd",     label: "Hydraulics",     icon: "hyd" },
  { id: "trans",   label: "Transformers",   icon: "trans" },
];

const ROLES = [
  { id: "TECH",    label: "Technician",  hint: "Collect & log" },
  { id: "ANALYST", label: "Analyst",     hint: "QC & publish"  },
  { id: "MANAGER", label: "Manager",     hint: "Review & sign-off" },
  { id: "ADMIN",   label: "Admin",       hint: "Config & access" },
];

// ISO condition codes
const COND = {
  1: { label: "Normal",   short: "OK",   color: "ok",   range: "75–100", icon: "●" },
  2: { label: "Caution",  short: "WARN", color: "warn", range: "50–74",  icon: "●" },
  3: { label: "Critical", short: "CRIT", color: "crit", range: "25–49",  icon: "●" },
  4: { label: "Severe",   short: "SEV",  color: "sev",  range: "0–24",   icon: "●" },
};

// Score → ISO code
function scoreToCode(s) {
  if (s >= 75) return 1;
  if (s >= 50) return 2;
  if (s >= 25) return 3;
  return 4;
}

// Stable RNG so refresh doesn't reshuffle
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ASSET_NAMES = {
  pump:  ["Crude Charge P-101","Booster P-204","Reflux P-318","Cooling P-422","Loading P-507","Recirc P-612"],
  comp:  ["Recycle C-201","Gas Boost C-305","Inter-stage C-412","Vapor Recovery C-509","Air C-118","Sales C-707"],
  turb:  ["Main GT-1","Drive Turbine T-302","Steam T-411","Exhaust T-508","Aux T-119"],
  gear:  ["Mill Drive G-220","Conveyor G-318","Mixer G-405","Aerator G-511","Crane G-622"],
  hyd:   ["Press H-110","Actuator H-225","Lift H-330","Servo H-445","Valve H-518"],
  trans: ["Transformer TX-301","Transformer TX-402","Transformer TX-510","Transformer TX-604"],
};

const OEMS = ["Sulzer","Flowserve","Atlas Copco","Siemens Energy","GE Vernova","Voith","Bosch Rexroth","ABB"];
const OILS = [
  { brand: "Mobil",   name: "Mobil DTE 10 Excel 46",  iso: "ISO VG 46" },
  { brand: "Shell",   name: "Shell Tellus S2 V 68",   iso: "ISO VG 68" },
  { brand: "Castrol", name: "Castrol Hyspin AWH-M 46",iso: "ISO VG 46" },
  { brand: "Chevron", name: "Chevron Rando HDZ 32",   iso: "ISO VG 32" },
  { brand: "Mobil",   name: "Mobilgear 600 XP 220",   iso: "ISO VG 220" },
  { brand: "Shell",   name: "Shell Turbo T 32",       iso: "ISO VG 32" },
];

// Build assets
const ASSETS = [];
{
  const rng = mulberry32(7);
  let id = 1000;
  for (const site of SITES) {
    const count = Math.max(6, Math.min(14, Math.floor(site.assets / 4)));
    for (let i = 0; i < count; i++) {
      const cls = ASSET_CLASSES[Math.floor(rng() * ASSET_CLASSES.length)];
      const names = ASSET_NAMES[cls.id];
      const baseName = names[Math.floor(rng() * names.length)];
      // Health score skews healthy with a tail of trouble
      const r = rng();
      let score;
      if (r < 0.55)      score = 78 + Math.floor(rng() * 20);
      else if (r < 0.82) score = 55 + Math.floor(rng() * 22);
      else if (r < 0.95) score = 28 + Math.floor(rng() * 20);
      else               score = 6  + Math.floor(rng() * 18);

      ASSETS.push({
        id: "A-" + (id++),
        tag: `${cls.id.toUpperCase()}-${100 + i + Math.floor(rng()*40)}`,
        name: baseName,
        site: site.id,
        siteName: site.name,
        class: cls.id,
        classLabel: cls.label,
        oem: OEMS[Math.floor(rng() * OEMS.length)],
        oil: OILS[Math.floor(rng() * OILS.length)],
        runHours: 800 + Math.floor(rng() * 32000),
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

function makeDimensions(rng, base, cls) {
  // N-dimensional health depending on sample type
  const sets = {
    pump:  ["Wear","Contamination","Chemistry"],
    comp:  ["Wear","Contamination","Chemistry","Viscosity"],
    turb:  ["Wear","Oxidation","Viscosity"],
    gear:  ["Wear","Contamination","Additives","Viscosity"],
    hyd:   ["Particles","Water","Viscosity"],
    trans: ["Dielectric","Moisture","Acidity","Gases"],
  };
  const dims = sets[cls] || ["Wear","Contamination","Chemistry"];
  return dims.map((d, i) => {
    const jitter = (rng() - 0.5) * 30;
    const score = Math.max(2, Math.min(99, Math.floor(base + jitter)));
    return { label: d, score, code: scoreToCode(score) };
  });
}

function daysAgo(d)   { const x = new Date(); x.setDate(x.getDate() - d); return x; }
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

// Sample lifecycle
const SAMPLE_STATUS = ["DRAFT","QC","APPROVED","PUBLISHED","REJECTED"];

const SAMPLES = [];
{
  const rng = mulberry32(13);
  let id = 50231;
  for (const a of ASSETS) {
    // Each asset gets 1-4 recent samples
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
        barcode: "0" + (240000 + Math.floor(rng() * 9999)),
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

function pickComponent(rng, cls) {
  const opts = {
    pump:  ["Bearing","Casing","Mech Seal","Coupling"],
    comp:  ["Crankcase","Cylinder","Cooler","Filter"],
    turb:  ["Reservoir","Bearing","Gov Oil"],
    gear:  ["High-speed Stage","Low-speed Stage","Sump","Bearing"],
    hyd:   ["Main Reservoir","Charge Line","Return Line"],
    trans: ["Tank Oil","LTC Compartment"],
  };
  const arr = opts[cls] || ["Sump"];
  return arr[Math.floor(rng() * arr.length)];
}
function pickAnalyst(rng) {
  const list = ["M. Okafor","R. Pillai","S. Henningsen","T. Reyes","D. Vaughn","J. Park"];
  return list[Math.floor(rng() * list.length)];
}
function pickFlags(rng, score) {
  const flags = [];
  if (score < 55 && rng() < 0.7) flags.push("Fe↑");
  if (score < 60 && rng() < 0.5) flags.push("H₂O");
  if (score < 50 && rng() < 0.55) flags.push("Visc Δ");
  if (score < 35 && rng() < 0.4) flags.push("TAN↑");
  if (rng() < 0.05) flags.push("Particle");
  return flags;
}

// Alarms
const ALARMS = [];
{
  const rng = mulberry32(101);
  const candidates = ASSETS.filter(a => a.health < 70).sort((a,b) => a.health - b.health);
  for (const a of candidates.slice(0, 14)) {
    const t = rng();
    const rule = a.health < 25 ? "Condemning limit exceeded"
              : a.health < 50 ? (t < 0.5 ? "Bearing failure imminent — water contamination accelerating wear" : "Iron trend +3 consecutive, ΔFe 22 ppm in 1 sample")
              : (t < 0.5 ? "Viscosity deviation > 15% — possible fuel dilution" : "Z-score anomaly on Cu (2.6σ above baseline)");
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

// Test parameters for sample detail
function makeTestResults(sample) {
  const rng = mulberry32(parseInt(sample.id.slice(2), 10));
  const bad = sample.score < 55;
  const sev = sample.score < 30;
  const params = [
    { code: "Fe",       name: "Iron",            unit: "ppm",  value: sev ? 84 : bad ? 38 : 8 + Math.floor(rng()*7),    warn: 25,   alarm: 50,   method: "ASTM D5185" },
    { code: "Cu",       name: "Copper",          unit: "ppm",  value: sev ? 41 : bad ? 22 : 3 + Math.floor(rng()*6),    warn: 15,   alarm: 30,   method: "ASTM D5185" },
    { code: "Si",       name: "Silicon",         unit: "ppm",  value: sev ? 28 : bad ? 14 : 2 + Math.floor(rng()*5),    warn: 12,   alarm: 25,   method: "ASTM D5185" },
    { code: "Pb",       name: "Lead",            unit: "ppm",  value: bad ? 18 : 2 + Math.floor(rng()*4),               warn: 12,   alarm: 24,   method: "ASTM D5185" },
    { code: "Cr",       name: "Chromium",        unit: "ppm",  value: bad ? 9  : 1 + Math.floor(rng()*3),               warn: 8,    alarm: 16,   method: "ASTM D5185" },
    { code: "Visc40",   name: "Viscosity @ 40°C",unit: "cSt",  value: bad ? 38.2 : 45.8 + (rng()-0.5)*1.6,              warn: "±10%", alarm: "±15%", method: "ASTM D445", target: 46 },
    { code: "H2O",      name: "Water",           unit: "ppm",  value: sev ? 2400 : bad ? 1100 : 120 + Math.floor(rng()*180), warn: 500, alarm: 1500, method: "ASTM D6304" },
    { code: "TAN",      name: "Acid Number",     unit: "mg KOH/g", value: bad ? 1.9 : 0.4 + rng()*0.4,                  warn: 1.2,  alarm: 2.0,  method: "ASTM D664"  },
    { code: "ISO",      name: "Particle Code",   unit: "—",    value: bad ? "21/19/16" : "17/15/12",                    warn: "18/16/13", alarm: "20/18/15", method: "ISO 4406" },
    { code: "Oxid",     name: "Oxidation",       unit: "Abs/cm",value: bad ? 24 : 8 + Math.floor(rng()*5),              warn: 20,   alarm: 30,   method: "FTIR" },
  ];
  return params.map(p => ({
    ...p,
    status: evalStatus(p),
  }));
}
function evalStatus(p) {
  if (typeof p.alarm === "number" && typeof p.value === "number") {
    if (p.value >= p.alarm) return "alarm";
    if (p.value >= p.warn)  return "warn";
    return "ok";
  }
  if (p.code === "ISO") {
    return p.value === "21/19/16" ? "alarm" : "ok";
  }
  if (p.code === "Visc40") {
    const dev = Math.abs(p.value - 46) / 46;
    if (dev > 0.15) return "alarm";
    if (dev > 0.10) return "warn";
    return "ok";
  }
  return "ok";
}

// Trends for asset drill-down (12 points)
function makeTrend(asset, paramKey) {
  const rng = mulberry32(asset.id.charCodeAt(2) + paramKey.length);
  const target = paramKey === "Fe" ? 12 : paramKey === "Visc40" ? 46 : paramKey === "H2O" ? 200 : 8;
  const warn   = paramKey === "Fe" ? 25 : paramKey === "Visc40" ? 50 : paramKey === "H2O" ? 500 : 18;
  const alarm  = paramKey === "Fe" ? 50 : paramKey === "Visc40" ? 53 : paramKey === "H2O" ? 1500 : 30;
  const bad = asset.health < 60;
  const points = [];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    let v = target + (rng() - 0.5) * target * 0.18;
    if (bad) v += t * (warn * (asset.health < 35 ? 2 : 1.0)) * 0.85;
    points.push({
      i,
      date: daysAgo((11 - i) * 14),
      value: paramKey === "Visc40" ? Number(v.toFixed(1)) : Math.round(v),
    });
  }
  return { points, target, warn, alarm, unit: paramKey === "Visc40" ? "cSt" : "ppm" };
}

// Counts for dashboard
function fleetCounts() {
  const total = ASSETS.length;
  const byCode = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const a of ASSETS) byCode[a.code]++;
  return { total, byCode };
}

// Recent published samples (for AI tools)
function recentPublished(n = 6) {
  return SAMPLES.filter(s => s.status === "PUBLISHED").slice(0, n);
}

Object.assign(window, {
  SITES, ASSETS, ASSET_CLASSES, ROLES, SAMPLES, ALARMS, COND, OILS,
  scoreToCode, fmtDate, fmtShortDate, fmtTime,
  makeTestResults, makeTrend, fleetCounts, recentPublished,
});
