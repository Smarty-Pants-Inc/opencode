#!/bin/bash
# Test interrupt handling using development version

echo "Testing OpenCode interrupt handling (dev mode)"
echo "============================================="
echo ""
echo "Quick test commands to try:"
echo ""
echo "1. Simple sleep test:"
echo "   Command: sleep 30"
echo "   Expected: Interrupt with ESC ESC → 'Request was aborted'"
echo ""
echo "2. Infinite loop test:"
echo "   Command: while true; do echo 'Still running...'; sleep 1; done"
echo "   Expected: Interrupt with ESC ESC → 'Request was aborted'"
echo ""
echo "3. Heavy computation test:"
echo "   Command: find / -type f 2>/dev/null | head -1000"
echo "   Expected: Interrupt with ESC ESC → 'Request was aborted'"
echo ""
echo "Starting OpenCode in dev mode..."
echo ""

cd "$(dirname "$0")/packages/opencode"
bun run dev