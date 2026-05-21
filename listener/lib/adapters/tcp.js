// TCP adapter — opens a listening socket on { tcpHost, tcpPort } and
// accepts CRLF-terminated frames from instruments that push data to
// us. Each frame is parsed and enqueued the same way the file-drop
// adapter does.

const net = require("net");
const { detectAndParse } = require("../parsers");
const sink  = require("../sink");

function start(instrument, { onActivity }) {
  const host = instrument.tcpHost || "0.0.0.0";
  const port = Number(instrument.tcpPort || 0);
  if (!port) return { stop() {}, error: "tcpPort is required" };

  const server = net.createServer((socket) => {
    onActivity({ level: "info", instrumentId: instrument.id, text: `TCP client connected ${socket.remoteAddress}:${socket.remotePort}` });
    let buf = "";
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      // Frames are blank-line delimited (\r\n\r\n) — typical for
      // instrument export blobs that emit a multi-row CSV per sample.
      while ((i = buf.indexOf("\r\n\r\n")) >= 0 || (i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
        if (!frame.trim()) continue;
        try {
          const { kind, readings } = detectAndParse(instrument.name + ".csv", frame);
          if (!readings.length) {
            onActivity({ level: "warn", instrumentId: instrument.id, text: `TCP frame produced no readings (kind: ${kind})` });
            continue;
          }
          const routed = sink.deliver({
            payload: {
              assetId: instrument.assetId || null,
              component: "Auto (instrument upload)",
              receivedAt: new Date().toISOString(),
              status: "DRAFT", priority: "STD",
              analyst: `Listener · ${instrument.name}`,
              sampleType: instrument.sampleType || "diesel-cf1",
              results: readings,
              note: `Auto-imported from ${instrument.name} (tcp · ${kind})`,
            },
            source: instrument.id,
          });
          onActivity({ level: "info", instrumentId: instrument.id, text: `tcp frame → ${readings.length} readings · ${routed.routedTo === "session" ? "added to active session" : "queued"}` });
        } catch (e) {
          onActivity({ level: "error", instrumentId: instrument.id, text: e.message });
        }
      }
    });
    socket.on("error", (e) => onActivity({ level: "warn", instrumentId: instrument.id, text: "socket: " + e.message }));
  });
  server.on("error", (e) => onActivity({ level: "error", instrumentId: instrument.id, text: "TCP server: " + e.message }));
  server.listen(port, host, () => onActivity({ level: "info", instrumentId: instrument.id, text: `TCP listening on ${host}:${port}` }));

  return {
    stop() { try { server.close(); } catch (_) {} },
    info() { return { host, port }; },
  };
}

module.exports = { start };
