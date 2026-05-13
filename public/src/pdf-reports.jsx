// ============================================================
// Generated PDF reports.
//
// These build the report from data using jsPDF text/tables, instead
// of html2canvas-ing the current page. Important reasons:
//  - No webpage chrome (sidebar, topbar, Reject/Approve buttons) leaks
//    into the report.
//  - The health-vector radar is intentionally excluded — TruVu-style
//    lab reports show data, not visualizations.
//  - Pagination is deterministic: tables wrap cleanly across pages.
//
// `window.exportSamplePDF(sample, asset)` writes a sample analysis
// report. `window.exportAssetPDF(asset, samples)` writes an engine-
// history summary. Both are owner-facing — appropriate to email to
// an aircraft owner or A&P.
// ============================================================

(function () {
  const ACCENT = [194, 65, 12];   // burnt orange (matches --accent default)
  const INK    = [28, 26, 23];
  const INK_2  = [74, 70, 64];
  const INK_3  = [128, 122, 112];
  const LINE   = [227, 224, 217];
  const SUNKEN = [236, 235, 230];
  const OK     = [47, 125, 79];
  const WARN   = [184, 133, 20];
  const CRIT   = [184, 51, 31];
  const SEV    = [42, 37, 33];

  function statusColor(s) {
    if (s === "alarm") return CRIT;
    if (s === "warn")  return WARN;
    return OK;
  }
  function condColor(c) {
    return c === 1 ? OK : c === 2 ? WARN : c === 3 ? CRIT : SEV;
  }
  function statusLabel(s) {
    return s === "alarm" ? "ALARM" : s === "warn" ? "WARN" : "OK";
  }
  function fmt(v) {
    if (v == null) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
    return String(v);
  }
  function dateOnly(d) {
    if (!d) return "—";
    const x = d instanceof Date ? d : new Date(d);
    return isNaN(x) ? "—" : x.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  }

  // ---- Layout helpers -----------------------------------------------

  // Page geometry (A4 portrait, points).
  const PAGE = { W: 595.28, H: 841.89, M: 40 };
  const RIGHT = PAGE.W - PAGE.M;
  const COL_W = PAGE.W - PAGE.M * 2;

  function header(doc, title, subId, subRight) {
    // Orange band
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, PAGE.W, 56, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("OILWATCH", PAGE.M, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(title, PAGE.M + 115, 36);

    doc.setFontSize(9);
    if (subId)    doc.text(subId,    RIGHT, 22, { align: "right" });
    if (subRight) doc.text(subRight, RIGHT, 38, { align: "right" });
  }

  function footer(doc, sampleId) {
    const y = PAGE.H - 32;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(PAGE.M, y, RIGHT, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK_3);
    doc.text("Oilwatch · Lab88 VU · advisory report — not a substitute for proper engine maintenance.", PAGE.M, y + 14);
    if (sampleId) doc.text(`${sampleId}  ·  Page ${doc.internal.getNumberOfPages()}`, RIGHT, y + 14, { align: "right" });
  }

  function sectionHead(doc, y, label) {
    doc.setTextColor(...INK_3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), PAGE.M, y);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(PAGE.M, y + 4, RIGHT, y + 4);
    return y + 16;
  }

  function kv(doc, x, y, label, value, w) {
    doc.setTextColor(...INK_3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...INK);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(value ?? "—"), w || 220);
    doc.text(lines, x, y + 13);
    return y + 13 + lines.length * 12;
  }

  function paragraph(doc, x, y, text, w) {
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, w);
    doc.text(lines, x, y);
    return y + lines.length * 13;
  }

  // ---- Results table -------------------------------------------------

  function resultsTable(doc, startY, results) {
    // Column layout (proportional). Widths sum to ~COL_W (515).
    const cols = [
      { key: "code",   label: "Code",      w: 50,  align: "left"  },
      { key: "name",   label: "Parameter", w: 110, align: "left"  },
      { key: "value",  label: "Value",     w: 70,  align: "right" },
      { key: "unit",   label: "Unit",      w: 55,  align: "left"  },
      { key: "warn",   label: "Warn",      w: 60,  align: "right" },
      { key: "alarm",  label: "Alarm",     w: 60,  align: "right" },
      { key: "status", label: "Status",    w: 60,  align: "left"  },
      { key: "method", label: "Method",    w: 50,  align: "left"  },
    ];
    const ROW_H = 18;
    let y = startY;

    const drawHeader = () => {
      doc.setFillColor(...SUNKEN);
      doc.rect(PAGE.M, y, COL_W, ROW_H, "F");
      doc.setTextColor(...INK_3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let x = PAGE.M + 8;
      for (const c of cols) {
        const tx = c.align === "right" ? x + c.w - 12 : x;
        doc.text(c.label.toUpperCase(), tx, y + 12, { align: c.align === "right" ? "right" : "left" });
        x += c.w;
      }
      y += ROW_H;
    };
    drawHeader();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];

      if (y + ROW_H > PAGE.H - 60) {
        footer(doc, null);
        doc.addPage();
        y = 80;
        drawHeader();
      }

      // Alt-row fill
      if (i % 2 === 1) {
        doc.setFillColor(250, 249, 246);
        doc.rect(PAGE.M, y, COL_W, ROW_H, "F");
      }

      let x = PAGE.M + 8;
      const cellText = (key) => {
        switch (key) {
          case "code":   return r.code;
          case "name":   return r.name;
          case "value":  return fmt(r.value);
          case "unit":   return r.unit;
          case "warn":   return r.warn != null ? String(r.warn) : "—";
          case "alarm":  return r.alarm != null ? String(r.alarm) : "—";
          case "status": return statusLabel(r.status);
          case "method": return r.method;
          default:       return "";
        }
      };

      for (const c of cols) {
        const txt = cellText(c.key);
        if (c.key === "status") {
          // colored chip
          const [rr, gg, bb] = statusColor(r.status);
          doc.setFillColor(rr, gg, bb);
          doc.rect(x, y + 4, 44, 11, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.text(txt, x + 22, y + 12, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
        } else {
          doc.setTextColor(c.key === "code" || c.key === "method" || c.key === "unit" ? INK_3[0] : INK[0],
                           c.key === "code" || c.key === "method" || c.key === "unit" ? INK_3[1] : INK[1],
                           c.key === "code" || c.key === "method" || c.key === "unit" ? INK_3[2] : INK[2]);
          const tx = c.align === "right" ? x + c.w - 12 : x;
          doc.text(String(txt), tx, y + 12, { align: c.align === "right" ? "right" : "left" });
        }
        x += c.w;
      }
      y += ROW_H;
    }

    // Bottom border under table
    doc.setDrawColor(...LINE);
    doc.line(PAGE.M, y, RIGHT, y);
    return y + 12;
  }

  // ---- Sample report -------------------------------------------------

  function buildSampleReport(sample, asset, site, results, opts = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

    const cond = window.COND[sample.code] || window.COND[1];
    const reportDate = dateOnly(new Date());

    header(doc, "AIRCRAFT OIL ANALYSIS REPORT",
      `Sample  ${sample.id}`, `Report date  ${reportDate}`);

    let y = 80;

    // Operator + Engine, two columns
    y = sectionHead(doc, y, "Operator & Engine");
    const colW = (COL_W - 24) / 2;
    let yL = y, yR = y;
    yL = kv(doc, PAGE.M, yL, "Operator", site?.name || sample.siteName || "—", colW);
    yL = kv(doc, PAGE.M, yL, "Location", site ? `${site.region}  ·  ${site.code}` : "—", colW);

    yR = kv(doc, PAGE.M + colW + 24, yR, "Aircraft", asset?.name || sample.assetName || "—", colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Engine",   asset?.tag || sample.assetTag || "—", colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Engine class & OEM", asset ? `${asset.classLabel}  ·  ${asset.oem}` : "—", colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Run hours (TSMOH)", asset?.runHours != null ? `${asset.runHours.toLocaleString()} hr` : "—", colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Oil in service", asset?.oil ? `${asset.oil.brand}  ·  ${asset.oil.name}  (${asset.oil.iso})` : sample.oil || "—", colW);

    y = Math.max(yL, yR) + 12;

    // Sample details
    y = sectionHead(doc, y, "Sample Details");
    const grid = [
      [["Sample ID",    sample.id],                  ["Drawn",       dateOnly(sample.receivedAt)]],
      [["Barcode",      sample.barcode || "—"],      ["Received",    dateOnly(sample.receivedAt)]],
      [["Component",    sample.component || "—"],    ["Method panel","AVI-STD-12 (Piston Aircraft)"]],
      [["Priority",     sample.priority || "STD"],   ["Analyst",     sample.analyst || "—"]],
      [["Status",       sample.status],              ["Flags",       (sample.flags || []).join(", ") || "—"]],
    ];
    for (const row of grid) {
      kv(doc, PAGE.M,                row[0][0] ? PAGE.M*0+y : y, row[0][0], row[0][1], colW);
      kv(doc, PAGE.M + colW + 24, y, row[1][0], row[1][1], colW);
      y += 28;
    }
    y += 4;

    // Overall assessment
    y = sectionHead(doc, y, "Overall Assessment");
    doc.setTextColor(...INK_3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("HEALTH SCORE", PAGE.M, y);
    doc.text("CONDITION", PAGE.M + 200, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    doc.text(`${sample.score}`, PAGE.M, y + 22);
    doc.setTextColor(255, 255, 255);
    const [cr, cg, cb] = condColor(sample.code);
    doc.setFillColor(cr, cg, cb);
    doc.rect(PAGE.M + 200, y + 6, 90, 20, "F");
    doc.setFontSize(11);
    doc.text(cond.label.toUpperCase(), PAGE.M + 245, y + 20, { align: "center" });

    // Health score bar
    const barX = PAGE.M, barY = y + 32, barW = COL_W, barH = 6;
    doc.setFillColor(...SUNKEN);
    doc.rect(barX, barY, barW, barH, "F");
    const filledW = barW * Math.max(0, Math.min(1, (sample.score || 0) / 100));
    doc.setFillColor(cr, cg, cb);
    doc.rect(barX, barY, filledW, barH, "F");
    // band markers at 25/50/75
    doc.setDrawColor(...LINE);
    for (const t of [0.25, 0.5, 0.75]) {
      doc.line(barX + barW * t, barY, barX + barW * t, barY + barH);
    }
    y = barY + barH + 18;

    // Test results
    y = sectionHead(doc, y, "Test Results");
    if (!results || results.length === 0) {
      y = paragraph(doc, PAGE.M, y, "No instrument readings have been recorded for this sample yet. Sample is in DRAFT until results are attached.", COL_W);
      y += 8;
    } else {
      y = resultsTable(doc, y, results);
    }

    // Diagnostic summary (page-break aware)
    const ensureRoom = (h) => {
      if (y + h > PAGE.H - 60) {
        footer(doc, sample.id);
        doc.addPage();
        y = 80;
      }
    };

    ensureRoom(120);
    y = sectionHead(doc, y, "Diagnostic Summary");
    const diag = opts.diagnostic || autoDiagnostic(sample, asset, results);
    y = paragraph(doc, PAGE.M, y, diag.summary, COL_W);
    y += 8;

    if (diag.recommendations && diag.recommendations.length) {
      ensureRoom(20 + diag.recommendations.length * 14);
      doc.setTextColor(...INK_3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("RECOMMENDED ACTIONS", PAGE.M, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      for (const rec of diag.recommendations) {
        ensureRoom(20);
        doc.text("•", PAGE.M, y);
        const lines = doc.splitTextToSize(rec, COL_W - 16);
        doc.text(lines, PAGE.M + 12, y);
        y += lines.length * 13;
      }
      y += 4;
    }

    // Sign-off block
    ensureRoom(80);
    y = sectionHead(doc, y, "Sign-Off");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK_2);
    doc.text(`Analyst:   ${sample.analyst || "—"}`, PAGE.M, y + 4);
    doc.text(`Approved:  ${(sample.status === "APPROVED" || sample.status === "PUBLISHED") ? sample.analyst || "(reviewed)" : "_____________________"}`, PAGE.M, y + 22);
    doc.text(`Date:      ${reportDate}`, PAGE.M, y + 40);
    y += 56;

    // Footers on every page
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      footer(doc, sample.id);
    }

    return doc;
  }

  // ---- Asset (engine) report ----------------------------------------

  function buildAssetReport(asset, site, samples) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const reportDate = dateOnly(new Date());
    const cond = window.COND[asset.code] || window.COND[1];

    header(doc, "ENGINE TREND REPORT",
      `Engine  ${asset.tag}`, `Report date  ${reportDate}`);

    let y = 80;

    y = sectionHead(doc, y, "Operator & Engine");
    const colW = (COL_W - 24) / 2;
    let yL = y, yR = y;
    yL = kv(doc, PAGE.M, yL, "Operator", site?.name || asset.siteName, colW);
    yL = kv(doc, PAGE.M, yL, "Location", site ? `${site.region}  ·  ${site.code}` : "—", colW);

    yR = kv(doc, PAGE.M + colW + 24, yR, "Aircraft", asset.name, colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Engine",   `${asset.tag}  ·  ${asset.oem}`, colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Class & criticality", `${asset.classLabel}  ·  Class ${asset.criticality}`, colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Run hours (TSMOH)", `${(asset.runHours || 0).toLocaleString()} hr`, colW);
    yR = kv(doc, PAGE.M + colW + 24, yR, "Oil in service", asset.oil ? `${asset.oil.brand}  ·  ${asset.oil.name}  (${asset.oil.iso})` : "—", colW);
    y = Math.max(yL, yR) + 12;

    // Vitals
    y = sectionHead(doc, y, "Vitals");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...INK);
    doc.text(String(asset.health), PAGE.M, y + 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK_3);
    doc.text("HEALTH SCORE", PAGE.M, y);
    const [cr, cg, cb] = condColor(asset.code);
    doc.setFillColor(cr, cg, cb);
    doc.rect(PAGE.M + 110, y + 6, 90, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(cond.label.toUpperCase(), PAGE.M + 155, y + 20, { align: "center" });
    doc.setTextColor(...INK_3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("CONDITION", PAGE.M + 110, y);
    doc.setTextColor(...INK);
    doc.setFontSize(11);
    doc.text(`${asset.rulDays} hr to inspection threshold`, PAGE.M + 220, y + 22);
    doc.setTextColor(...INK_3);
    doc.setFontSize(8);
    doc.text("INSPECTION THRESHOLD", PAGE.M + 220, y);
    y += 40;

    // Sample history (most recent 12)
    y = sectionHead(doc, y, "Recent Samples");
    const list = (samples || []).slice(0, 12);
    if (list.length === 0) {
      y = paragraph(doc, PAGE.M, y, "No samples on file for this engine.", COL_W);
    } else {
      // Compact table: ID, Date, Score, Cond, Flags, Status
      const cols = [
        { key: "id",     label: "Sample",   w: 90 },
        { key: "date",   label: "Drawn",    w: 90 },
        { key: "score",  label: "Score",    w: 50, align: "right" },
        { key: "cond",   label: "Cond",     w: 60 },
        { key: "flags",  label: "Flags",    w: 130 },
        { key: "status", label: "Status",   w: 95 },
      ];
      const ROW_H = 18;
      // Header row
      doc.setFillColor(...SUNKEN);
      doc.rect(PAGE.M, y, COL_W, ROW_H, "F");
      doc.setTextColor(...INK_3);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      let x = PAGE.M + 8;
      for (const c of cols) {
        const tx = c.align === "right" ? x + c.w - 12 : x;
        doc.text(c.label.toUpperCase(), tx, y + 12, { align: c.align === "right" ? "right" : "left" });
        x += c.w;
      }
      y += ROW_H;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (y + ROW_H > PAGE.H - 80) { footer(doc, asset.tag); doc.addPage(); y = 80; }
        if (i % 2 === 1) {
          doc.setFillColor(250, 249, 246);
          doc.rect(PAGE.M, y, COL_W, ROW_H, "F");
        }
        let xx = PAGE.M + 8;
        const cellText = (key) => {
          switch (key) {
            case "id":     return s.id;
            case "date":   return dateOnly(s.receivedAt);
            case "score":  return String(s.score);
            case "cond":   return (window.COND[s.code]?.label || "").toUpperCase();
            case "flags":  return (s.flags || []).join(" ") || "—";
            case "status": return s.status;
          }
        };
        for (const c of cols) {
          const txt = cellText(c.key);
          doc.setTextColor(...INK);
          if (c.key === "id") doc.setTextColor(...INK_2);
          if (c.key === "cond") {
            const [rr, gg, bb] = condColor(s.code);
            doc.setTextColor(rr, gg, bb);
            doc.setFont("helvetica", "bold");
          }
          const tx = c.align === "right" ? xx + c.w - 12 : xx;
          doc.text(String(txt), tx, y + 12, { align: c.align === "right" ? "right" : "left" });
          if (c.key === "cond") doc.setFont("helvetica", "normal");
          xx += c.w;
        }
        y += ROW_H;
      }
      doc.setDrawColor(...LINE);
      doc.line(PAGE.M, y, RIGHT, y);
      y += 16;
    }

    // Diagnostic from the latest sample (if any)
    const latest = list.find(s => s.results) || list[0];
    if (latest) {
      const latestResults = window.resolveResults(latest.results || [], asset.class);
      const diag = autoDiagnostic(latest, asset, latestResults);
      if (y + 100 > PAGE.H - 60) { footer(doc, asset.tag); doc.addPage(); y = 80; }
      y = sectionHead(doc, y, `Latest Diagnostic (sample ${latest.id})`);
      y = paragraph(doc, PAGE.M, y, diag.summary, COL_W);
    }

    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      footer(doc, asset.tag);
    }
    return doc;
  }

  // ---- Diagnostic generator -----------------------------------------

  function autoDiagnostic(sample, asset, results) {
    if (!results || results.length === 0) {
      return {
        summary: "Sample has no instrument readings yet. A diagnostic will be produced once Spectroil / FluidScan / MiniVisc readings are attached.",
        recommendations: [],
      };
    }
    const get = code => results.find(r => r.code === code);
    const flagged = results.filter(r => r.status === "alarm" || r.status === "warn");
    const cls = asset?.class || "";
    const isLyco = cls.startsWith("lyco");

    const fe = get("Fe"), cr = get("Cr"), al = get("Al"), cu = get("Cu");
    const h2o = get("H2O"), fuel = get("Fuel"), visc = get("Visc100"), si = get("Si");

    const lines = [];
    if (fe && cr && (fe.status !== "ok" || cr.status !== "ok") && isLyco) {
      lines.push(`Iron (${fmt(fe.value)} ppm) and chromium (${fmt(cr.value)} ppm) are running together — the classic Lycoming cam/lifter wear signature, often tied to low recent utilization.`);
    } else if (fe && fe.status !== "ok") {
      lines.push(`Iron at ${fmt(fe.value)} ppm is ${fe.status === "alarm" ? "above the alarm threshold" : "elevated above the warn band"}.`);
    }
    if (al && al.status !== "ok") lines.push(`Aluminum at ${fmt(al.value)} ppm suggests piston scuff or oil-pump body wear.`);
    if (cu && cu.status !== "ok") lines.push(`Copper at ${fmt(cu.value)} ppm can indicate oil-cooler corrosion or bronze bushing wear.`);
    if (si && si.status !== "ok") lines.push(`Silicon at ${fmt(si.value)} ppm is consistent with airborne dirt ingestion or an induction leak.`);
    if (h2o && h2o.status !== "ok") lines.push(`Water at ${fmt(h2o.value)} ppm is high — short-flight condensation is the usual cause.`);
    if (fuel && fuel.status !== "ok") lines.push(`Fuel dilution at ${fmt(fuel.value)}% suggests rich operation; mag check and ignition timing recommended.`);
    if (visc && visc.status !== "ok") lines.push(`Viscosity at 100 °C is ${fmt(visc.value)} cSt, off the SAE 50 target — usually fuel dilution or oxidation.`);

    if (lines.length === 0) {
      return {
        summary: "All measured parameters are within normal limits for this engine class. No action required beyond the usual oil-change cadence.",
        recommendations: [],
      };
    }

    const recommendations = [];
    if ((fe?.status !== "ok") || (cr?.status !== "ok") || (al?.status !== "ok")) {
      recommendations.push("Cut the oil filter at the next oil change and inspect for ferrous and non-ferrous metallic debris.");
      if (isLyco) recommendations.push("Borescope the cam and lifters at next opportunity.");
      recommendations.push("Resample at 10 hours rather than the usual interval so the trend can be tracked.");
    }
    if (h2o?.status !== "ok") recommendations.push("Run the engine to oil-temp on the next 2-3 flights to drive off condensation before resampling.");
    if (fuel?.status !== "ok") recommendations.push("Perform a mag check and verify mixture leaning practice.");
    if (si?.status !== "ok") recommendations.push("Inspect induction tract, air filter, and intake gaskets for ingress paths.");

    const head = flagged.length === 1
      ? `One parameter is outside its limit: ${flagged.map(r => r.code).join(", ")}.`
      : `${flagged.length} parameters are outside their limits: ${flagged.map(r => r.code).join(", ")}.`;

    return {
      summary: head + " " + lines.join(" "),
      recommendations,
    };
  }

  // ---- Public entry points ------------------------------------------

  window.exportSamplePDF = function (sample) {
    if (!sample) return;
    const asset = window.ASSETS.find(a => a.id === sample.assetId);
    const site  = window.SITES.find(s => s.id === asset?.site);
    const results = sample.results
      ? window.resolveResults(sample.results, asset?.class)
      : window.makeTestResults(sample);
    const doc = buildSampleReport(sample, asset, site, results);
    doc.save(`${sample.id}.pdf`);
  };

  window.exportAssetPDF = function (asset) {
    if (!asset) return;
    const site = window.SITES.find(s => s.id === asset.site);
    const samples = window.SAMPLES.filter(s => s.assetId === asset.id);
    const doc = buildAssetReport(asset, site, samples);
    doc.save(`${asset.id}-${asset.tag}.pdf`);
  };
})();
