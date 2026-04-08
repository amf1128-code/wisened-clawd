import React, { useState, useEffect, useCallback } from "react";
import { getPending, approveAction, rejectAction, editAction, snoozeAction } from "../api";

function ActionCard({ action, onResolve }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(false);

  let details;
  try { details = JSON.parse(action.details); } catch { details = action.details; }

  async function handleAction(fn) {
    setLoading(true);
    try {
      await fn();
      onResolve();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setEditText(typeof details === "string" ? details : JSON.stringify(details, null, 2));
    setEditing(true);
    setExpanded(true);
  }

  async function submitEdit() {
    let parsed;
    try { parsed = JSON.parse(editText); } catch { parsed = editText; }
    await handleAction(() => editAction(action.id, parsed));
    setEditing(false);
  }

  return (
    <div className="card" onClick={() => !editing && setExpanded(!expanded)}>
      <div className="card-header">
        <span className={`card-type ${action.type}`}>{action.type}</span>
        <span className={`badge ${action.priority}`}>{action.priority}</span>
      </div>
      <div className="card-summary">{action.summary}</div>
      <div className="card-meta">
        <span>{new Date(action.created_at).toLocaleString()}</span>
        {action.wing && <span>Wing: {action.wing}</span>}
        {action.model_used && <span>Model: {action.model_used}</span>}
      </div>

      {expanded && (
        <>
          {editing ? (
            <textarea
              className="edit-area"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="card-details">
              {typeof details === "object" ? JSON.stringify(details, null, 2) : details}
            </div>
          )}

          <div className="btn-row" onClick={(e) => e.stopPropagation()}>
            {editing ? (
              <>
                <button className="btn btn-approve" disabled={loading} onClick={submitEdit}>
                  Save & Approve
                </button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-approve" disabled={loading}
                  onClick={() => handleAction(() => approveAction(action.id))}>
                  Approve
                </button>
                <button className="btn btn-edit" disabled={loading} onClick={startEdit}>
                  Edit
                </button>
                <button className="btn btn-snooze" disabled={loading}
                  onClick={() => handleAction(() => snoozeAction(action.id))}>
                  Snooze
                </button>
                <button className="btn btn-reject" disabled={loading}
                  onClick={() => handleAction(() => rejectAction(action.id))}>
                  Reject
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function QueuePage() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPending();
      setActions(data);
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 10 seconds for new actions
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Approval Queue</h1>
        {actions.length > 0 && <span className="pending-count">{actions.length}</span>}
      </div>

      {loading && actions.length === 0 ? (
        <div className="empty">Loading...</div>
      ) : actions.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">&#10003;</div>
          <p>No pending actions. All clear!</p>
        </div>
      ) : (
        actions.map((action) => (
          <ActionCard key={action.id} action={action} onResolve={load} />
        ))
      )}
    </>
  );
}

export default QueuePage;
