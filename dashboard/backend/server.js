// ═══════════════════════════════════════════════════════════════
// Approval Dashboard — API Server
//
// Serves the approval dashboard on http://localhost:3000
// All data stays local in SQLite. Not exposed to the internet.
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// Serve the React frontend (built files)
app.use(express.static(path.join(__dirname, "..", "frontend", "build")));

// ── Simple auth middleware ──────────────────────────────────────
// PIN-based auth for local-only dashboard.
// Set DASHBOARD_PIN in your .env file (e.g., DASHBOARD_PIN=1234)
const DASHBOARD_PIN = process.env.DASHBOARD_PIN;

function requireAuth(req, res, next) {
  if (!DASHBOARD_PIN) return next(); // No PIN set = no auth required
  const pin = req.headers["x-dashboard-pin"] || req.query.pin;
  if (pin === DASHBOARD_PIN) return next();
  res.status(401).json({ error: "Invalid or missing PIN" });
}

// ── Health check ───────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", pending: db.countPending() });
});

// ── Actions (Approval Queue) ───────────────────────────────────

// GET /api/actions/pending — list pending actions
app.get("/api/actions/pending", requireAuth, (_req, res) => {
  res.json(db.getPendingActions());
});

// GET /api/actions/history — list resolved actions
app.get("/api/actions/history", requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  res.json(db.getHistory(limit, offset));
});

// GET /api/actions/search — search actions
app.get("/api/actions/search", requireAuth, (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: "Query parameter 'q' required" });
  res.json(db.searchActions(q, parseInt(limit) || 50));
});

// GET /api/actions/wing/:wing — actions by MemPalace wing
app.get("/api/actions/wing/:wing", requireAuth, (req, res) => {
  res.json(db.getActionsByWing(req.params.wing, parseInt(req.query.limit) || 50));
});

// GET /api/actions/:id — single action detail
app.get("/api/actions/:id", requireAuth, (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  res.json(action);
});

// POST /api/actions — create a new action (used by OpenClaw skills)
app.post("/api/actions", requireAuth, (req, res) => {
  const { type, priority, summary, details, wing, modelUsed, cloudDataSent } = req.body;
  if (!type || !summary || !details) {
    return res.status(400).json({ error: "type, summary, and details are required" });
  }
  const action = db.createAction({
    id: uuidv4(),
    type,
    priority,
    summary,
    details,
    wing,
    modelUsed,
    cloudDataSent,
  });
  res.status(201).json(action);
});

// POST /api/actions/:id/approve
app.post("/api/actions/:id/approve", requireAuth, (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (action.status !== "pending") {
    return res.status(400).json({ error: `Action is already ${action.status}` });
  }
  res.json(db.approveAction(req.params.id));
});

// POST /api/actions/:id/reject
app.post("/api/actions/:id/reject", requireAuth, (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (action.status !== "pending") {
    return res.status(400).json({ error: `Action is already ${action.status}` });
  }
  res.json(db.rejectAction(req.params.id));
});

// POST /api/actions/:id/edit
app.post("/api/actions/:id/edit", requireAuth, (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (action.status !== "pending") {
    return res.status(400).json({ error: `Action is already ${action.status}` });
  }
  const { editedDetails } = req.body;
  if (!editedDetails) {
    return res.status(400).json({ error: "editedDetails required" });
  }
  res.json(db.editAction(req.params.id, editedDetails));
});

// POST /api/actions/:id/snooze
app.post("/api/actions/:id/snooze", requireAuth, (req, res) => {
  const action = db.getAction(req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });
  if (action.status !== "pending") {
    return res.status(400).json({ error: `Action is already ${action.status}` });
  }
  res.json(db.snoozeAction(req.params.id));
});

// ── Logs ───────────────────────────────────────────────────────

// GET /api/logs — recent logs
app.get("/api/logs", requireAuth, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type;
  if (type) {
    res.json(db.getLogsByType(type, limit));
  } else {
    res.json(db.getRecentLogs(limit, offset));
  }
});

// POST /api/logs — add a log entry (used by OpenClaw skills)
app.post("/api/logs", requireAuth, (req, res) => {
  const { eventType, details } = req.body;
  if (!eventType || !details) {
    return res.status(400).json({ error: "eventType and details required" });
  }
  db.addLog(eventType, details);
  res.status(201).json({ status: "logged" });
});

// ── Memory Snapshot (Phase 1) ──────────────────────────────────

app.get("/api/memory/snapshot", requireAuth, (_req, res) => {
  const snapshotPath = path.join(
    process.env.ASSISTANT_DATA_DIR || path.join(require("os").homedir(), "assistant-data"),
    "snapshots",
    "latest.json"
  );
  try {
    const fs = require("fs");
    if (fs.existsSync(snapshotPath)) {
      res.sendFile(snapshotPath);
    } else {
      res.status(404).json({ error: "No snapshot available yet" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to read snapshot" });
  }
});

// ── Stats ──────────────────────────────────────────────────────

app.get("/api/stats", requireAuth, (_req, res) => {
  const pending = db.countPending();
  const recentActions = db.getHistory(5, 0);
  const recentLogs = db.getRecentLogs(5, 0);
  res.json({ pending, recentActions, recentLogs });
});

// ── Catch-all: serve React app for client-side routing ─────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "build", "index.html"));
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Dashboard running at http://127.0.0.1:${PORT}`);
  console.log(`Pending actions: ${db.countPending()}`);

  // Start Telegram notification bridge if token is available
  if (process.env.TELEGRAM_BOT_TOKEN) {
    const telegramBridge = require("./telegram-bridge");
    telegramBridge.start();
  }
});
