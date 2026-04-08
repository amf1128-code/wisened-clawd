import React, { useState, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import QueuePage from "./pages/Queue";
import HistoryPage from "./pages/History";
import LogsPage from "./pages/Logs";
import { getHealth, setPin, hasPin, clearPin } from "./api";

function App() {
  const [authed, setAuthed] = useState(false);
  const [needsPin, setNeedsPin] = useState(null); // null = loading
  const [pinInput, setPinInput] = useState("");

  useEffect(() => {
    // Check if the server requires a PIN
    getHealth()
      .then(() => {
        setNeedsPin(false);
        setAuthed(true);
      })
      .catch((err) => {
        if (err.message === "Unauthorized") {
          setNeedsPin(true);
          if (hasPin()) setAuthed(true); // try stored PIN
        }
      });
  }, []);

  function handlePinSubmit(e) {
    e.preventDefault();
    setPin(pinInput);
    getHealth()
      .then(() => setAuthed(true))
      .catch(() => {
        clearPin();
        setPinInput("");
        alert("Incorrect PIN");
      });
  }

  if (needsPin === null) {
    return <div className="app"><div className="main empty">Loading...</div></div>;
  }

  if (needsPin && !authed) {
    return (
      <div className="app">
        <div className="main" style={{ maxWidth: 360, margin: "80px auto", textAlign: "center" }}>
          <h1 style={{ marginBottom: 24 }}>Dashboard PIN</h1>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              className="search-bar"
              placeholder="Enter PIN..."
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
              style={{ textAlign: "center", fontSize: 20, letterSpacing: 8 }}
            />
            <button type="submit" className="btn btn-approve" style={{ width: "100%", marginTop: 8 }}>
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-title">Assistant</span>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} end>
            Queue
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            History
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            Logs
          </NavLink>
        </div>
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
