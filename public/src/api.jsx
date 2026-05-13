// Thin fetch wrapper that owns talking to /api. All mutations route
// through here so swapping the transport later is one file.
const api = {
  async bootstrap() {
    const r = await fetch("/api/bootstrap");
    if (!r.ok) throw new Error("bootstrap failed: " + r.status);
    return r.json();
  },

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
window.api = api;
