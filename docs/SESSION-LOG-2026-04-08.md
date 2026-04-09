# Session Log: 2026-04-08/09 — Phase 0 Setup

## What Was Accomplished

### Code & Project (committed to `claude/personal-ai-assistant-build-Kntsl`)
- Full project scaffolding created (31 files, ~2,900 lines) across 2 commits
- **Config**: OpenClaw config template, env template, identity file, queued-writes schema
- **Dashboard**: Express.js backend (server.js, db.js, telegram-bridge.js) + React frontend (Queue, History, Logs pages) with dark theme, mobile-responsive, PIN auth
- **Skills**: Skill template, landlord skill, plant care skill (all scaffolding, not wired in yet)
- **Setup scripts**: phase0-install.sh, phase0-start.sh, phase1-install.sh
- **Fix committed**: Removed invalid `gateway.host` config key, added timeout to `openclaw doctor` check

### On the User's Mac (live config, not in git)
- Ollama installed and working
- Gemma 4 E4B downloaded (both q8_0 and q4_K_M quantizations)
- Llama 3.2 3B downloaded
- Custom Ollama model `llama-oc` created (Llama 3.2 3B with num_ctx=32768)
- OpenClaw installed globally via npm (`sudo npm install -g openclaw@latest`)
- OpenClaw gateway running as a LaunchAgent (auto-starts on boot)
- Telegram bot `@WizenedClawdBot` created and paired (user ID: 1367952707)
- MemPalace installed via pip (not yet initialized with wings)
- Workspace files trimmed: AGENTS.md cut from 7,874 chars to ~1,500 chars

### Config changes applied on user's Mac (via `openclaw config set`)
These are the CURRENT live values in `~/.openclaw/openclaw.json` on the Mac:
- `gateway.mode`: "local"
- `agents.defaults.model.primary`: "ollama/llama-oc"
- `agents.defaults.sandbox.mode`: "off" (Docker not installed)
- `agents.defaults.timeoutSeconds`: 300
- `agents.defaults.compaction.reserveTokensFloor`: 24000
- `agents.defaults.heartbeat.includeSystemPromptSection`: false
- `agents.defaults.bootstrapMaxChars`: 5000
- `agents.defaults.contextInjection`: "continuation-skip"
- `models.providers.ollama.models.0.id`: "llama-oc"
- `models.providers.ollama.models.0.contextWindow`: 32768 (was set to 131072 then overridden)
- `models.providers.ollama.models.0.contextTokens`: 32768
- `models.providers.ollama.api`: changed to "ollama" (verify this took effect)
- `models.providers.ollama.baseUrl`: changed to "http://127.0.0.1:11434" (verify)

---

## What's Still Broken (Phase 0 NOT complete)

### Primary issue: Telegram bot doesn't respond
The bot receives messages and the gateway processes them, but responses either time out or fail. The model works fine when called directly (`ollama run llama-oc "hello"` responds instantly).

### Root cause chain
1. **Gemma 4 E4B q8_0 (11GB)**: Too much RAM on 16GB Mac. Model loaded but inference timed out. Switched to q4_K_M.
2. **Gemma 4 E4B q4_K_M**: Still used 10GB with large context window. Timed out.
3. **Context window mismatch**: OpenClaw requires minimum 16,000 token context. Ollama models default to small context (4096-7168). Had to override in OpenClaw config AND create custom Ollama Modelfile.
4. **reserveTokensFloor too high**: Default is 24,000. Was set to 20,000 at one point. With a 16,384-token model, this left 0 tokens for the actual prompt. Fixed by switching to larger context.
5. **Switched to Llama 3.2 3B**: Much smaller (2GB base), 128k native context. Created custom `llama-oc` model with num_ctx=32768.
6. **System prompt too large**: OpenClaw injects ~9,600 tokens of system prompt (tool schemas, workspace files, internal instructions). On a small local model, processing this takes ~60+ seconds.
7. **Hidden ~60s timeout**: Even with `timeoutSeconds: 300`, requests timeout at ~60 seconds. Provider-level timeout keys (`requestTimeoutMs`, `timeoutMs`) are rejected by OpenClaw's schema. Root cause unknown — possibly hardcoded in OpenClaw's HTTP client for Ollama.
8. **Workspace files bloated**: AGENTS.md was 7,874 chars (~2,000 tokens). Trimmed to ~1,500 chars. SOUL.md still at 1,747 chars.
9. **Bot called itself "Ali"**: Telegram metadata sends user's name as "A". Model assumed that was its own name. Memory files with bad conversation saved and re-injected. Need to clear `~/.openclaw/workspace/memory/*.md` and update SOUL.md to say "You are Wiz".

### Remaining tasks to fix Phase 0
- [ ] Clear bad memory files: `rm ~/.openclaw/workspace/memory/*.md`
- [ ] Update SOUL.md to include "You are Wiz" and USER.md with Ali's info
- [ ] Trim SOUL.md and TOOLS.md (still ~2,600 chars combined, can be cut to ~800)
- [ ] Resolve the ~60 second timeout issue — either:
  - (a) Find and increase the hidden timeout (not yet found in config schema)
  - (b) Reduce system prompt further so model responds within 60s
  - (c) Try `openclaw configure` to auto-detect optimal Ollama settings
  - (d) Try a faster model that can handle ~10k tokens of system prompt quickly
- [ ] Verify `models.providers.ollama.api` is "ollama" (not "openai-responses") and `baseUrl` is "http://127.0.0.1:11434" (not /v1)
- [ ] Once bot responds: test basic conversation stability for 30+ minutes
- [ ] Once stable: update repo config template to match working live config

---

## Key Lessons Learned

### OpenClaw + Local Models on 16GB RAM
- OpenClaw's system prompt is ~9,600 tokens. Local models need at least 32k context to be viable.
- Default `reserveTokensFloor` (24,000) assumes cloud models with 100k+ context. Must be tuned for local.
- OpenClaw validates config strictly — unknown keys prevent startup. Always run `openclaw doctor` after config changes.
- `openclaw config set` changes the JSON file but doesn't always take effect until `openclaw gateway restart`.
- Ollama models report their own context window metadata. OpenClaw reads this via `source=model`. To override, set `contextWindow` in `models.providers.ollama.models[]` (changes source to `modelsConfig`).
- Custom Ollama Modelfiles (`PARAMETER num_ctx`) set the runtime context but don't change the metadata OpenClaw reads. Must ALSO override in OpenClaw's config.
- The gateway auto-starts as a LaunchAgent after `openclaw doctor --fix`. Use `openclaw gateway restart`, not `openclaw gateway` (which tries to start a second instance).

### Workspace Token Budget (every token counts on small models)
- AGENTS.md, SOUL.md, USER.md, TOOLS.md, MEMORY.md, and memory/*.md all get injected into every request
- Default AGENTS.md is ~7,800 chars (~2,000 tokens) — way too much for small models
- memory/*.md files accumulate automatically (session saves). Old error sessions create files like "request-timed-out-before-a-res.md" that get re-injected. Clean periodically.
- `bootstrapMaxChars: 5000` caps individual file injection but files under the limit still add up
- Config options to reduce prompt: `heartbeat.includeSystemPromptSection: false`, `contextInjection: "continuation-skip"`, lower `bootstrapMaxChars`

---

## Architecture Decisions Still Valid
- OpenClaw as the gateway framework (confirmed working, good Telegram integration)
- MemPalace for memory (installed, not yet initialized — Phase 1)
- Approval dashboard (code written, not yet deployed — Phase 1)
- Telegram as primary interface (bot created, paired, receiving messages)
- Local-first with cloud fallback (cloud not configured yet — Phase 1)

## Repo State
- Branch: `claude/personal-ai-assistant-build-Kntsl`
- 2 commits pushed
- Repo config template (`config/openclaw.json5`) is OUTDATED — still references gemma4:e4b-it-q8_0 and old settings. Needs to be updated to match the working live config once Phase 0 is resolved.
