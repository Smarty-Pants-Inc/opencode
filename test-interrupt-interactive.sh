#!/bin/bash
# Interactive test for OpenCode interrupt handling fix

echo "OpenCode TUI Interrupt Test"
echo "==========================="
echo ""
echo "This will test the interrupt handling fix."
echo ""
echo "Steps to test:"
echo "1. The TUI will open"
echo "2. Type one of these commands:"
echo "   - sleep 30"
echo "   - while true; do echo 'Running...'; sleep 1; done"
echo "   - find / -name '*.txt' 2>/dev/null"
echo ""
echo "3. Press Enter to execute"
echo "4. While it's running, press ESC twice quickly"
echo "5. Check the error message:"
echo "   ✅ GOOD: 'Request was aborted' or 'Tool execution aborted'"
echo "   ❌ BAD: 'AI_APICallError' or 'was provided without its required following item'"
echo ""
echo "Press Enter to start..."
read

# Run opencode from the built version
cd "$(dirname "$0")/packages/opencode"
./bin/opencode