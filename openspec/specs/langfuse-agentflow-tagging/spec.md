## ADDED Requirements

### Requirement: LangFuse traces SHALL include agentflow name as trace name

When a LangFuse trace is created for an agentflow, the system SHALL use the agentflow name as the trace name for identification.

#### Scenario: Agentflow name is provided

- **WHEN** `onChainStart()` is called and `agentflowName` is available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL set the `name` field to the agentflow name value

#### Scenario: Agentflow name is not provided

- **WHEN** `onChainStart()` is called and `agentflowName` is not available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL set the `name` field to "Agentflow" as fallback

### Requirement: LangFuse traces SHALL include agentflow ID tag

When a LangFuse trace is created for an agentflow, the system SHALL include a tag with the agentflow ID for filtering.

#### Scenario: Agentflow ID is provided

- **WHEN** `onChainStart()` is called and `agentflowId` is available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL include `agentflow-id:<id>` in the `tags` array

#### Scenario: Agentflow ID is not provided

- **WHEN** `onChainStart()` is called and `agentflowId` is not available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL NOT include an agentflow ID tag

### Requirement: LangFuse traces SHALL include agentflow name tag

When a LangFuse trace is created for an agentflow, the system SHALL include the agentflow name as a tag for human-readable filtering.

#### Scenario: Agentflow name is provided

- **WHEN** `onChainStart()` is called and `agentflowName` is available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL include the agentflow name value in the `tags` array

#### Scenario: Agentflow name is not provided

- **WHEN** `onChainStart()` is called and `agentflowName` is not available in handler options
- **THEN** the LangFuse `langfuse.trace()` call SHALL NOT include an agentflow name tag

### Requirement: LangFuse traces SHALL include agentflow metadata

When a LangFuse trace is created for an agentflow, the system SHALL include agentflow details in the metadata object.

#### Scenario: Both agentflow ID and name are provided

- **WHEN** `onChainStart()` is called and both `agentflowId` and `agentflowName` are available
- **THEN** the LangFuse `langfuse.trace()` call SHALL include a `metadata` object with `agentflowId` and `agentflowName` fields

#### Scenario: Only agentflow ID is provided

- **WHEN** `onChainStart()` is called and only `agentflowId` is available
- **THEN** the LangFuse `langfuse.trace()` call SHALL include a `metadata` object with only the `agentflowId` field

#### Scenario: No agentflow info is provided

- **WHEN** `onChainStart()` is called and neither `agentflowId` nor `agentflowName` is available
- **THEN** the LangFuse `langfuse.trace()` call SHALL NOT include agentflow fields in metadata

### Requirement: Existing analytics functionality SHALL be preserved

The addition of agentflow tagging SHALL NOT break existing LangFuse analytics functionality.

#### Scenario: Existing trace with sessionId

- **WHEN** `onChainStart()` is called with `chatId` in options
- **THEN** the LangFuse trace SHALL continue to include `sessionId` set to `chatId`

#### Scenario: Existing trace with custom analytics config

- **WHEN** `onChainStart()` is called with `nodeData.inputs.analytics.langFuse` override config
- **THEN** the LangFuse trace SHALL merge the override config with the agentflow tags and metadata
