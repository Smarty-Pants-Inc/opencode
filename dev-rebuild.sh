#!/bin/bash
# REBUILD SCRIPT - Use this EVERY TIME you edit TUI code
# This is the ONLY correct way to test TUI changes

set -e

echo "🔨 Rebuilding smartypants (includes TUI rebuild)..."
cd packages/smartypants
bun run build

echo ""
echo "✅ Build complete!"
echo ""
echo "🚀 Run this to test:"
echo "   packages/smartypants/dist/smartypants-darwin-arm64/bin/smartypants"
