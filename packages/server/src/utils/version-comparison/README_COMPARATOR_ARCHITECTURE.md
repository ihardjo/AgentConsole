# Version Comparison Architecture

## Overview

The Version Comparison module uses a **Strategy + Factory + Template Method** pattern to
provide modular, extensible, and DRY comparison logic for different node types in the
Agent Flow system. It supports both single-node comparison and multi-node flow-level
comparison.

## Architecture Diagram

```
                        ┌──────────────────────────────────────────┐
                        │       NodeComparatorFactory              │
                        │  (Factory + Orchestrator — static API)   │
                        │                                          │
                        │  compareVersions(A, B, nodeType)         │
                        │  compareFlows(nodesA, nodesB)            │
                        │  registerComparator(type, impl)          │
                        │  getRegisteredTypes()                    │
                        └────────────┬─────────────────────────────┘
                                     │ getComparator(nodeType)
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────────┐
   │ AgentNodeComp.   │ │ LLMNodeComp.     │ │ ConditionAgentNodeComp. │
   │ (Agent-specific  │ │ (LLM-specific    │ │ (ConditionAgent-specific│
   │  tools, knowledge│ │  — delegates all │ │  scenarios, custom msgs │
   │  getModelLabel)  │ │  to base helpers)│ │  + compare() override)  │
   └────────┬─────────┘ └────────┬─────────┘ └───────────┬─────────────┘
            │                    │                        │
            └────────────────────┼────────────────────────┘
                                 ▼
              ┌──────────────────────────────────────────┐
              │      BaseNodeComparator (Abstract)       │
              │                                          │
              │  compare()             — template method │
              │  isDifferent()         — deep comparison │
              │  addChange()           — register change │
              │                                          │
              │  ── Reusable building blocks ──          │
              │  compareModelConfig()                    │
              │  compareRoleMessages()                   │
              │  compareMemoryFields()                   │
              │  compareStructuredOutput()               │
              │  compareKeyValueState()                  │
              │  compareScalarField()                    │
              │  normaliseArray()                        │
              │  normaliseMultiOption()                  │
              │                                          │
              │  ── Abstract (7 categories) ──           │
              │  compareModel()                          │
              │  compareMessages()                       │
              │  compareTools()                          │
              │  compareKnowledge()                      │
              │  compareMemory()                         │
              │  compareOutput()                         │
              │  compareState()                          │
              └──────────────────────────────────────────┘
```

## Key Components

### 1. BaseNodeComparator (Abstract Base Class)

The heart of the architecture. Provides:

- **Template method** `compare()` — orchestrates the 7 abstract category methods.
- **Reusable protected helpers** for common comparison patterns so concrete
  comparators stay DRY:
  | Helper | What it compares |
  |--------|------------------|
  | `compareModelConfig()` | Model provider field + 11 config sub-fields (temperature, modelName, etc.) |
  | `compareRoleMessages()` | Per-role messages (system/developer/assistant/user) + count + user-message template |
  | `compareMemoryFields()` | 4 memory fields (enable, type, windowSize, maxTokenLimit) |
  | `compareStructuredOutput()` | Return-as selector + structured output schema array with per-field diffing |
  | `compareKeyValueState()` | Key/value state array with added/removed/modified detection |
  | `compareScalarField()` | Any single scalar input field |
- **Normalisation helpers** — `normaliseArray()`, `normaliseMultiOption()`.
- **Deep comparison** via `isDifferent()` — handles `undefined`, `null`, `''`, `[]` as
  equivalent "not set" values; uses `JSON.stringify` for objects.
- **Shared field descriptors** — `MODEL_CONFIG_FIELDS`, `MESSAGE_ROLES` exported as
  constants so new comparators can reuse or extend them.

### 2. AgentNodeComparator

Comparator for **Agent** nodes (`agentAgentflow`). All 16 Agent input groups are covered.

- **Model / Messages / Memory / Output / State** — single-line delegation to base helpers
  (e.g. `this.compareModelConfig(versionA, versionB, 'agentModel', 'agentModelConfig', 'Agent')`).
- **Tools** — Agent-specific: custom tools (name + humanInput flag), 3 built-in tool
  sets (OpenAI, Gemini, Anthropic).
- **Knowledge** — Agent-specific: document stores + vector embeddings with per-field diff.
- **Private helpers** — `extractTools()`, `storeLabel()`, `getModelLabel()`.

### 3. LLMNodeComparator

Comparator for **LLM** nodes (`llmAgentflow`). Extremely concise (~65 lines) because all
shared patterns are delegated to the base class.

- Model / Messages / Memory / Output / State — one-line delegation each.
- Tools / Knowledge — intentional no-ops (LLM nodes don't have these).

### 4. ConditionAgentNodeComparator

Comparator for **ConditionAgent** nodes (`conditionAgentAgentflow`).

- **Model** — delegated to `compareModelConfig()`.
- **Messages** — unique fields (instructions, input template, system prompt override)
  via `compareScalarField()`.
- **Scenarios** — custom `compareScenarios()` method detecting count changes,
  additions, removals, and content edits per scenario index.
- **`compare()` override** — calls `super.compare()` then `compareScenarios()`.
- Tools / Knowledge / Memory / Output / State — intentional no-ops.

### 5. NodeComparatorFactory

Static factory + orchestrator. Main public API:

- `compareVersions(A, B, nodeType)` — single-node property-level comparison.
- `compareFlows(nodesA, nodesB)` — multi-node flow comparison:
  - Matches nodes by `id`
  - Detects added / removed / modified / unchanged nodes
  - Runs property-level diff for registered node types
  - Falls back to shallow JSON comparison for unknown types
  - Sorts results: modified → added → removed → unchanged
- `registerComparator()` — runtime extension point.
- `getRegisteredTypes()` — lists all registered node types.

## Enums

Defined in `types.ts`:

| Enum | Values |
|------|--------|
| `ImpactLevel` | `Breaking`, `Major`, `Minor`, `Patch` |
| `ChangeType` | `Added`, `Removed`, `Modified` |
| `ChangeCategory` | `Model`, `Messages`, `Tools`, `Knowledge`, `Memory`, `Output`, `State`, `Scenarios` |

## Comparison Categories

| Category | Description | Impact Levels |
|----------|-------------|---------------|
| Model | AI model provider + config (temperature, tokens, etc.) | Major, Minor, Patch |
| Messages | System/developer/assistant/user prompts, message templates | Major, Minor |
| Tools | Custom tools, built-in tool sets | Breaking (removed), Minor (added) |
| Knowledge | Document stores, vector embeddings | Breaking (removed), Major (added/modified) |
| Memory | Enable, type, window size, max token limit | Major, Minor |
| Output | Response format, structured output schema | Major, Breaking (field removed) |
| State | Key/value state update configuration | Major |
| Scenarios | Branching conditions (ConditionAgent only) | Breaking (count change), Major (text change) |

## Adding a New Node Type

### Step 1: Create comparator class

```typescript
// comparators/MyNodeComparator.ts
import { BaseNodeComparator } from '../BaseNodeComparator'
import { ICommonObject } from '../types'

export class MyNodeComparator extends BaseNodeComparator {
    compareModel(vA: ICommonObject, vB: ICommonObject): void {
        // Use base helpers where applicable:
        this.compareModelConfig(vA, vB, 'myModel', 'myModelConfig', 'My Node')
    }

    compareMessages(vA: ICommonObject, vB: ICommonObject): void {
        this.compareRoleMessages(vA, vB, 'myMessages', 'myUserMessage')
    }

    // Implement remaining abstract methods (no-op if not applicable):
    compareTools(_vA: ICommonObject, _vB: ICommonObject): void {}
    compareKnowledge(_vA: ICommonObject, _vB: ICommonObject): void {}

    compareMemory(vA: ICommonObject, vB: ICommonObject): void {
        this.compareMemoryFields(vA, vB, 'my')
    }

    compareOutput(vA: ICommonObject, vB: ICommonObject): void {
        this.compareStructuredOutput(vA, vB, 'myStructuredOutput', 'myReturnResponseAs')
    }

    compareState(vA: ICommonObject, vB: ICommonObject): void {
        this.compareKeyValueState(vA, vB, 'myUpdateState')
    }
}
```

### Step 2: Export from `comparators/index.ts`

```typescript
export { MyNodeComparator } from './MyNodeComparator'
```

### Step 3: Register in `NodeComparatorFactory`

```typescript
private static comparators = new Map([
    ['Agent', new AgentNodeComparator()],
    ['LLM', new LLMNodeComparator()],
    ['ConditionAgent', new ConditionAgentNodeComparator()],
    ['MyNode', new MyNodeComparator()],  // ← add here
])
```

### Step 4: (Optional) Add UI category config

In `CompareVersionsDialog.jsx`, add any new categories to `CATEGORY_CONFIG`:

```jsx
const CATEGORY_CONFIG = {
    // ...existing...
    myCustomCategory: { label: 'My Category', icon: '🎯' }
}
```

## File Structure

```
version-comparison/
├── index.ts                    # Barrel exports (types, enums, classes)
├── types.ts                    # IVersionChange, IVersionComparison, IFlowComparison, enums
├── BaseNodeComparator.ts       # Abstract base + reusable helpers + field descriptors
├── NodeComparatorFactory.ts    # Factory + compareVersions + compareFlows
├── README_COMPARATOR_ARCHITECTURE.md
└── comparators/
    ├── index.ts                # Re-exports all comparators
    ├── AgentNodeComparator.ts  # Agent-specific (tools, knowledge)
    ├── LLMNodeComparator.ts    # LLM-specific (concise delegation)
    └── ConditionAgentNodeComparator.ts  # ConditionAgent-specific (scenarios)
```

## Usage

```typescript
import { NodeComparatorFactory } from './version-comparison'

// Single-node comparison
const result = NodeComparatorFactory.compareVersions(nodeDataA, nodeDataB, 'Agent')

// Multi-node flow comparison
const flowResult = NodeComparatorFactory.compareFlows(nodesA, nodesB)
```

## Design Patterns

1. **Strategy Pattern** — Different comparison strategies per node type.
2. **Factory Pattern** — `NodeComparatorFactory` creates/manages comparator instances.
3. **Template Method** — `BaseNodeComparator.compare()` defines the algorithm skeleton;
   subclasses fill in details.
4. **Open/Closed Principle** — New node types added without modifying existing code.
