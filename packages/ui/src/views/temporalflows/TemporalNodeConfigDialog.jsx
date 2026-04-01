import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

// material-ui
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    IconButton,
    ToggleButtonGroup,
    ToggleButton,
    Chip,
    Alert,
    Checkbox,
    FormControlLabel,
    Divider
} from '@mui/material'

// icons
import { IconX, IconPlayerPlay, IconClock, IconPlus, IconTrash } from '@tabler/icons-react'

// components
import TemporalTemplateInput from './TemporalTemplateInput'

// ==============================|| TEMPORAL NODE CONFIG DIALOG ||============================== //

const TemporalNodeConfigDialog = ({ open, onClose, dialogProps, onSave }) => {
    const [formData, setFormData] = useState({})
    const node = dialogProps?.node
    const agentFlows = dialogProps?.agentFlows || []
    const apiKeys = dialogProps?.apiKeys || []
    const nodes = dialogProps?.nodes || []
    const edges = dialogProps?.edges || []

    useEffect(() => {
        if (node?.data) {
            setFormData({ ...node.data })
        }
    }, [node])

    const handleChange = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value
        }))
    }

    const handleSave = () => {
        if (node?.id) {
            onSave(node.id, formData)
        }
    }

    // Input Variables handlers (Tasks 12.3, 12.4)
    const addVariable = () => {
        const currentVars = formData.inputVariables || []
        handleChange('inputVariables', [...currentVars, { name: '', type: 'string', required: false, defaultValue: '', description: '' }])
    }

    const removeVariable = (index) => {
        const currentVars = formData.inputVariables || []
        handleChange(
            'inputVariables',
            currentVars.filter((_, i) => i !== index)
        )
    }

    const updateVariable = (index, field, value) => {
        const currentVars = formData.inputVariables || []
        const updated = [...currentVars]
        updated[index] = { ...updated[index], [field]: value }
        handleChange('inputVariables', updated)
    }

    // Validate variable name: non-empty, no whitespace, unique
    const validateVariableName = (name, index) => {
        if (!name) return 'Name is required'
        if (/\s/.test(name)) return 'No whitespace allowed'
        const currentVars = formData.inputVariables || []
        const duplicate = currentVars.some((v, i) => i !== index && v.name === name)
        if (duplicate) return 'Name must be unique'
        return null
    }

    const renderFields = () => {
        if (!node) return null

        switch (node.type) {
            case 'temporalStart':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <Box>
                            <Typography variant='body2' sx={{ mb: 1, fontWeight: 500 }}>
                                Trigger Mode
                            </Typography>
                            <ToggleButtonGroup
                                value={formData.triggerMode || 'manual'}
                                exclusive
                                onChange={(_, value) => {
                                    if (value) handleChange('triggerMode', value)
                                }}
                                size='small'
                            >
                                <ToggleButton value='manual' sx={{ textTransform: 'none' }}>
                                    <IconPlayerPlay size={16} style={{ marginRight: 6 }} />
                                    Manual
                                </ToggleButton>
                                <ToggleButton value='scheduled' sx={{ textTransform: 'none' }}>
                                    <IconClock size={16} style={{ marginRight: 6 }} />
                                    Scheduled
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {formData.triggerMode === 'scheduled' && (
                            <>
                                <TextField
                                    label='Schedule Interval'
                                    fullWidth
                                    value={formData.scheduleInterval || ''}
                                    onChange={(e) => handleChange('scheduleInterval', e.target.value)}
                                    placeholder='e.g., 10m, 1h, 1d'
                                    helperText='Format: <number><s|m|h|d> — e.g., 30s, 10m, 1h, 1d'
                                    error={formData.scheduleInterval !== '' && !/^(\d+)(s|m|h|d)$/.test(formData.scheduleInterval)}
                                />
                                <FormControl fullWidth>
                                    <InputLabel>Overlap Policy</InputLabel>
                                    <Select
                                        value={formData.overlapPolicy || 'SKIP'}
                                        label='Overlap Policy'
                                        onChange={(e) => handleChange('overlapPolicy', e.target.value)}
                                    >
                                        <MenuItem value='SKIP'>Skip (default)</MenuItem>
                                        <MenuItem value='ALLOW_ALL'>Allow All</MenuItem>
                                        <MenuItem value='BUFFER_ONE'>Buffer One</MenuItem>
                                        <MenuItem value='CANCEL_OTHER'>Cancel Other</MenuItem>
                                    </Select>
                                </FormControl>
                                <TextField
                                    label='Catchup Window (optional)'
                                    fullWidth
                                    value={formData.catchupWindow || ''}
                                    onChange={(e) => handleChange('catchupWindow', e.target.value)}
                                    placeholder='e.g., 5m, 1h'
                                    helperText='How far back to catch up on missed schedules'
                                />
                            </>
                        )}
                        {formData.scheduleId && formData.triggerMode === 'scheduled' && (
                            <Alert severity='info' sx={{ mt: 1 }}>
                                Click Reschedule in the toolbar to apply changes. Your workflow will be saved automatically.
                            </Alert>
                        )}

                        {/* Input Variables Section */}
                        <Divider sx={{ my: 1 }} />
                        <Box>
                            <Typography variant='body2' sx={{ mb: 1.5, fontWeight: 500 }}>
                                Input Variables
                            </Typography>
                            {(formData.inputVariables || []).map((variable, index) => {
                                const nameError = validateVariableName(variable.name, index)
                                return (
                                    <Box
                                        key={index}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 1,
                                            mb: 2,
                                            p: 1.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            position: 'relative'
                                        }}
                                    >
                                        <IconButton
                                            onClick={() => removeVariable(index)}
                                            size='small'
                                            sx={{ position: 'absolute', top: 4, right: 4 }}
                                        >
                                            <IconTrash size={16} />
                                        </IconButton>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', pr: 4 }}>
                                            <TextField
                                                size='small'
                                                label='Name'
                                                value={variable.name}
                                                onChange={(e) => updateVariable(index, 'name', e.target.value.replace(/\s/g, ''))}
                                                error={!!variable.name && !!nameError}
                                                helperText={variable.name ? nameError : ''}
                                                sx={{ flex: 2 }}
                                            />
                                            <FormControl size='small' sx={{ minWidth: 100 }}>
                                                <InputLabel>Type</InputLabel>
                                                <Select
                                                    value={variable.type || 'string'}
                                                    label='Type'
                                                    onChange={(e) => updateVariable(index, 'type', e.target.value)}
                                                >
                                                    <MenuItem value='string'>String</MenuItem>
                                                    <MenuItem value='number'>Number</MenuItem>
                                                    <MenuItem value='boolean'>Boolean</MenuItem>
                                                    <MenuItem value='object'>Object</MenuItem>
                                                    <MenuItem value='array'>Array</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={variable.required || false}
                                                        onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                                                        size='small'
                                                    />
                                                }
                                                label='Required'
                                                sx={{ mr: 0 }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <TextField
                                                size='small'
                                                label='Default Value'
                                                value={variable.defaultValue || ''}
                                                onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                                                sx={{ flex: 1 }}
                                                disabled={variable.required}
                                                helperText={variable.required ? 'Required fields cannot have defaults' : ''}
                                            />
                                            <TextField
                                                size='small'
                                                label='Description'
                                                value={variable.description || ''}
                                                onChange={(e) => updateVariable(index, 'description', e.target.value)}
                                                sx={{ flex: 1 }}
                                                placeholder='Optional help text'
                                            />
                                        </Box>
                                    </Box>
                                )
                            })}
                            <Button startIcon={<IconPlus size={16} />} onClick={addVariable} size='small' variant='outlined'>
                                Add Variable
                            </Button>
                            {(formData.inputVariables || []).length > 0 && (
                                <Alert severity='info' sx={{ mt: 2 }} icon={false}>
                                    Access in other nodes using: <code style={{ fontWeight: 500 }}>{'{{input.variableName}}'}</code>
                                </Alert>
                            )}
                        </Box>
                    </Box>
                )

            case 'temporalAgentFlowCall':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <FormControl fullWidth>
                            <InputLabel>AgentFlow</InputLabel>
                            <Select
                                value={formData.agentFlowId || ''}
                                label='AgentFlow'
                                onChange={(e) => {
                                    const selectedFlow = agentFlows.find((f) => f.id === e.target.value)
                                    handleChange('agentFlowId', e.target.value)
                                    handleChange('agentFlowName', selectedFlow?.name || '')
                                }}
                            >
                                {agentFlows.map((flow) => (
                                    <MenuItem key={flow.id} value={flow.id}>
                                        {flow.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>API Key</InputLabel>
                            <Select
                                value={formData.apiKeyId || ''}
                                label='API Key'
                                onChange={(e) => {
                                    const selectedKey = apiKeys.find((k) => k.id === e.target.value)
                                    handleChange('apiKeyId', e.target.value)
                                    handleChange('apiKeyName', selectedKey?.keyName || '')
                                }}
                            >
                                <MenuItem value=''>
                                    <em>None (use default)</em>
                                </MenuItem>
                                {apiKeys.map((key) => (
                                    <MenuItem key={key.id} value={key.id}>
                                        {key.keyName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Typography variant='caption' color='text.secondary'>
                            Select an API key to authenticate calls to the AgentFlow. Create API keys in Settings.
                        </Typography>
                        <TemporalTemplateInput
                            label='Question Template'
                            value={formData.question || ''}
                            onChange={(value) => handleChange('question', value)}
                            placeholder='Use {{variableName}} to reference workflow variables. Type {{ to see available variables.'
                            helperText='Template for the question sent to the AgentFlow'
                            multiline
                            rows={3}
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                    </Box>
                )

            case 'temporalTimer':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <TextField
                            label='Duration'
                            fullWidth
                            value={formData.duration || ''}
                            onChange={(e) => handleChange('duration', e.target.value)}
                            placeholder='e.g., 30s, 5m, 1h, 1d'
                            helperText='Duration format: 30s (seconds), 5m (minutes), 1h (hours), 1d (days)'
                        />
                    </Box>
                )

            case 'temporalHumanTask':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <TextField
                            label='Task Name'
                            fullWidth
                            value={formData.taskName || ''}
                            onChange={(e) => handleChange('taskName', e.target.value)}
                            placeholder='e.g., Review Application, Approve Request'
                            helperText='Display name for this human task'
                        />
                        <TextField
                            label='Assigned Role'
                            fullWidth
                            value={formData.assignedRole || ''}
                            onChange={(e) => handleChange('assignedRole', e.target.value)}
                            placeholder='e.g., Loan Officer, Approver, Manager'
                            helperText='Role responsible for completing this task'
                        />
                        <TemporalTemplateInput
                            label='Instructions'
                            value={formData.instructions || ''}
                            onChange={(value) => handleChange('instructions', value)}
                            placeholder='Provide detailed instructions for the human completing this task. Type {{ for variables.'
                            helperText='Instructions shown to the person completing the task'
                            multiline
                            rows={3}
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                        <TextField
                            label='Signal Name (optional)'
                            fullWidth
                            value={formData.signalName || ''}
                            onChange={(e) => handleChange('signalName', e.target.value)}
                            placeholder='Auto-generated if empty'
                            helperText='Custom signal name, or leave empty for auto-generated task_{nodeId}'
                        />
                        <TextField
                            label='Timeout (optional)'
                            fullWidth
                            value={formData.timeout || ''}
                            onChange={(e) => handleChange('timeout', e.target.value)}
                            placeholder='e.g., 24h, 7d'
                            helperText='Time limit for task completion'
                        />
                        <FormControl fullWidth>
                            <InputLabel>Timeout Behavior</InputLabel>
                            <Select
                                value={formData.timeoutBehavior || 'continue'}
                                label='Timeout Behavior'
                                onChange={(e) => handleChange('timeoutBehavior', e.target.value)}
                            >
                                <MenuItem value='continue'>Continue (workflow proceeds with timeout result)</MenuItem>
                                <MenuItem value='fail'>Fail (workflow throws error on timeout)</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                )

            case 'temporalCollectSignals':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <TextField
                            label='Signal Name'
                            fullWidth
                            value={formData.signalName || ''}
                            onChange={(e) => handleChange('signalName', e.target.value)}
                            placeholder='e.g., document_uploaded, approval_received'
                            helperText='Name of the signal to collect multiple times'
                        />
                        <TextField
                            label='Required Count'
                            fullWidth
                            type='number'
                            value={formData.requiredCount || 2}
                            onChange={(e) => handleChange('requiredCount', parseInt(e.target.value, 10) || 2)}
                            inputProps={{ min: 1 }}
                            helperText='Number of signals to collect before continuing'
                        />
                        <TextField
                            label='Timeout (optional)'
                            fullWidth
                            value={formData.timeout || ''}
                            onChange={(e) => handleChange('timeout', e.target.value)}
                            placeholder='e.g., 24h, 7d'
                            helperText='Overall timeout for collecting all signals'
                        />
                    </Box>
                )

            case 'temporalCondition':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <TemporalTemplateInput
                            label='Expression'
                            value={formData.expression || ''}
                            onChange={(value) => handleChange('expression', value)}
                            placeholder="e.g., {{result}} === 'approved' or {{count}} > 10. Type {{ for variables."
                            helperText='JavaScript-like expression that evaluates to true or false'
                            multiline
                            rows={2}
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                    </Box>
                )

            case 'temporalHTTPRequest':
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Label'
                            fullWidth
                            value={formData.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Method</InputLabel>
                            <Select
                                value={formData.method || 'GET'}
                                label='Method'
                                onChange={(e) => handleChange('method', e.target.value)}
                            >
                                <MenuItem value='GET'>GET</MenuItem>
                                <MenuItem value='POST'>POST</MenuItem>
                                <MenuItem value='PUT'>PUT</MenuItem>
                                <MenuItem value='PATCH'>PATCH</MenuItem>
                                <MenuItem value='DELETE'>DELETE</MenuItem>
                            </Select>
                        </FormControl>
                        <TemporalTemplateInput
                            label='URL'
                            value={formData.url || ''}
                            onChange={(value) => handleChange('url', value)}
                            placeholder='https://api.example.com/endpoint. Type {{ for variables.'
                            helperText='Use {{variableName}} for dynamic values'
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                        <TemporalTemplateInput
                            label='Headers (JSON)'
                            value={
                                typeof formData.headers === 'object' ? JSON.stringify(formData.headers, null, 2) : formData.headers || ''
                            }
                            onChange={(value) => {
                                try {
                                    const parsed = JSON.parse(value)
                                    handleChange('headers', parsed)
                                } catch {
                                    handleChange('headers', value)
                                }
                            }}
                            placeholder='{"Authorization": "Bearer {{token}}"}'
                            multiline
                            rows={2}
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                        <TemporalTemplateInput
                            label='Body (JSON)'
                            value={formData.body || ''}
                            onChange={(value) => handleChange('body', value)}
                            placeholder='{"key": "{{value}}"}'
                            helperText='Request body for POST/PUT/PATCH requests'
                            multiline
                            rows={3}
                            nodes={nodes}
                            edges={edges}
                            nodeId={node?.id}
                        />
                    </Box>
                )

            default:
                return <Typography color='text.secondary'>No configuration available for this node type.</Typography>
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant='h6'>Configure {node?.data?.label || 'Node'}</Typography>
                <IconButton onClick={onClose} size='small'>
                    <IconX size={20} />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>{renderFields()}</DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant='contained'>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    )
}

TemporalNodeConfigDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    dialogProps: PropTypes.object,
    onSave: PropTypes.func
}

export default TemporalNodeConfigDialog
