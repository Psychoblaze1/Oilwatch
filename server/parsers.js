// ============================================================
// Instrument-file parsers.
//
// Each parser takes a CSV/TSV-like text blob and returns a uniform
// shape: { readings: [{ code, value }, ...] }. Codes are the same
// param-vocabulary the rest of Oilwatch uses (Dist_T10, FlashPt,
// El_Fe, etc.) so the parsed readings drop straight into a sample.
//
// Parsing is intentionally forgiving — unknown columns / extra rows
// are skipped, common separators (comma / semicolon / tab) all work,
// and whitespace and unit suffixes (e.g. "90.0 °C", "<0.1 ppm") are
// tolerated. Each function is pure: no filesystem hits, no DB hits.
// ============================================================

// Split a single CSV line on the most common separator. Stays robust
// for the rate at which instruments emit semicolon vs comma vs tab.
function splitLine(line) {
  if (line.indexOf("\t") >= 0) return line.split("\t").map(s => s.trim());
  if (line.indexOf(";")  >= 0) return line.split(";").map(s => s.trim());
  return line.split(",").map(s => s.trim());
}

// Strip a trailing unit, "<" prefix, quotes, etc. and parse to a Number.
// Returns null if nothing numeric could be found.
function num(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return isNaN(raw) ? null : raw;
  const s = String(raw).replace(/^["']|["']$/g, "").trim();
  if (!s) return null;
  const m = s.replace(/^</, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return isNaN(n) ? null : n;
}

function rows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(splitLine);
}

// Build a flexible key→value lookup from the rows. Looks at the first
// cell as the label and the next non-empty numeric cell as the value.
function kvMap(text) {
  const out = new Map();
  for (const cells of rows(text)) {
    if (cells.length < 2) continue;
    const label = (cells[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!label) continue;
    // First non-empty numeric cell after column 0 wins.
    let value = null;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i] === "") continue;
      const n = num(cells[i]);
      if (n != null) { value = n; break; }
      // Keep the raw string as a fallback (e.g. for ISO 4406 codes).
      if (value == null) value = cells[i];
    }
    if (value != null && !out.has(label)) out.set(label, value);
  }
  return out;
}

// =============================================================
// IR Vision CSV — distillation curve + density + cetane + viscosity
// =============================================================

// Maps loose labels (normalised to lowercase, no separators) to our
// canonical param codes. Multiple aliases per code so the parser
// soaks up the small format differences between instrument firmwares.
const IR_VISION_ALIASES = {
  Dist_IBP:   ["ibp", "initialboilingpoint"],
  Dist_T10:   ["t10", "t10recovered", "10recovered"],
  Dist_T50:   ["t50", "t50recovered", "50recovered"],
  Dist_T65:   ["t65"],
  Dist_T85:   ["t85"],
  Dist_T90:   ["t90"],  // alias — T90 critical limit lives under T90Dist below.
  T90Dist:    ["t90", "t90distillation"],
  Dist_T95:   ["t95"],
  Dist_FBP:   ["fbp", "finalboilingpoint"],
  IR_Density: ["density", "density20", "densityat20c"],
  IR_Cetane:  ["cetaneindex", "cetane"],
  IR_CFPP:    ["cfpp", "coldfilterplugpoint"],
  KinVisc40:  ["kinematicviscosity40c", "kinematicviscosity", "viscosityat40c", "visc40", "kvisc40"],
};

function parseIRVisionCSV(text) {
  const kv = kvMap(text);
  const readings = [];
  // De-dupe Dist_T90 vs T90Dist by giving the critical-limit code
  // priority when both aliases would match the same key.
  const used = new Set();
  for (const [code, aliases] of Object.entries(IR_VISION_ALIASES)) {
    if (used.has(code)) continue;
    for (const a of aliases) {
      if (kv.has(a)) {
        const v = num(kv.get(a));
        if (v != null) {
          readings.push({ code, value: v });
          used.add(code);
        }
        break;
      }
    }
  }
  // If the CSV looks like the Lab88 positional layout (first-row header
  // plus a row of numeric cells in fixed positions), try that as a
  // last-resort fallback to support raw instrument exports.
  if (readings.length === 0) {
    const all = rows(text);
    // Heuristic: when 'IR' / 'Vision' is mentioned anywhere on the first
    // row and the body has at least 27 rows, the row offsets used by
    // Lab88's get_ir_values apply (Density on row 10, Cetane on row 17,
    // etc.). The exact indices are kept in lockstep with automation.py.
    const head = (all[0] || []).join(" ").toLowerCase();
    if (/ir|vision|aurora/.test(head) && all.length >= 27) {
      const tryRow = (idx, code) => {
        const v = num(all[idx + 1]?.[1]);
        if (v != null) readings.push({ code, value: v });
      };
      // Row offsets are 0-based into the body (skip header). Aligned
      // with Lab88's `formatted_rows[N]` indexing in automation.py.
      tryRow(9,  "IR_Density");
      tryRow(16, "IR_Cetane");
      tryRow(17, "Dist_IBP");
      tryRow(18, "Dist_T10");
      tryRow(19, "Dist_T50");
      tryRow(20, "Dist_T65");
      tryRow(21, "Dist_T85");
      tryRow(22, "T90Dist");
      tryRow(23, "Dist_T95");
      tryRow(24, "Dist_FBP");
      tryRow(25, "IR_CFPP");
      tryRow(26, "KinVisc40");
    }
  }
  return { readings };
}

// =============================================================
// Flash Point CSV — single value for FlashPt
// =============================================================

function parseFlashPointCSV(text) {
  const kv = kvMap(text);
  const tryKeys = ["flashpoint", "tflash", "fp", "tflashvalue"];
  for (const k of tryKeys) {
    if (kv.has(k)) {
      const v = num(kv.get(k));
      if (v != null) return { readings: [{ code: "FlashPt", value: v }] };
    }
  }
  // Fallback: first numeric value found in the text (instruments often
  // dump key-value pairs in their own quirky layouts).
  for (const cells of rows(text)) {
    for (const c of cells) {
      const n = num(c);
      if (n != null && n > 0 && n < 500) return { readings: [{ code: "FlashPt", value: n }] };
    }
  }
  return { readings: [] };
}

// =============================================================
// Additives CSV — elemental concentrations
// =============================================================

const ADDITIVE_ALIASES = {
  El_Sulphur:  ["sulphur", "sulfur", "s"],
  El_Fe:       ["iron", "fe"],
  El_Al:       ["aluminium", "aluminum", "al"],
  El_Mg:       ["magnesium", "mg"],
  El_Zn:       ["zinc", "zn"],
  El_Pb:       ["lead", "pb"],
  El_Si:       ["silicon", "si"],
  El_Mn:       ["manganese", "mn"],
  El_V:        ["vanadium", "v"],
};

function parseAdditivesCSV(text) {
  const kv = kvMap(text);
  const readings = [];
  for (const [code, aliases] of Object.entries(ADDITIVE_ALIASES)) {
    for (const a of aliases) {
      if (kv.has(a)) {
        const v = num(kv.get(a));
        if (v != null) readings.push({ code, value: v });
        break;
      }
    }
  }
  return { readings };
}

module.exports = { parseIRVisionCSV, parseFlashPointCSV, parseAdditivesCSV };
