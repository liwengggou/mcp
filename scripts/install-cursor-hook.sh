#!/bin/bash
# Install Concept Tracker hook for Cursor
# Adds the on-stop.sh hook to ~/.cursor/hooks.json

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_PATH="$(cd "$SCRIPT_DIR/../hooks/cursor" && pwd)/on-stop.sh"
HOOKS_FILE="$HOME/.cursor/hooks.json"

# Ensure the hook script exists and is executable
if [ ! -f "$HOOK_PATH" ]; then
  echo "Error: Hook script not found at $HOOK_PATH"
  exit 1
fi

chmod +x "$HOOK_PATH"

# Ensure config directory exists
mkdir -p "$(dirname "$HOOKS_FILE")"

# Create or update hooks.json
if [ -f "$HOOKS_FILE" ]; then
  # Check if jq is available
  if command -v jq &> /dev/null; then
    # Check if hook is already registered
    if jq -e '.hooks.stop[]?.command | select(. and contains("concept-tracker"))' "$HOOKS_FILE" > /dev/null 2>&1; then
      echo "Cursor hook already registered"
      exit 0
    fi

    # Use jq to merge with existing hooks
    TEMP_FILE=$(mktemp)
    jq --arg hook "$HOOK_PATH" '
      .version = (.version // 1) |
      .hooks = (.hooks // {}) |
      .hooks.stop = (.hooks.stop // []) |
      .hooks.stop += [{"command": $hook}]
    ' "$HOOKS_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$HOOKS_FILE"
  else
    # Without jq, check if already registered using grep
    if grep -q "concept-tracker" "$HOOKS_FILE" 2>/dev/null; then
      echo "Cursor hook already registered"
      exit 0
    fi

    echo "Warning: jq not found. Please manually add the hook to $HOOKS_FILE"
    echo ""
    echo "Add this to your hooks.json:"
    cat << EOF
{
  "version": 1,
  "hooks": {
    "stop": [
      {"command": "$HOOK_PATH"}
    ]
  }
}
EOF
    exit 0
  fi
else
  # Create new hooks file
  cat > "$HOOKS_FILE" << EOF
{
  "version": 1,
  "hooks": {
    "stop": [
      {
        "command": "$HOOK_PATH"
      }
    ]
  }
}
EOF
fi

echo "Cursor hook installed: $HOOK_PATH"
exit 0
