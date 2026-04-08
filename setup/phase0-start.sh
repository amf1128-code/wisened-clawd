#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Phase 0: Start & Test
# Starts the OpenClaw gateway and walks you through testing
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Personal AI Assistant — Starting Gateway${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Pre-flight checks ──────────────────────────────────────────
echo -e "${BLUE}[Check]${NC} Verifying everything is ready..."

# Check Ollama is running
if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
    echo -e "  ${YELLOW}Ollama is not running.${NC}"
    echo "  Open the Ollama app (look for the llama icon in your menu bar)."
    echo "  Or run: open -a Ollama"
    echo ""
    read -p "  Press Enter once Ollama is running... "

    if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
        echo -e "  ${RED}ERROR:${NC} Still can't reach Ollama at http://127.0.0.1:11434"
        echo "  Make sure the Ollama app is open and try again."
        exit 1
    fi
fi
echo -e "  ✓ Ollama is running"

# Check Telegram token is set
if [[ -f ~/.openclaw/.env ]]; then
    source ~/.openclaw/.env 2>/dev/null
fi

if [[ -z "$TELEGRAM_BOT_TOKEN" || "$TELEGRAM_BOT_TOKEN" == "your-telegram-bot-token-here" ]]; then
    echo -e "  ${YELLOW}Telegram bot token not set.${NC}"
    echo ""
    echo "  Edit ~/.openclaw/.env and set TELEGRAM_BOT_TOKEN"
    echo "  (See Phase 0 install script for how to get a token)"
    echo ""
    read -p "  Or paste your token now (Enter to skip): " TOKEN
    if [[ -n "$TOKEN" ]]; then
        sed -i.bak "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TOKEN|" ~/.openclaw/.env
        rm -f ~/.openclaw/.env.bak
        export TELEGRAM_BOT_TOKEN="$TOKEN"
        echo -e "  ${GREEN}✓ Token saved${NC}"
    else
        echo -e "  ${YELLOW}Skipping Telegram. You can set it up later.${NC}"
    fi
else
    echo -e "  ✓ Telegram bot token is set"
fi

# Check config exists
if [[ ! -f ~/.openclaw/openclaw.json ]]; then
    echo -e "  ${RED}ERROR:${NC} No config file found at ~/.openclaw/openclaw.json"
    echo "  Run the Phase 0 install script first: bash setup/phase0-install.sh"
    exit 1
fi
echo -e "  ✓ Config file exists"

echo ""

# ── Validate config ────────────────────────────────────────────
echo -e "${BLUE}[Validate]${NC} Checking configuration..."
# Quick validate with a 15-second timeout (doctor can hang on first run)
DOCTOR_OUT=$(timeout 15 openclaw doctor 2>&1 || true)
if echo "$DOCTOR_OUT" | grep -qi "error\|fatal\|invalid"; then
    echo -e "  ${YELLOW}Config issues detected. Attempting auto-fix...${NC}"
    timeout 15 openclaw doctor --fix --yes 2>&1 | head -20 || true
else
    echo -e "  ✓ Configuration OK"
fi
echo ""

# ── Start gateway ──────────────────────────────────────────────
echo -e "${BLUE}[Start]${NC} Starting OpenClaw gateway..."
echo ""
echo "  The gateway is the 'brain' — it connects the AI model to Telegram"
echo "  and manages all your conversations."
echo ""
echo "  Starting as a background service (daemon)..."

# Install and start as daemon
openclaw gateway --install-daemon 2>/dev/null || true
openclaw gateway start 2>/dev/null || openclaw gateway &

sleep 3

# Check if gateway is running
if openclaw health 2>&1 | grep -qi "ok\|healthy\|running"; then
    echo -e "  ${GREEN}✓ Gateway is running!${NC}"
else
    echo -e "  ${YELLOW}Gateway may still be starting up...${NC}"
    echo "  Waiting 10 more seconds..."
    sleep 10
    openclaw health 2>&1 | head -5
fi

echo ""

# ── Telegram pairing ──────────────────────────────────────────
echo -e "${BLUE}[Pair]${NC} Pairing your Telegram account..."
echo ""
echo -e "  ${BOLD}Now do this on your phone:${NC}"
echo ""
echo "  1. Open Telegram"
echo "  2. Find your bot (search for the username you gave it)"
echo "  3. Send it any message (e.g., 'hello')"
echo ""
echo "  The bot will reply with a pairing code."
echo ""

read -p "  Press Enter after you've sent a message to your bot... "

# Show pending pairing requests
echo ""
echo "  Checking for pairing requests..."
PAIRING=$(openclaw pairing list telegram 2>&1)
echo "$PAIRING"

if echo "$PAIRING" | grep -qi "code\|pending"; then
    echo ""
    read -p "  Enter the pairing code shown above to approve it: " PAIR_CODE
    if [[ -n "$PAIR_CODE" ]]; then
        openclaw pairing approve telegram "$PAIR_CODE"
        echo -e "  ${GREEN}✓ Telegram paired!${NC}"
    fi
else
    echo -e "  ${YELLOW}No pairing requests found yet.${NC}"
    echo "  Make sure you sent a message to the bot on Telegram."
    echo "  You can approve later with: openclaw pairing approve telegram <code>"
fi

echo ""

# ── Test ───────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Gateway is running! Time to test.${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Send these test messages to your bot on Telegram:"
echo ""
echo "  1. 'Hello, who are you?'"
echo "     → Should get a response from Gemma 4 (not a cloud model)"
echo ""
echo "  2. 'What is 2 + 2?'"
echo "     → Quick math test"
echo ""
echo "  3. 'Write me a haiku about coding'"
echo "     → Tests creative generation"
echo ""
echo "  4. Try sending a photo"
echo "     → E4B supports images, should attempt to describe it"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo "  • Check status:      openclaw status"
echo "  • View logs:         openclaw logs"
echo "  • Stop gateway:      openclaw gateway stop"
echo "  • Restart:           openclaw gateway restart"
echo "  • Health check:      openclaw health"
echo "  • Open Control UI:   openclaw dashboard"
echo "    (opens http://127.0.0.1:18789 in your browser)"
echo ""
echo -e "  ${BOLD}If something goes wrong:${NC}"
echo "  • openclaw doctor    (diagnoses issues)"
echo "  • openclaw logs      (shows recent activity)"
echo "  • ollama ps          (check if model is loaded)"
echo ""
echo "  When you're satisfied everything works, you're ready for Phase 1!"
echo "  Run: bash setup/phase1-install.sh"
echo ""
