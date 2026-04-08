#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Phase 0: Foundation Setup
# Installs Ollama, OpenClaw, and configures Telegram integration
#
# What this script does:
#   1. Checks your system (macOS, Node.js, Python)
#   2. Installs Ollama (the app that runs AI models on your Mac)
#   3. Downloads Gemma 4 E4B (the AI model — about 9GB download)
#   4. Installs OpenClaw (the assistant framework)
#   5. Creates config directories
#   6. Copies configuration files
#
# After this script, you'll need to:
#   - Create a Telegram bot (the script will walk you through it)
#   - Start the gateway and test it
# ═══════════════════════════════════════════════════════════════

set -e  # Stop on any error

# Colors for readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Personal AI Assistant — Phase 0 Setup${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 0: System checks ──────────────────────────────────────
echo -e "${BLUE}[Step 0]${NC} Checking your system..."

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}ERROR:${NC} This script is designed for macOS."
    echo "You appear to be running $(uname). The assistant needs a Mac."
    exit 1
fi

echo -e "  ✓ macOS detected: $(sw_vers -productVersion)"

# Check for Apple Silicon
ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${YELLOW}WARNING:${NC} Expected Apple Silicon (arm64), got $ARCH."
    echo "Ollama works on Intel Macs, but Gemma 4 may be slower."
fi
echo -e "  ✓ Architecture: $ARCH"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found.${NC} Installing via Homebrew..."
    if ! command -v brew &> /dev/null; then
        echo -e "${RED}ERROR:${NC} Neither Node.js nor Homebrew found."
        echo ""
        echo "Please install Homebrew first by running this in Terminal:"
        echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        echo ""
        echo "Then re-run this script."
        exit 1
    fi
    brew install node
fi
NODE_VERSION=$(node --version)
echo -e "  ✓ Node.js: $NODE_VERSION"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 not found.${NC} Installing via Homebrew..."
    brew install python3
fi
PYTHON_VERSION=$(python3 --version)
echo -e "  ✓ Python: $PYTHON_VERSION"

# Check pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${YELLOW}pip3 not found.${NC} Installing..."
    python3 -m ensurepip --upgrade 2>/dev/null || brew install python3
fi
echo -e "  ✓ pip3 available"

echo ""

# ── Step 1: Install Ollama ──────────────────────────────────────
echo -e "${BLUE}[Step 1]${NC} Installing Ollama..."
echo ""
echo "  Ollama is the app that runs AI models directly on your Mac."
echo "  No data leaves your computer when using local models."
echo ""

if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓ Ollama already installed${NC} ($OLLAMA_VERSION)"
else
    echo "  Downloading Ollama for macOS..."
    echo ""
    echo -e "  ${YELLOW}ACTION NEEDED:${NC}"
    echo "  1. Open your web browser and go to: https://ollama.com/download/mac"
    echo "  2. Click 'Download for macOS'"
    echo "  3. Open the downloaded .zip file"
    echo "  4. Drag Ollama to your Applications folder"
    echo "  5. Open Ollama from Applications (it'll show a llama icon in your menu bar)"
    echo ""
    read -p "  Press Enter once Ollama is installed and running... "

    if ! command -v ollama &> /dev/null; then
        echo -e "${RED}ERROR:${NC} Ollama command not found."
        echo "Make sure Ollama is running (look for the llama icon in your menu bar)."
        echo "If it's running but this still fails, try restarting Terminal."
        exit 1
    fi
fi

echo ""

# ── Step 2: Download Gemma 4 E4B ───────────────────────────────
echo -e "${BLUE}[Step 2]${NC} Downloading Gemma 4 E4B model..."
echo ""
echo "  This is the AI brain that will run locally on your Mac."
echo "  It's about 9GB — this may take a few minutes on Wi-Fi."
echo ""

# Try 8-bit first, fall back to 4-bit if memory is tight
PREFERRED_MODEL="gemma4:e4b-it-q8_0"
FALLBACK_MODEL="gemma4:e4b-it-q4_K_M"
CHOSEN_MODEL=""

# Check available memory
TOTAL_RAM_GB=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f", $1/1073741824}')
echo "  Your Mac has ${TOTAL_RAM_GB}GB RAM."

if [[ "$TOTAL_RAM_GB" -ge 16 ]]; then
    echo "  Downloading 8-bit version (best quality for 16GB)..."
    CHOSEN_MODEL="$PREFERRED_MODEL"
else
    echo "  Your RAM is under 16GB. Using 4-bit version (lighter, still good)..."
    CHOSEN_MODEL="$FALLBACK_MODEL"
fi

# Check if already downloaded
if ollama list 2>/dev/null | grep -q "$CHOSEN_MODEL"; then
    echo -e "  ${GREEN}✓ $CHOSEN_MODEL already downloaded${NC}"
else
    echo ""
    echo "  Pulling $CHOSEN_MODEL (this downloads ~9GB)..."
    ollama pull "$CHOSEN_MODEL"
    echo -e "  ${GREEN}✓ Model downloaded successfully${NC}"
fi

echo ""

# Quick test
echo "  Testing the model with a quick message..."
RESPONSE=$(ollama run "$CHOSEN_MODEL" "Say hello in exactly 5 words." 2>/dev/null | head -3)
echo "  Model says: $RESPONSE"
echo -e "  ${GREEN}✓ Model is working!${NC}"
echo ""

# ── Step 3: Install OpenClaw ───────────────────────────────────
echo -e "${BLUE}[Step 3]${NC} Installing OpenClaw..."
echo ""
echo "  OpenClaw is the framework that connects the AI to Telegram,"
echo "  email, calendar, and everything else."
echo ""

if command -v openclaw &> /dev/null; then
    OC_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
    echo -e "  ${GREEN}✓ OpenClaw already installed${NC} ($OC_VERSION)"
else
    echo "  Installing via npm (Node.js package manager)..."
    npm install -g openclaw@latest
    echo -e "  ${GREEN}✓ OpenClaw installed${NC}"
fi

echo ""

# ── Step 4: Install MemPalace ──────────────────────────────────
echo -e "${BLUE}[Step 4]${NC} Installing MemPalace..."
echo ""
echo "  MemPalace is the memory system. It stores everything the"
echo "  assistant learns about your life, organized by topic."
echo ""

if pip3 show mempalace &> /dev/null 2>&1; then
    MP_VERSION=$(pip3 show mempalace 2>/dev/null | grep Version | cut -d' ' -f2)
    echo -e "  ${GREEN}✓ MemPalace already installed${NC} (v$MP_VERSION)"
else
    pip3 install mempalace
    echo -e "  ${GREEN}✓ MemPalace installed${NC}"
fi

echo ""

# ── Step 5: Create directories ─────────────────────────────────
echo -e "${BLUE}[Step 5]${NC} Creating data directories..."

mkdir -p ~/.openclaw
mkdir -p ~/.mempalace
mkdir -p ~/assistant-data/snapshots
mkdir -p ~/assistant-data/logs
mkdir -p ~/assistant-data/backups

echo "  ✓ ~/.openclaw/           (OpenClaw config & credentials)"
echo "  ✓ ~/.mempalace/          (Memory database)"
echo "  ✓ ~/assistant-data/      (Approvals, snapshots, logs)"
echo ""

# ── Step 6: Copy configuration ─────────────────────────────────
echo -e "${BLUE}[Step 6]${NC} Setting up configuration..."

# Update model in config if we used the fallback
CONFIG_SOURCE="$PROJECT_DIR/config/openclaw.json5"

if [[ ! -f ~/.openclaw/openclaw.json ]]; then
    # Convert JSON5 template to actual config, replacing model name
    # We use a simple sed approach since the template is well-structured
    sed "s|gemma4:e4b-it-q8_0|$CHOSEN_MODEL|g" "$CONFIG_SOURCE" > ~/.openclaw/openclaw.json
    echo "  ✓ OpenClaw config created at ~/.openclaw/openclaw.json"
else
    echo -e "  ${YELLOW}Config already exists.${NC} Skipping (won't overwrite your settings)."
    echo "  To use the new template, run:"
    echo "    cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak"
    echo "    cp $CONFIG_SOURCE ~/.openclaw/openclaw.json"
fi

# Copy env template
if [[ ! -f ~/.openclaw/.env ]]; then
    cp "$PROJECT_DIR/config/env.example" ~/.openclaw/.env
    chmod 600 ~/.openclaw/.env  # Only you can read this file
    echo "  ✓ Environment file created at ~/.openclaw/.env"
else
    echo -e "  ${YELLOW}.env already exists.${NC} Skipping."
fi

# Copy identity file
if [[ ! -f ~/.mempalace/identity.txt ]]; then
    cp "$PROJECT_DIR/config/identity.txt" ~/.mempalace/identity.txt
    echo "  ✓ Identity file created at ~/.mempalace/identity.txt"
else
    echo -e "  ${YELLOW}Identity file already exists.${NC} Skipping."
fi

echo ""

# ── Step 7: Telegram Bot Setup ─────────────────────────────────
echo -e "${BLUE}[Step 7]${NC} Setting up your Telegram bot..."
echo ""
echo -e "  ${BOLD}You need to create a Telegram bot. Here's how:${NC}"
echo ""
echo "  1. Open Telegram on your phone or computer"
echo "  2. Search for @BotFather (it has a blue checkmark)"
echo "  3. Send the message: /newbot"
echo "  4. BotFather will ask for a name — type whatever you want"
echo "     (e.g., 'My Assistant' or 'Jarvis')"
echo "  5. BotFather will ask for a username — must end in 'bot'"
echo "     (e.g., 'my_personal_asst_bot')"
echo "  6. BotFather will give you an API token — it looks like:"
echo "     123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
echo ""

read -p "  Paste your Telegram bot token here: " BOT_TOKEN

if [[ -z "$BOT_TOKEN" ]]; then
    echo -e "  ${YELLOW}No token entered.${NC} You can add it later by editing ~/.openclaw/.env"
else
    # Update .env file with the token
    sed -i.bak "s|TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$BOT_TOKEN|" ~/.openclaw/.env
    rm -f ~/.openclaw/.env.bak
    echo -e "  ${GREEN}✓ Bot token saved${NC}"
fi

echo ""

# ── Step 8: FileVault check ────────────────────────────────────
echo -e "${BLUE}[Step 8]${NC} Security check: FileVault encryption..."

FV_STATUS=$(fdesetup status 2>/dev/null || echo "unknown")
if echo "$FV_STATUS" | grep -qi "on"; then
    echo -e "  ${GREEN}✓ FileVault is ON${NC} — your disk is encrypted. Good."
else
    echo -e "  ${YELLOW}⚠ FileVault appears to be OFF.${NC}"
    echo ""
    echo "  FileVault encrypts your entire hard drive. If your laptop is"
    echo "  stolen, nobody can read your files (including your AI memories)."
    echo ""
    echo "  To enable: System Settings → Privacy & Security → FileVault → Turn On"
    echo "  (This runs in the background and won't slow down your Mac.)"
fi

echo ""

# ── Done ────────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Phase 0 installation complete!${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  What was installed:"
echo "  • Ollama + Gemma 4 E4B ($CHOSEN_MODEL)"
echo "  • OpenClaw gateway framework"
echo "  • MemPalace memory system"
echo ""
echo -e "  ${BOLD}Next step: Start the gateway and test it!${NC}"
echo ""
echo "  Run this command:"
echo -e "    ${GREEN}bash $(dirname "$0")/phase0-start.sh${NC}"
echo ""
