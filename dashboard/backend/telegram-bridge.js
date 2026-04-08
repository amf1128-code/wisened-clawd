// ═══════════════════════════════════════════════════════════════
// Telegram Notification Bridge
//
// Sends approval queue notifications to your Telegram bot and
// handles approve/reject/edit replies directly from Telegram.
//
// This runs as part of the dashboard server (imported by server.js
// when TELEGRAM_BOT_TOKEN is set) or standalone.
// ═══════════════════════════════════════════════════════════════

const db = require("./db");

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3000";

// Polling interval for Telegram updates (in ms)
const POLL_INTERVAL = 3000;

// Track last processed update to avoid duplicates
let lastUpdateId = 0;

// Track which chat IDs are authorized (set after first /start or pairing)
const authorizedChats = new Set();

// ── Telegram API helpers ───────────────────────────────────────

async function telegramAPI(method, body = {}) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram API error (${method}):`, data.description);
  }
  return data;
}

async function sendMessage(chatId, text, options = {}) {
  return telegramAPI("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...options,
  });
}

// ── Notification formatting ────────────────────────────────────

const TYPE_ICONS = {
  email: "\u{1F4E7}",
  calendar: "\u{1F4C5}",
  text: "\u{1F4AC}",
  reminder: "\u23F0",
  config_change: "\u2699\uFE0F",
};

function formatActionNotification(action) {
  const icon = TYPE_ICONS[action.type] || "\u{1F4CB}";
  const priority = action.priority === "urgent" ? " \u{1F534} URGENT" :
                   action.priority === "high" ? " \u{1F7E0} HIGH" : "";

  let details;
  try { details = JSON.parse(action.details); } catch { details = action.details; }

  let preview = "";
  if (typeof details === "object") {
    // Show key fields from the details
    if (details.to) preview += `\nTo: ${details.to}`;
    if (details.subject) preview += `\nSubject: ${details.subject}`;
    if (details.body) preview += `\n\n${details.body.slice(0, 300)}${details.body.length > 300 ? "..." : ""}`;
    if (details.title) preview += `\nEvent: ${details.title}`;
    if (details.start) preview += `\nWhen: ${details.start}`;
  } else if (typeof details === "string") {
    preview = `\n${details.slice(0, 300)}`;
  }

  return `${icon} *[${action.type}]* ${action.summary}${priority}` +
    `${action.wing ? `\nWing: ${action.wing}` : ""}` +
    `${preview}` +
    `\n\n_Reply: approve / reject / edit / snooze_` +
    `\n_Or open:_ ${DASHBOARD_URL}/queue/${action.id}` +
    `\n\`ID: ${action.id.slice(0, 8)}\``;
}

// ── Queue monitoring ───────────────────────────────────────────

// Track which actions we've already notified about
const notifiedActions = new Set();

async function checkForNewActions() {
  if (authorizedChats.size === 0) return;

  const pending = db.getPendingActions();
  for (const action of pending) {
    if (notifiedActions.has(action.id)) continue;
    notifiedActions.add(action.id);

    const message = formatActionNotification(action);
    for (const chatId of authorizedChats) {
      await sendMessage(chatId, message);
    }
  }
}

// ── Incoming message handling ──────────────────────────────────

// Track "pending reply" context per chat
const replyContext = new Map(); // chatId -> { actionId, mode }

async function handleMessage(chatId, text) {
  const lower = text.trim().toLowerCase();

  // /start command — authorize this chat
  if (lower === "/start") {
    authorizedChats.add(chatId);
    await sendMessage(chatId, "Assistant dashboard linked. You'll receive approval notifications here.\n\nCommands:\n/pending — show pending actions\n/history — recent actions\n/status — system status");
    return;
  }

  // /pending — show current queue
  if (lower === "/pending") {
    const pending = db.getPendingActions();
    if (pending.length === 0) {
      await sendMessage(chatId, "No pending actions. All clear! \u2705");
      return;
    }
    let msg = `*${pending.length} pending action(s):*\n\n`;
    for (const a of pending.slice(0, 5)) {
      const icon = TYPE_ICONS[a.type] || "\u{1F4CB}";
      msg += `${icon} \`${a.id.slice(0, 8)}\` ${a.summary}\n`;
    }
    if (pending.length > 5) msg += `\n_...and ${pending.length - 5} more_`;
    await sendMessage(chatId, msg);
    return;
  }

  // /status — system health
  if (lower === "/status") {
    const pending = db.countPending();
    await sendMessage(chatId, `*System Status*\nPending actions: ${pending}\nDashboard: ${DASHBOARD_URL}`);
    return;
  }

  // /history — recent resolved
  if (lower === "/history") {
    const history = db.getHistory(5, 0);
    if (history.length === 0) {
      await sendMessage(chatId, "No action history yet.");
      return;
    }
    let msg = "*Recent actions:*\n\n";
    for (const a of history) {
      const icon = TYPE_ICONS[a.type] || "\u{1F4CB}";
      msg += `${icon} ${a.summary} — _${a.status}_\n`;
    }
    await sendMessage(chatId, msg);
    return;
  }

  // Check if this is a reply to an action
  const ctx = replyContext.get(chatId);

  // Handle direct approve/reject for the most recent pending action
  if (["approve", "yes", "y"].includes(lower)) {
    const target = ctx?.actionId || getMostRecentPending();
    if (!target) {
      await sendMessage(chatId, "No pending action to approve.");
      return;
    }
    const action = db.getAction(target);
    if (!action || action.status !== "pending") {
      await sendMessage(chatId, "That action is no longer pending.");
      replyContext.delete(chatId);
      return;
    }
    db.approveAction(target);
    await sendMessage(chatId, `\u2705 Approved: ${action.summary}`);
    replyContext.delete(chatId);
    return;
  }

  if (["reject", "no", "n"].includes(lower)) {
    const target = ctx?.actionId || getMostRecentPending();
    if (!target) {
      await sendMessage(chatId, "No pending action to reject.");
      return;
    }
    const action = db.getAction(target);
    if (!action || action.status !== "pending") {
      await sendMessage(chatId, "That action is no longer pending.");
      replyContext.delete(chatId);
      return;
    }
    db.rejectAction(target);
    await sendMessage(chatId, `\u274C Rejected: ${action.summary}`);
    replyContext.delete(chatId);
    return;
  }

  if (["snooze", "later"].includes(lower)) {
    const target = ctx?.actionId || getMostRecentPending();
    if (!target) {
      await sendMessage(chatId, "No pending action to snooze.");
      return;
    }
    const action = db.getAction(target);
    if (!action || action.status !== "pending") {
      await sendMessage(chatId, "That action is no longer pending.");
      replyContext.delete(chatId);
      return;
    }
    db.snoozeAction(target);
    await sendMessage(chatId, `\u23F8 Snoozed: ${action.summary}`);
    replyContext.delete(chatId);
    return;
  }

  if (lower === "edit") {
    const target = ctx?.actionId || getMostRecentPending();
    if (!target) {
      await sendMessage(chatId, "No pending action to edit.");
      return;
    }
    replyContext.set(chatId, { actionId: target, mode: "editing" });
    await sendMessage(chatId, "What would you like to change? Send your edit instructions.");
    return;
  }

  // If we're in edit mode, treat this as edit instructions
  if (ctx?.mode === "editing") {
    const action = db.getAction(ctx.actionId);
    if (!action || action.status !== "pending") {
      await sendMessage(chatId, "That action is no longer pending.");
      replyContext.delete(chatId);
      return;
    }
    // Store the edit instruction as the edited details
    db.editAction(ctx.actionId, { editInstruction: text, originalDetails: action.details });
    await sendMessage(chatId, `\u270F\uFE0F Edited & approved: ${action.summary}\nYour changes: ${text}`);
    replyContext.delete(chatId);
    return;
  }

  // Unrecognized command
  await sendMessage(chatId,
    "Commands: /pending, /history, /status\n" +
    "Quick actions: approve, reject, edit, snooze"
  );
}

function getMostRecentPending() {
  const pending = db.getPendingActions();
  return pending.length > 0 ? pending[0].id : null;
}

// ── Telegram polling loop ──────────────────────────────────────

async function pollTelegram() {
  if (!BOT_TOKEN) return;

  try {
    const data = await telegramAPI("getUpdates", {
      offset: lastUpdateId + 1,
      timeout: 10,
      allowed_updates: ["message"],
    });

    if (data?.result) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        if (update.message?.text) {
          const chatId = update.message.chat.id;
          authorizedChats.add(chatId); // Auto-authorize anyone who messages the bot
          await handleMessage(chatId, update.message.text);
        }
      }
    }
  } catch (err) {
    console.error("Telegram poll error:", err.message);
  }
}

// ── Start the bridge ───────────────────────────────────────────

function start() {
  if (!BOT_TOKEN) {
    console.log("Telegram bridge: No TELEGRAM_BOT_TOKEN set, skipping.");
    return;
  }

  console.log("Telegram bridge: Starting...");

  // Poll for new Telegram messages
  setInterval(pollTelegram, POLL_INTERVAL);

  // Check for new approval queue items every 5 seconds
  setInterval(checkForNewActions, 5000);

  // Initial poll
  pollTelegram();
  checkForNewActions();

  console.log("Telegram bridge: Running.");
}

module.exports = { start, sendMessage, authorizedChats };
