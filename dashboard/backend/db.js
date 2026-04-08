// ═══════════════════════════════════════════════════════════════
// Database layer for the approval queue
// Uses SQLite via better-sqlite3 — all data stays on your Mac.
// ═══════════════════════════════════════════════════════════════

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_DIR = path.join(
  process.env.ASSISTANT_DATA_DIR || path.join(require("os").homedir(), "assistant-data")
);
const DB_PATH = path.join(DB_DIR, "approvals.db");

// Ensure directory exists
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Performance: WAL mode for better concurrent reads
db.pragma("journal_mode = WAL");

// ── Schema ─────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    summary TEXT NOT NULL,
    details TEXT NOT NULL,
    edited_details TEXT,
    resolved_at TEXT,
    wing TEXT,
    model_used TEXT,
    cloud_data_sent TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,
    details TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
  CREATE INDEX IF NOT EXISTS idx_actions_type ON actions(type);
  CREATE INDEX IF NOT EXISTS idx_actions_created ON actions(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
`);

// ── Action queries ─────────────────────────────────────────────

const insertAction = db.prepare(`
  INSERT INTO actions (id, type, status, priority, summary, details, wing, model_used, cloud_data_sent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getAction = db.prepare("SELECT * FROM actions WHERE id = ?");

const getPendingActions = db.prepare(`
  SELECT * FROM actions WHERE status = 'pending'
  ORDER BY
    CASE priority
      WHEN 'urgent' THEN 0
      WHEN 'high' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
    END,
    created_at ASC
`);

const updateActionStatus = db.prepare(`
  UPDATE actions SET status = ?, resolved_at = datetime('now') WHERE id = ?
`);

const updateActionEdited = db.prepare(`
  UPDATE actions SET status = 'edited', edited_details = ?, resolved_at = datetime('now') WHERE id = ?
`);

const getActionHistory = db.prepare(`
  SELECT * FROM actions WHERE status != 'pending'
  ORDER BY resolved_at DESC
  LIMIT ? OFFSET ?
`);

const searchActions = db.prepare(`
  SELECT * FROM actions
  WHERE summary LIKE ? OR details LIKE ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const getActionsByWing = db.prepare(`
  SELECT * FROM actions WHERE wing = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const countPending = db.prepare(
  "SELECT COUNT(*) as count FROM actions WHERE status = 'pending'"
);

// ── Log queries ────────────────────────────────────────────────

const insertLog = db.prepare(`
  INSERT INTO logs (event_type, details) VALUES (?, ?)
`);

const getRecentLogs = db.prepare(`
  SELECT * FROM logs ORDER BY timestamp DESC LIMIT ? OFFSET ?
`);

const getLogsByType = db.prepare(`
  SELECT * FROM logs WHERE event_type = ?
  ORDER BY timestamp DESC LIMIT ?
`);

// ── Exported interface ─────────────────────────────────────────

module.exports = {
  db,

  createAction({ id, type, priority, summary, details, wing, modelUsed, cloudDataSent }) {
    insertAction.run(
      id, type, "pending", priority || "normal",
      summary, JSON.stringify(details),
      wing || null, modelUsed || null,
      cloudDataSent ? JSON.stringify(cloudDataSent) : null
    );
    insertLog.run("action_created", JSON.stringify({ actionId: id, type, summary }));
    return getAction.get(id);
  },

  getAction(id) {
    return getAction.get(id);
  },

  getPendingActions() {
    return getPendingActions.all();
  },

  approveAction(id) {
    updateActionStatus.run("approved", id);
    insertLog.run("action_resolved", JSON.stringify({ actionId: id, status: "approved" }));
    return getAction.get(id);
  },

  rejectAction(id) {
    updateActionStatus.run("rejected", id);
    insertLog.run("action_resolved", JSON.stringify({ actionId: id, status: "rejected" }));
    return getAction.get(id);
  },

  editAction(id, editedDetails) {
    updateActionEdited.run(JSON.stringify(editedDetails), id);
    insertLog.run("action_resolved", JSON.stringify({ actionId: id, status: "edited" }));
    return getAction.get(id);
  },

  snoozeAction(id) {
    updateActionStatus.run("snoozed", id);
    insertLog.run("action_resolved", JSON.stringify({ actionId: id, status: "snoozed" }));
    return getAction.get(id);
  },

  getHistory(limit = 50, offset = 0) {
    return getActionHistory.all(limit, offset);
  },

  searchActions(query, limit = 50) {
    const pattern = `%${query}%`;
    return searchActions.all(pattern, pattern, limit);
  },

  getActionsByWing(wing, limit = 50) {
    return getActionsByWing.all(wing, limit);
  },

  countPending() {
    return countPending.get().count;
  },

  addLog(eventType, details) {
    insertLog.run(eventType, JSON.stringify(details));
  },

  getRecentLogs(limit = 100, offset = 0) {
    return getRecentLogs.all(limit, offset);
  },

  getLogsByType(eventType, limit = 100) {
    return getLogsByType.all(eventType, limit);
  },
};
