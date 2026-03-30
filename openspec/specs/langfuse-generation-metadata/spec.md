## ADDED Requirements

### Requirement: LangFuse generation events SHALL include model name

When an LLM generation event is created, the system SHALL send the model name (e.g., "gpt-4-turbo", "claude-3-opus") to LangFuse if the model name is provided by the caller.

#### Scenario: Model name is provided

- **WHEN** `onLLMStart()` is called with a model name in the metadata parameter
- **THEN** the LangFuse `trace.generation()` call SHALL include the `model` field with the provided value

#### Scenario: Model name is not provided

- **WHEN** `onLLMStart()` is called without a model name
- **THEN** the LangFuse `trace.generation()` call SHALL NOT include the `model` field

### Requirement: LangFuse generation events SHALL include model parameters

When an LLM generation event is created, the system SHALL send model parameters (temperature, maxTokens, etc.) to LangFuse if provided by the caller.

#### Scenario: Model parameters are provided

- **WHEN** `onLLMStart()` is called with model parameters in the metadata
- **THEN** the LangFuse `trace.generation()` call SHALL include the `modelParameters` field with the provided values

#### Scenario: Partial model parameters are provided

- **WHEN** `onLLMStart()` is called with only some model parameters (e.g., only temperature)
- **THEN** the LangFuse `trace.generation()` call SHALL include only the provided parameters

#### Scenario: Model parameters are not provided

- **WHEN** `onLLMStart()` is called without model parameters
- **THEN** the LangFuse `trace.generation()` call SHALL NOT include the `modelParameters` field

### Requirement: LangFuse generation events SHALL include token usage

When an LLM generation event ends, the system SHALL send token usage data (promptTokens, completionTokens, totalTokens) to LangFuse if provided by the caller.

#### Scenario: Full token usage is provided

- **WHEN** `onLLMEnd()` is called with complete token usage data (promptTokens, completionTokens, totalTokens)
- **THEN** the LangFuse `generation.end()` call SHALL include the `usage` field with all token counts

#### Scenario: Partial token usage is provided

- **WHEN** `onLLMEnd()` is called with only some token usage fields (e.g., only totalTokens)
- **THEN** the LangFuse `generation.end()` call SHALL include only the provided token counts

#### Scenario: Token usage is not provided

- **WHEN** `onLLMEnd()` is called without token usage data
- **THEN** the LangFuse `generation.end()` call SHALL NOT include the `usage` field

### Requirement: Backward compatibility SHALL be maintained

Existing call sites that do not provide model metadata or token usage SHALL continue to work without modification.

#### Scenario: Existing call without metadata

- **WHEN** `onLLMStart(name, input, parentIds)` is called with only the original parameters
- **THEN** the function SHALL execute successfully and create a LangFuse generation event

#### Scenario: Existing call without token usage

- **WHEN** `onLLMEnd(returnIds, output)` is called with only the original parameters
- **THEN** the function SHALL execute successfully and end the LangFuse generation event
