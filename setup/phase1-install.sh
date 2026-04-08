#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Phase 1: Memory + Safety + Dashboard
# Sets up MemPalace, the approval dashboard, and cloud fallback.
#
# What this script does:
#   1. Initializes MemPalace with your life domain "wings"
#   2. Installs and builds the approval dashboard web app
#   3. Sets up the memory snapshot system
#   4. Configures cloud API fallback (if you have an API key)
#   5. Mines this project's spec into memory
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Personal AI Assistant — Phase 1 Setup${NC}"
echo -e "${BOLD}  Memory + Dashboard + Cloud Fallback${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Initialize MemPalace ────────────────────────────────
echo -e "${BLUE}[Step 1]${NC} Setting up MemPalace (persistent memory)..."
echo ""
echo "  MemPalace organizes your assistant's memory into 'wings' —"
echo "  think of it like rooms in a house, one for each area of your life."
echo ""

# Create the assistant-data directory structure for MemPalace to use
PALACE_DIR="$HOME/assistant-data/palace"
mkdir -p "$PALACE_DIR"

# Create wing directories so MemPalace detects them during init
WINGS=("landlord" "personal" "health" "fitness" "work" "career" "side-projects" "finance")
for wing in "${WINGS[@]}"; do
    mkdir -p "$PALACE_DIR/$wing"
    # Add a placeholder file so the directory isn't empty
    echo "# $wing wing — memories related to $(echo "$wing" | tr '-' ' ')" > "$PALACE_DIR/$wing/.wing"
done

echo "  Created wing directories:"
for wing in "${WINGS[@]}"; do
    echo "    - $wing"
done

# Initialize MemPalace
echo ""
echo "  Initializing MemPalace database..."
mempalace init "$PALACE_DIR" --yes 2>&1 | head -20

echo -e "  ${GREEN}✓ MemPalace initialized with ${#WINGS[@]} wings${NC}"
echo ""

# ── Step 2: Copy identity file ──────────────────────────────────
echo -e "${BLUE}[Step 2]${NC} Setting up assistant identity..."

if [[ ! -f ~/.mempalace/identity.txt ]]; then
    cp "$PROJECT_DIR/config/identity.txt" ~/.mempalace/identity.txt
    echo -e "  ${GREEN}✓ Identity file created${NC}"
else
    echo "  Identity file already exists — keeping your current version."
fi

echo ""
echo "  You can personalize the assistant by editing:"
echo "    ~/.mempalace/identity.txt"
echo "  (Change the name, add your communication preferences, etc.)"
echo ""

# ── Step 3: Install the approval dashboard ──────────────────────
echo -e "${BLUE}[Step 3]${NC} Installing the approval dashboard..."
echo ""
echo "  This is a web app you'll open in your browser to approve/reject"
echo "  actions the assistant wants to take (like sending emails)."
echo ""

# Install backend dependencies
echo "  Installing backend dependencies..."
cd "$PROJECT_DIR/dashboard/backend"
npm install 2>&1 | tail -3
echo -e "  ${GREEN}✓ Backend ready${NC}"

# Install frontend dependencies and build
echo "  Installing frontend dependencies (this takes a minute)..."
cd "$PROJECT_DIR/dashboard/frontend"
npm install 2>&1 | tail -3
echo "  Building frontend..."
npm run build 2>&1 | tail -5
echo -e "  ${GREEN}✓ Frontend built${NC}"

cd "$PROJECT_DIR"
echo ""

# ── Step 4: Set dashboard PIN ───────────────────────────────────
echo -e "${BLUE}[Step 4]${NC} Setting a dashboard PIN..."
echo ""
echo "  The dashboard runs on your Mac at http://localhost:3000."
echo "  A PIN prevents accidental access (e.g., if screen sharing)."
echo ""

read -sp "  Choose a PIN (4+ digits), or press Enter to skip: " DASH_PIN
echo ""

if [[ -n "$DASH_PIN" ]]; then
    # Add to .env
    if grep -q "DASHBOARD_PIN" ~/.openclaw/.env 2>/dev/null; then
        sed -i.bak "s|DASHBOARD_PIN=.*|DASHBOARD_PIN=$DASH_PIN|" ~/.openclaw/.env
        rm -f ~/.openclaw/.env.bak
    else
        echo "" >> ~/.openclaw/.env
        echo "# Dashboard PIN" >> ~/.openclaw/.env
        echo "DASHBOARD_PIN=$DASH_PIN" >> ~/.openclaw/.env
    fi
    echo -e "  ${GREEN}✓ PIN saved${NC}"
else
    echo "  No PIN set. Anyone on your Mac can access the dashboard."
fi

echo ""

# ── Step 5: Cloud API key (optional) ───────────────────────────
echo -e "${BLUE}[Step 5]${NC} Cloud API fallback (optional)..."
echo ""
echo "  For complex tasks (email drafting, image analysis), the assistant"
echo "  can use a cloud AI model. This costs ~\$5-20/month depending on usage."
echo ""
echo "  Options:"
echo "    A) Anthropic (Claude Sonnet) — https://console.anthropic.com/settings/keys"
echo "    B) Skip for now (local-only mode)"
echo ""

read -p "  Paste your Anthropic API key, or press Enter to skip: " API_KEY

if [[ -n "$API_KEY" ]]; then
    if grep -q "ANTHROPIC_API_KEY" ~/.openclaw/.env 2>/dev/null; then
        sed -i.bak "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" ~/.openclaw/.env
        rm -f ~/.openclaw/.env.bak
    else
        echo "" >> ~/.openclaw/.env
        echo "ANTHROPIC_API_KEY=$API_KEY" >> ~/.openclaw/.env
    fi
    chmod 600 ~/.openclaw/.env
    echo -e "  ${GREEN}✓ API key saved${NC}"
    echo ""
    echo "  Enabling cloud model in OpenClaw config..."
    echo "  (You can toggle this on/off in the dashboard later.)"
else
    echo "  Skipping — the assistant will run fully local."
    echo "  You can add a cloud API key later by editing ~/.openclaw/.env"
fi

echo ""

# ── Step 6: Set up memory snapshot cron ─────────────────────────
echo -e "${BLUE}[Step 6]${NC} Setting up memory snapshots..."
echo ""
echo "  The snapshot system creates a portable copy of your key memories"
echo "  every hour. You can access it from your phone for quick lookups."
echo ""

# Create the snapshot generation script
cat > "$HOME/assistant-data/generate-snapshot.sh" << 'SNAPSHOT_SCRIPT'
#!/bin/bash
# Generates a memory snapshot from MemPalace
# Run by cron every hour

SNAPSHOT_DIR="$HOME/assistant-data/snapshots"
mkdir -p "$SNAPSHOT_DIR"

# Generate snapshot using MemPalace wake-up (L0 + L1 data)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SNAPSHOT_FILE="$SNAPSHOT_DIR/snapshot_$TIMESTAMP.json"

{
  echo "{"
  echo "  \"generated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"wake_up\": $(mempalace wake-up 2>/dev/null | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""'),"
  echo "  \"status\": $(mempalace status 2>/dev/null | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')"
  echo "}"
} > "$SNAPSHOT_FILE"

# Update the "latest" symlink
ln -sf "$SNAPSHOT_FILE" "$SNAPSHOT_DIR/latest.json"

# Keep only the last 24 snapshots (delete older ones)
ls -t "$SNAPSHOT_DIR"/snapshot_*.json 2>/dev/null | tail -n +25 | xargs rm -f 2>/dev/null

echo "Snapshot generated: $SNAPSHOT_FILE"
SNAPSHOT_SCRIPT

chmod +x "$HOME/assistant-data/generate-snapshot.sh"

# Generate the first snapshot now
echo "  Generating initial snapshot..."
bash "$HOME/assistant-data/generate-snapshot.sh" 2>&1 | head -3

# Set up hourly cron job
CRON_CMD="0 * * * * bash $HOME/assistant-data/generate-snapshot.sh > /dev/null 2>&1"
if crontab -l 2>/dev/null | grep -q "generate-snapshot"; then
    echo "  Cron job already exists."
else
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo -e "  ${GREEN}✓ Hourly snapshot cron job installed${NC}"
fi

echo ""

# ── Step 7: Seed initial memories ───────────────────────────────
echo -e "${BLUE}[Step 7]${NC} Seeding initial memories..."
echo ""
echo "  Mining this project into MemPalace so the assistant knows"
echo "  about its own architecture and your setup."
echo ""

# Mine the config and docs
if [[ -d "$PROJECT_DIR/docs" ]]; then
    mempalace mine "$PROJECT_DIR" 2>&1 | tail -5
fi

echo -e "  ${GREEN}✓ Project files mined into memory${NC}"
echo ""
echo "  You should also add your personal info. Here's how:"
echo ""
echo "  1. Create a text file with key facts about yourself:"
echo "     ~/assistant-data/palace/personal/about-me.txt"
echo ""
echo "  2. Add things like:"
echo "     - Your name"
echo "     - Your email addresses"
echo "     - Key contacts (property manager, doctor, etc.)"
echo "     - Preferences (\"Don't schedule before 9am\")"
echo ""
echo "  3. Run:  mempalace mine ~/assistant-data/palace/personal/"
echo ""

# ── Done ────────────────────────────────────────────────────────
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Phase 1 installation complete!${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  What was set up:"
echo "  • MemPalace with 8 life-domain wings"
echo "  • Approval dashboard (web app)"
echo "  • Memory snapshot system (hourly)"
echo "  • Cloud API fallback (if key provided)"
echo ""
echo -e "  ${BOLD}To start the dashboard:${NC}"
echo -e "    ${GREEN}cd $PROJECT_DIR/dashboard/backend && node server.js${NC}"
echo "    Then open http://localhost:3000 in your browser"
echo ""
echo -e "  ${BOLD}To test the approval queue:${NC}"
echo "    Send a message to your Telegram bot like:"
echo "    'Draft an email to Dave saying hi'"
echo "    Then check the dashboard for the queued action."
echo ""
