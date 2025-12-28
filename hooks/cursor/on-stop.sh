#!/bin/bash
# Cursor hook for auto-extraction on stop event
# This script is triggered when Cursor finishes an AI response
# It sends the conversation context to the Concept Tracker API

# Configuration
API_URL="${CONCEPT_TRACKER_API_URL:-http://localhost:3001}"

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from the JSON input using grep/sed (no jq dependency)
CONVERSATION_ID=$(echo "$INPUT" | grep -o '"conversation_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"conversation_id"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')
STATUS=$(echo "$INPUT" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"status"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')

# Only process completed conversations
if [ "$STATUS" != "completed" ]; then
  exit 0
fi

# If no conversation ID, exit
if [ -z "$CONVERSATION_ID" ]; then
  exit 0
fi

# Cursor doesn't provide transcript directly in the hook
# We need to check if there's a transcript in the input or use session files
# For now, we'll send the conversation context to a dedicated endpoint
# that can handle Cursor-specific data retrieval

# Build the request payload
PAYLOAD="{\"conversation_id\": \"$CONVERSATION_ID\", \"status\": \"$STATUS\"}"

# Check if workspace_roots is provided and add it
WORKSPACE_ROOTS=$(echo "$INPUT" | grep -o '"workspace_roots"[[:space:]]*:[[:space:]]*\[[^]]*\]' | head -1)
if [ -n "$WORKSPACE_ROOTS" ]; then
  PAYLOAD="{\"conversation_id\": \"$CONVERSATION_ID\", \"status\": \"$STATUS\", $WORKSPACE_ROOTS}"
fi

# Post to Cursor-specific extract API (async fire-and-forget)
(curl -s -X POST "${API_URL}/api/extract/cursor" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  --connect-timeout 2 \
  --max-time 10 \
  >/dev/null 2>&1 &) 2>/dev/null

# Exit immediately without blocking
exit 0
