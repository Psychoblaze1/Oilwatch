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
  const [branding, setBranding] = React.useState(() => window.BRANDING || { labName: "Oilwatch", accentColor: "#c2410c", logo: null, tagline: "" });
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

  // --- Register Equipment form
  const [newEng, setNewEng] = React.useState({ name: "", tag: "", locationId: "", assetTypeId: "", oem: "", oilName: "" });
  const onAddEngine = async () => {
    if (!canEdit || !siteId || !newEng.name.trim()) return;
    await window.api.createEngine({
      siteId,
      locationId: newEng.locationId || null,
      assetTypeId: newEng.assetTypeId || null,
      name: newEng.name.trim(),
      tag: newEng.tag.trim(),
      oem: newEng.oem.trim() || null,
      oilName: newEng.oilName.trim() || null,
      health: 95, code: 1, runHours: 0, criticality: "C", rulDays: 120,
    });
    setNewEng({ name: "", tag: "", locationId: "", assetTypeId: "", oem: "", oilName: "" });
    await refreshAll();
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
                          {canEdit && <button className="btn btn-sm btn-ghost" onClick={async () => { if (confirm(`Delete location "${l.name}"?`)) { await window.api.deleteLocation(l.id); await refreshAll(); } }}><Icon name="trash" size={12}/></button>}
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
                            {canEdit && <button className="btn btn-sm btn-ghost" onClick={async () => { if (confirm(`Delete asset type "${at.name}"?`)) { await window.api.deleteAssetType(at.id); await refreshAll(); } }}><Icon name="trash" size={12}/></button>}
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
                  <th>Name</th><th>Tag / Serial</th><th>Location</th><th>Asset Type</th><th>OEM</th><th>Oil</th>
                </tr></thead>
                <tbody>
                  {engines.map(e => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td className="mono t-id">{e.tag || "—"}</td>
                      <td className="t-muted">{e.locationName || "—"}</td>
                      <td className="t-muted">{e.assetTypeName || e.classLabel || "—"}</td>
                      <td className="t-muted">{e.oem || "—"}</td>
                      <td className="t-muted">{e.oil?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {canEdit && (
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
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
              <div><div className="mng-label">OEM</div><input className="mng-input" placeholder="Cummins" value={newEng.oem} onChange={e => setNewEng({ ...newEng, oem: e.target.value })}/></div>
              <div><div className="mng-label">Oil / fuel</div><input className="mng-input" placeholder="Sulphur LG CF1" value={newEng.oilName} onChange={e => setNewEng({ ...newEng, oilName: e.target.value })}/></div>
              <button className="btn btn-primary" onClick={onAddEngine} disabled={!newEng.name.trim()}><Icon name="plus" size={12}/> Register</button>
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

window.ScreenManage = ScreenManage;
