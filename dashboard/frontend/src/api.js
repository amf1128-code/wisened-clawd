// ═══════════════════════════════════════════════════════════════
// API client for the dashboard backend
// ═══════════════════════════════════════════════════════════════

const BASE = "/api";

// PIN is stored in sessionStorage after login
function getHeaders() {
  const pin = sessionStorage.getItem("dashboard_pin");
  const headers = { "Content-Type": "application/json" };
  if (pin) headers["X-Dashboard-Pin"] = pin;
  return headers;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  if (res.status === 401) {
    sessionStorage.removeItem("dashboard_pin");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

// ── Actions ────────────────────────────────────────────────────

export function getPending() {
  return request("/actions/pending");
}

export function getHistory(limit = 50, offset = 0) {
  return request(`/actions/history?limit=${limit}&offset=${offset}`);
}

export function searchActions(query, limit = 50) {
  return request(`/actions/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function getAction(id) {
  return request(`/actions/${id}`);
}

export function approveAction(id) {
  return request(`/actions/${id}/approve`, { method: "POST" });
}

export function rejectAction(id) {
  return request(`/actions/${id}/reject`, { method: "POST" });
}

export function editAction(id, editedDetails) {
  return request(`/actions/${id}/edit`, {
    method: "POST",
    body: JSON.stringify({ editedDetails }),
  });
}

export function snoozeAction(id) {
  return request(`/actions/${id}/snooze`, { method: "POST" });
}

// ── Logs ───────────────────────────────────────────────────────

export function getLogs(limit = 100, offset = 0, type = null) {
  let url = `/logs?limit=${limit}&offset=${offset}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;
  return request(url);
}

// ── Stats ──────────────────────────────────────────────────────

export function getStats() {
  return request("/stats");
}

// ── Health ─────────────────────────────────────────────────────

export function getHealth() {
  return request("/health");
}

// ── Memory ─────────────────────────────────────────────────────

export function getSnapshot() {
  return request("/memory/snapshot");
}

// ── Auth helper ────────────────────────────────────────────────

export function setPin(pin) {
  sessionStorage.setItem("dashboard_pin", pin);
}

export function hasPin() {
  return !!sessionStorage.getItem("dashboard_pin");
}

export function clearPin() {
  sessionStorage.removeItem("dashboard_pin");
}
