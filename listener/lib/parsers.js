// Local copies of the Lab88 server's CSV parsers so the listener can
// pre-parse instrument files before uploading. The wire shape of the
// produced `readings` array matches POST /api/samples exactly:
//   [{ code, value }, ...]
// Codes use the Lab88 vocabulary (Dist_T10, FlashPt, El_Fe, etc.).

function splitLine(line) {
  if (line.indexOf("\t") >= 0) return line.split("\t").map(s => s.trim());
  if (line.indexOf(";")  >= 0) return line.split(";").map(s => s.trim());
  return line.split(",").map(s => s.trim());
}
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
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(splitLine);
}
function kvMap(text) {
  const out = new Map();
  for (const cells of rows(text)) {
    if (cells.length < 2) continue;
    const label = (cells[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!label) continue;
    let value = null;
    for (let i = 1; i < cells.length; i++) {
      if (cells[i] === "") continue;
      const n = num(cells[i]);
      if (n != null) { value = n; break; }
      if (value == null) value = cells[i];
    }
    if (value != null && !out.has(label)) out.set(label, value);
  }
  return out;
}

const IR_VISION_ALIASES = {
  Dist_IBP:   ["ibp","initialboilingpoint"],
  Dist_T10:   ["t10","t10recovered"],
  Dist_T50:   ["t50","t50recovered"],
  Dist_T65:   ["t65"],
  Dist_T85:   ["t85"],
  Dist_T90:   ["t90"],
  T90Dist:    ["t90","t90distillation"],
  Dist_T95:   ["t95"],
  Dist_FBP:   ["fbp","finalboilingpoint"],
  IR_Density: ["density","density20","densityat20c"],
  IR_Cetane:  ["cetaneindex","cetane"],
  IR_CFPP:    ["cfpp","coldfilterplugpoint"],
  KinVisc40:  ["kinematicviscosity40c","kinematicviscosity","viscosityat40c","visc40","kvisc40"],
};
function parseIRVisionCSV(text) {
  const kv = kvMap(text);
  const readings = [];
  const used = new Set();
  for (const [code, aliases] of Object.entries(IR_VISION_ALIASES)) {
    if (used.has(code)) continue;
    for (const a of aliases) {
      if (kv.has(a)) {
        const v = num(kv.get(a));
        if (v != null) { readings.push({ code, value: v }); used.add(code); }
        break;
      }
    }
  }
  return { readings };
}

function parseFlashPointCSV(text) {
  const kv = kvMap(text);
  for (const k of ["flashpoint","tflash","fp","tflashvalue"]) {
    if (kv.has(k)) {
      const v = num(kv.get(k));
      if (v != null) return { readings: [{ code: "FlashPt", value: v }] };
    }
  }
  return { readings: [] };
}

const ADDITIVE_ALIASES = {
  El_Sulphur: ["sulphur","sulfur","s"],
  El_Fe:      ["iron","fe"],
  El_Al:      ["aluminium","aluminum","al"],
  El_Mg:      ["magnesium","mg"],
  El_Zn:      ["zinc","zn"],
  El_Pb:      ["lead","pb"],
  El_Si:      ["silicon","si"],
  El_Mn:      ["manganese","mn"],
  El_V:       ["vanadium","v"],
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

// Choose the right parser from the file name. Easy to extend.
function detectAndParse(filename, text) {
  const f = filename.toLowerCase();
  if (/ir.?vision|distill|spectrovisc|minivisc/.test(f)) return { kind: "ir-vision",   ...parseIRVisionCSV(text) };
  if (/flash/.test(f))                                   return { kind: "flash-point", ...parseFlashPointCSV(text) };
  if (/additive|spectroil|elemental|wear/.test(f))       return { kind: "additives",   ...parseAdditivesCSV(text) };
  // Fallback: try all three and pick whichever produced the most readings.
  const ir  = parseIRVisionCSV(text);
  const fp  = parseFlashPointCSV(text);
  const add = parseAdditivesCSV(text);
  const winner = [["ir-vision", ir], ["flash-point", fp], ["additives", add]]
    .sort((a, b) => b[1].readings.length - a[1].readings.length)[0];
  return { kind: winner[0], ...winner[1] };
}

module.exports = { parseIRVisionCSV, parseFlashPointCSV, parseAdditivesCSV, detectAndParse };
