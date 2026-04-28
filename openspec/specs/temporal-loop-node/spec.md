## Requirements

### Requirement: Loop node available in node drawer

The system SHALL provide a Loop node in the temporal workflow node drawer.

#### Scenario: Loop node displayed in drawer

-   WHEN user opens the Add Nodes drawer
-   THEN system displays "Loop" node with description "Loop back to a previous node"
-   AND node icon is IconRepeat with brown color (#795548)

### Requirement: Loop node configuration

The system SHALL provide configuration options for Loop nodes.

#### Scenario: Loop config dialog displays

-   WHEN user double-clicks a Loop node
-   THEN system opens config dialog with fields: label, loopToNodeId (dropdown), maxIterations

#### Scenario: Target dropdown shows only upstream nodes

-   GIVEN user is configuring a Loop node
-   WHEN user opens the target node dropdown
-   THEN system shows only nodes that are upstream of the Loop node
-   AND each option displays the node's label

#### Scenario: Default max iterations

-   WHEN user adds a new Loop node
-   THEN maxIterations defaults to 3

### Requirement: Loop node validation

The system SHALL validate Loop node configuration before save.

#### Scenario: Target node required

-   GIVEN user is saving workflow
-   AND a Loop node has no target selected
-   THEN system shows validation error "Loop target is required"

#### Scenario: Target must be upstream

-   GIVEN user is saving workflow
-   AND a Loop node target is not an upstream node
-   THEN system shows validation error "Loop target must be an upstream node"

### Requirement: Loop edge visualization

The system SHALL display loop edges with dashed line style.

#### Scenario: Edge to loop target is dashed

-   GIVEN a Loop node is connected to canvas
-   AND a target node is selected in config
-   WHEN the workflow renders
-   THEN the edge from Loop node to its target is displayed with dashed style (strokeDasharray="5,5")
-   AND edge color is brown (#795548)

### Requirement: Loop execution behavior

The system SHALL execute Loop nodes by redirecting to target node.

#### Scenario: Loop redirects execution

-   GIVEN workflow execution reaches a Loop node
-   AND current iteration < maxIterations
-   THEN system clears executed status for nodes in loop path
-   AND resumes execution from target node
-   AND increments iteration counter

#### Scenario: Loop exits on max iterations

-   GIVEN workflow execution reaches a Loop node
-   AND current iteration >= maxIterations
-   THEN system stops looping
-   AND sets exitReason to "max_iterations"
-   AND sets continueLoop to false

### Requirement: Loop preserves context

The system SHALL preserve workflow context across loop iterations.

#### Scenario: Context accumulates across iterations

-   GIVEN a workflow loops multiple times
-   THEN each iteration can access results from previous iterations via context
-   AND node outputs are overwritten with latest iteration values

### Requirement: Loop node output schema

The system SHALL provide output values from Loop node execution.

#### Scenario: Loop output contains iteration info

-   WHEN a Loop node executes
-   THEN output contains:
    -   `iteration`: Current iteration count (1-based)
    -   `loopedTo`: Target node ID
    -   `continueLoop`: Boolean indicating if loop continued
    -   `exitReason`: null or "max_iterations"
