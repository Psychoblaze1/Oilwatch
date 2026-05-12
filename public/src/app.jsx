// ============================================================
// Root app — routing, role state, AI panel, tweaks
// ============================================================

const THEME_KEY = "oilwatch.theme";

function App() {
  // Seed dark from localStorage so it survives reload, falling back to design default.
  const initialDark = (() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "dark" || v === "light") return v === "dark";
    } catch (_) {}
    return !!window.__TWEAK_DEFAULTS__.dark;
  })();
  const [tweaks, setTweak] = useTweaks({ ...window.__TWEAK_DEFAULTS__, dark: initialDark });
  const [route, setRouteState] = React.useState("dashboard");
  const [siteFilter, setSiteFilter] = React.useState("all");
  const [role, setRole] = React.useState("ANALYST");
  const [aiOpen, setAIOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(null);   // { id, kind: "asset"|"sample" }

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.dark ? "dark" : "light");
    try { localStorage.setItem(THEME_KEY, tweaks.dark ? "dark" : "light"); } catch (_) {}
  }, [tweaks.dark]);

  React.useEffect(() => {
    const accent = tweaks.accent || "#c2410c";
    document.documentElement.style.setProperty("--accent", accent);
    const soft = hexToRgba(accent, 0.10);
    const line = hexToRgba(accent, 0.28);
    document.documentElement.style.setProperty("--accent-soft", soft);
    document.documentElement.style.setProperty("--accent-line", line);
  }, [tweaks.accent]);

  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setAIOpen(o => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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

  return (
    <React.Fragment>
      <ShellStyles />
      <div className={`app ${aiOpen ? "with-ai" : ""}`}>
        <Sidebar route={route === "sample" || route === "asset" ? (focused?.kind === "sample" ? "samples" : "assets") : route}
                 setRoute={setRoute} role={role} setRole={setRole} openAI={() => setAIOpen(true)} />
        <main className="main">
          <Topbar site={siteFilter} setSite={setSiteFilter} route={route} openAI={() => setAIOpen(true)}
                  dark={tweaks.dark} onToggleTheme={toggleTheme} />
          {route === "dashboard" && <ScreenDashboard siteFilter={siteFilter} setRoute={setRoute} focus={focus} openAI={() => setAIOpen(true)} />}
          {route === "samples"   && <ScreenSamples   siteFilter={siteFilter} focus={focus} />}
          {route === "lifecycle" && <ScreenLifecycle siteFilter={siteFilter} focus={focus} role={role} />}
          {route === "assets"    && <ScreenAssets    siteFilter={siteFilter} focus={focus} />}
          {route === "alarms"    && <ScreenAlarms    siteFilter={siteFilter} focus={focus} />}
          {route === "ai"        && <ScreenAI        focus={focus} openAI={() => setAIOpen(true)} />}
          {route === "limits"    && <ScreenLimits    role={role} />}
          {route === "rules"     && <ScreenRules     role={role} />}
          {route === "ref"       && <ScreenRef />}
          {route === "sample"    && <ScreenSample    sampleId={focused?.id} back={back} openAI={() => setAIOpen(true)} role={role}/>}
          {route === "asset"     && <ScreenAsset     assetId={focused?.id}  back={back} focus={focus} openAI={() => setAIOpen(true)} />}
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

// PDF export — captures the current screen (or a specific element) with
// html2canvas, then renders a paginated jsPDF document.
async function exportPDF(filename, target) {
  const el = target || document.querySelector(".main .page") || document.body;
  if (!window.html2canvas || !window.jspdf) {
    alert("PDF libraries failed to load. Check your network connection.");
    return;
  }
  // Force light theme for export so PDFs print well, then restore.
  const wasDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (wasDark) document.documentElement.setAttribute("data-theme", "light");
  try {
    const canvas = await window.html2canvas(el, {
      backgroundColor: "#ffffff",
      scale: window.devicePixelRatio > 1 ? 2 : 1.5,
      useCORS: true,
      logging: false,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW - 36;
    const imgH = (canvas.height * imgW) / canvas.width;
    const img = canvas.toDataURL("image/png");

    let position = 18;
    let heightLeft = imgH;
    pdf.addImage(img, "PNG", 18, position, imgW, imgH);
    heightLeft -= (pageH - 36);
    while (heightLeft > 0) {
      pdf.addPage();
      position = 18 - (imgH - heightLeft);
      pdf.addImage(img, "PNG", 18, position, imgW, imgH);
      heightLeft -= (pageH - 36);
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
