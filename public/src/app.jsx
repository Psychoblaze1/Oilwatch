// ============================================================
// Root app — bootstrap loading, routing, role state, AI panel, tweaks
// ============================================================

const THEME_KEY = "oilwatch.theme";

function App() {
  const initialDark = (() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "dark" || v === "light") return v === "dark";
    } catch (_) {}
    return !!window.__TWEAK_DEFAULTS__.dark;
  })();
  const [tweaks, setTweak] = useTweaks({ ...window.__TWEAK_DEFAULTS__, dark: initialDark });
  const [ready, setReady]     = React.useState(false);
  const [bootErr, setBootErr] = React.useState(null);
  const [, force]             = React.useReducer(x => x + 1, 0);  // re-render after mutations
  const [route, setRouteState] = React.useState("dashboard");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [role, setRole]       = React.useState("ANALYST");
  const [aiOpen, setAIOpen]   = React.useState(false);
  const [focused, setFocused] = React.useState(null);

  // Bootstrap fleet data from /api/bootstrap on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await window.bootstrap(); if (!cancelled) setReady(true); }
      catch (e) { if (!cancelled) setBootErr(e.message || String(e)); }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.dark ? "dark" : "light");
    try { localStorage.setItem(THEME_KEY, tweaks.dark ? "dark" : "light"); } catch (_) {}
  }, [tweaks.dark]);
  React.useEffect(() => {
    const accent = tweaks.accent || "#c2410c";
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-soft", hexToRgba(accent, 0.10));
    document.documentElement.style.setProperty("--accent-line", hexToRgba(accent, 0.28));
  }, [tweaks.accent]);
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAIOpen(o => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Shared refresh callback handed to screens that need to redraw
  // after a mutation. Cheap — we already have the data in memory and
  // mutations also patch window arrays locally.
  const refresh = React.useCallback(() => force(), []);

  const setRoute = (r) => { setFocused(null); setRouteState(r); };
  const focus = (id, kind = "asset") => {
    setFocused({ id, kind });
    setRouteState(kind === "sample" ? "sample" : "asset");
  };
  const back = () => {
    if (focused?.kind === "sample") setRouteState("samples");
    else setRouteState("assets");
    setFocused(null);
  };
  const toggleTheme = () => setTweak("dark", !tweaks.dark);

  if (bootErr) {
    return (
      <div style={{ display:"grid", placeItems:"center", height:"100vh", fontFamily:"var(--mono)", color:"var(--crit)", padding: 24, textAlign:"center" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 0.2, textTransform:"uppercase", marginBottom: 8 }}>BOOTSTRAP FAILED</div>
          <div style={{ fontSize: 13, color:"var(--ink-2)" }}>{bootErr}</div>
          <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => location.reload()}>Retry</button>
        </div>
      </div>
    );
  }
  if (!ready) {
    return (
      <div style={{ display:"grid", placeItems:"center", height:"100vh", fontFamily:"var(--mono)", color:"var(--ink-3)", letterSpacing: 0.15 }}>
        LOADING FLEET…
      </div>
    );
  }

  return (
    <React.Fragment>
      <ShellStyles />
      <div className={`app ${aiOpen ? "with-ai" : ""}`}>
        <Sidebar route={route === "sample" || route === "asset" ? (focused?.kind === "sample" ? "samples" : "assets") : route}
                 setRoute={setRoute} role={role} setRole={setRole} openAI={() => setAIOpen(true)} />
        <main className="main">
          <Topbar site={siteFilter} setSite={setSiteFilter} route={route} openAI={() => setAIOpen(true)}
                  dark={tweaks.dark} onToggleTheme={toggleTheme} />
          {route === "dashboard"  && <ScreenDashboard  siteFilter={siteFilter} setRoute={setRoute} focus={focus} openAI={() => setAIOpen(true)} />}
          {route === "samples"    && <ScreenSamples    siteFilter={siteFilter} focus={focus} setRoute={setRoute} />}
          {route === "lifecycle"  && <ScreenLifecycle  siteFilter={siteFilter} focus={focus} role={role} refresh={refresh} />}
          {route === "assets"     && <ScreenAssets     siteFilter={siteFilter} focus={focus} />}
          {route === "alarms"     && <ScreenAlarms     siteFilter={siteFilter} focus={focus} />}
          {route === "ai"         && <ScreenAI         focus={focus} openAI={() => setAIOpen(true)} />}
          {route === "limits"     && <ScreenLimits     role={role} />}
          {route === "rules"      && <ScreenRules      role={role} />}
          {route === "log-sample" && <ScreenLogSample  refresh={refresh} setRoute={setRoute} focus={focus} />}
          {route === "ref"        && <ScreenRef />}
          {route === "sample"     && <ScreenSample     sampleId={focused?.id} back={back} openAI={() => setAIOpen(true)} role={role} refresh={refresh}/>}
          {route === "asset"      && <ScreenAsset      assetId={focused?.id}  back={back} focus={focus} openAI={() => setAIOpen(true)} setRoute={setRoute} />}
        </main>
        {aiOpen && <AIPanel onClose={() => setAIOpen(false)} focus={focus} context={{ route, role, focused, siteFilter }} />}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio label="Mode" value={tweaks.dark ? "dark" : "light"} options={[{value: "light", label: "Light"}, {value: "dark", label: "Dark"}]} onChange={v => setTweak("dark", v === "dark")} />
        </TweakSection>
        <TweakSection title="Accent">
          <TweakColor
            label="Color"
            value={tweaks.accent}
            options={["#c2410c", "#1a4d3a", "#1e3a8a", "#7c3aed", "#0f172a", "#b91c1c"]}
            onChange={v => setTweak("accent", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.length === 3 ? h[0]+h[0] : h.slice(0,2), 16);
  const g = parseInt(h.length === 3 ? h[1]+h[1] : h.slice(2,4), 16);
  const b = parseInt(h.length === 3 ? h[2]+h[2] : h.slice(4,6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ============================================================
// PDF export — section-aware. We capture each top-level block of the
// current page (the header, then every direct child like `.card` and
// the `.grid-3` row) as its own canvas, and pack them onto PDF pages
// without ever splitting a block across the page boundary. Blocks
// taller than a page fall back to a sliced render so they don't get
// lost. This fixes the original bug where Sample Meta / Equipment
// Context / Workflow cards were cut at the page break.
// ============================================================
async function exportPDF(filename, target) {
  const page = target || document.querySelector(".main .page");
  if (!page) return;
  if (!window.html2canvas || !window.jspdf) {
    alert("PDF libraries failed to load. Check your network connection.");
    return;
  }
  const wasDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (wasDark) document.documentElement.setAttribute("data-theme", "light");
  await new Promise(r => requestAnimationFrame(r));

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const PAGE_W = pdf.internal.pageSize.getWidth();
    const PAGE_H = pdf.internal.pageSize.getHeight();
    const M = 24;                          // page margin in pt
    const printableW = PAGE_W - M * 2;
    const printableH = PAGE_H - M * 2;

    // Build the block list: page header + every direct child.
    const blocks = Array.from(page.children).filter(el => el.offsetHeight > 0);

    let cursorY = M;
    let pageCount = 0;
    const newPage = () => {
      if (pageCount > 0) pdf.addPage();
      pageCount++;
      cursorY = M;
    };
    newPage();

    const scale = window.devicePixelRatio > 1 ? 2 : 1.5;

    for (const block of blocks) {
      const canvas = await window.html2canvas(block, {
        backgroundColor: "#ffffff",
        scale, useCORS: true, logging: false,
      });
      const drawW = printableW;
      const drawH = (canvas.height * drawW) / canvas.width;

      if (drawH > printableH) {
        // Block too tall for a single page — fall back to slicing this
        // single block across pages, but always start it on a fresh page.
        if (cursorY > M) newPage();
        const slicePxH = (printableH / drawW) * canvas.width;   // canvas px per page slice
        let yPx = 0;
        while (yPx < canvas.height) {
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(slicePxH, canvas.height - yPx);
          sliceCanvas.getContext("2d").drawImage(canvas, 0, -yPx);
          const img = sliceCanvas.toDataURL("image/png");
          const sliceDrawH = (sliceCanvas.height * drawW) / canvas.width;
          if (yPx > 0) newPage();
          pdf.addImage(img, "PNG", M, M, drawW, sliceDrawH);
          yPx += slicePxH;
        }
        cursorY = M + printableH;   // force a new page for the next block
        continue;
      }

      if (cursorY + drawH > M + printableH) newPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", M, cursorY, drawW, drawH);
      cursorY += drawH + 12;
    }
    pdf.save(filename || "oilwatch-report.pdf");
  } finally {
    if (wasDark) document.documentElement.setAttribute("data-theme", "dark");
  }
}
window.exportPDF = exportPDF;

// CSV export — array of plain objects → CSV file download.
function exportCSV(rows, filename) {
  if (!rows || !rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename || "oilwatch-export.csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
window.exportCSV = exportCSV;

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
