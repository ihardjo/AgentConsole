import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import moment from 'moment'

// material-ui
import {
    Box,
    Stack,
    Button,
    Grid,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    useTheme,
    Alert,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Collapse,
    OutlinedInput
} from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ErrorBoundary from '@/ErrorBoundary'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { StyledTableCell, StyledTableRow } from '@/ui-component/table/TableStyles'
import { StyledButton } from '@/ui-component/button/StyledButton'

// API
import useApi from '@/hooks/useApi'
import chatflowVersionsApi from '@/api/chatflowVersions'
import { useSelector } from 'react-redux'

// icons
import version_empty from '@/assets/images/executions_empty.svg'
import { 
    IconPlus, 
    IconChevronDown, 
    IconDeviceFloppy, 
    IconRestore,
    IconTrash,
    IconAlertTriangle
} from '@tabler/icons-react'

// components
import VersionHistoryTable from '@/ui-component/table/VersionHistoryTable'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// ==============================|| AGENT OPS - VERSION HISTORY ||============================== //

const AgentOps = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const customization = useSelector((state) => state.customization)
    const borderColor = theme.palette.grey[900] + 25

    // API hooks
    const getAllVersionsGroupedApi = useApi(chatflowVersionsApi.getAllVersionsGrouped)
    const getAgentflowsApi = useApi(chatflowVersionsApi.getAgentflowsForVersioning)
    const createVersionApi = useApi(chatflowVersionsApi.createVersion)
    const restoreVersionApi = useApi(chatflowVersionsApi.restoreVersion)
    const deleteVersionApi = useApi(chatflowVersionsApi.deleteVersion)

    // State
    const [error, setError] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [groupedVersions, setGroupedVersions] = useState([])
    const [agentflows, setAgentflows] = useState([])
    const [expandedFlows, setExpandedFlows] = useState({})
    // Only enable versioning for agentflows (AGENTFLOW). Use 'AI Agents' terminology in the UI.
    const [filters, setFilters] = useState({
        type: 'AGENTFLOW'
    })

    // Dialog states
    const [openSaveVersionDialog, setOpenSaveVersionDialog] = useState(false)
    const [openRestoreDialog, setOpenRestoreDialog] = useState(false)
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
    const [selectedVersion, setSelectedVersion] = useState(null)

    // Save version form state
    const [saveVersionForm, setSaveVersionForm] = useState({
        chatflowId: '',
        changeDescription: ''
    })

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    // No tabs: versioning is only for AGENTFLOW

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
    }

    const fetchVersions = useCallback(() => {
        setLoading(true)
        const params = {
            page: currentPage,
            limit: pageLimit
        }
        if (filters.type) params.type = filters.type
        getAllVersionsGroupedApi.request(params)
    }, [currentPage, pageLimit, filters.type])

    const fetchAgentflows = useCallback(() => {
        getAgentflowsApi.request()
    }, [])

    // Toggle accordion expansion
    const handleAccordionChange = (flowId) => {
        setExpandedFlows((prev) => ({
            ...prev,
            [flowId]: !prev[flowId]
        }))
    }

    // Save version dialog
    const handleOpenSaveVersion = () => {
        setSaveVersionForm({ chatflowId: '', changeDescription: '' })
        fetchAgentflows()
        setOpenSaveVersionDialog(true)
    }

    const handleCloseSaveVersion = () => {
        setOpenSaveVersionDialog(false)
        setSaveVersionForm({ chatflowId: '', changeDescription: '' })
    }

    const handleSaveVersionFormChange = (field) => (event) => {
        setSaveVersionForm((prev) => ({
            ...prev,
            [field]: event.target.value
        }))
    }

    const handleConfirmSaveVersion = () => {
        if (saveVersionForm.chatflowId) {
            // Use the unified createVersion endpoint
            // Since flowData is not provided, it will automatically fetch from the chatflow
            createVersionApi.request(saveVersionForm.chatflowId, {
                changeDescription: saveVersionForm.changeDescription || 'Manual version save'
            })
        }
    }

    // Version actions
    const handleVersionClick = (version) => {
        // Navigate to version details or open a drawer
        console.log('View version details:', version)
    }

    const handleRestoreClick = (version) => {
        setSelectedVersion(version)
        setOpenRestoreDialog(true)
    }

    const handleConfirmRestore = () => {
        if (selectedVersion) {
            restoreVersionApi.request(selectedVersion.id)
        }
        setOpenRestoreDialog(false)
    }

    const handleDeleteClick = (version) => {
        setSelectedVersion(version)
        setOpenDeleteDialog(true)
    }

    const handleConfirmDelete = () => {
        if (selectedVersion) {
            deleteVersionApi.request(selectedVersion.id)
        }
        setOpenDeleteDialog(false)
    }

    // Effects
    useEffect(() => {
        fetchVersions()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, pageLimit, filters.type])

    useEffect(() => {
        if (getAllVersionsGroupedApi.data) {
            try {
                const { data, total } = getAllVersionsGroupedApi.data
                if (!Array.isArray(data)) return
                setGroupedVersions(data)
                setTotal(total)
                // Expand all flows by default
                const expanded = {}
                data.forEach((group) => {
                    expanded[group.chatFlowId] = true
                })
                setExpandedFlows(expanded)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllVersionsGroupedApi.data])

    useEffect(() => {
        if (getAgentflowsApi.data) {
            setAgentflows(getAgentflowsApi.data || [])
        }
    }, [getAgentflowsApi.data])

    useEffect(() => {
        setLoading(getAllVersionsGroupedApi.loading)
    }, [getAllVersionsGroupedApi.loading])

    useEffect(() => {
        setError(getAllVersionsGroupedApi.error)
    }, [getAllVersionsGroupedApi.error])

    // Refresh after version creation
    useEffect(() => {
        if (createVersionApi.data) {
            fetchVersions()
            handleCloseSaveVersion()
        }
    }, [createVersionApi.data])

    // Refresh after restore
    useEffect(() => {
        if (restoreVersionApi.data) {
            fetchVersions()
            setSelectedVersion(null)
        }
    }, [restoreVersionApi.data])

    // Refresh after delete
    useEffect(() => {
        if (deleteVersionApi.data !== undefined) {
            fetchVersions()
            setSelectedVersion(null)
        }
    }, [deleteVersionApi.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        title='AI Agents Versions'
                        description='Manage AI Agent versions'
                    >
                        <Button
                            variant='contained'
                            startIcon={<IconPlus />}
                            onClick={handleOpenSaveVersion}
                        >
                            Create Version
                        </Button>
                    </ViewHeader>

                    {/* Grouped Version History */}
                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : groupedVersions.length === 0 ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '16vh', width: 'auto' }}
                                    src={version_empty}
                                    alt='No versions'
                                />
                            </Box>
                            <div>No versions found</div>
                            <div>Create a version by clicking "Create Version" above</div>
                        </Stack>
                    ) : (
                        <>
                            <TableContainer component={Paper} sx={{ border: 1, borderColor: borderColor, borderRadius: 2 }}>
                                <Table>
                                    <TableHead 
                                        sx={{ 
                                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                                            height: 56
                                        }}
                                    >
                                        <TableRow>
                                            <StyledTableCell>Name</StyledTableCell>
                                            <StyledTableCell>Version</StyledTableCell>
                                            <StyledTableCell>Description</StyledTableCell>
                                            <StyledTableCell>Created By</StyledTableCell>
                                            <StyledTableCell>Created Date</StyledTableCell>
                                            <StyledTableCell align='right'>Actions</StyledTableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {groupedVersions.map((group, index) => (
                                            <>
                                                {/* Agent Flow Row */}
                                                <StyledTableRow
                                                    key={`flow-${group.chatFlowId}`}
                                                    sx={{
                                                        backgroundColor: customization.isDarkMode 
                                                            ? theme.palette.common.black
                                                            : theme.palette.grey[100],
                                                        '&:hover': {
                                                            backgroundColor: customization.isDarkMode
                                                                ? theme.palette.action.hover
                                                                : theme.palette.grey[200]
                                                        },
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handleAccordionChange(group.chatFlowId)}
                                                >
                                                    <StyledTableCell 
                                                        colSpan={5} 
                                                        sx={{ 
                                                            color: theme.palette.text.primary
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Typography 
                                                                variant='subtitle1' 
                                                                fontWeight='bold'
                                                                color='text.primary'
                                                            >
                                                                {group.chatFlowName}
                                                            </Typography>
                                                            <Chip
                                                                label={`${group.versionCount} version${group.versionCount !== 1 ? 's' : ''}`}
                                                                size='small'
                                                                color='primary'
                                                                variant='outlined'
                                                            />
                                                        </Box>
                                                    </StyledTableCell>
                                                    <StyledTableCell align='right'>
                                                        <IconButton
                                                            size='small'
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleAccordionChange(group.chatFlowId)
                                                            }}
                                                            sx={{
                                                                color: theme.palette.text.primary
                                                            }}
                                                        >
                                                            <IconChevronDown
                                                                size={20}
                                                                style={{
                                                                    transform: expandedFlows[group.chatFlowId] ? 'rotate(0deg)' : 'rotate(-90deg)',
                                                                    transition: 'transform 0.2s'
                                                                }}
                                                            />
                                                        </IconButton>
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                                
                                                {/* Versions Rows (Collapsible) */}
                                                {expandedFlows[group.chatFlowId] && group.versions.map((version) => (
                                                    <StyledTableRow
                                                        key={version.id}
                                                        hover
                                                        sx={{
                                                            cursor: 'pointer'
                                                        }}
                                                        onClick={() => handleVersionClick && handleVersionClick(version)}
                                                    >
                                                        <StyledTableCell>{group.chatFlowName}</StyledTableCell>
                                                        <StyledTableCell>
                                                            v{version.version}
                                                        </StyledTableCell>
                                                        <StyledTableCell>
                                                            <Tooltip title={version.changeDescription || 'No description'}>
                                                                <Box
                                                                    sx={{
                                                                        maxWidth: 200,
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap'
                                                                    }}
                                                                >
                                                                    {version.changeDescription || '-'}
                                                                </Box>
                                                            </Tooltip>
                                                        </StyledTableCell>
                                                        <StyledTableCell>{version.createdBy || '-'}</StyledTableCell>
                                                        <StyledTableCell>
                                                            {version.createdDate ? moment(version.createdDate).format('YYYY-MM-DD HH:mm') : '-'}
                                                        </StyledTableCell>
                                                        <StyledTableCell align='right'>
                                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                                                <Tooltip title='Restore version'>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleRestoreClick && handleRestoreClick(version)
                                                                        }}
                                                                        sx={{
                                                                            color: theme.palette.text.primary
                                                                        }}
                                                                    >
                                                                        <IconRestore size={18} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title='Delete version'>
                                                                    <IconButton
                                                                        size='small'
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleDeleteClick && handleDeleteClick(version)
                                                                        }}
                                                                        color='error'
                                                                    >
                                                                        <IconTrash size={18} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </StyledTableCell>
                                                    </StyledTableRow>
                                                ))}
                                            </>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            
                            {/* Pagination */}
                            <TablePagination
                                currentPage={currentPage}
                                limit={pageLimit}
                                total={total}
                                onChange={onChange}
                            />
                        </>
                    )}
                </Stack>
            )}

            {/* Save Version Dialog */}
            <Dialog open={openSaveVersionDialog} onClose={handleCloseSaveVersion} maxWidth='sm' fullWidth>
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconDeviceFloppy style={{ marginRight: '10px' }} />
                        Create Version
                    </div>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ p: 2 }}>
                        <Typography>
                            Select AI Agent<span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>
                        <FormControl fullWidth sx={{ mt: 1 }}>
                            <Select
                                size='small'
                                value={saveVersionForm.chatflowId}
                                onChange={handleSaveVersionFormChange('chatflowId')}
                            >
                                {getAgentflowsApi.loading ? (
                                    <MenuItem disabled>Loading...</MenuItem>
                                ) : agentflows.length === 0 ? (
                                    <MenuItem disabled>No AI Agents found</MenuItem>
                                ) : (
                                    agentflows.map((flow) => (
                                        <MenuItem key={flow.id} value={flow.id}>
                                            {flow.name}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    </Box>
                    <Box sx={{ p: 2 }}>
                        <Typography>Version Description (optional)</Typography>
                        <OutlinedInput
                            fullWidth
                            multiline={true}
                            rows={3}
                            size='small'
                            placeholder='Describe the changes in this version...'
                            value={saveVersionForm.changeDescription}
                            onChange={handleSaveVersionFormChange('changeDescription')}
                            sx={{ mt: 1 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseSaveVersion}>Cancel</Button>
                    <StyledButton
                        variant='contained'
                        onClick={handleConfirmSaveVersion}
                        disabled={!saveVersionForm.chatflowId || createVersionApi.loading}
                    >
                        {createVersionApi.loading ? 'Saving...' : 'Save Version'}
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Restore Confirmation Dialog */}
            <Dialog open={openRestoreDialog} onClose={() => setOpenRestoreDialog(false)} fullWidth maxWidth='sm'>
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconRestore style={{ marginRight: '10px' }} />
                        Restore to version v{selectedVersion?.version}
                    </div>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Alert 
                        severity='warning' 
                        sx={{ 
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : 'rgb(255, 244, 229)',
                            '& .MuiAlert-icon': {
                                color: theme.palette.mode === 'dark' ? '#ffb74d' : '#ed6c02'
                            }
                        }}
                    >
                        <Typography variant='body2' sx={{ fontWeight: 500 }}>
                            This will replace the current configuration.
                        </Typography>
                        <Typography variant='body2' sx={{ mt: 0.5 }}>
                            The current configuration will be backed up automatically before restoring.
                        </Typography>
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenRestoreDialog(false)}>Cancel</Button>
                    <StyledButton
                        variant='contained'
                        onClick={handleConfirmRestore}
                        disabled={restoreVersionApi.loading}
                    >
                        {restoreVersionApi.loading ? 'Restoring...' : 'Restore'}
                    </StyledButton>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} fullWidth maxWidth='sm'>
                <DialogTitle style={{ fontSize: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <IconTrash style={{ marginRight: '10px' }} />
                        Delete version v{selectedVersion?.version}
                    </div>
                </DialogTitle>
                <DialogContent sx={{ pt: 2, pb: 1 }}>
                    <Alert 
                        severity='error' 
                        icon={<IconAlertTriangle />}
                        sx={{ 
                            backgroundColor: theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.2)' : 'rgb(253, 237, 237)',
                            '& .MuiAlert-icon': {
                                color: theme.palette.mode === 'dark' ? '#f44336' : '#d32f2f'
                            }
                        }}
                    >
                        <Typography variant='body2' sx={{ fontWeight: 500 }}>
                            This action cannot be undone.
                        </Typography>
                        <Typography variant='body2' sx={{ mt: 0.5 }}>
                            This will permanently remove this version from the history.
                        </Typography>
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
                    <StyledButton 
                        variant='contained' 
                        color='error'
                        onClick={handleConfirmDelete}
                    >
                        Delete
                    </StyledButton>
                </DialogActions>
            </Dialog>
        </MainCard>
    )
}

export default AgentOps