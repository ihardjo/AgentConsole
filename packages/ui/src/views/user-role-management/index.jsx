import { useState } from 'react'

// material-ui
import { Box, Tab, Tabs } from '@mui/material'

// sub-views
import UserManagement from './users'
import RoleManagement from './roles'

// hooks
import { useAuth } from '@/hooks/useAuth'

// ==============================|| User & Role Management ||============================== //

const UserRoleManagement = () => {
    const { hasPermission } = useAuth()

    const canManageUsers = hasPermission('users:manage')
    const canManageRoles = hasPermission('roles:manage')

    // Default to Users tab if permitted, otherwise fall back to Roles
    const defaultTab = canManageUsers ? 0 : 1
    const [activeTab, setActiveTab] = useState(defaultTab)

    const handleTabChange = (_, newValue) => {
        setActiveTab(newValue)
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label='Users and Roles tabs'>
                    {canManageUsers && <Tab label='Users' id='tab-users' aria-controls='tabpanel-users' />}
                    {canManageRoles && <Tab label='Roles' id='tab-roles' aria-controls='tabpanel-roles' value={canManageUsers ? 1 : 0} />}
                </Tabs>
            </Box>

            {canManageUsers && activeTab === 0 && (
                <Box role='tabpanel' id='tabpanel-users' aria-labelledby='tab-users'>
                    <UserManagement />
                </Box>
            )}

            {canManageRoles && activeTab === (canManageUsers ? 1 : 0) && (
                <Box role='tabpanel' id='tabpanel-roles' aria-labelledby='tab-roles'>
                    <RoleManagement />
                </Box>
            )}
        </Box>
    )
}

export default UserRoleManagement
