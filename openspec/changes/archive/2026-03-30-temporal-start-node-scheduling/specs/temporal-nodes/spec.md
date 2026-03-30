## MODIFIED Requirements

### Requirement: Start node defines workflow entry point

The system SHALL provide a Start node type that defines the workflow entry point, accepts input variables, and configures the trigger mode (manual or scheduled).

#### Scenario: Start node is placed on canvas

- **WHEN** user drags a Start node onto the canvas
- **THEN** system displays a Start node with an output anchor and a configuration panel for defining trigger mode, schedule settings, and input variables

#### Scenario: Start node configuration with manual trigger

- **WHEN** user configures the Start node with `triggerMode: 'manual'`
- **THEN** system stores the configuration and the workflow runs on-demand when the user clicks Run

#### Scenario: Start node configuration with scheduled trigger

- **WHEN** user configures the Start node with `triggerMode: 'scheduled'`, `scheduleInterval: '10m'`, `overlapPolicy: 'SKIP'`
- **THEN** system stores the schedule configuration in the node data and creates a Temporal Schedule when the user clicks Run

#### Scenario: Start node displays trigger mode

- **WHEN** Start node is rendered on canvas
- **THEN** system displays the trigger mode badge (e.g., "Manual" or "Every 10m") on the node

#### Scenario: Start node input variables

- **WHEN** user configures the Start node with input variable names
- **THEN** system stores the variable names and makes them available for templating in downstream nodes
