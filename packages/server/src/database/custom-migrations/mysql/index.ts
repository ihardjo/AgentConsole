import { AddPlatformAssetEntity1760000000001 } from './1760000000001-AddPlatformAssetEntity'
import { AddChatFlowMetadataEntity1760000000002 } from './1760000000002-AddChatFlowMetadataEntity'
import { AddChatFlowVersionEntity1760000000003 } from './1760000000003-AddChatFlowVersionEntity'
import { MakeVersionStandalone1760000000004 } from './1760000000004-MakeVersionStandalone'
import { RemoveVersionForeignKey1760000000005 } from './1760000000005-RemoveVersionForeignKey'
import { AddVersionConfigColumns1760000000006 } from './1760000000006-AddVersionConfigColumns'
import { AddWorkspaceIdToVersion1760000000007 } from './1760000000007-AddWorkspaceIdToVersion'
import { AddDedicatedQueueToWorkspace1760000000008 } from './1760000000008-AddDedicatedQueueToWorkspace'

export const mysqlCustomMigrations = [
    AddPlatformAssetEntity1760000000001,
    AddChatFlowMetadataEntity1760000000002,
    AddChatFlowVersionEntity1760000000003,
    MakeVersionStandalone1760000000004,
    RemoveVersionForeignKey1760000000005,
    AddVersionConfigColumns1760000000006,
    AddWorkspaceIdToVersion1760000000007,
    AddDedicatedQueueToWorkspace1760000000008
]
