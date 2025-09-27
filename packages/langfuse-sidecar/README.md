# OpenCode ↔ Langfuse Integration (v4)

This package implements a sidecar process that bridges OpenCode's event stream to Langfuse v4 observability.

## Architecture

### Sidecar-Only Approach
We've moved from in-process instrumentation to a dedicated sidecar process that:
- Connects to OpenCode's SSE event stream (`/event` endpoint)
- Aggregates streaming events into coherent Langfuse observations
- Sends traces to Langfuse v4 using the OpenTelemetry SDK
- Logs canonical trace URLs for easy access

### Why Sidecar?
1. **Clean separation**: Observability doesn't pollute the main app
2. **Streaming support**: Properly aggregates text-delta/reasoning-delta events
3. **Resilient**: Crashes don't affect the main server
4. **Consistent**: Single source of truth for trace generation

## Implementation Details

### Event Mapping
The sidecar listens for these OpenCode events and maps them:

```
message.part.updated:
  - start-step → Creates GENERATION observation + step span
  - text-*/reasoning-* → Accumulates into generation output
  - tool → Creates nested TOOL observations
  - finish-step → Finalizes with tokens/cost/usageDetails

message.updated:
  - assistant role → Ensures generation exists, finalizes if pending
  - user role → Caches input text for next generation
```

### Key Features
1. **Auto-start**: Server spawns sidecar when `OPENCODE_OBSERVE=langfuse` is set
2. **Trace URLs**: Logs US region URLs on generation finalization
3. **Input/Output**: Captures user prompt as input, assistant response as output
4. **Nested structure**: Tools and reasoning appear as child observations
5. **Usage tracking**: Maps OpenCode's token counts to Langfuse's usageDetails

### Environment Variables
- `OPENCODE_OBSERVE=langfuse` - Enables the sidecar
- `LANGFUSE_PUBLIC_KEY` - Your Langfuse public key
- `LANGFUSE_SECRET_KEY` - Your Langfuse secret key  
- `LANGFUSE_BASE_URL` - Langfuse API URL (e.g., https://us.cloud.langfuse.com)

## Current Status

### What's Working
- ✅ Sidecar auto-starts from server
- ✅ Basic GENERATION observations with input/output
- ✅ Nested TOOL observations
- ✅ Token usage and cost tracking
- ✅ Canonical trace URLs logged to server
- ✅ Session ID attached to traces

### Known Issues

1. **Double text accumulation**: The agent's response "4" shows as "44" in Langfuse
   - Likely streaming text parts being accumulated twice
   - Need to debug text-start/text-delta/text-end handling

2. **Missing reasoning traces**: Thinking/reasoning text not appearing in Langfuse
   - Events fire but may not be properly attached to generation
   - Need to verify reasoning observation nesting

3. **Session hierarchy unclear**: Need to verify trace structure
   - Should have: Session (root) → Generation → Tools/Reasoning/Text
   - Currently may be creating flat traces instead of nested

## Development

### Running Locally
```bash
cd .worktrees/opencode-langfuse
OPENCODE_OBSERVE=langfuse bun run --conditions=development packages/smartypants/src/index.ts serve -p 6140
```

### Testing
1. Create a session: `POST /session`
2. Send message: `POST /session/{id}/message` with `{"parts":[{"type":"text","text":"What is 2+2?"}]}`
3. Check logs for "generation finalized" with trace URL
4. Open URL in Langfuse to inspect trace

### Debugging
- Set `LF_SIDECAR_LOG=1` for verbose sidecar logs
- Check server logs for sidecar start/crash messages
- Trace IDs in logs can be searched in Langfuse UI

## Files Modified

### In this worktree
- `packages/langfuse-sidecar/` - The sidecar implementation
- `packages/smartypants/src/server/server.ts` - Auto-start logic
- `packages/smartypants/src/index.ts` - Disabled in-app tracing (gated behind langfuse-app)
- `packages/web/package.json` - Fixed workspace reference

### Key Changes from OpenCode
1. Added sidecar package outside main app
2. Server spawns Node.js sidecar on startup
3. In-app Langfuse disabled by default (opt-in with OPENCODE_OBSERVE=langfuse-app)
4. All observability flows through SSE → sidecar → Langfuse

## Next Steps

1. Fix double text accumulation bug
2. Ensure reasoning observations attach properly
3. Verify session → trace → observation hierarchy
4. Add trace sampling for high-volume scenarios
5. Consider batching for better performance