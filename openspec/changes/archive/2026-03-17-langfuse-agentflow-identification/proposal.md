## Why

The current LangFuse integration cannot differentiate between different agentflows - all traces appear with the generic name "Agentflow" and lack identifying metadata. This makes it impossible to filter, analyze, or debug specific agentflows in the LangFuse dashboard when multiple agentflows are running in production.

## What Changes

- Pass agentflow identification data (`chatflow.id` and `chatflow.name`) to the `AnalyticHandler`
- Update LangFuse trace creation to include:
    - Meaningful trace name (agentflow name instead of generic "Agentflow")
    - Tags for filtering by agentflow ID and name
    - Metadata with agentflow details for detailed context
- Maintain backward compatibility with existing analytics configurations

## Capabilities

### New Capabilities

- `langfuse-agentflow-tagging`: Ability to identify and filter LangFuse traces by agentflow ID and name using tags and metadata

### Modified Capabilities

None - this change adds new trace-level tagging without modifying existing generation metadata requirements.

## Impact

- **Code Changes**:
    - `packages/server/src/utils/buildAgentflow.ts` - Pass chatflow info to AnalyticHandler
    - `packages/components/src/handler.ts` - Accept and use agentflow info in LangFuse trace creation
- **APIs**: No external API changes
- **Dependencies**: No new dependencies required
- **Systems**: LangFuse traces will now include richer metadata; no breaking changes to existing trace structure
