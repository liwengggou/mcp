#!/bin/bash
# Claude Code hook for auto-extraction on Stop event
# This script is triggered when Claude finishes responding
# It extracts concepts from the conversation transcript

# Read hook input from stdin
INPUT=$(cat)

# Extract transcript_path from the JSON input
TRANSCRIPT_PATH=$(echo "$INPUT" | grep -o '"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/')

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  # No transcript available, exit silently
  exit 0
fi

# Extract conversation content from JSONL transcript
# We want user and assistant messages for concept extraction
CONVERSATION=""

while IFS= read -r line; do
  # Check if this is a user or assistant message
  if echo "$line" | grep -q '"type"[[:space:]]*:[[:space:]]*"user"'; then
    content=$(echo "$line" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"message"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' | head -1)
    if [ -n "$content" ]; then
      CONVERSATION="$CONVERSATION\n\nUser: $content"
    fi
  elif echo "$line" | grep -q '"type"[[:space:]]*:[[:space:]]*"assistant"'; then
    content=$(echo "$line" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"message"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' | head -1)
    if [ -n "$content" ]; then
      CONVERSATION="$CONVERSATION\n\nAssistant: $content"
    fi
  fi
done < "$TRANSCRIPT_PATH"

# If no conversation content, exit
if [ -z "$CONVERSATION" ]; then
  exit 0
fi

# Limit conversation to last 2000 characters to avoid API limits
CONVERSATION=$(echo -e "$CONVERSATION" | tail -c 2000)

# Escape special characters for JSON
CONVERSATION=$(echo "$CONVERSATION" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

# Post to extract API (async fire-and-forget)
(curl -s -X POST "http://localhost:3001/api/extract" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$CONVERSATION\", \"saveContext\": true}" \
  --connect-timeout 2 \
  --max-time 10 \
  >/dev/null 2>&1 &) 2>/dev/null

# Exit immediately without blocking
exit 0
