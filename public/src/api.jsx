// Thin fetch wrapper that owns talking to /api. All mutations route
// through here so swapping the transport later is one file.
const api = {
  async bootstrap() {
    const r = await fetch("/api/bootstrap");
    if (!r.ok) throw new Error("bootstrap failed: " + r.status);
    return r.json();
  },

  // --- Samples -----------------------------------------------------
  async createSample(sample) {
    const r = await fetch("/api/samples", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sample),
    });
    if (!r.ok) throw new Error("createSample failed: " + r.status);
    return r.json();
  },
  async setSampleStatus(id, status) {
    await fetch(`/api/samples/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },
  async attachFilterPatch(id, dataUrl) {
    await fetch(`/api/samples/${encodeURIComponent(id)}/filter-patch`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
  },

  // --- Hierarchy CRUD ----------------------------------------------
  async createSite(payload) {
    const r = await fetch("/api/sites", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  },
  async createLocation(siteId, name) {
    const r = await fetch(`/api/sites/${encodeURIComponent(siteId)}/locations`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return r.json();
  },
  async deleteLocation(id) {
    await fetch(`/api/locations/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async createAssetType(siteId, locationId, name) {
    const r = await fetch(`/api/sites/${encodeURIComponent(siteId)}/asset-types`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, locationId }),
    });
    return r.json();
  },
  async deleteAssetType(id) {
    await fetch(`/api/asset-types/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async createAssetClass(payload) {
    const r = await fetch("/api/asset-classes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("createAssetClass failed: " + r.status);
    return r.json();
  },
  // --- Oils CRUD ----------------------------------------------------
  async createOil(payload) {
    const r = await fetch("/api/oils", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ("createOil failed: " + r.status));
    }
    return r.json();
  },
  async deleteOil(id) {
    const r = await fetch(`/api/oils/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ("deleteOil failed: " + r.status));
    }
  },

  // --- Custom parameters CRUD --------------------------------------
  async createParam(payload) {
    const r = await fetch("/api/params-custom", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ("createParam failed: " + r.status));
    }
    return r.json();
  },
  async deleteParam(code) {
    const r = await fetch(`/api/params-custom/${encodeURIComponent(code)}`, { method: "DELETE" });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ("deleteParam failed: " + r.status));
    }
  },

  // --- AI Library --------------------------------------------------
  async aiLibrary({ assetId, section, q, limit } = {}) {
    const qs = new URLSearchParams();
    if (assetId) qs.set("assetId", assetId);
    if (section) qs.set("section", section);
    if (q) qs.set("q", q);
    if (limit) qs.set("limit", String(limit));
    const r = await fetch("/api/ai/library?" + qs.toString());
    if (!r.ok) throw new Error("aiLibrary failed: " + r.status);
    return r.json();
  },

  async deleteAssetClass(id) {
    const r = await fetch(`/api/asset-classes/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || ("deleteAssetClass failed: " + r.status));
    }
  },
  async createEngine(payload) {
    const r = await fetch("/api/engines", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  },

  // --- Instrument-file parsing -------------------------------------
  async parseIrVision(csv)   { return parsePost("/api/parse/ir-vision", csv); },
  async parseFlashPoint(csv) { return parsePost("/api/parse/flash-point", csv); },
  async parseAdditives(csv)  { return parsePost("/api/parse/additives", csv); },

  // --- Branding ----------------------------------------------------
  async getBranding() {
    const r = await fetch("/api/branding");
    return r.json();
  },
  async saveBranding(branding) {
    const r = await fetch("/api/branding", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify(branding),
    });
    return r.json();
  },

  // --- Alarms ------------------------------------------------------
  async ackAlarm(id, acknowledged = true) {
    await fetch(`/api/alarms/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acknowledged }),
    });
  },
  async ackAllAlarms() {
    await fetch("/api/alarms/ack-all", { method: "POST" });
  },

  // --- Limits ------------------------------------------------------
  async setLimit(scope, paramCode, patch) {
    await fetch(`/api/limits/${encodeURIComponent(scope)}/${encodeURIComponent(paramCode)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  },
  async resetLimits(scope) {
    await fetch(`/api/limits/${encodeURIComponent(scope)}`, { method: "DELETE" });
  },

  // --- Rules -------------------------------------------------------
  async saveRule(rule) {
    const r = await fetch(rule.id ? `/api/rules/${encodeURIComponent(rule.id)}` : "/api/rules", {
      method: rule.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rule),
    });
    return r.json();
  },
  async deleteRule(id) {
    await fetch(`/api/rules/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async nextRuleId() {
    const r = await fetch("/api/rules/next-id");
    return (await r.json()).id;
  },
};

async function parsePost(url, csv) {
  const r = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`${url} failed: ${r.status} ${msg}`);
  }
  return r.json();
}

window.api = api;
