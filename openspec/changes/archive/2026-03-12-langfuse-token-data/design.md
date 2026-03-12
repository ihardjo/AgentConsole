## Context

The `AnalyticHandler` class in `packages/components/src/handler.ts` integrates with multiple observability platforms (LangFuse, LangSmith, Lunary, LangWatch, Arize, Phoenix, Opik). Currently, the LangFuse integration creates generation events with only `name` and `input`/`output` data, missing critical metadata that LangFuse supports:

- `model`: The model identifier (e.g., "gpt-4-turbo")
- `modelParameters`: Configuration like temperature, maxTokens
- `usage`: Token counts (promptTokens, completionTokens, totalTokens)

The LangFuse SDK's `trace.generation()` and `generation.end()` methods accept these fields, but our implementation doesn't populate them.

## Goals / Non-Goals

**Goals:**

- Send model name to LangFuse generation events in `onLLMStart()`
- Send model parameters (temperature, maxTokens, etc.) to LangFuse generation events
- Extract and send token usage data to LangFuse in `onLLMEnd()`
- Maintain backward compatibility - existing call sites should continue to work
- Handle cases where model/token data is unavailable gracefully

**Non-Goals:**

- Enhancing other observability providers (LangSmith, Lunary, etc.) - separate changes
- Adding new analytics providers
- Changing the AnalyticHandler instantiation pattern
- Real-time token streaming metrics

## Decisions

### 1. Extend method signatures with optional parameters

**Decision**: Add optional `model`, `modelParameters`, and `usage` parameters to `onLLMStart()` and `onLLMEnd()` methods.

**Rationale**: Optional parameters maintain backward compatibility. Existing call sites continue to work, and callers can opt-in to providing additional metadata.

**Alternative considered**: Create new methods like `onLLMStartWithMetadata()`. Rejected because it fragments the API and increases maintenance burden.

### 2. Use interface types for metadata

**Decision**: Define `ILLMMetadata` interface for model info and `ITokenUsage` interface for token counts.

```typescript
interface ILLMMetadata {
    model?: string
    modelParameters?: {
        temperature?: number
        maxTokens?: number
        topP?: number
        frequencyPenalty?: number
        presencePenalty?: number
        [key: string]: any
    }
}

interface ITokenUsage {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
}
```

**Rationale**: Typed interfaces provide IntelliSense support and prevent errors. The `[key: string]: any` allows provider-specific parameters.

### 3. Extract token usage from LangChain response objects

**Decision**: In `onLLMEnd()`, accept an optional `usage` parameter. Call sites are responsible for extracting token data from their specific response formats.

**Rationale**: Different LLM providers return token data in different formats. OpenAI uses `usage.prompt_tokens`, Anthropic uses `usage.input_tokens`, etc. Keeping extraction at the call site allows proper handling per provider.

### 4. Graceful fallback for missing data

**Decision**: All new parameters are optional. LangFuse calls only include fields that are defined.

**Rationale**: Not all LLM calls will have token data available (e.g., streaming responses, local models). The system should work without it.

## Risks / Trade-offs

| Risk                                  | Mitigation                                                  |
| ------------------------------------- | ----------------------------------------------------------- |
| Call sites may not provide metadata   | Fields are optional; system degrades gracefully             |
| Token data format varies by provider  | Call sites handle extraction; document expected format      |
| Breaking change if types are wrong    | Use permissive types with `[key: string]: any` escape hatch |
| Performance impact of additional data | Negligible - just passing references, no computation        |
