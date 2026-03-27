import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Box, Stack, ToggleButton, ToggleButtonGroup, Chip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import AgentsEmptySVG from '@/assets/images/agents_empty.svg'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// API
import temporalApi from '@/api/temporal'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { useError } from '@/store/context/ErrorContext'

// icons
import { IconPlus, IconLayoutGrid, IconList, IconClock } from '@tabler/icons-react'

// Temporal node icons for display
const TEMPORAL_NODE_ICONS = {
    temporalStart: { icon: IconClock, color: '#4CAF50' },
    temporalAgentFlowCall: { icon: IconClock, color: '#2196F3' },
    temporalTimer: { icon: IconClock, color: '#FF9800' },
    temporalSignalWait: { icon: IconClock, color: '#9C27B0' },
    temporalCondition: { icon: IconClock, color: '#E91E63' },
    temporalHTTPRequest: { icon: IconClock, color: '#00BCD4' }
}

// ==============================|| TEMPORAL WORKFLOWS ||============================== //

const TemporalFlowList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const [isLoading, setLoading] = useState(true)
    const [images, setImages] = useState({})
    const [icons, setIcons] = useState({})
    const [search, setSearch] = useState('')
    const { error, setError } = useError()

    const getAllTemporalWorkflows = useApi(temporalApi.getAllTemporalWorkflows)
    const [view, setView] = useState(localStorage.getItem('temporalFlowDisplayStyle') || 'card')

    /* Table Pagination */
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
        refresh(page, pageLimit, search)
    }

    const refresh = (page, limit, searchQuery) => {
        const params = {
            page: page || currentPage,
            limit: limit || pageLimit
        }
        if (searchQuery && searchQuery.trim()) {
            params.search = searchQuery.trim()
        }
        getAllTemporalWorkflows.request(params)
    }

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('temporalFlowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        const newSearch = event.target.value
        setSearch(newSearch)
        setCurrentPage(1)
        refresh(1, pageLimit, newSearch)
    }

    const addNew = () => {
        navigate('/temporalcanvas')
    }

    const goToCanvas = (selectedWorkflow) => {
        navigate(`/temporalcanvas/${selectedWorkflow.id}`)
    }

    useEffect(() => {
        refresh(currentPage, pageLimit, search)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (getAllTemporalWorkflows.error) {
            setError(getAllTemporalWorkflows.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllTemporalWorkflows.error])

    useEffect(() => {
        setLoading(getAllTemporalWorkflows.loading)
    }, [getAllTemporalWorkflows.loading])

    useEffect(() => {
        if (getAllTemporalWorkflows.data) {
            try {
                const workflows = getAllTemporalWorkflows.data?.data || []
                setTotal(getAllTemporalWorkflows.data?.total || 0)
                const newImages = {}
                const newIcons = {}

                for (let i = 0; i < workflows.length; i += 1) {
                    const flowDataStr = workflows[i].flowData
                    const flowData = flowDataStr ? JSON.parse(flowDataStr) : { nodes: [] }
                    const nodes = flowData.nodes || []
                    newImages[workflows[i].id] = []
                    newIcons[workflows[i].id] = []

                    for (let j = 0; j < nodes.length; j += 1) {
                        const nodeType = nodes[j].data?.type || nodes[j].type
                        const foundIcon = TEMPORAL_NODE_ICONS[nodeType]
                        if (foundIcon) {
                            newIcons[workflows[i].id].push(foundIcon)
                        }
                    }
                }
                setImages(newImages)
                setIcons(newIcons)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllTemporalWorkflows.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchValue={search}
                        searchPlaceholder='Search Name'
                        title='Durable Workflows'
                        description='Long-running Temporal workflows with AgentFlow orchestration'
                    >
                        <Chip label='BETA' size='small' color='warning' sx={{ mr: 2 }} />
                        <ToggleButtonGroup
                            sx={{ borderRadius: 2, maxHeight: 40 }}
                            value={view}
                            disabled={total === 0}
                            color='primary'
                            exclusive
                            onChange={handleChange}
                        >
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: customization.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='card'
                                title='Card View'
                            >
                                <IconLayoutGrid />
                            </ToggleButton>
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: customization.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='list'
                                title='List View'
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledPermissionButton
                            permissionId={'temporalflows:create'}
                            variant='contained'
                            onClick={addNew}
                            startIcon={<IconPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            Add New
                        </StyledPermissionButton>
                    </ViewHeader>

                    {!isLoading && total > 0 && (
                        <>
                            {!view || view === 'card' ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {(getAllTemporalWorkflows.data?.data || []).map((data, index) => (
                                        <ItemCard
                                            key={index}
                                            onClick={() => goToCanvas(data)}
                                            data={data}
                                            images={images[data.id]}
                                            icons={icons[data.id]}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <FlowListTable
                                    isAgentCanvas={false}
                                    isTemporalCanvas={true}
                                    data={getAllTemporalWorkflows.data?.data || []}
                                    images={images}
                                    icons={icons}
                                    isLoading={isLoading}
                                    filterFunction={() => true}
                                    updateFlowsApi={getAllTemporalWorkflows}
                                    setError={setError}
                                    currentPage={currentPage}
                                    pageLimit={pageLimit}
                                />
                            )}
                            <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                        </>
                    )}

                    {!isLoading && total === 0 && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '12vh', width: 'auto' }}
                                    src={AgentsEmptySVG}
                                    alt='No Workflows'
                                />
                            </Box>
                            <div>No Durable Workflows Yet</div>
                        </Stack>
                    )}
                </Stack>
            )}
            <ConfirmDialog />
        </MainCard>
    )
}

export default TemporalFlowList
