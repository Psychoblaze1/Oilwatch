// First-boot seed for Lab88.
//
// The fleet (sites / locations / asset types / equipment / samples /
// alarms) is intentionally NOT seeded — the operator registers their
// own customers and equipment via the Manage screen and logs the first
// sample through Log Sample. The single admin user is seeded by
// db.js so it's available immediately.
//
// What we DO seed here is the rule library so Lab88 ships with
// useful default rules out of the box (cam/lifter pattern, fuel
// dilution, water condensation, etc.). Operators can disable or
// delete any of them on the Rules screen.

const { db } = require("./db");

const RULE_SEED = [
  { id: "R-001", name: "Cam/lifter wear pattern (Lycoming)", enabled: 1, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6"] },
    conditions: [{ param: "Fe", op: ">", value: 35 }, { param: "Cr", op: ">", value: 5 }],
    action: "alarm", createdAt: "2026-04-12T14:00:00Z", lastTriggered: null },
  { id: "R-002", name: "Viscosity drop > 15% — fuel dilution suspected", enabled: 1, severity: "CRITICAL",
    scope: { classes: "all" }, conditions: [{ param: "Visc100", op: "abs%>", value: 15 }],
    action: "alarm", createdAt: "2026-03-30T10:00:00Z", lastTriggered: null },
  { id: "R-003", name: "Aluminum spike — piston scuff", enabled: 1, severity: "SEVERE",
    scope: { classes: "all" }, conditions: [{ param: "Al", op: ">", value: 15 }],
    action: "alarm", createdAt: "2026-02-18T09:00:00Z", lastTriggered: null },
  { id: "R-004", name: "Water > 500 ppm — short-flight condensation", enabled: 1, severity: "WARN",
    scope: { classes: "all" }, conditions: [{ param: "H2O", op: ">", value: 500 }],
    action: "notify", createdAt: "2026-02-05T12:00:00Z", lastTriggered: null },
  { id: "R-005", name: "Fuel dilution > 4% — mag check needed", enabled: 1, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6","conto4","conto6"] },
    conditions: [{ param: "Fuel", op: ">", value: 4 }],
    action: "alarm", createdAt: "2026-01-22T09:00:00Z", lastTriggered: null },
  { id: "R-006", name: "Copper Z-score anomaly (oil-cooler corrosion)", enabled: 0, severity: "WARN",
    scope: { classes: "all" }, conditions: [{ param: "Cu", op: "z>", value: 2.0 }],
    action: "flag", createdAt: "2026-01-09T08:00:00Z", lastTriggered: null },
];

function seed() {
  const insertRule = db.prepare(`
    INSERT INTO rules (id, name, enabled, severity, scope_json, conditions_json, action, created_at, last_triggered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    for (const r of RULE_SEED) {
      insertRule.run(r.id, r.name, r.enabled, r.severity,
        JSON.stringify(r.scope), JSON.stringify(r.conditions), r.action,
        r.createdAt, r.lastTriggered);
    }
  });
  tx();
}

module.exports = { seed };
