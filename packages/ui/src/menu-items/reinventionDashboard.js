// assets
import {
    IconHierarchy,
    IconUsersGroup,
    IconRobot,
    IconTool,
    IconLock,
    IconVariable,
    IconFiles,
    IconBuildingStore,
    IconCloudCog,
    IconSettings,
    IconStack2,
    IconUsers,
    IconKey,
    IconNetwork,
    IconPlug,
    IconChartBar,
    IconShieldCheck,
    IconArrowsExchange,
    IconListCheck,
    IconGitBranch,
    IconActivity,
    IconBrain,
    IconBulb
} from '@tabler/icons-react'

// constant
const icons = {
    IconHierarchy,
    IconUsersGroup,
    IconRobot,
    IconTool,
    IconLock,
    IconVariable,
    IconFiles,
    IconBuildingStore,
    IconCloudCog,
    IconSettings,
    IconStack2,
    IconUsers,
    IconKey,
    IconNetwork,
    IconPlug,
    IconChartBar,
    IconShieldCheck,
    IconArrowsExchange,
    IconListCheck,
    IconGitBranch,
    IconActivity,
    IconBrain,
    IconBulb
}

// ==============================|| REINVENTION DASHBOARD MENU ITEMS ||============================== //

const reinventionDashboard = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        // Empty primary group — required by NavGroup's renderPrimaryItems()
        {
            id: 'primary',
            title: '',
            type: 'group',
            children: []
        },

        // 1. PROCESS STUDIO
        {
            id: 'process-studio',
            title: 'Process Studio',
            type: 'group',
            children: [
                {
                    id: 'reinvention-processes',
                    title: 'Reinvention Processes',
                    type: 'item',
                    url: '/temporalflows',
                    icon: icons.IconHierarchy,
                    breadcrumbs: true,
                    permission: 'temporalflows:view',
                    alwaysShow: true
                },
                {
                    id: 'deployments',
                    title: 'Deployments',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconArrowsExchange,
                    breadcrumbs: true,
                    alwaysShow: true
                },
                {
                    id: 'process-intelligence',
                    title: 'Process Intelligence',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconBulb,
                    breadcrumbs: true,
                    alwaysShow: true
                }
            ]
        },

        // 2. AGENT STUDIO
        {
            id: 'agent-studio',
            title: 'Agent Studio',
            type: 'group',
            children: [
                {
                    id: 'agentflows',
                    title: 'Agent Flows',
                    type: 'item',
                    url: '/agentflows',
                    icon: icons.IconUsersGroup,
                    breadcrumbs: true,
                    permission: 'agentflows:view'
                },
                {
                    id: 'executions',
                    title: 'Executions',
                    type: 'item',
                    url: '/executions',
                    icon: icons.IconListCheck,
                    breadcrumbs: true,
                    permission: 'executions:view'
                },
                {
                    id: 'assistants',
                    title: 'Assistants',
                    type: 'item',
                    url: '/assistants',
                    icon: icons.IconRobot,
                    breadcrumbs: true,
                    permission: 'assistants:view'
                },
                {
                    id: 'tools',
                    title: 'Tools',
                    type: 'item',
                    url: '/tools',
                    icon: icons.IconTool,
                    breadcrumbs: true,
                    permission: 'tools:view'
                },
                {
                    id: 'credentials',
                    title: 'Credentials',
                    type: 'item',
                    url: '/credentials',
                    icon: icons.IconLock,
                    breadcrumbs: true,
                    permission: 'credentials:view'
                },
                {
                    id: 'variables',
                    title: 'Variables',
                    type: 'item',
                    url: '/variables',
                    icon: icons.IconVariable,
                    breadcrumbs: true,
                    permission: 'variables:view'
                },
                {
                    id: 'versions-promotion',
                    title: 'Versions & Promotion',
                    type: 'item',
                    url: '/agentops',
                    icon: icons.IconGitBranch,
                    breadcrumbs: true,
                    permission: 'agentops:view'
                }
            ]
        },

        // 3. KNOWLEDGE
        {
            id: 'knowledge',
            title: 'Knowledge',
            type: 'group',
            children: [
                {
                    id: 'document-stores',
                    title: 'Document Stores',
                    type: 'item',
                    url: '/document-stores',
                    icon: icons.IconFiles,
                    breadcrumbs: true,
                    permission: 'documentStores:view'
                },
                {
                    id: 'knowledge-graph',
                    title: 'Knowledge Graph',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconNetwork,
                    breadcrumbs: true,
                    alwaysShow: true
                },
                {
                    id: 'connectors',
                    title: 'Connectors',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconPlug,
                    breadcrumbs: true,
                    alwaysShow: true
                }
            ]
        },

        // 4. OBSERVABILITY
        {
            id: 'observability',
            title: 'Observability',
            type: 'group',
            children: [
                {
                    id: 'process-performance',
                    title: 'Process Performance',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconActivity,
                    breadcrumbs: true,
                    alwaysShow: true
                },
                {
                    id: 'agentPerformance',
                    title: 'Agent Performance',
                    type: 'item',
                    url: '/coming-soon',
                    icon: icons.IconBrain,
                    breadcrumbs: true,
                    alwaysShow: true,
                    dynamicUrl: true,
                    external: true,
                    target: true
                }
            ]
        },

        // 5. MARKETPLACE
        {
            id: 'marketplace',
            title: 'Marketplace',
            type: 'group',
            children: [
                {
                    id: 'marketplaces',
                    title: 'Marketplace',
                    type: 'item',
                    url: '/marketplaces',
                    icon: icons.IconBuildingStore,
                    breadcrumbs: true,
                    permission: 'templates:marketplace,templates:custom'
                }
            ]
        },

        // 6. PLATFORM
        {
            id: 'platform',
            title: 'Platform',
            type: 'group',
            children: [
                {
                    id: 'user-role-management',
                    title: 'Users & Roles',
                    type: 'item',
                    url: '/user-role-management',
                    icon: icons.IconUsers,
                    breadcrumbs: true,
                    permission: 'users:manage,roles:manage'
                },
                {
                    id: 'workspace-management',
                    title: 'Workspaces',
                    type: 'item',
                    url: '/workspace-management',
                    icon: icons.IconStack2,
                    breadcrumbs: true,
                    permission: 'workspace:view'
                },
                {
                    id: 'apikey',
                    title: 'API Keys',
                    type: 'item',
                    url: '/apikey',
                    icon: icons.IconKey,
                    breadcrumbs: true,
                    permission: 'apikeys:view'
                },
                {
                    id: 'workerConfiguration',
                    title: 'Worker Configuration',
                    type: 'item',
                    url: '/worker-configuration',
                    icon: icons.IconCloudCog,
                    breadcrumbs: true,
                    permission: 'worker:view'
                },
                {
                    id: 'platform-configuration',
                    title: 'Platform Settings',
                    type: 'item',
                    url: '/platform-configuration',
                    icon: icons.IconSettings,
                    breadcrumbs: true,
                    permission: 'platformConfiguration:manage'
                }
            ]
        }
    ]
}

export default reinventionDashboard
