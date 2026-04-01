## NEW Requirements

### Requirement: Start node allows defining input variables

The system SHALL allow users to define input variables in the Start node configuration.

#### Scenario: Adding an input variable

-   **GIVEN** user is configuring a Start node
-   **WHEN** user clicks "Add Variable"
-   **THEN** system adds a new row with fields: name, type, required checkbox, default value

#### Scenario: Input variable types

-   **GIVEN** user is defining an input variable
-   **WHEN** user selects the type dropdown
-   **THEN** system provides options: string, number, boolean, object, array

#### Scenario: Required vs optional variables

-   **GIVEN** user has defined an input variable
-   **WHEN** user checks the "Required" checkbox
-   **THEN** system marks that variable as required for workflow execution

#### Scenario: Variable name validation

-   **GIVEN** user is entering a variable name
-   **WHEN** user types whitespace characters
-   **THEN** system automatically removes whitespace from the name

#### Scenario: Variable name uniqueness

-   **GIVEN** user has defined a variable named "applicantName"
-   **WHEN** user tries to add another variable with the same name
-   **THEN** system shows validation error indicating duplicate name

### Requirement: Template fields show autocomplete on {{ trigger

The system SHALL show an autocomplete dropdown when user types `{{` in template fields.

#### Scenario: Autocomplete trigger

-   **GIVEN** user is editing a template field (e.g., Question Template in AgentFlow Call)
-   **WHEN** user types `{{` at the end of the input
-   **THEN** system displays a dropdown popover with available variables

#### Scenario: Input variables in autocomplete

-   **GIVEN** Start node has inputVariables defined
-   **WHEN** autocomplete dropdown is shown
-   **THEN** system displays `input.{variableName}` entries for each defined variable

#### Scenario: Upstream node outputs in autocomplete

-   **GIVEN** current node has upstream nodes connected
-   **WHEN** autocomplete dropdown is shown
-   **THEN** system displays outputs from upstream nodes using friendly labels (e.g., `CreditAnalysis.text`)

#### Scenario: Selecting a variable

-   **GIVEN** autocomplete dropdown is open
-   **WHEN** user clicks on a variable entry
-   **THEN** system replaces the trailing `{{` with `{{selectedVariable}}`

#### Scenario: Autocomplete uses node label for display

-   **GIVEN** upstream node has label "Credit Analysis"
-   **WHEN** autocomplete dropdown is shown
-   **THEN** system displays variable as `CreditAnalysis.text` (whitespace removed)
-   **AND** system stores value as `{{temporalAgentFlowCall_xxx.text}}` (actual node ID)

#### Scenario: Autocomplete for AgentFlow Call question template

-   **GIVEN** user is configuring an AgentFlow Call node
-   **WHEN** user types `{{` in the Question Template field
-   **THEN** system shows autocomplete dropdown

#### Scenario: Autocomplete for Condition expression

-   **GIVEN** user is configuring a Condition node
-   **WHEN** user types `{{` in the Expression field
-   **THEN** system shows autocomplete dropdown

#### Scenario: Autocomplete for HTTP Request fields

-   **GIVEN** user is configuring an HTTP Request node
-   **WHEN** user types `{{` in URL, headers, or body fields
-   **THEN** system shows autocomplete dropdown

#### Scenario: Autocomplete for Human Task instructions

-   **GIVEN** user is configuring a Human Task node
-   **WHEN** user types `{{` in the Instructions field
-   **THEN** system shows autocomplete dropdown

### Requirement: Run Workflow dialog collects input values

The system SHALL display a Run Workflow dialog when running manual workflows with input variables.

#### Scenario: Dialog opens for manual workflow with variables

-   **GIVEN** workflow is in manual trigger mode
-   **AND** Start node has inputVariables defined
-   **WHEN** user clicks "Run" button
-   **THEN** system displays Run Workflow dialog with form fields

#### Scenario: Dialog skipped when no variables defined

-   **GIVEN** workflow is in manual trigger mode
-   **AND** Start node has no inputVariables defined
-   **WHEN** user clicks "Run" button
-   **THEN** system starts workflow immediately without dialog

#### Scenario: Form fields generated from variables

-   **GIVEN** Run Workflow dialog is open
-   **WHEN** dialog renders
-   **THEN** system displays a form field for each input variable

#### Scenario: Required field indicator

-   **GIVEN** input variable is marked as required
-   **WHEN** form field renders
-   **THEN** system displays asterisk (\*) next to field label

#### Scenario: Required field validation

-   **GIVEN** input variable is marked as required
-   **WHEN** user tries to run without providing value
-   **THEN** system shows validation error and prevents submission

#### Scenario: Type-specific number input

-   **GIVEN** input variable has type "number"
-   **WHEN** form field renders
-   **THEN** system displays number input field

#### Scenario: Type-specific boolean input

-   **GIVEN** input variable has type "boolean"
-   **WHEN** form field renders
-   **THEN** system displays checkbox or switch

#### Scenario: Default value placeholder

-   **GIVEN** input variable has defaultValue defined
-   **WHEN** form field renders
-   **THEN** system shows default value as placeholder or pre-filled value

#### Scenario: Dialog cancel

-   **GIVEN** Run Workflow dialog is open
-   **WHEN** user clicks "Cancel" button
-   **THEN** system closes dialog without starting workflow

#### Scenario: Dialog run

-   **GIVEN** Run Workflow dialog is open
-   **AND** all required fields have values
-   **WHEN** user clicks "Run" button
-   **THEN** system starts workflow with provided input values

### Requirement: Runtime validates input against schema

The system SHALL validate workflow input at runtime against the defined schema.

#### Scenario: Missing required input

-   **GIVEN** workflow has required input variable "applicantName"
-   **WHEN** workflow starts without applicantName in input
-   **THEN** system fails workflow with error "Missing required input: applicantName"

#### Scenario: Type coercion for numbers

-   **GIVEN** input variable has type "number"
-   **AND** input value is string "50000"
-   **WHEN** workflow starts
-   **THEN** system coerces value to number 50000

#### Scenario: Type coercion for booleans

-   **GIVEN** input variable has type "boolean"
-   **AND** input value is string "true"
-   **WHEN** workflow starts
-   **THEN** system coerces value to boolean true

#### Scenario: Type validation failure for number

-   **GIVEN** input variable has type "number"
-   **AND** input value is string "fifty"
-   **WHEN** workflow starts
-   **THEN** system fails workflow with error "{name} must be a number"

#### Scenario: Default value applied

-   **GIVEN** input variable has defaultValue "Personal"
-   **AND** input does not include that variable
-   **WHEN** workflow starts
-   **THEN** system uses default value "Personal"

#### Scenario: Optional variable not provided

-   **GIVEN** input variable is not required
-   **AND** input does not include that variable
-   **AND** no defaultValue is defined
-   **WHEN** workflow starts
-   **THEN** system continues without error (variable is undefined in context)

#### Scenario: Multiple validation errors

-   **GIVEN** workflow has multiple input variables
-   **AND** multiple validation errors occur
-   **WHEN** workflow starts
-   **THEN** system fails with all errors listed in the error message

#### Scenario: JSON object coercion

-   **GIVEN** input variable has type "object"
-   **AND** input value is string '{"key": "value"}'
-   **WHEN** workflow starts
-   **THEN** system parses string to object {key: "value"}

#### Scenario: JSON array coercion

-   **GIVEN** input variable has type "array"
-   **AND** input value is string '[1, 2, 3]'
-   **WHEN** workflow starts
-   **THEN** system parses string to array [1, 2, 3]
