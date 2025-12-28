#!/bin/bash
# Legacy installer - redirects to install-claude-hook.sh
# Kept for backwards compatibility

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Note: This script is deprecated. Use install-claude-hook.sh instead."
echo ""

exec "$SCRIPT_DIR/install-claude-hook.sh"
