import React, { useState, useEffect } from "react";
import { getHistory, searchActions } from "../api";

function HistoryPage() {
  const [actions, setActions] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await getHistory(100, 0);
      setActions(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    if (q.length < 2) {
      loadHistory();
      return;
    }
    try {
      const data = await searchActions(q);
      setActions(data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">History</h1>
      </div>

      <input
        type="text"
        className="search-bar"
        placeholder="Search actions..."
        value={query}
        onChange={handleSearch}
      />

      {loading ? (
        <div className="empty">Loading...</div>
      ) : actions.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#128196;</div>
          <p>No actions yet.</p>
        </div>
      ) : (
        actions.map((action) => {
          let details;
          try { details = JSON.parse(action.details); } catch { details = action.details; }

          return (
            <div key={action.id} className="card">
              <div className="card-header">
                <span className={`card-type ${action.type}`}>{action.type}</span>
                <span className={`badge ${action.status}`}>{action.status}</span>
              </div>
              <div className="card-summary">{action.summary}</div>
              <div className="card-meta">
                <span>{new Date(action.created_at).toLocaleString()}</span>
                {action.wing && <span>Wing: {action.wing}</span>}
                {action.resolved_at && <span>Resolved: {new Date(action.resolved_at).toLocaleString()}</span>}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

export default HistoryPage;
