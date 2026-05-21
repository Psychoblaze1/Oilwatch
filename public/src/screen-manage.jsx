// ============================================================
// Manage — Sites / Locations / Asset Types / Equipment
//
// Mirrors the customer-managed hierarchy from Lab88
// (Site → Location → AssetType → Equipment / Serial #). Each card
// is an inline add-form. Equipment registration creates a row in the
// engines table so it shows up in Log Sample's cascading dropdowns.
// ============================================================

function ScreenManage({ role, refresh }) {
  const canEdit = role === "MANAGER" || role === "ADMIN";
  const [siteId, setSiteId] = React.useState(window.SITES[0]?.id || "");
  const [, force] = React.useReducer(x => x + 1, 0);
  const [branding, setBranding] = React.useState(() => window.BRANDING || { labName: "Lab88", accentColor: "#c2410c", logo: null, tagline: "" });
  React.useEffect(() => { if (!siteId && window.SITES[0]) setSiteId(window.SITES[0].id); }, [window.SITES.length]);
  const site = window.SITES.find(s => s.id === siteId);

  const refreshAll = async () => { await window.bootstrap(); refresh && refresh(); force(); };

  // --- Branding handlers
  const saveBranding = async (patch) => {
    if (!canEdit) return;
    const next = { ...branding, ...patch };
    setBranding(next);
    window.BRANDING = next;
    await window.api.saveBranding(next);
  };
  const onLogoFile = async (file) => {
    if (!file) return;
    const url = await dataUrlFromImage(file, 600, 0.85);
    saveBranding({ logo: url });
  };

  // --- Add Site form
  const [newSite, setNewSite] = React.useState({ name: "", code: "", region: "" });
  const onAddSite = async () => {
    if (!canEdit || !newSite.name.trim()) return;
    await window.api.createSite(newSite);
    setNewSite({ name: "", code: "", region: "" });
    await refreshAll();
  };

  // --- Add Location form
  const [newLoc, setNewLoc] = React.useState("");
  const onAddLoc = async () => {
    if (!canEdit || !newLoc.trim() || !siteId) return;
    await window.api.createLocation(siteId, newLoc.trim());
    setNewLoc("");
    await refreshAll();
  };

  // --- Add Asset Type form
  const [newAt, setNewAt] = React.useState({ name: "", locationId: "" });
  const onAddAt = async () => {
    if (!canEdit || !newAt.name.trim() || !siteId) return;
    await window.api.createAssetType(siteId, newAt.locationId || null, newAt.name.trim());
    setNewAt({ name: "", locationId: "" });
    await refreshAll();
  };

  // --- Register Equipment form (asset class + section + tail#)
  const [newEng, setNewEng] = React.useState({
    name: "", tag: "", locationId: "", assetTypeId: "", classId: "",
    section: "oil", oem: "", oilName: "", aircraftReg: "",
  });
  const onAddEngine = async () => {
    if (!canEdit || !siteId || !newEng.name.trim()) return;
    await window.api.createEngine({
      siteId,
      locationId: newEng.locationId || null,
      assetTypeId: newEng.assetTypeId || null,
      classId: newEng.classId || null,
      section: newEng.section,
      name: newEng.name.trim(),
      tag: newEng.tag.trim(),
      oem: newEng.oem.trim() || null,
      oilName: newEng.oilName.trim() || null,
      aircraftReg: newEng.aircraftReg.trim() || null,
      health: 95, code: 1, runHours: 0, criticality: "C", rulDays: 120,
    });
    setNewEng({ name: "", tag: "", locationId: "", assetTypeId: "", classId: "", section: newEng.section, oem: "", oilName: "", aircraftReg: "" });
    await refreshAll();
  };

  // --- Add Oil form
  const [newOil, setNewOil] = React.useState({ brand: "", name: "", iso: "", category: "industrial" });
  const onAddOil = async () => {
    if (!canEdit || !newOil.brand.trim() || !newOil.name.trim()) return;
    try {
      await window.api.createOil({ brand: newOil.brand.trim(), name: newOil.name.trim(), iso: newOil.iso.trim() || null, category: newOil.category });
      setNewOil({ brand: "", name: "", iso: "", category: newOil.category });
      await refreshAll();
    } catch (e) { alert(e.message); }
  };
  const onDeleteOil = async (oil) => {
    if (!canEdit || oil.isBuiltin) return;
    if (!confirm(`Delete oil "${oil.brand} ${oil.name}"?`)) return;
    try { await window.api.deleteOil(oil.id); await refreshAll(); } catch (e) { alert(e.message); }
  };

  // --- Add Parameter form
  const [newParam, setNewParam] = React.useState({
    code: "", name: "", unit: "", method: "", section: "oil",
    dir: "info", warn: "", alarm: "", target: "", min: "", max: "",
  });
  const num = (v) => { if (v === "") return null; const n = Number(v); return isFinite(n) ? n : null; };
  const onAddParam = async () => {
    if (!canEdit || !newParam.code.trim() || !newParam.name.trim()) return;
    try {
      await window.api.createParam({
        code: newParam.code.trim(),
        name: newParam.name.trim(),
        unit: newParam.unit.trim(),
        method: newParam.method.trim(),
        section: newParam.section,
        dir: newParam.dir,
        warn:   num(newParam.warn),
        alarm:  num(newParam.alarm),
        target: num(newParam.target),
        min:    num(newParam.min),
        max:    num(newParam.max),
      });
      setNewParam({ ...newParam, code: "", name: "", unit: "", method: "", warn: "", alarm: "", target: "", min: "", max: "" });
      await refreshAll();
    } catch (e) { alert(e.message); }
  };
  const onDeleteParam = async (code) => {
    if (!canEdit) return;
    if (!confirm(`Delete custom parameter "${code}"?`)) return;
    try { await window.api.deleteParam(code); await refreshAll(); } catch (e) { alert(e.message); }
  };

  // --- Add Asset Class form
  const [newClass, setNewClass] = React.useState({ label: "", section: "oil" });
  const onAddClass = async () => {
    if (!canEdit || !newClass.label.trim()) return;
    await window.api.createAssetClass({ label: newClass.label.trim(), section: newClass.section });
    setNewClass({ label: "", section: newClass.section });
    await refreshAll();
  };
  const onDeleteClass = async (cls) => {
    if (!canEdit || cls.isBuiltin) return;
    if (!confirm(`Delete asset class "${cls.label}"? Engines tagged with it keep the label but lose the link.`)) return;
    try { await window.api.deleteAssetClass(cls.id); await refreshAll(); }
    catch (e) { alert(e.message); }
  };

  const locations = siteId ? window.getLocationsForSite(siteId) : [];
  const assetTypes = siteId ? window.getAssetTypesForSite(siteId) : [];
  const engines = siteId ? window.ASSETS.filter(e => e.site === siteId) : [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manage</h1>
          <div className="page-sub">Customer-managed hierarchy: Site → Location → Asset Type → Equipment. Drives the Log Sample cascading dropdowns.</div>
        </div>
        <div className="page-actions">
          {!canEdit && <Tag>READ-ONLY · MANAGER required</Tag>}
        </div>
      </div>

      {/* Lab branding — drives the PDF report header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Lab Branding</span>
          <span className="card-sub mono">APPLIES TO EVERY PRINTED REPORT</span>
        </div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1.4fr", gap: 16, alignItems: "center" }}>
          {/* Logo preview / upload */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", minWidth: 140 }}>
            <div style={{ width: 110, height: 110, border: "1px dashed var(--line)", borderRadius: 8, display: "grid", placeItems: "center", background: "var(--bg-sunken)", overflow: "hidden" }}>
              {branding.logo
                ? <img src={branding.logo} alt="Lab logo" style={{ maxWidth: "100%", maxHeight: "100%" }}/>
                : <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", padding: 6 }}>No logo</span>}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6 }}>
                <label className="btn btn-sm btn-ghost" style={{ cursor: "pointer" }}>
                  <Icon name="plus" size={11}/> Upload
                  <input type="file" accept="image/*" style={{ display: "none" }}
                         onChange={e => onLogoFile(e.target.files?.[0])}/>
                </label>
                {branding.logo && <button className="btn btn-sm btn-ghost" onClick={() => saveBranding({ logo: null })}>Remove</button>}
              </div>
            )}
          </div>

          <div>
            <div className="mng-label">Lab name</div>
            <input className="mng-input" value={branding.labName || ""} disabled={!canEdit}
                   onChange={e => setBranding(b => ({ ...b, labName: e.target.value }))}
                   onBlur={e => saveBranding({ labName: e.target.value })}
                   placeholder="Atomic Oil Lab"/>
          </div>

          <div>
            <div className="mng-label">Report accent color</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="color" disabled={!canEdit}
                     style={{ width: 40, height: 32, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "transparent" }}
                     value={branding.accentColor || "#c2410c"}
                     onChange={e => saveBranding({ accentColor: e.target.value })}/>
              <input className="mng-input mono" style={{ maxWidth: 110 }} disabled={!canEdit}
                     value={branding.accentColor || ""}
                     onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                     onBlur={e => /^#[0-9a-f]{6}$/i.test(e.target.value) && saveBranding({ accentColor: e.target.value })}/>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4 }}>HEADER BAND + PASS/FAIL PILL + STATUS BARS</div>
          </div>

          <div>
            <div className="mng-label">Footer / disclaimer tagline</div>
            <input className="mng-input" disabled={!canEdit}
                   value={branding.tagline || ""}
                   onChange={e => setBranding(b => ({ ...b, tagline: e.target.value }))}
                   onBlur={e => saveBranding({ tagline: e.target.value })}
                   placeholder="Lab88 VU - advisory report; not a substitute for proper engine maintenance."/>
          </div>
        </div>
      </div>

      {/* Site picker + add Site */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Sites</span>
          <span className="card-sub mono">{window.SITES.length} REGISTERED</span>
        </div>
        <div className="card-body" style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="mng-label">Active site</div>
            <select className="mng-input" value={siteId} onChange={e => setSiteId(e.target.value)}>
              {window.SITES.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.code ? `· ${s.code}` : ""}</option>
              ))}
            </select>
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div>
                <div className="mng-label">New site name</div>
                <input className="mng-input" placeholder="Logger Mines"
                       value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })}/>
              </div>
              <div>
                <div className="mng-label">Code</div>
                <input className="mng-input" style={{ width: 80 }} placeholder="LM"
                       value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value })}/>
              </div>
              <div>
                <div className="mng-label">Region</div>
                <input className="mng-input" placeholder="Mpumalanga, ZA"
                       value={newSite.region} onChange={e => setNewSite({ ...newSite, region: e.target.value })}/>
              </div>
              <button className="btn btn-primary" onClick={onAddSite} disabled={!newSite.name.trim()}>
                <Icon name="plus" size={12}/> Add site
              </button>
            </div>
          )}
        </div>
      </div>

      {!siteId
        ? <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--ink-3)" }}>Add a site to begin.</div></div>
        : (
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {/* Locations */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Locations · {site?.name}</span>
              <span className="card-sub mono">{locations.length}</span>
            </div>
            <div className="card-body no-pad">
              {locations.length === 0 ? (
                <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>No locations yet.</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Name</th><th>ID</th><th></th></tr></thead>
                  <tbody>
                    {locations.map(l => (
                      <tr key={l.id}>
                        <td>{l.name}</td>
                        <td className="mono t-muted">{l.id}</td>
                        <td style={{ textAlign: "right" }}>
                          {canEdit && <button className="btn btn-sm btn-ghost" onClick={async () => {
                            if (!confirm(`Delete location "${l.name}"?`)) return;
                            try { await window.api.deleteLocation(l.id); await refreshAll(); }
                            catch (e) { alert(e.message); }
                          }}><Icon name="trash" size={12}/></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {canEdit && (
              <div className="card-body" style={{ display: "flex", gap: 8 }}>
                <input className="mng-input" placeholder="Open Pit 1"
                       value={newLoc} onChange={e => setNewLoc(e.target.value)}
                       onKeyDown={e => e.key === "Enter" && onAddLoc()} />
                <button className="btn btn-primary" onClick={onAddLoc} disabled={!newLoc.trim()}><Icon name="plus" size={12}/> Add</button>
              </div>
            )}
          </div>

          {/* Asset Types */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Asset Types · {site?.name}</span>
              <span className="card-sub mono">{assetTypes.length}</span>
            </div>
            <div className="card-body no-pad">
              {assetTypes.length === 0 ? (
                <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>No asset types yet.</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Name</th><th>Location</th><th></th></tr></thead>
                  <tbody>
                    {assetTypes.map(at => {
                      const loc = window.LOCATIONS.find(l => l.id === at.locationId);
                      return (
                        <tr key={at.id}>
                          <td>{at.name}</td>
                          <td className="t-muted">{loc?.name || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            {canEdit && <button className="btn btn-sm btn-ghost" onClick={async () => {
                              if (!confirm(`Delete asset type "${at.name}"?`)) return;
                              try { await window.api.deleteAssetType(at.id); await refreshAll(); }
                              catch (e) { alert(e.message); }
                            }}><Icon name="trash" size={12}/></button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {canEdit && (
              <div className="card-body" style={{ display: "flex", gap: 8 }}>
                <input className="mng-input" placeholder="Diesel Generator"
                       value={newAt.name} onChange={e => setNewAt({ ...newAt, name: e.target.value })} />
                <select className="mng-input" style={{ maxWidth: 200 }} value={newAt.locationId} onChange={e => setNewAt({ ...newAt, locationId: e.target.value })}>
                  <option value="">— Any location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button className="btn btn-primary" onClick={onAddAt} disabled={!newAt.name.trim()}><Icon name="plus" size={12}/> Add</button>
              </div>
            )}
          </div>
        </div>
        )}

      {/* Asset Classes — global (not per site). Each belongs to a section. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Asset Classes</span>
          <span className="card-sub mono">{window.ASSET_CLASSES.length} TOTAL · BUILT-IN + CUSTOM · OIL / DIESEL SECTIONS</span>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr><th>Label</th><th>Section</th><th>Type</th><th>ID</th><th></th></tr></thead>
            <tbody>
              {window.ASSET_CLASSES.map(c => (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td><Tag tone={c.section === "diesel" ? "accent" : "neutral"}>{c.section === "diesel" ? "Diesel" : "Oil"}</Tag></td>
                  <td className="t-muted">{c.isBuiltin ? "Built-in" : "Custom"}</td>
                  <td className="mono t-id">{c.id}</td>
                  <td style={{ textAlign: "right" }}>
                    {canEdit && !c.isBuiltin && (
                      <button className="btn btn-sm btn-ghost" onClick={() => onDeleteClass(c)}>
                        <Icon name="trash" size={12}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="card-body" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div className="mng-label">New class label</div>
              <input className="mng-input" placeholder="Caterpillar 3508 / John Deere 6068"
                     value={newClass.label} onChange={e => setNewClass({ ...newClass, label: e.target.value })}
                     onKeyDown={e => e.key === "Enter" && onAddClass()} />
            </div>
            <div>
              <div className="mng-label">Section</div>
              <select className="mng-input" style={{ width: 140 }}
                      value={newClass.section} onChange={e => setNewClass({ ...newClass, section: e.target.value })}>
                <option value="oil">Oil</option>
                <option value="diesel">Diesel</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={onAddClass} disabled={!newClass.label.trim()}>
              <Icon name="plus" size={12}/> Add class
            </button>
          </div>
        )}
      </div>

      {/* Oils / lubricants catalogue */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Oils & Lubricants</span>
          <span className="card-sub mono">{window.OILS.length} TOTAL · AVIATION + INDUSTRIAL + MARINE + HYDRAULIC + GEARBOX</span>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr><th>Brand</th><th>Name</th><th>Grade</th><th>Category</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {window.OILS.map(o => (
                <tr key={o.id}>
                  <td>{o.brand}</td>
                  <td>{o.name}</td>
                  <td className="mono t-muted">{o.iso || "—"}</td>
                  <td className="t-muted">{o.category || "—"}</td>
                  <td className="t-muted">{o.isBuiltin ? "Built-in" : "Custom"}</td>
                  <td style={{ textAlign: "right" }}>
                    {canEdit && !o.isBuiltin && (
                      <button className="btn btn-sm btn-ghost" onClick={() => onDeleteOil(o)}>
                        <Icon name="trash" size={12}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 0.8fr 1fr auto", gap: 8, alignItems: "end" }}>
            <div><div className="mng-label">Brand</div><input className="mng-input" placeholder="Castrol" value={newOil.brand} onChange={e => setNewOil({ ...newOil, brand: e.target.value })} /></div>
            <div><div className="mng-label">Name</div><input className="mng-input" placeholder="GTX 20W-50" value={newOil.name} onChange={e => setNewOil({ ...newOil, name: e.target.value })} /></div>
            <div><div className="mng-label">Grade</div><input className="mng-input" placeholder="SAE 20W-50" value={newOil.iso} onChange={e => setNewOil({ ...newOil, iso: e.target.value })} /></div>
            <div>
              <div className="mng-label">Category</div>
              <select className="mng-input" value={newOil.category} onChange={e => setNewOil({ ...newOil, category: e.target.value })}>
                <option value="industrial">Industrial</option>
                <option value="aviation">Aviation</option>
                <option value="marine">Marine</option>
                <option value="hydraulic">Hydraulic</option>
                <option value="gearbox">Gearbox</option>
                <option value="fuel">Fuel</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={onAddOil} disabled={!newOil.brand.trim() || !newOil.name.trim()}>
              <Icon name="plus" size={12}/> Add oil
            </button>
          </div>
        )}
      </div>

      {/* Custom parameters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Custom Test Parameters</span>
          <span className="card-sub mono">{window.PARAMS_CUSTOM.length} CUSTOM · MERGES WITH BUILT-IN CATALOGUE</span>
        </div>
        <div className="card-body no-pad">
          {window.PARAMS_CUSTOM.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>
              No custom parameters yet. Add one below — it appears in Limits and Log Sample's manual-readings step automatically.
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Unit</th><th>Method</th><th>Section</th><th>Dir</th><th>Limits</th><th></th></tr></thead>
              <tbody>
                {window.PARAMS_CUSTOM.map(p => (
                  <tr key={p.code}>
                    <td className="mono t-id">{p.code}</td>
                    <td>{p.name}</td>
                    <td className="mono t-muted">{p.unit || "—"}</td>
                    <td className="t-muted">{p.method || "—"}</td>
                    <td><Tag tone={p.section === "diesel" ? "accent" : "neutral"}>{p.section === "diesel" ? "Diesel" : "Oil"}</Tag></td>
                    <td className="mono t-muted">{p.dir}</td>
                    <td className="mono t-muted">
                      {p.dir === "min"   && (p.minV != null ? `min ${p.minV}` : "—")}
                      {p.dir === "max"   && (p.maxV != null ? `max ${p.maxV}` : "—")}
                      {p.dir === "range" && (`${p.minV ?? "?"}–${p.maxV ?? "?"}`)}
                      {(p.dir === "warn" || p.dir === "info") && (p.warn != null || p.alarm != null
                        ? `warn ${p.warn ?? "—"} · alarm ${p.alarm ?? "—"}`
                        : "—")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canEdit && <button className="btn btn-sm btn-ghost" onClick={() => onDeleteParam(p.code)}><Icon name="trash" size={12}/></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {canEdit && (
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "0.7fr 1.3fr 0.6fr 1fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr auto", gap: 6, alignItems: "end" }}>
            <div><div className="mng-label">Code</div><input className="mng-input mono" placeholder="TBN" value={newParam.code} onChange={e => setNewParam({ ...newParam, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} /></div>
            <div><div className="mng-label">Name</div><input className="mng-input" placeholder="Total Base Number" value={newParam.name} onChange={e => setNewParam({ ...newParam, name: e.target.value })} /></div>
            <div><div className="mng-label">Unit</div><input className="mng-input" placeholder="mgKOH/g" value={newParam.unit} onChange={e => setNewParam({ ...newParam, unit: e.target.value })} /></div>
            <div><div className="mng-label">Method</div><input className="mng-input" placeholder="ASTM D2896" value={newParam.method} onChange={e => setNewParam({ ...newParam, method: e.target.value })} /></div>
            <div>
              <div className="mng-label">Section</div>
              <select className="mng-input" value={newParam.section} onChange={e => setNewParam({ ...newParam, section: e.target.value })}>
                <option value="oil">Oil</option>
                <option value="diesel">Diesel</option>
              </select>
            </div>
            <div>
              <div className="mng-label">Dir</div>
              <select className="mng-input" value={newParam.dir} onChange={e => setNewParam({ ...newParam, dir: e.target.value })}>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="min">min</option>
                <option value="max">max</option>
                <option value="range">range</option>
              </select>
            </div>
            <div><div className="mng-label">Warn</div><input className="mng-input mono" type="number" step="any" value={newParam.warn} onChange={e => setNewParam({ ...newParam, warn: e.target.value })} /></div>
            <div><div className="mng-label">Alarm</div><input className="mng-input mono" type="number" step="any" value={newParam.alarm} onChange={e => setNewParam({ ...newParam, alarm: e.target.value })} /></div>
            <div><div className="mng-label">Min</div><input className="mng-input mono" type="number" step="any" value={newParam.min} onChange={e => setNewParam({ ...newParam, min: e.target.value })} /></div>
            <div><div className="mng-label">Max</div><input className="mng-input mono" type="number" step="any" value={newParam.max} onChange={e => setNewParam({ ...newParam, max: e.target.value })} /></div>
            <button className="btn btn-primary" onClick={onAddParam} disabled={!newParam.code.trim() || !newParam.name.trim()}><Icon name="plus" size={12}/> Add</button>
          </div>
        )}
      </div>

      {siteId && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Equipment · {site?.name}</span>
            <span className="card-sub mono">{engines.length} REGISTERED</span>
          </div>
          <div className="card-body no-pad">
            {engines.length === 0 ? (
              <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>No equipment registered for this site yet.</div>
            ) : (
              <table className="table">
                <thead><tr>
                  <th>Name</th><th>Tag / Serial</th><th>Location</th><th>Asset Type</th><th>OEM</th><th>Oil</th><th>Run hrs</th><th>Crit</th><th></th>
                </tr></thead>
                <tbody>
                  {engines.map(e => (
                    <EngineRow key={e.id} engine={e} canEdit={canEdit} refreshAll={refreshAll} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {canEdit && (
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div><div className="mng-label">Name</div><input className="mng-input" placeholder="Generator G-101" value={newEng.name} onChange={e => setNewEng({ ...newEng, name: e.target.value })}/></div>
              <div><div className="mng-label">Serial #</div><input className="mng-input" placeholder="QSK60-G4-0123" value={newEng.tag} onChange={e => setNewEng({ ...newEng, tag: e.target.value })}/></div>
              <div>
                <div className="mng-label">Location</div>
                <select className="mng-input" value={newEng.locationId} onChange={e => setNewEng({ ...newEng, locationId: e.target.value })}>
                  <option value="">—</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <div className="mng-label">Asset Type</div>
                <select className="mng-input" value={newEng.assetTypeId} onChange={e => setNewEng({ ...newEng, assetTypeId: e.target.value })}>
                  <option value="">—</option>
                  {assetTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                </select>
              </div>
              <div>
                <div className="mng-label">Asset Class</div>
                <select className="mng-input" value={newEng.classId} onChange={e => {
                  const id = e.target.value;
                  const cls = window.ASSET_CLASSES.find(c => c.id === id);
                  setNewEng({ ...newEng, classId: id, section: cls ? cls.section : newEng.section });
                }}>
                  <option value="">— Custom —</option>
                  {window.ASSET_CLASSES.map(c => (
                    <option key={c.id} value={c.id}>{c.label} ({c.section === "diesel" ? "Diesel" : "Oil"})</option>
                  ))}
                </select>
              </div>
              <div><div className="mng-label">OEM</div><input className="mng-input" placeholder="Cummins" value={newEng.oem} onChange={e => setNewEng({ ...newEng, oem: e.target.value })}/></div>
              <div><div className="mng-label">Oil / fuel</div><input className="mng-input" placeholder="Sulphur LG CF1" value={newEng.oilName} onChange={e => setNewEng({ ...newEng, oilName: e.target.value })}/></div>
              <button className="btn btn-primary" onClick={onAddEngine} disabled={!newEng.name.trim()}><Icon name="plus" size={12}/> Register</button>

              {/* Aviation-only tail / registration number — shown only when an aviation class is chosen.
                  Feeds the AI panel's FAA AD lookup directive. */}
              {isAviationClass(newEng.classId) && (
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "end" }}>
                  <div style={{ flex: "0 0 220px" }}>
                    <div className="mng-label">Aircraft registration / tail #</div>
                    <input className="mng-input mono" placeholder="N12345 / ZS-ABC"
                           value={newEng.aircraftReg} onChange={e => setNewEng({ ...newEng, aircraftReg: e.target.value.toUpperCase() })}/>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    Used by the AI panel to search FAA Airworthiness Directives for this airframe.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .mng-label { font-size: 10px; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; font-family: var(--mono); margin-bottom: 4px; }
        .mng-input { padding: 7px 10px; border-radius: 7px; background: var(--bg-sunken); border: 1px solid transparent; color: var(--ink); font-size: 13px; width: 100%; }
        .mng-input:focus { outline: 0; border-color: var(--accent-line); background: var(--bg-elev); }
      `}</style>
    </div>
  );
}

// Client-side resize used for the lab-logo upload so we don't ship
// a 4 MB PNG inside every bootstrap response.
function dataUrlFromImage(file, maxW = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("invalid image"));
      img.onload = () => {
        const ratio = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        // Use PNG so logos with transparent backgrounds keep them.
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Aviation engine classes — drives the conditional tail-number input
// and downstream AI FAA-AD lookups.
const AVIATION_CLASS_IDS = new Set(["lyco4","lyco6","conto4","conto6","rotax","radial"]);
function isAviationClass(id) { return id && AVIATION_CLASS_IDS.has(id); }

// Inline edit/delete row for the Equipment table. Keeps the read-only
// row compact and reveals an editable strip when the user clicks Edit.
function EngineRow({ engine, canEdit, refreshAll }) {
  const [editing, setEditing] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const samplingPoints = engine.samplingPoints || [];
  const [draft, setDraft] = React.useState({
    name: engine.name || "", tag: engine.tag || "", oem: engine.oem || "",
    oilName: engine.oil?.name || "", runHours: engine.runHours ?? 0,
    criticality: engine.criticality || "C", aircraftReg: engine.aircraftReg || "",
  });
  React.useEffect(() => {
    setDraft({
      name: engine.name || "", tag: engine.tag || "", oem: engine.oem || "",
      oilName: engine.oil?.name || "", runHours: engine.runHours ?? 0,
      criticality: engine.criticality || "C", aircraftReg: engine.aircraftReg || "",
    });
  }, [engine.id]);
  const save = async () => {
    try {
      await window.api.updateEngine(engine.id, {
        name: draft.name.trim(),
        tag: draft.tag.trim(),
        oem: draft.oem.trim() || null,
        oilName: draft.oilName.trim() || null,
        runHours: Number(draft.runHours) || 0,
        criticality: draft.criticality,
        aircraftReg: draft.aircraftReg.trim() || null,
      });
      setEditing(false);
      await refreshAll();
    } catch (e) { alert("Save failed: " + e.message); }
  };
  const del = async () => {
    if (!confirm(`Delete "${engine.name}"? This removes its samples and alarms too.`)) return;
    try { await window.api.deleteEngine(engine.id); await refreshAll(); }
    catch (e) { alert("Delete failed: " + e.message); }
  };
  if (!editing) {
    return (
      <>
        <tr>
          <td>
            <button className="btn btn-sm btn-ghost" onClick={() => setExpanded(v => !v)} aria-label="Toggle sampling points" style={{ marginRight: 4 }}>
              <Icon name={expanded ? "chevron-dn" : "chevron-r"} size={11}/>
            </button>
            {engine.name}
            {samplingPoints.length > 0 && <span className="mono" style={{ marginLeft: 6, fontSize: 10.5, color: "var(--ink-3)" }}>{samplingPoints.length} pt{samplingPoints.length === 1 ? "" : "s"}</span>}
          </td>
          <td className="mono t-id">{engine.tag || "—"}</td>
          <td className="t-muted">{engine.locationName || "—"}</td>
          <td className="t-muted">{engine.assetTypeName || engine.classLabel || "—"}</td>
          <td className="t-muted">{engine.oem || "—"}</td>
          <td className="t-muted">{engine.oil?.name || "—"}</td>
          <td className="mono t-muted">{(engine.runHours || 0).toLocaleString()}</td>
          <td><Tag tone="accent">{engine.criticality || "C"}</Tag></td>
          <td style={{ textAlign: "right" }}>
            {canEdit && (
              <>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)} aria-label="Edit equipment"><Icon name="settings" size={12}/></button>
                <button className="btn btn-sm btn-ghost" onClick={del} aria-label="Delete equipment"><Icon name="trash" size={12}/></button>
              </>
            )}
          </td>
        </tr>
        {expanded && (
          <tr>
            <td colSpan={9} style={{ background: "var(--bg-sunken)", padding: "8px 14px" }}>
              <SamplingPointEditor engine={engine} canEdit={canEdit} refreshAll={refreshAll} />
            </td>
          </tr>
        )}
      </>
    );
  }
  return (
    <tr>
      <td><input className="mng-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></td>
      <td><input className="mng-input mono" value={draft.tag} onChange={e => setDraft({ ...draft, tag: e.target.value })}/></td>
      <td className="t-muted">{engine.locationName || "—"}</td>
      <td className="t-muted">{engine.assetTypeName || engine.classLabel || "—"}</td>
      <td><input className="mng-input" value={draft.oem} onChange={e => setDraft({ ...draft, oem: e.target.value })}/></td>
      <td><input className="mng-input" value={draft.oilName} onChange={e => setDraft({ ...draft, oilName: e.target.value })}/></td>
      <td><input className="mng-input mono" type="number" value={draft.runHours} onChange={e => setDraft({ ...draft, runHours: e.target.value })}/></td>
      <td>
        <select className="mng-input" value={draft.criticality} onChange={e => setDraft({ ...draft, criticality: e.target.value })}>
          <option value="A">A</option><option value="B">B</option><option value="C">C</option>
        </select>
      </td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={!draft.name.trim()}><Icon name="check" size={12}/></button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
      </td>
    </tr>
  );
}

// Inline editor for an engine's sampling points (Before Filter, After
// Filter, Sump Drain, etc.). Rendered under the engine row when the
// caret is expanded. Operators register points here once and the Log
// Sample wizard offers them in a dropdown for every future sample.
function SamplingPointEditor({ engine, canEdit, refreshAll }) {
  const points = engine.samplingPoints || [];
  const [draft, setDraft] = React.useState({ name: "", kind: "" });
  const add = async () => {
    if (!draft.name.trim()) return;
    try { await window.api.createSamplingPoint(engine.id, { name: draft.name.trim(), kind: draft.kind.trim() || null }); }
    catch (e) { alert(e.message); return; }
    setDraft({ name: "", kind: "" });
    await refreshAll();
  };
  const del = async (sp) => {
    if (!confirm(`Delete sampling point "${sp.name}"? Samples already drawn from it keep the link as free text.`)) return;
    try { await window.api.deleteSamplingPoint(sp.id); await refreshAll(); }
    catch (e) { alert(e.message); }
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: 0.1, color: "var(--ink-3)" }}>
        SAMPLING POINTS · {points.length} REGISTERED
      </div>
      {points.length === 0
        ? <div className="muted" style={{ fontSize: 12 }}>No sampling points yet. Add one below — operators will see it in the Log Sample wizard.</div>
        : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {points.map(sp => (
              <span key={sp.id} className="mono" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "4px 10px", borderRadius: 999,
                background: "var(--bg-elev)", border: "1px solid var(--line)",
                fontSize: 11.5,
              }}>
                <span>{sp.name}</span>
                {sp.kind && <span style={{ color: "var(--ink-3)" }}>· {sp.kind}</span>}
                {canEdit && <button className="btn btn-sm btn-ghost" style={{ padding: "0 2px", marginLeft: 2 }} onClick={() => del(sp)} aria-label={`Delete ${sp.name}`}><Icon name="close" size={10}/></button>}
              </span>
            ))}
          </div>
        )}
      {canEdit && (
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          <div>
            <div className="mng-label">Point name</div>
            <input className="mng-input" placeholder="Before Filter / Sump Drain"
                   value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                   onKeyDown={e => e.key === "Enter" && add()} />
          </div>
          <div>
            <div className="mng-label">Kind (optional)</div>
            <select className="mng-input" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })}>
              <option value="">—</option>
              <option value="filter">Filter</option>
              <option value="sump">Sump</option>
              <option value="cooler">Cooler</option>
              <option value="bearing">Bearing</option>
              <option value="reservoir">Reservoir</option>
              <option value="drain">Drain</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!draft.name.trim()}>
            <Icon name="plus" size={12}/> Add point
          </button>
        </div>
      )}
    </div>
  );
}

window.ScreenManage = ScreenManage;
