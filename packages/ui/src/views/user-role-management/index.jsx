import { useState, useRef } from 'react'

// material-ui
import { Box, Stack, Tab, Tabs } from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'

// sub-views
import UserManagement from './users'
import RoleManagement from './roles'

// hooks
import { useAuth } from '@/hooks/useAuth'

// icons
import { IconPlus } from '@tabler/icons-react'

// ==============================|| User & Role Management ||============================== //

const UserRoleManagement = () => {
    const { hasPermission } = useAuth()

    const canManageUsers = hasPermission('users:manage')
    const canManageRoles = hasPermission('roles:manage')

    const defaultTab = canManageUsers ? 0 : 1
    const [activeTab, setActiveTab] = useState(defaultTab)
    const [search, setSearch] = useState('')
    const addHandlerRef = useRef(null)

    const isUsersTab = canManageUsers && activeTab === 0
    const searchPlaceholder = isUsersTab ? 'Search Users' : 'Search Roles'
    const actionPermission = isUsersTab ? 'workspace:add-user,users:manage' : 'roles:manage'
    const actionLabel = isUsersTab ? 'Invite User' : 'Add Role'
    const actionId = isUsersTab ? 'btn_createUser' : 'btn_createRole'

    const handleTabChange = (_, newValue) => {
        setActiveTab(newValue)
        setSearch('')
    }

    const handleSearchChange = (e) => {
        setSearch(e.target.value)
    }

    const handleActionClick = () => {
        if (addHandlerRef.current) addHandlerRef.current()
    }

    const registerAdd = (fn) => {
        addHandlerRef.current = fn
    }

    return (
        <MainCard>
            <Stack flexDirection='column' sx={{ gap: 3 }}>
                <ViewHeader
                    title='Users & Roles'
                    description='Manage workspace members and their permission roles'
                    search={true}
                    searchPlaceholder={searchPlaceholder}
                    onSearchChange={handleSearchChange}
                    searchValue={search}
                >
                    <StyledPermissionButton
                        permissionId={actionPermission}
                        variant='contained'
                        sx={{ borderRadius: 2, height: '100%' }}
                        onClick={handleActionClick}
                        startIcon={<IconPlus />}
                        id={actionId}
                    >
                        {actionLabel}
                    </StyledPermissionButton>
                </ViewHeader>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: -2 }}>
                    <Tabs value={activeTab} onChange={handleTabChange} aria-label='Users and Roles tabs'>
                        {canManageUsers && <Tab label='Users' id='tab-users' aria-controls='tabpanel-users' />}
                        {canManageRoles && (
                            <Tab label='Roles' id='tab-roles' aria-controls='tabpanel-roles' value={canManageUsers ? 1 : 0} />
                        )}
                    </Tabs>
                </Box>

                {canManageUsers && activeTab === 0 && (
                    <Box role='tabpanel' id='tabpanel-users' aria-labelledby='tab-users'>
                        <UserManagement search={search} onAdd={registerAdd} />
                    </Box>
                )}

                {canManageRoles && activeTab === (canManageUsers ? 1 : 0) && (
                    <Box role='tabpanel' id='tabpanel-roles' aria-labelledby='tab-roles'>
                        <RoleManagement search={search} onAdd={registerAdd} />
                    </Box>
                )}
            </Stack>
        </MainCard>
    )
}

export default UserRoleManagement
