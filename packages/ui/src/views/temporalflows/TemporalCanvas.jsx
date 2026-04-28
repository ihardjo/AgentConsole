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
import { Toolbar, Box, AppBar, Button, Fab, Chip, IconButton, Typography, Tooltip, Menu, MenuItem, Divider } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import TemporalStartNode from './nodes/StartNode'
import TemporalAgentFlowCallNode from './nodes/AgentFlowCallNode'
import TemporalTimerNode from './nodes/TimerNode'
import TemporalHumanTaskNode from './nodes/HumanTaskNode'
import TemporalCollectSignalsNode from './nodes/CollectSignalsNode'
import TemporalConditionNode from './nodes/ConditionNode'
import TemporalHTTPRequestNode from './nodes/HTTPRequestNode'
import TemporalLoopNode from './nodes/LoopNode'
import TemporalNotificationNode from './nodes/NotificationNode'
import TemporalParallelNode from './nodes/ParallelNode'
import TemporalSubWorkflowNode from './nodes/SubWorkflowNode'
import TemporalEdge from './TemporalEdge'
import AddTemporalNodes from './AddTemporalNodes'
import TemporalNodeConfigDialog from './TemporalNodeConfigDialog'
import RunWorkflowDialog from './RunWorkflowDialog'
import temporalApi from '@/api/temporal'
import apikeyApi from '@/api/apikey'
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import {
    IconX,
    IconDeviceFloppy,
    IconPlayerPlay,
    IconExternalLink,
    IconArrowLeft,
    IconMagnetFilled,
    IconMagnetOff,
    IconArtboard,
    IconArtboardOff,
    IconClock,
    IconCircleCheck,
    IconCircleOff,
    IconDots
} from '@tabler/icons-react'
import useNotifier from '@/utils/useNotifier'
import { usePrompt } from '@/utils/usePrompt'

const nodeTypes = {
    temporalStart: TemporalStartNode,
    temporalAgentFlowCall: TemporalAgentFlowCallNode,
    temporalTimer: TemporalTimerNode,
    temporalHumanTask: TemporalHumanTaskNode,
    temporalCollectSignals: TemporalCollectSignalsNode,
    temporalCondition: TemporalConditionNode,
    temporalHTTPRequest: TemporalHTTPRequestNode,
    temporalLoop: TemporalLoopNode,
    temporalNotification: TemporalNotificationNode,
    temporalParallel: TemporalParallelNode,
    temporalSubWorkflow: TemporalSubWorkflowNode
}

const edgeTypes = {
    temporal: TemporalEdge
}
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
    const [scheduleDetails, setScheduleDetails] = useState(null)
    const [scheduleAnchorEl, setScheduleAnchorEl] = useState(null)
    useNotifier()
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [reactFlowInstance, setReactFlowInstance] = useState(null)
    const [selectedNode, setSelectedNode] = useState(null)
    const [configDialogOpen, setConfigDialogOpen] = useState(false)
    const [configDialogProps, setConfigDialogProps] = useState({})
    const [runDialogOpen, setRunDialogOpen] = useState(false)
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(false)
    const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(true)
    const [workflowName, setWorkflowName] = useState('Untitled Workflow')
    const reactFlowWrapper = useRef(null)
    const getTemporalWorkflowApi = useApi(temporalApi.getTemporalWorkflow)
    const createTemporalWorkflowApi = useApi(temporalApi.createTemporalWorkflow)
    const updateTemporalWorkflowApi = useApi(temporalApi.updateTemporalWorkflow)
    const getAgentFlowsApi = useApi(temporalApi.getAgentFlows)
    const startWorkflowApi = useApi(temporalApi.startTemporalWorkflow)
    const getApiKeysApi = useApi(apikeyApi.getAllAPIKeys)
    const [apiKeys, setApiKeys] = useState([])

    const getStartNode = useCallback(() => {
        return nodes.find((n) => n.type === 'temporalStart')
    }, [nodes])
    const startNodeData = useMemo(() => getStartNode()?.data, [getStartNode, nodes])
    const startNodeScheduleId = startNodeData?.scheduleId || null
    const startNodeTriggerMode = startNodeData?.triggerMode || 'manual'
    const isSchedulePaused = scheduleDetails?.status?.paused ?? false
    const hasScheduleId = !!startNodeScheduleId

    const runButtonLabel = useMemo(() => {
        if (startNodeTriggerMode === 'manual') return 'Run'
        return hasScheduleId ? 'Reschedule' : 'Schedule'
    }, [startNodeTriggerMode, hasScheduleId])

    const fetchScheduleDetails = useCallback(
        async (scheduleId) => {
            try {
                const result = await temporalApi.getScheduleDetails(scheduleId)
                setScheduleDetails(result.data)
            } catch (error) {
                setScheduleDetails(null)
                enqueueSnackbar({
                    message: `Failed to fetch schedule status: ${error.response?.data?.message || error.message}`,
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
            }
        },
        [enqueueSnackbar, closeSnackbar]
    )

    const onConnect = useCallback(
        (params) => {
            const sourceNode = nodes.find((n) => n.id === params.source)
            const targetNode = nodes.find((n) => n.id === params.target)
            if (!sourceNode || !targetNode) return
            let edgeLabel = undefined
            if (sourceNode.type === 'temporalCondition') {
                edgeLabel = params.sourceHandle?.includes('true') ? 'True' : 'False'
            }
            // Mark edges TO Loop nodes or FROM Loop nodes as loop edges
            const isLoopEdge = sourceNode.type === 'temporalLoop' || targetNode.type === 'temporalLoop'
            const newEdge = {
                ...params,
                type: 'temporal',
                data: {
                    edgeLabel,
                    isLoopEdge
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

        // Validate Loop nodes before saving
        const loopNodes = rfInstanceObject.nodes.filter((n) => n.type === 'temporalLoop')
        for (const loopNode of loopNodes) {
            const { loopToNodeId, label } = loopNode.data || {}
            const loopLabel = label || loopNode.id

            // Check that target node is selected
            if (!loopToNodeId) {
                enqueueSnackbar({
                    message: `Loop node "${loopLabel}" requires a target node. Double-click to configure.`,
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
                return
            }

            // Check that target node exists
            const targetExists = rfInstanceObject.nodes.some((n) => n.id === loopToNodeId)
            if (!targetExists) {
                enqueueSnackbar({
                    message: `Loop node "${loopLabel}" references a deleted node. Please reconfigure.`,
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
                return
            }
        }

        const flowData = JSON.stringify(rfInstanceObject)
        try {
            if (!workflow?.id) {
                const newWorkflowBody = {
                    name: workflowName,
                    flowData,
                    type: 'TEMPORAL'
                }
                createTemporalWorkflowApi.request(newWorkflowBody)
            } else {
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

        // Check if manual workflow has input variables - open dialog to collect input
        if (startNodeTriggerMode === 'manual') {
            const inputVariables = startNodeData?.inputVariables || []
            if (inputVariables.length > 0) {
                setRunDialogOpen(true)
                return
            }
            // No input variables - run directly with empty input
            await executeWorkflow({})
            return
        }

        // Handle scheduled workflows (existing logic)
        if (startNodeTriggerMode === 'scheduled' && hasScheduleId) {
            const confirmPayload = {
                title: 'Reschedule',
                description: 'This will delete the existing schedule and create a new one. Continue?',
                confirmButtonName: 'Reschedule',
                cancelButtonName: 'Cancel'
            }
            const isConfirmed = await confirm(confirmPayload)
            if (!isConfirmed) return
            try {
                await temporalApi.deleteSchedule(startNodeScheduleId)
                setScheduleDetails(null)
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to delete existing schedule: ${error.response?.data?.message || error.message}`,
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
                return
            }
        }
        // Auto-save workflow before schedule creation to ensure server has latest configuration
        if (reactFlowInstance && startNodeTriggerMode === 'scheduled') {
            try {
                const rfInstanceObject = reactFlowInstance.toObject()
                const flowData = JSON.stringify(rfInstanceObject)
                const updateBody = { name: workflowName, flowData }
                await temporalApi.updateTemporalWorkflow(workflow.id, updateBody)
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to save workflow: ${error.response?.data?.message || error.message}`,
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
                return
            }
        }
        await executeWorkflow({})
    }

    // Execute workflow with input (used by both direct run and RunWorkflowDialog)
    const executeWorkflow = async (input) => {
        try {
            const result = await temporalApi.startTemporalWorkflow(workflow.id, { input })
            const data = result.data
            let message
            if (data.triggerMode === 'scheduled') {
                message = `Schedule created: ${data.scheduleId} (every ${data.scheduleInterval})`
                // Update local React state with the new scheduleId
                if (data.scheduleId) {
                    setNodes((nds) =>
                        nds.map((node) => {
                            if (node.type === 'temporalStart') {
                                return {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        scheduleId: data.scheduleId
                                    }
                                }
                            }
                            return node
                        })
                    )
                    // Auto-save workflow to persist the new scheduleId
                    if (reactFlowInstance && workflow?.id) {
                        setTimeout(() => {
                            const rfInstanceObject = reactFlowInstance.toObject()
                            // Update the scheduleId in the flow data before saving
                            const updatedNodes = rfInstanceObject.nodes.map((node) => {
                                if (node.type === 'temporalStart') {
                                    return {
                                        ...node,
                                        data: {
                                            ...node.data,
                                            scheduleId: data.scheduleId
                                        }
                                    }
                                }
                                return node
                            })
                            const flowData = JSON.stringify({ ...rfInstanceObject, nodes: updatedNodes })
                            const updateBody = { name: workflowName, flowData }
                            updateTemporalWorkflowApi.request(workflow.id, updateBody)
                        }, 100)
                    }
                }
            } else {
                message = `Workflow started: ${data.workflowId}`
            }
            if (data.scheduleId) {
                fetchScheduleDetails(data.scheduleId)
            }
            enqueueSnackbar({
                message,
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

    // Handle run from dialog with input values
    const handleRunWithInput = async (input) => {
        setRunDialogOpen(false)
        await executeWorkflow(input)
    }

    const handleOpenTemporalUI = () => {
        // Use Vite env variable (set at build time), fallback to localhost
        const temporalWebUIUrl = import.meta.env.VITE_TEMPORAL_WEB_UI_URL || 'http://localhost:8080'
        window.open(temporalWebUIUrl, '_blank')
    }

    const handlePauseSchedule = async () => {
        try {
            await temporalApi.pauseSchedule(startNodeScheduleId)
            await fetchScheduleDetails(startNodeScheduleId)
            enqueueSnackbar({
                message: 'Schedule paused',
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
                message: `Failed to pause schedule: ${error.response?.data?.message || error.message}`,
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

    const handleResumeSchedule = async () => {
        try {
            await temporalApi.unpauseSchedule(startNodeScheduleId)
            await fetchScheduleDetails(startNodeScheduleId)
            enqueueSnackbar({
                message: 'Schedule resumed',
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
                message: `Failed to resume schedule: ${error.response?.data?.message || error.message}`,
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

    const handleTriggerSchedule = async () => {
        try {
            await temporalApi.triggerSchedule(startNodeScheduleId)
            enqueueSnackbar({
                message: 'Schedule triggered manually',
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
                message: `Failed to trigger schedule: ${error.response?.data?.message || error.message}`,
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

    const handleStopSchedule = async () => {
        const confirmPayload = {
            title: 'Stop Schedule',
            description: `Stop the schedule "${startNodeScheduleId}"? This will permanently delete it.`,
            confirmButtonName: 'Stop',
            cancelButtonName: 'Cancel'
        }
        const isConfirmed = await confirm(confirmPayload)
        if (!isConfirmed) return
        try {
            await temporalApi.deleteSchedule(startNodeScheduleId)
            setNodes((nds) =>
                nds.map((node) => {
                    if (node.type === 'temporalStart') {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                scheduleId: undefined
                            }
                        }
                    }
                    return node
                })
            )
            setScheduleDetails(null)
            setScheduleAnchorEl(null)
            if (reactFlowInstance && workflow?.id) {
                setTimeout(() => {
                    const rfInstanceObject = reactFlowInstance.toObject()
                    const flowData = JSON.stringify(rfInstanceObject)
                    const updateBody = { name: workflowName, flowData }
                    updateTemporalWorkflowApi.request(workflow.id, updateBody)
                }, 100)
            }
            enqueueSnackbar({
                message: 'Schedule stopped',
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
                message: `Failed to stop schedule: ${error.response?.data?.message || error.message}`,
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
                apiKeys: apiKeys,
                nodes: nodes,
                edges: edges
            })
            setConfigDialogOpen(true)
        },
        [temporal.agentFlows, apiKeys, nodes, edges]
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

    useEffect(() => {
        if (updateTemporalWorkflowApi.data) {
            setWorkflow(updateTemporalWorkflowApi.data)
            dispatch({ type: SET_TEMPORAL_WORKFLOW, workflow: updateTemporalWorkflowApi.data })
            saveChatflowSuccess()
        } else if (updateTemporalWorkflowApi.error) {
            errorFailed(`Failed to save workflow: ${updateTemporalWorkflowApi.error.response?.data?.message || 'Unknown error'}`)
        }
    }, [updateTemporalWorkflowApi.data, updateTemporalWorkflowApi.error])

    useEffect(() => {
        if (getAgentFlowsApi.data) {
            dispatch({ type: SET_TEMPORAL_AGENTFLOWS, agentFlows: getAgentFlowsApi.data })
        }
    }, [getAgentFlowsApi.data])

    useEffect(() => {
        if (getApiKeysApi.data) {
            setApiKeys(getApiKeysApi.data)
        }
    }, [getApiKeysApi.data])

    useEffect(() => {
        if (startNodeScheduleId && workflowId) {
            fetchScheduleDetails(startNodeScheduleId)
        }
    }, [startNodeScheduleId, workflowId])

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
        getAgentFlowsApi.request()
        getApiKeysApi.request()
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
                            {hasScheduleId && (
                                <Chip
                                    label={isSchedulePaused ? 'Paused' : 'Scheduled'}
                                    size='small'
                                    color={isSchedulePaused ? 'warning' : 'success'}
                                    sx={{ ml: 0.5 }}
                                />
                            )}
                            {temporal.isDirty && <Chip label='Unsaved' size='small' color='warning' />}
                        </Box>
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
                            <Tooltip title={runButtonLabel}>
                                <Button
                                    variant='outlined'
                                    color={startNodeTriggerMode === 'scheduled' ? 'warning' : 'success'}
                                    startIcon={
                                        startNodeTriggerMode === 'scheduled' ? <IconClock size={18} /> : <IconPlayerPlay size={18} />
                                    }
                                    onClick={handleStartWorkflow}
                                    disabled={!workflow?.id}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {runButtonLabel}
                                </Button>
                            </Tooltip>
                            {hasScheduleId && (
                                <>
                                    <Tooltip title='Schedule Actions'>
                                        <IconButton onClick={(e) => setScheduleAnchorEl(e.currentTarget)} sx={{ borderRadius: 2 }}>
                                            <IconDots size={18} />
                                        </IconButton>
                                    </Tooltip>
                                    <Menu
                                        anchorEl={scheduleAnchorEl}
                                        open={!!scheduleAnchorEl}
                                        onClose={() => setScheduleAnchorEl(null)}
                                        MenuListProps={{ disablePadding: true }}
                                        sx={{ mt: -1 }}
                                    >
                                        <MenuItem onClick={isSchedulePaused ? handleResumeSchedule : handlePauseSchedule}>
                                            {isSchedulePaused ? (
                                                <IconCircleCheck size={16} style={{ marginRight: 8 }} />
                                            ) : (
                                                <IconCircleOff size={16} style={{ marginRight: 8 }} />
                                            )}
                                            {isSchedulePaused ? 'Resume' : 'Pause'}
                                        </MenuItem>
                                        <MenuItem onClick={handleTriggerSchedule}>
                                            <IconPlayerPlay size={16} style={{ marginRight: 8 }} />
                                            Trigger Now
                                        </MenuItem>
                                        <Divider />
                                        <MenuItem onClick={handleStopSchedule} sx={{ color: 'error.main' }}>
                                            <IconCircleOff size={16} style={{ marginRight: 8 }} />
                                            Stop Schedule
                                        </MenuItem>
                                    </Menu>
                                </>
                            )}
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
                <RunWorkflowDialog
                    open={runDialogOpen}
                    onClose={() => setRunDialogOpen(false)}
                    workflow={workflow}
                    inputVariables={startNodeData?.inputVariables || []}
                    onRun={handleRunWithInput}
                />
            </Box>
        </>
    )
}
export default TemporalCanvas
