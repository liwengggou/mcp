#!/bin/bash
# Install Concept Tracker hook for Claude Code
# Adds the on-stop.sh hook to ~/.claude/settings.json

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_PATH="$(cd "$SCRIPT_DIR/../hooks/claude-code" && pwd)/on-stop.sh"
SETTINGS_FILE="$HOME/.claude/settings.json"

# Ensure the hook script exists and is executable
if [ ! -f "$HOOK_PATH" ]; then
  echo "Error: Hook script not found at $HOOK_PATH"
  exit 1
fi

chmod +x "$HOOK_PATH"

# Ensure settings directory exists
mkdir -p "$(dirname "$SETTINGS_FILE")"

# Create or update settings.json
if [ -f "$SETTINGS_FILE" ]; then
  # Check if jq is available
  if command -v jq &> /dev/null; then
    # Check if hook is already registered
    if jq -e '.hooks.Stop[]?.command // .hooks.Stop[]?.hooks[]?.command | select(. and contains("concept-tracker"))' "$SETTINGS_FILE" > /dev/null 2>&1; then
      echo "Claude Code hook already registered"
      exit 0
    fi

    # Use jq to merge with existing settings
    TEMP_FILE=$(mktemp)
    jq --arg hook "$HOOK_PATH" '
      .hooks = (.hooks // {}) |
      .hooks.Stop = (.hooks.Stop // []) |
      .hooks.Stop += [{"command": $hook}]
    ' "$SETTINGS_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$SETTINGS_FILE"
  else
    # Without jq, check if already registered using grep
    if grep -q "concept-tracker" "$SETTINGS_FILE" 2>/dev/null; then
      echo "Claude Code hook already registered"
      exit 0
    fi

    echo "Warning: jq not found. Please manually add the hook to $SETTINGS_FILE"
    echo ""
    echo "Add this to your settings.json hooks section:"
    echo "  {\"command\": \"$HOOK_PATH\"}"
    exit 0
  fi
else
  # Create new settings file
  cat > "$SETTINGS_FILE" << EOF
{
  "hooks": {
    "Stop": [
      {
        "command": "$HOOK_PATH"
      }
    ]
  }
}
EOF
fi

echo "Claude Code hook installed: $HOOK_PATH"
exit 0
