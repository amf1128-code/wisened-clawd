import React, { useState, useEffect } from "react";
import { getLogs } from "../api";

const LOG_TYPES = [
  { value: "", label: "All" },
  { value: "cloud_api_call", label: "Cloud API" },
  { value: "action_created", label: "Created" },
  { value: "action_resolved", label: "Resolved" },
  { value: "memory_update", label: "Memory" },
  { value: "error", label: "Errors" },
];

function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [filter]);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await getLogs(200, 0, filter || null);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Logs</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {LOG_TYPES.map((t) => (
          <button
            key={t.value}
            className={`btn ${filter === t.value ? "btn-approve" : "btn-secondary"}`}
            onClick={() => setFilter(t.value)}
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#128221;</div>
          <p>No logs yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {logs.map((log) => {
            let details;
            try { details = JSON.parse(log.details); } catch { details = log.details; }
            const detailStr = typeof details === "object" ? JSON.stringify(details) : details;

            return (
              <div key={log.id} className="log-entry">
                <span className="log-time">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
                <span className="log-type">{log.event_type}</span>
                <span>{detailStr.length > 120 ? detailStr.slice(0, 120) + "..." : detailStr}</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default LogsPage;
