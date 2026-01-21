import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import {
    Breadcrumbs,
    Menu,
    MenuItem,
    Dialog,
    DialogContent,
    CircularProgress,
    Typography,
    Stack,
    Chip,
    ListItemText,
    ListItemIcon,
    Select
} from '@mui/material'
import { Check } from '@mui/icons-material'
import { alpha, styled, emphasize } from '@mui/material/styles'

import { IconChevronDown } from '@tabler/icons-react'

// api
import userApi from '@/api/userManagement'
import workspaceApi from '@/api/workspaceManagement'

// hooks
import useApi from '@/hooks/useApi'

// store
import { store } from '@/store'
import { workspaceSwitchSuccess } from '@/store/reducers/authSlice'

// ==============================|| OPEN SOURCE ORG WORKSPACE BREADCRUMBS ||============================== //

const StyledMenu = styled((props) => (
    <Menu
        elevation={0}
        anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
        }}
        transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
        }}
        {...props}
    />
))(({ theme }) => ({
    '& .MuiPaper-root': {
        borderRadius: 6,
        marginTop: theme.spacing(1),
        minWidth: 180,
        boxShadow:
            'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
        '& .MuiMenu-list': {
            padding: '4px 0'
        },
        '& .MuiMenuItem-root': {
            '& .MuiSvgIcon-root': {
                fontSize: 18,
                color: theme.palette.text.secondary,
                marginRight: theme.spacing(1.5)
            },
            '&:active': {
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            }
        }
    }
}))

const StyledBreadcrumb = styled(Chip)(({ theme, isDarkMode }) => {
    const backgroundColor = isDarkMode ? theme.palette.grey[800] : theme.palette.grey[100]
    return {
        backgroundColor,
        height: theme.spacing(3),
        color: theme.palette.text.primary,
        fontWeight: theme.typography.fontWeightRegular,
        '&:hover, &:focus': {
            backgroundColor: emphasize(backgroundColor, 0.06)
        },
        '&:active': {
            boxShadow: theme.shadows[1],
            backgroundColor: emphasize(backgroundColor, 0.12)
        }
    }
})

const OpenSourceOrgWorkspaceBreadcrumbs = () => {
    const navigate = useNavigate()

    const user = useSelector((state) => state.auth.user)
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const customization = useSelector((state) => state.customization)

    const [workspaceAnchorEl, setWorkspaceAnchorEl] = useState(null)
    const workspaceMenuOpen = Boolean(workspaceAnchorEl)

    const [assignedWorkspaces, setAssignedWorkspaces] = useState([])
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(undefined)
    const [activeOrganizationId, setActiveOrganizationId] = useState(undefined)
    const [organizationName, setOrganizationName] = useState('Organization')
    const [isWorkspaceSwitching, setIsWorkspaceSwitching] = useState(false)
    const [showWorkspaceUnavailableDialog, setShowWorkspaceUnavailableDialog] = useState(false)

    const getWorkspacesByOrganizationIdUserIdApi = useApi(userApi.getWorkspacesByOrganizationIdUserId)
    const switchWorkspaceApi = useApi(workspaceApi.switchWorkspace)

    const handleWorkspaceClick = (event) => {
        setWorkspaceAnchorEl(event.currentTarget)
    }

    const handleWorkspaceClose = () => {
        setWorkspaceAnchorEl(null)
    }

    const switchWorkspace = async (id) => {
        setWorkspaceAnchorEl(null)
        if (activeWorkspaceId !== id) {
            setIsWorkspaceSwitching(true)
            switchWorkspaceApi.request(id)
        }
    }

    useEffect(() => {
        // Fetch workspaces when component mounts
        if (isAuthenticated && user && user.activeOrganizationId) {
            getWorkspacesByOrganizationIdUserIdApi.request(user.activeOrganizationId, user.id)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, user])

    useEffect(() => {
        if (getWorkspacesByOrganizationIdUserIdApi.data) {
            const formattedAssignedWorkspaces = getWorkspacesByOrganizationIdUserIdApi.data.map((item) => ({
                id: item.workspaceId,
                name: item.workspace.name
            }))

            const sortedWorkspaces = [...formattedAssignedWorkspaces].sort((a, b) => a.name.localeCompare(b.name))

            // Get organization name from the first workspace (all workspaces belong to the same org)
            if (getWorkspacesByOrganizationIdUserIdApi.data.length > 0 && getWorkspacesByOrganizationIdUserIdApi.data[0].workspace.organization) {
                setOrganizationName(getWorkspacesByOrganizationIdUserIdApi.data[0].workspace.organization.name || 'Organization')
            }

            // Only check workspace availability after a short delay to allow store updates to complete
            setTimeout(() => {
                if (user && user.activeWorkspaceId && !sortedWorkspaces.find((item) => item.id === user.activeWorkspaceId)) {
                    setShowWorkspaceUnavailableDialog(true)
                }
            }, 500)

            setAssignedWorkspaces(sortedWorkspaces)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getWorkspacesByOrganizationIdUserIdApi.data])

    useEffect(() => {
        if (getWorkspacesByOrganizationIdUserIdApi.error) {
            setIsWorkspaceSwitching(false)
        }
    }, [getWorkspacesByOrganizationIdUserIdApi.error])

    useEffect(() => {
        if (switchWorkspaceApi.data) {
            setIsWorkspaceSwitching(false)
            store.dispatch(workspaceSwitchSuccess(switchWorkspaceApi.data))

            // get the current path and navigate to the same after refresh
            navigate('/', { replace: true })
            navigate(0)
        }
    }, [switchWorkspaceApi.data, navigate])

    useEffect(() => {
        if (switchWorkspaceApi.error) {
            setIsWorkspaceSwitching(false)
        }
    }, [switchWorkspaceApi.error])

    useEffect(() => {
        setActiveOrganizationId(user?.activeOrganizationId)
        setActiveWorkspaceId(user?.activeWorkspaceId)
    }, [user])

    return (
        <>
            {isAuthenticated && user ? (
                <>
                    <StyledMenu anchorEl={workspaceAnchorEl} open={workspaceMenuOpen} onClose={handleWorkspaceClose}>
                        {assignedWorkspaces.map((workspace) => (
                            <MenuItem
                                key={workspace.id}
                                onClick={() => switchWorkspace(workspace.id)}
                                selected={workspace.id === activeWorkspaceId}
                            >
                                <ListItemText>{workspace.name}</ListItemText>
                                {workspace.id === activeWorkspaceId && (
                                    <ListItemIcon sx={{ minWidth: 'auto' }}>
                                        <Check />
                                    </ListItemIcon>
                                )}
                            </MenuItem>
                        ))}
                    </StyledMenu>
                    <Breadcrumbs aria-label='breadcrumb'>
                        <StyledBreadcrumb isDarkMode={customization.isDarkMode} label={organizationName} component='div' />
                        <StyledBreadcrumb
                            isDarkMode={customization.isDarkMode}
                            label={assignedWorkspaces.find((ws) => ws.id === activeWorkspaceId)?.name || 'Workspace'}
                            deleteIcon={<IconChevronDown size={16} />}
                            onDelete={handleWorkspaceClick}
                            onClick={handleWorkspaceClick}
                        />
                    </Breadcrumbs>
                </>
            ) : null}
            <Dialog open={isWorkspaceSwitching} PaperProps={{ style: { backgroundColor: 'transparent', boxShadow: 'none' } }}>
                <DialogContent>
                    <Stack spacing={2} alignItems='center'>
                        <CircularProgress />
                        <Typography variant='body1' style={{ color: 'white' }}>
                            Switching workspace...
                        </Typography>
                    </Stack>
                </DialogContent>
            </Dialog>
            <Dialog
                open={showWorkspaceUnavailableDialog}
                disableEscapeKeyDown
                disableBackdropClick
                PaperProps={{
                    style: {
                        padding: '20px',
                        minWidth: '400px'
                    }
                }}
            >
                <DialogContent>
                    <Stack spacing={3}>
                        <Typography variant='h5'>Workspace Unavailable</Typography>
                        <Typography variant='body1'>
                            Your current workspace is no longer available. Please select another workspace to continue.
                        </Typography>
                        {assignedWorkspaces.length > 0 && (
                            <Select
                                fullWidth
                                value=''
                                onChange={(event) => {
                                    setShowWorkspaceUnavailableDialog(false)
                                    switchWorkspace(event.target.value)
                                }}
                                displayEmpty
                            >
                                <MenuItem disabled value=''>
                                    <em>Select Workspace</em>
                                </MenuItem>
                                {assignedWorkspaces.map((workspace, index) => (
                                    <MenuItem key={index} value={workspace.id}>
                                        {workspace.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        )}
                    </Stack>
                </DialogContent>
            </Dialog>
        </>
    )
}

OpenSourceOrgWorkspaceBreadcrumbs.propTypes = {}

export default OpenSourceOrgWorkspaceBreadcrumbs
