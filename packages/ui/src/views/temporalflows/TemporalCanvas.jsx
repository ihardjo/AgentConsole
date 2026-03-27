import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ReactFlow, { addEdge, Controls, Background, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import './index.css'

import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import {
    SET_TEMPORAL_DIRTY,
    REMOVE_TEMPORAL_DIRTY,
    SET_TEMPORAL_WORKFLOW,
    SET_TEMPORAL_AGENTFLOWS,
    enqueueSnackbar as enqueueSnackbarAction,
    closeSnackbar as closeSnackbarAction
} from '@/store/actions'
import { cloneDeep } from 'lodash'

// material-ui
import { Toolbar, Box, AppBar, Button, Fab, Chip, IconButton, Typography, Tooltip } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'

// Temporal node components
import TemporalStartNode from './nodes/StartNode'
import TemporalAgentFlowCallNode from './nodes/AgentFlowCallNode'
import TemporalTimerNode from './nodes/TimerNode'
import TemporalSignalWaitNode from './nodes/SignalWaitNode'
import TemporalConditionNode from './nodes/ConditionNode'
import TemporalHTTPRequestNode from './nodes/HTTPRequestNode'
import TemporalEdge from './TemporalEdge'
import AddTemporalNodes from './AddTemporalNodes'
import TemporalNodeConfigDialog from './TemporalNodeConfigDialog'

// API
import temporalApi from '@/api/temporal'
import apikeyApi from '@/api/apikey'

// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'

// icons
import {
    IconX,
    IconDeviceFloppy,
    IconPlayerPlay,
    IconExternalLink,
    IconArrowLeft,
    IconMagnetFilled,
    IconMagnetOff,
    IconArtboard,
    IconArtboardOff
} from '@tabler/icons-react'

// utils
import useNotifier from '@/utils/useNotifier'
import { usePrompt } from '@/utils/usePrompt'

// Node types registration
const nodeTypes = {
    temporalStart: TemporalStartNode,
    temporalAgentFlowCall: TemporalAgentFlowCallNode,
    temporalTimer: TemporalTimerNode,
    temporalSignalWait: TemporalSignalWaitNode,
    temporalCondition: TemporalConditionNode,
    temporalHTTPRequest: TemporalHTTPRequestNode
}

const edgeTypes = {
    temporal: TemporalEdge
}

// ==============================|| TEMPORAL CANVAS ||============================== //

const TemporalCanvas = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const customization = useSelector((state) => state.customization)

    const { state } = useLocation()

    const URLpath = document.location.pathname.toString().split('/')
    const workflowId = URLpath[URLpath.length - 1] === 'temporalcanvas' ? '' : URLpath[URLpath.length - 1]

    const { confirm } = useConfirm()

    const dispatch = useDispatch()
    const temporal = useSelector((state) => state.temporal)
    const [workflow, setWorkflow] = useState(null)

    // ==============================|| Snackbar ||============================== //

    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // ==============================|| ReactFlow ||============================== //

    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [reactFlowInstance, setReactFlowInstance] = useState(null)

    const [selectedNode, setSelectedNode] = useState(null)
    const [configDialogOpen, setConfigDialogOpen] = useState(false)
    const [configDialogProps, setConfigDialogProps] = useState({})
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(false)
    const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(true)
    const [workflowName, setWorkflowName] = useState('Untitled Workflow')

    const reactFlowWrapper = useRef(null)

    // ==============================|| API ||============================== //

    const getTemporalWorkflowApi = useApi(temporalApi.getTemporalWorkflow)
    const createTemporalWorkflowApi = useApi(temporalApi.createTemporalWorkflow)
    const updateTemporalWorkflowApi = useApi(temporalApi.updateTemporalWorkflow)
    const getAgentFlowsApi = useApi(temporalApi.getAgentFlows)
    const startWorkflowApi = useApi(temporalApi.startTemporalWorkflow)
    const getApiKeysApi = useApi(apikeyApi.getAllAPIKeys)

    // State for API keys
    const [apiKeys, setApiKeys] = useState([])

    // ==============================|| Events & Actions ||============================== //

    const onConnect = useCallback(
        (params) => {
            // Basic connection validation
            const sourceNode = nodes.find((n) => n.id === params.source)
            const targetNode = nodes.find((n) => n.id === params.target)

            if (!sourceNode || !targetNode) return

            // Determine edge label for condition nodes
            let edgeLabel = undefined
            if (sourceNode.type === 'temporalCondition') {
                edgeLabel = params.sourceHandle?.includes('true') ? 'True' : 'False'
            }

            const newEdge = {
                ...params,
                type: 'temporal',
                data: {
                    edgeLabel
                },
                id: `${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`
            }

            setEdges((eds) => addEdge(newEdge, eds))
            setDirty()
        },
        [nodes]
    )

    const handleDeleteFlow = async () => {
        const confirmPayload = {
            title: 'Delete',
            description: `Delete workflow ${workflow?.name || 'Untitled'}?`,
            confirmButtonName: 'Delete',
            cancelButtonName: 'Cancel'
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                await temporalApi.deleteTemporalWorkflow(workflow.id)
                navigate('/temporalflows')
            } catch (error) {
                enqueueSnackbar({
                    message:
                        typeof error.response?.data === 'object' ? error.response.data.message : error.response?.data || 'Delete failed',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        persist: true,
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        }
    }

    const handleSaveFlow = async () => {
        if (!reactFlowInstance) return

        const rfInstanceObject = reactFlowInstance.toObject()
        const flowData = JSON.stringify(rfInstanceObject)

        try {
            if (!workflow?.id) {
                // Create new workflow
                const newWorkflowBody = {
                    name: workflowName,
                    flowData,
                    type: 'TEMPORAL'
                }
                createTemporalWorkflowApi.request(newWorkflowBody)
            } else {
                // Update existing workflow
                const updateBody = {
                    name: workflowName,
                    flowData
                }
                updateTemporalWorkflowApi.request(workflow.id, updateBody)
            }
        } catch (error) {
            errorFailed(`Failed to save workflow: ${error.message}`)
        }
    }

    const handleStartWorkflow = async () => {
        if (!workflow?.id) {
            enqueueSnackbar({
                message: 'Please save the workflow first',
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'warning',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            return
        }

        try {
            const result = await temporalApi.startTemporalWorkflow(workflow.id, {})
            enqueueSnackbar({
                message: `Workflow started: ${result.data.workflowId}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'success',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        } catch (error) {
            enqueueSnackbar({
                message: `Failed to start workflow: ${error.response?.data?.message || error.message}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const handleOpenTemporalUI = () => {
        // Open Temporal Web UI - configurable via environment
        const temporalWebUIUrl = window.TEMPORAL_WEB_UI_URL || 'http://localhost:8233'
        window.open(temporalWebUIUrl, '_blank')
    }

    const onNodeClick = useCallback(
        (event, clickedNode) => {
            setSelectedNode(clickedNode)
            setNodes((nds) =>
                nds.map((node) => ({
                    ...node,
                    data: {
                        ...node.data,
                        selected: node.id === clickedNode.id
                    }
                }))
            )
        },
        [setNodes]
    )

    const onNodeDoubleClick = useCallback(
        (event, node) => {
            if (!node || !node.data) return

            setConfigDialogProps({
                node,
                agentFlows: temporal.agentFlows || [],
                apiKeys: apiKeys
            })
            setConfigDialogOpen(true)
        },
        [temporal.agentFlows, apiKeys]
    )

    const onDragOver = useCallback((event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (event) => {
            event.preventDefault()
            const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
            let nodeData = event.dataTransfer.getData('application/reactflow')

            if (typeof nodeData === 'undefined' || !nodeData) {
                return
            }

            nodeData = JSON.parse(nodeData)

            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left - 100,
                y: event.clientY - reactFlowBounds.top - 50
            })

            const existingNodes = reactFlowInstance.getNodes()

            // Only allow one Start node
            if (nodeData.type === 'temporalStart' && existingNodes.find((node) => node.type === 'temporalStart')) {
                enqueueSnackbar({
                    message: 'Only one Start node is allowed',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                return
            }

            const newNodeId = `${nodeData.type}_${Date.now()}`

            const newNode = {
                id: newNodeId,
                type: nodeData.type,
                position,
                data: {
                    ...nodeData.defaultData,
                    id: newNodeId,
                    label: nodeData.label,
                    selected: true
                }
            }

            setSelectedNode(newNode)
            setNodes((nds) => {
                return nds
                    .map((n) => ({
                        ...n,
                        data: { ...n.data, selected: false }
                    }))
                    .concat(newNode)
            })
            setDirty()
        },
        [reactFlowInstance, enqueueSnackbar, closeSnackbar]
    )

    const handleConfigSave = useCallback(
        (nodeId, newData) => {
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.id === nodeId) {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                ...newData
                            }
                        }
                    }
                    return node
                })
            )
            setConfigDialogOpen(false)
            setDirty()
        },
        [setNodes]
    )

    const saveChatflowSuccess = () => {
        dispatch({ type: REMOVE_TEMPORAL_DIRTY })
        enqueueSnackbar({
            message: 'Workflow saved',
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'success',
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    const errorFailed = (message) => {
        enqueueSnackbar({
            message,
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'error',
                persist: true,
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    const setDirty = () => {
        dispatch({ type: SET_TEMPORAL_DIRTY })
    }

    // ==============================|| useEffect ||============================== //

    // Get specific workflow successful
    useEffect(() => {
        if (getTemporalWorkflowApi.data) {
            const workflowData = getTemporalWorkflowApi.data
            const initialFlow = workflowData.flowData ? JSON.parse(workflowData.flowData) : { nodes: [], edges: [] }
            setNodes(initialFlow.nodes || [])
            setEdges(initialFlow.edges || [])
            setWorkflowName(workflowData.name || 'Untitled Workflow')
            setWorkflow(workflowData)
            dispatch({ type: SET_TEMPORAL_WORKFLOW, workflow: workflowData })
        } else if (getTemporalWorkflowApi.error) {
            errorFailed(`Failed to retrieve workflow: ${getTemporalWorkflowApi.error.response?.data?.message || 'Unknown error'}`)
        }
    }, [getTemporalWorkflowApi.data, getTemporalWorkflowApi.error])

    // Create new workflow successful
    useEffect(() => {
        if (createTemporalWorkflowApi.data) {
            const newWorkflow = createTemporalWorkflowApi.data
            setWorkflow(newWorkflow)
            dispatch({ type: SET_TEMPORAL_WORKFLOW, workflow: newWorkflow })
            saveChatflowSuccess()
            window.history.replaceState(state, null, `/temporalcanvas/${newWorkflow.id}`)
        } else if (createTemporalWorkflowApi.error) {
            errorFailed(`Failed to save workflow: ${createTemporalWorkflowApi.error.response?.data?.message || 'Unknown error'}`)
        }
    }, [createTemporalWorkflowApi.data, createTemporalWorkflowApi.error])

    // Update workflow successful
    useEffect(() => {
        if (updateTemporalWorkflowApi.data) {
            setWorkflow(updateTemporalWorkflowApi.data)
            dispatch({ type: SET_TEMPORAL_WORKFLOW, workflow: updateTemporalWorkflowApi.data })
            saveChatflowSuccess()
        } else if (updateTemporalWorkflowApi.error) {
            errorFailed(`Failed to save workflow: ${updateTemporalWorkflowApi.error.response?.data?.message || 'Unknown error'}`)
        }
    }, [updateTemporalWorkflowApi.data, updateTemporalWorkflowApi.error])

    // Get AgentFlows for dropdown
    useEffect(() => {
        if (getAgentFlowsApi.data) {
            dispatch({ type: SET_TEMPORAL_AGENTFLOWS, agentFlows: getAgentFlowsApi.data })
        }
    }, [getAgentFlowsApi.data])

    // Get API keys for dropdown
    useEffect(() => {
        if (getApiKeysApi.data) {
            setApiKeys(getApiKeysApi.data)
        }
    }, [getApiKeysApi.data])

    // Initialization
    useEffect(() => {
        if (workflowId) {
            getTemporalWorkflowApi.request(workflowId)
        } else {
            setNodes([])
            setEdges([])
            setWorkflow({ name: 'Untitled Workflow' })
            dispatch({
                type: SET_TEMPORAL_WORKFLOW,
                workflow: { name: 'Untitled Workflow' }
            })
        }

        // Fetch AgentFlows for dropdown
        getAgentFlowsApi.request()

        // Fetch API keys for dropdown
        getApiKeysApi.request()

        // Clear dirty state before leaving
        return () => {
            setTimeout(() => dispatch({ type: REMOVE_TEMPORAL_DIRTY }), 0)
        }
    }, [])

    usePrompt('You have unsaved changes! Do you want to navigate away?', temporal.isDirty)

    return (
        <>
            <Box>
                <AppBar
                    enableColorOnDark
                    position='fixed'
                    color='inherit'
                    elevation={1}
                    sx={{
                        bgcolor: theme.palette.background.default
                    }}
                >
                    <Toolbar sx={{ justifyContent: 'space-between' }}>
                        {/* Left section */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton onClick={() => navigate('/temporalflows')}>
                                <IconArrowLeft />
                            </IconButton>
                            <input
                                type='text'
                                value={workflowName}
                                onChange={(e) => {
                                    setWorkflowName(e.target.value)
                                    setDirty()
                                }}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '1.2rem',
                                    fontWeight: 500,
                                    color: theme.palette.text.primary,
                                    outline: 'none',
                                    width: '250px'
                                }}
                            />
                            <Chip label='TEMPORAL' size='small' color='primary' />
                            {temporal.isDirty && <Chip label='Unsaved' size='small' color='warning' />}
                        </Box>

                        {/* Right section */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title='View in Temporal UI'>
                                <Button
                                    variant='outlined'
                                    startIcon={<IconExternalLink size={18} />}
                                    onClick={handleOpenTemporalUI}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Temporal UI
                                </Button>
                            </Tooltip>
                            <Tooltip title='Run Workflow'>
                                <Button
                                    variant='outlined'
                                    color='success'
                                    startIcon={<IconPlayerPlay size={18} />}
                                    onClick={handleStartWorkflow}
                                    disabled={!workflow?.id}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Run
                                </Button>
                            </Tooltip>
                            <Tooltip title='Save Workflow'>
                                <Button
                                    variant='contained'
                                    startIcon={<IconDeviceFloppy size={18} />}
                                    onClick={handleSaveFlow}
                                    sx={{ borderRadius: 2 }}
                                >
                                    Save
                                </Button>
                            </Tooltip>
                        </Box>
                    </Toolbar>
                </AppBar>
                <Box sx={{ pt: '70px', height: '100vh', width: '100%' }}>
                    <div className='reactflow-parent-wrapper'>
                        <div className='reactflow-wrapper' ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onNodeClick={onNodeClick}
                                onNodeDoubleClick={onNodeDoubleClick}
                                onEdgesChange={onEdgesChange}
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onNodeDragStop={setDirty}
                                nodeTypes={nodeTypes}
                                edgeTypes={edgeTypes}
                                onConnect={onConnect}
                                onInit={setReactFlowInstance}
                                proOptions={{ hideAttribution: true }}
                                fitView
                                deleteKeyCode={['Delete', 'Backspace']}
                                minZoom={0.5}
                                snapGrid={[25, 25]}
                                snapToGrid={isSnappingEnabled}
                            >
                                <Controls
                                    className={customization.isDarkMode ? 'dark-mode-controls' : ''}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    <button
                                        className='react-flow__controls-button react-flow__controls-interactive'
                                        onClick={() => setIsSnappingEnabled(!isSnappingEnabled)}
                                        title='toggle snapping'
                                        aria-label='toggle snapping'
                                    >
                                        {isSnappingEnabled ? <IconMagnetFilled /> : <IconMagnetOff />}
                                    </button>
                                    <button
                                        className='react-flow__controls-button react-flow__controls-interactive'
                                        onClick={() => setIsBackgroundEnabled(!isBackgroundEnabled)}
                                        title='toggle background'
                                        aria-label='toggle background'
                                    >
                                        {isBackgroundEnabled ? <IconArtboard /> : <IconArtboardOff />}
                                    </button>
                                </Controls>
                                {isBackgroundEnabled && <Background color='#aaa' gap={16} />}
                                <AddTemporalNodes />
                            </ReactFlow>
                        </div>
                    </div>
                </Box>
                <ConfirmDialog />
                <TemporalNodeConfigDialog
                    open={configDialogOpen}
                    onClose={() => setConfigDialogOpen(false)}
                    dialogProps={configDialogProps}
                    onSave={handleConfigSave}
                />
            </Box>
        </>
    )
}

export default TemporalCanvas
