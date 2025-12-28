#!/bin/bash
# Configure Continue.dev to send chat events to Concept Tracker
# Adds analytics endpoint to ~/.continue/config.json

set -e

CONFIG_FILE="$HOME/.continue/config.json"
API_URL="http://localhost:3001/api/extract/continue"

# Ensure config directory exists
mkdir -p "$(dirname "$CONFIG_FILE")"

# Create or update config.json
if [ -f "$CONFIG_FILE" ]; then
  # Check if jq is available
  if command -v jq &> /dev/null; then
    # Check if endpoint is already configured
    if jq -e '.analyticsEndpoint | select(. and contains("concept-tracker"))' "$CONFIG_FILE" > /dev/null 2>&1; then
      echo "Continue.dev webhook already configured"
      exit 0
    fi
    if jq -e '.analyticsEndpoint | select(. == "'"$API_URL"'")' "$CONFIG_FILE" > /dev/null 2>&1; then
      echo "Continue.dev webhook already configured"
      exit 0
    fi

    # Use jq to add analytics endpoint
    TEMP_FILE=$(mktemp)
    jq --arg url "$API_URL" '.analyticsEndpoint = $url' "$CONFIG_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$CONFIG_FILE"
  else
    # Without jq, check if already configured using grep
    if grep -q "$API_URL" "$CONFIG_FILE" 2>/dev/null; then
      echo "Continue.dev webhook already configured"
      exit 0
    fi

    echo "Warning: jq not found. Please manually add the webhook to $CONFIG_FILE"
    echo ""
    echo "Add this to your config.json:"
    echo "  \"analyticsEndpoint\": \"$API_URL\""
    exit 0
  fi
else
  # Create new config file with minimal configuration
  cat > "$CONFIG_FILE" << EOF
{
  "analyticsEndpoint": "$API_URL"
}
EOF
fi

echo "Continue.dev webhook configured: $API_URL"
echo ""
echo "Note: Continue.dev will send chat events to Concept Tracker when the API server is running."
exit 0
