## Context

The Agent Console uses LangFuse for LLM observability through the `AnalyticHandler` class in `packages/components/src/handler.ts`. Currently, when an agentflow runs:

1. `buildAgentflow.ts` creates an `AnalyticHandler` instance and calls `onChainStart('Agentflow', input)`
2. The handler creates a LangFuse trace with the generic name "Agentflow"
3. All agentflows appear identical in LangFuse - no way to distinguish between them

The `chatflow` object containing `id` and `name` is available in `buildAgentflow.ts` but is not passed to the analytics layer.

## Goals / Non-Goals

**Goals:**

- Enable filtering and identification of traces by agentflow in LangFuse dashboard
- Pass agentflow `id` and `name` to LangFuse traces via tags and metadata
- Use agentflow name as the trace name for human readability
- Maintain backward compatibility - existing analytics configurations continue to work

**Non-Goals:**

- Changing how other analytics providers (LangSmith, Lunary, etc.) handle agentflow identification
- Adding user-configurable tagging beyond automatic agentflow identification
- Modifying the LangFuse callback handler for LangChain integrations (only affects `AnalyticHandler`)

## Decisions

### 1. Pass agentflow info via `options` parameter

**Decision**: Add `agentflowId` and `agentflowName` to the `options` object passed to `AnalyticHandler.getInstance()`.

**Rationale**: The options object already contains contextual data like `chatId`, `orgId`, `workspaceId`. Adding agentflow info follows the existing pattern without changing method signatures.

**Alternatives considered**:

- Adding new parameters to `onChainStart()` - Rejected: Would require changing all call sites and break existing integrations
- Creating a new interface for agentflow context - Rejected: Over-engineering for two simple string fields

### 2. Use LangFuse tags for filtering

**Decision**: Add tags in the format `agentflow-id:<id>` and the agentflow name as a tag.

**Rationale**:

- Tags are searchable/filterable in LangFuse UI
- Using `agentflow-id:` prefix prevents collision with other tags
- Agentflow name as direct tag enables human-friendly filtering

**Format**:

```typescript
tags: [`agentflow-id:${agentflowId}`, agentflowName]
```

### 3. Use LangFuse metadata for detailed context

**Decision**: Add metadata object with `agentflowId` and `agentflowName` fields.

**Rationale**: Metadata provides structured data for API queries and detailed trace inspection, complementing tags for different use cases.

### 4. Use agentflow name as trace name

**Decision**: Set trace `name` to `agentflowName` with fallback to "Agentflow".

**Rationale**: Makes traces immediately identifiable in LangFuse without opening details. Fallback ensures backward compatibility if name is undefined.

## Risks / Trade-offs

| Risk                                          | Mitigation                                                            |
| --------------------------------------------- | --------------------------------------------------------------------- |
| Agentflow name changes break trace continuity | Use `agentflow-id` tag as stable identifier; name is for display only |
| Empty/undefined agentflow name                | Fallback to "Agentflow" for trace name; omit from tags if undefined   |
| Tag length limits in LangFuse                 | Truncate long names if needed (LangFuse allows reasonable lengths)    |
| Increased payload size to LangFuse            | Minimal impact - adding ~50 bytes per trace is negligible             |

## Implementation Approach

1. **Modify `buildAgentflow.ts`**: Pass `chatflow.id` and `chatflow.name` in options to `AnalyticHandler.getInstance()`

2. **Modify `AnalyticHandler` constructor**: Store agentflow info from options

3. **Modify `onChainStart` LangFuse section**:
    - Set trace `name` to agentflow name (with fallback)
    - Add `tags` array with agentflow identifiers
    - Add `metadata` object with agentflow details
