#!/bin/bash
# Universal Concept Tracker Installation Script
# Detects installed AI tools and configures hooks for each

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$HOME/.concept-tracker"

echo "========================================"
echo "   Concept Tracker - Multi-IDE Setup   "
echo "========================================"
echo ""

# Detect installed IDEs
echo "Detecting installed AI tools..."
echo ""

DETECTED=()

# Claude Code
if [ -d "$HOME/.claude" ] || command -v claude &> /dev/null 2>&1; then
  echo "  [✓] Claude Code: Detected"
  DETECTED+=("claude-code")
else
  echo "  [ ] Claude Code: Not found"
fi

# Cursor
if [ -d "$HOME/.cursor" ] || [ -d "/Applications/Cursor.app" ] || [ -n "$CURSOR_VERSION" ]; then
  echo "  [✓] Cursor: Detected"
  DETECTED+=("cursor")
else
  echo "  [ ] Cursor: Not found"
fi

# Continue.dev
if [ -d "$HOME/.continue" ]; then
  echo "  [✓] Continue.dev: Detected"
  DETECTED+=("continue")
else
  echo "  [ ] Continue.dev: Not found"
fi

echo ""

if [ ${#DETECTED[@]} -eq 0 ]; then
  echo "No supported AI tools detected."
  echo ""
  echo "Concept Tracker supports:"
  echo "  - Claude Code (https://claude.ai/code)"
  echo "  - Cursor (https://cursor.sh)"
  echo "  - Continue.dev (https://continue.dev)"
  echo ""
  exit 1
fi

# Create unified configuration
echo "Creating unified configuration..."
mkdir -p "$CONFIG_DIR"

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  cat > "$CONFIG_DIR/config.json" << 'EOF'
{
  "version": "1.0.0",
  "extraction": {
    "enabled": true,
    "apiProvider": "deepseek",
    "minConversationLength": 100,
    "excludePatterns": []
  },
  "storage": {
    "path": "~/.concept-tracker",
    "format": "json"
  },
  "server": {
    "enabled": true,
    "port": 3001,
    "host": "localhost"
  },
  "dashboard": {
    "enabled": true,
    "port": 3000,
    "autoOpen": false
  },
  "ides": {}
}
EOF
  echo "  Created: $CONFIG_DIR/config.json"
else
  echo "  Config already exists: $CONFIG_DIR/config.json"
fi

echo ""

# Install hooks for detected IDEs
echo "Installing hooks..."
echo ""

for ide in "${DETECTED[@]}"; do
  case $ide in
    claude-code)
      echo "  Installing Claude Code hook..."
      if "$SCRIPT_DIR/install-claude-hook.sh"; then
        echo "  [✓] Claude Code hook installed"
      else
        echo "  [✗] Claude Code hook failed"
      fi
      ;;
    cursor)
      echo "  Installing Cursor hook..."
      if "$SCRIPT_DIR/install-cursor-hook.sh"; then
        echo "  [✓] Cursor hook installed"
      else
        echo "  [✗] Cursor hook failed"
      fi
      ;;
    continue)
      echo "  Installing Continue.dev webhook..."
      if "$SCRIPT_DIR/install-continue-hook.sh"; then
        echo "  [✓] Continue.dev webhook configured"
      else
        echo "  [✗] Continue.dev webhook failed"
      fi
      ;;
  esac
done

echo ""
echo "========================================"
echo "           Setup Complete!             "
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the Concept Tracker servers:"
echo "   cd $PROJECT_ROOT"
echo "   npm run dev:api   # API server (port 3001)"
echo "   npm run dev       # Dashboard (port 3000)"
echo ""
echo "2. Ensure you have DEEPSEEK_API_KEY set in your environment"
echo "   or in $PROJECT_ROOT/.env"
echo ""
echo "3. Start using your AI tools - concepts will be extracted automatically!"
echo ""
