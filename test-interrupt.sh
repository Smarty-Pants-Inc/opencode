#!/bin/bash
# Test script for OpenCode interrupt handling

echo "Test: OpenCode Interrupt Handling"
echo "================================"
echo ""
echo "This test will:"
echo "1. Start opencode TUI"
echo "2. Send a long-running command"
echo "3. You should interrupt it with ESC twice"
echo "4. Check that the error is handled gracefully"
echo ""
echo "Instructions:"
echo "- When the TUI opens, type: sleep 30"
echo "- Press Enter to execute"
echo "- While it's running, press ESC twice quickly"
echo "- Observe the error message"
echo "- Check if it shows 'Request was aborted' instead of AI_APICallError"
echo ""
echo "Press Enter to start the test..."
read

# Run opencode in TUI mode
cd "$(dirname "$0")/packages/opencode"
bun run dev