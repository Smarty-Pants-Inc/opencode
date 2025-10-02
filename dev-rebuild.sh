#!/bin/bash
# REBUILD SCRIPT - Use this EVERY TIME you edit TUI code
# This is the ONLY correct way to test TUI changes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔨 Rebuilding smartypants (includes TUI rebuild)..."
cd "$SCRIPT_DIR/packages/smartypants"
bun run build

echo ""
echo "✅ Build complete!"
echo ""
echo "🚀 ALWAYS provide this FULL PATH to user for testing:"
echo "   $SCRIPT_DIR/packages/smartypants/dist/smartypants-darwin-arm64/bin/smartypants"
