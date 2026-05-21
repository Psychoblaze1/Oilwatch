// Sink — adapters call deliver() instead of touching the queue
// directly. If the operator has an active Console session, the
// readings flow into that session for interactive review. Otherwise
// they hit the persistent upload queue exactly like before.

const queue   = require("./queue");
const session = require("./session");

function deliver({ payload, source }) {
  if (session.isActive() && Array.isArray(payload?.results) && payload.results.length) {
    session.ingest({
      readings: payload.results,
      source,
      files: {
        irVisionFile:   payload.irVisionFile,
        flashPointFile: payload.flashPointFile,
        additivesFile:  payload.additivesFile,
      },
    });
    return { routedTo: "session", id: session.get().id };
  }
  const item = queue.enqueue({ payload, source });
  return { routedTo: "queue", id: item.id };
}

module.exports = { deliver };
