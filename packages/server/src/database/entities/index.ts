import { ChatFlow } from './ChatFlow'
import { ChatFlowMetadata } from './ChatFlowMetadata'
import { ChatFlowVersion } from './ChatFlowVersion'
import { ChatMessage } from './ChatMessage'
import { ChatMessageFeedback } from './ChatMessageFeedback'
import { Credential } from './Credential'
import { Tool } from './Tool'
import { Assistant } from './Assistant'
import { Variable } from './Variable'
import { DocumentStore } from './DocumentStore'
import { DocumentStoreFileChunk } from './DocumentStoreFileChunk'
import { Lead } from './Lead'
import { UpsertHistory } from './UpsertHistory'
import { Dataset } from './Dataset'
import { DatasetRow } from './DatasetRow'
import { EvaluationRun } from './EvaluationRun'
import { Evaluation } from './Evaluation'
import { Evaluator } from './Evaluator'
import { ApiKey } from './ApiKey'
import { CustomTemplate } from './CustomTemplate'
import { Execution } from './Execution'
// Enterprise entities still needed for specific features
import { LoginActivity, WorkspaceShared, WorkspaceUsers } from '../../enterprise/database/entities/EnterpriseEntities'
import { LoginSession } from '../../enterprise/database/entities/login-session.entity'
// Custom-rbac entities (primary implementation)
import { User } from '../../custom-rbac/entities/user.entity'
import { Organization } from '../../custom-rbac/entities/organization.entity'
import { Role } from '../../custom-rbac/entities/role.entity'
import { OrganizationUser } from '../../custom-rbac/entities/organization-user.entity'
import { Workspace } from '../../custom-rbac/entities/workspace.entity'
import { WorkspaceUser } from '../../custom-rbac/entities/workspace-user.entity'
import { LoginMethod } from '../../custom-rbac/entities/login-method.entity'
import { PlatformAsset } from '../../custom-rbac/entities/platform-asset.entity'

export const entities = {
    ChatFlow,
    ChatFlowMetadata,
    ChatFlowVersion,
    ChatMessage,
    ChatMessageFeedback,
    Credential,
    Tool,
    Assistant,
    Variable,
    UpsertHistory,
    DocumentStore,
    DocumentStoreFileChunk,
    Lead,
    Dataset,
    DatasetRow,
    Evaluation,
    EvaluationRun,
    Evaluator,
    ApiKey,
    CustomTemplate,
    Execution,
    // Enterprise-specific entities
    LoginActivity,
    LoginSession,
    WorkspaceUsers,
    WorkspaceShared,
    // Custom-rbac entities (primary)
    User,
    Organization,
    Role,
    OrganizationUser,
    Workspace,
    WorkspaceUser,
    LoginMethod,
    PlatformAsset
}
