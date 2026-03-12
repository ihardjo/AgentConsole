## Why

The `AnalyticHandler` class sends LLM events to LangFuse without model name, model parameters, or token usage data. This prevents users from tracking cost, performance metrics, and token consumption in LangFuse dashboards. The LangFuse API fully supports these fields, but our integration doesn't populate them.

## What Changes

- Enhance `AnalyticHandler.onLLMStart()` to capture and send model name and model parameters (temperature, maxTokens, etc.) to LangFuse generation events
- Enhance `AnalyticHandler.onLLMEnd()` to extract and send token usage (promptTokens, completionTokens, totalTokens) from LLM responses
- Update all call sites of `AnalyticHandler` to pass model information when available
- Provide fallback handling when token data is not available in the response

## Capabilities

### New Capabilities

- `langfuse-generation-metadata`: Capture and send model name, model parameters, and token usage data in LangFuse generation events

### Modified Capabilities

<!-- No existing specs are being modified - this is a new enhancement to existing code -->

## Impact

- **Primary file**: `packages/components/src/handler.ts` - `AnalyticHandler` class
    - `onLLMStart()` method (line ~1271)
    - `onLLMEnd()` method (line ~1403)
    - LangFuse generation calls at lines 1305-1308 and 1419-1421
- **Call sites to update**:
    - `packages/components/nodes/agents/OpenAIAssistant/OpenAIAssistant.ts`
    - `packages/components/nodes/agentflow/LLM/LLM.ts`
    - `packages/components/nodes/agentflow/Agent/Agent.ts`
    - `packages/components/nodes/agentflow/ConditionAgent/ConditionAgent.ts`
    - `packages/server/src/utils/buildAgentflow.ts`
- **Dependencies**: No new dependencies required - using existing LangFuse SDK capabilities
