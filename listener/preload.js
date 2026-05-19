// Preload script — exposes a narrow surface to the renderer.
// Everything is request/response IPC except `onActivity` and
// `onSnapshot` which let the renderer subscribe to push events.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("listener", {
  snapshot: () => ipcRenderer.invoke("snapshot"),
  setServer: (cfg) => ipcRenderer.invoke("server:set", cfg),
  addInstrument: (spec) => ipcRenderer.invoke("instrument:add", spec),
  updateInstrument: (id, patch) => ipcRenderer.invoke("instrument:update", { id, patch }),
  removeInstrument: (id) => ipcRenderer.invoke("instrument:remove", id),
  startInstrument: (id) => ipcRenderer.invoke("instrument:start", id),
  stopInstrument:  (id) => ipcRenderer.invoke("instrument:stop", id),
  removeQueueItem: (id) => ipcRenderer.invoke("queue:remove", id),
  clearQueue:      () => ipcRenderer.invoke("queue:clear"),
  tickNow:         () => ipcRenderer.invoke("queue:tick"),
  onActivity: (fn) => ipcRenderer.on("activity", (_e, p) => fn(p)),
  onSnapshot: (fn) => ipcRenderer.on("snapshot", (_e, p) => fn(p)),
});
