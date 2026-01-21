# Custom RBAC Implementation - License Notice

## Apache License 2.0 - Custom Implementation

This folder contains a **custom, independently developed** Role-Based Access Control (RBAC) 
implementation for extending Flowise functionality in open-source deployments.

### Important Legal Notices

1. **Clean Room Development**: This code was developed using a "clean room" approach, 
   meaning it was built from scratch without referencing, copying, or deriving from 
   the FlowiseAI Enterprise RBAC implementation.

2. **No Enterprise Code**: This implementation does NOT use, import, or depend on any 
   code from the `/packages/server/src/enterprise/` folder or any other code covered 
   by the FlowiseAI Commercial License.

3. **Apache 2.0 Licensed**: All code in this folder is licensed under the Apache License 2.0,
   consistent with the Flowise open-source project.

4. **Independent Design**: The architecture, data models, and implementation patterns 
   in this folder were designed independently to provide RBAC functionality while 
   complying with the FlowiseAI licensing terms.

### Folder Structure

```
custom-rbac/
├── entities/           # Custom database entities (User, Organization, Workspace, Role, etc.)
├── interfaces/         # TypeScript interfaces and types
├── utils/              # Utility functions (validation, encryption, etc.)
├── middleware/         # Express middleware for permission checking
├── services/           # Business logic services
└── constants/          # Constants and error messages
```

### Compliance Guidelines

When extending this code:

- DO NOT import from `enterprise/` folders
- DO NOT copy patterns or code from enterprise implementations
- DO document any significant additions with Apache 2.0 headers
- DO keep this clean-room approach for all RBAC-related code

### Contact

For licensing questions, consult with legal counsel familiar with open-source licensing 
and the FlowiseAI Commercial License terms.

---
Copyright (c) 2024-2026 - Custom Implementation
Licensed under the Apache License, Version 2.0
