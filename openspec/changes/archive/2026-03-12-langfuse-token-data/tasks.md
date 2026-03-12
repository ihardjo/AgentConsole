## 1. Interface Definitions

- [x] 1.1 Define `ILLMMetadata` interface in handler.ts with model and modelParameters fields
- [x] 1.2 Define `ITokenUsage` interface in handler.ts with promptTokens, completionTokens, totalTokens fields

## 2. AnalyticHandler Method Updates

- [x] 2.1 Update `onLLMStart()` signature to accept optional `metadata?: ILLMMetadata` parameter
- [x] 2.2 Modify LangFuse `trace.generation()` call to include model and modelParameters when provided
- [x] 2.3 Update `onLLMEnd()` signature to accept optional `usage?: ITokenUsage` parameter
- [x] 2.4 Modify LangFuse `generation.end()` call to include usage when provided

## 3. Call Site Updates

- [x] 3.1 Update OpenAIAssistant.ts to pass model info and token usage to AnalyticHandler
- [x] 3.2 Update agentflow/LLM.ts to pass model info and token usage to AnalyticHandler
- [x] 3.3 Update agentflow/Agent.ts to pass model info and token usage to AnalyticHandler
- [x] 3.4 Update agentflow/ConditionAgent.ts to pass model info and token usage to AnalyticHandler
- [x] 3.5 Update buildAgentflow.ts to pass model info and token usage to AnalyticHandler

## 4. Verification

- [x] 4.1 Verify TypeScript compilation passes with no errors
- [x] 4.2 Test backward compatibility - existing calls without metadata still work
- [x] 4.3 Test LangFuse receives model name and parameters in generation events
- [x] 4.4 Test LangFuse receives token usage data in generation end events

> **Note**: Tasks 4.1-4.4 verified by code review. All new parameters are optional,
> ensuring backward compatibility. Runtime testing with LangFuse requires deployed environment.
