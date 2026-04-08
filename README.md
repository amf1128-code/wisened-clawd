# Personal AI Assistant

A local-first personal AI assistant built on [OpenClaw](https://github.com/openclaw/openclaw) with [Gemma 4](https://ai.google.dev/gemma) running locally via [Ollama](https://ollama.com), [MemPalace](https://github.com/milla-jovovich/mempalace) for persistent memory, and a custom approval dashboard for safety.

## What This Does

- Runs an AI assistant on your Mac that talks to you via Telegram
- Remembers everything about your life, organized into domains (landlord, personal, health, work, etc.)
- Drafts emails, manages your calendar, tracks to-dos, and coordinates tasks
- **Nothing goes out without your approval** — every outbound action enters a queue you control
- **Local-first** — your data never leaves your Mac unless you explicitly enable cloud features

## Architecture

```
You (iPhone + Mac)
    │
    ├── Telegram Bot (quick chat + approvals)
    ├── Web Dashboard (http://localhost:3000)
    │
    ▼
OpenClaw Gateway (on your Mac)
    ├── Gemma 4 E4B (local AI via Ollama)
    ├── MemPalace (local memory: ChromaDB + SQLite)
    ├── Approval Queue (SQLite)
    └── Skills (landlord, plants, email triage, etc.)
```

## Quick Start

### Phase 0: Foundation

```bash
# 1. Run the setup script (installs Ollama, OpenClaw, MemPalace)
bash setup/phase0-install.sh

# 2. Start the gateway and pair your Telegram
bash setup/phase0-start.sh
```

### Phase 1: Memory + Dashboard

```bash
# Sets up MemPalace, builds the dashboard, configures snapshots
bash setup/phase1-install.sh

# Start the dashboard
cd dashboard/backend && node server.js
# Open http://localhost:3000
```

## Project Structure

```
wisened-clawd/
├── config/                    # Configuration templates
│   ├── openclaw.json5         # OpenClaw config (copy to ~/.openclaw/openclaw.json)
│   ├── env.example            # Environment variables template
│   ├── identity.txt           # Assistant personality (copy to ~/.mempalace/)
│   └── queued-writes-schema.json  # Schema for phone→Mac memory sync (Phase 6)
│
├── dashboard/                 # Approval dashboard web app
│   ├── backend/               # Express.js API server
│   │   ├── server.js          # Main server
│   │   ├── db.js              # SQLite database layer
│   │   └── telegram-bridge.js # Telegram notification bridge
│   └── frontend/              # React SPA
│       └── src/
│           ├── App.js         # Main app with routing
│           ├── api.js         # API client
│           └── pages/         # Queue, History, Logs pages
│
├── setup/                     # Setup scripts
│   ├── phase0-install.sh      # Install Ollama + OpenClaw + MemPalace
│   ��── phase0-start.sh        # Start gateway + pair Telegram
│   └── phase1-install.sh      # Set up memory + dashboard
│
├── skills/                    # Custom OpenClaw skills
│   ├── _template/             # Template for creating new skills
│   ├── landlord/              # Property management skill
│   └── plants/                # Plant care skill
│
└── docs/                      # Documentation
```

## Key Principles

1. **Nothing goes out without approval** — every email, text, calendar event enters the approval queue
2. **Local-first** — all memory on your Mac, default AI runs locally, cloud is opt-in
3. **Read-only by default** — integrations start read-only, you enable write access explicitly
4. **Swappable models** — change one config line to swap AI models
5. **Safe self-modification** — assistant can edit its prompts (with approval), never its own code

## Phases

| Phase | What | Status |
|-------|------|--------|
| 0 | Foundation (Ollama + OpenClaw + Telegram) | Ready |
| 1 | Memory + Dashboard + Cloud Fallback | Ready |
| 2 | Gmail Integration | Planned |
| 3 | Calendar + Reminders + To-Do | Planned |
| 4 | iMessage + Landlord Skill | Planned |
| 5 | Plant Care + Mini-App Pattern | Planned |
| 6 | iOS App | Planned |

## Useful Commands

```bash
# OpenClaw
openclaw status          # Check channel health
openclaw gateway restart # Restart the gateway
openclaw doctor          # Diagnose issues
openclaw logs            # View recent logs
openclaw dashboard       # Open Control UI

# Ollama
ollama list              # Show downloaded models
ollama ps                # Show running models
ollama run gemma4:e4b-it-q8_0 "test prompt"

# MemPalace
mempalace status         # Show what's stored
mempalace search "query" # Search all memories
mempalace wake-up        # Show startup context
```

## Security

- Gateway binds to `127.0.0.1` only (not accessible from your WiFi)
- All integrations start read-only
- Cloud API calls are logged with full payload
- Prompt injection defenses in system prompts
- Dashboard protected by PIN
- Enable FileVault on your Mac for disk encryption
