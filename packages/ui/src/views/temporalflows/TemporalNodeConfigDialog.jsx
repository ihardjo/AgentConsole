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
    IconButton
} from '@mui/material'

// icons
import { IconX } from '@tabler/icons-react'

// ==============================|| TEMPORAL NODE CONFIG DIALOG ||============================== //

const TemporalNodeConfigDialog = ({ open, onClose, dialogProps, onSave }) => {
    const [formData, setFormData] = useState({})
    const node = dialogProps?.node
    const agentFlows = dialogProps?.agentFlows || []
    const apiKeys = dialogProps?.apiKeys || []

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
                        <Typography variant='body2' color='text.secondary'>
                            Input variables can be defined here. The workflow will receive these as initial parameters.
                        </Typography>
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
                        <TextField
                            label='Question Template'
                            fullWidth
                            multiline
                            rows={3}
                            value={formData.question || ''}
                            onChange={(e) => handleChange('question', e.target.value)}
                            placeholder='Use {{variableName}} to reference workflow variables'
                            helperText='Template for the question sent to the AgentFlow'
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

            case 'temporalSignalWait':
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
                            placeholder='e.g., approval, user_response'
                            helperText='Unique name for the signal to wait for'
                        />
                        <TextField
                            label='Timeout (optional)'
                            fullWidth
                            value={formData.timeout || ''}
                            onChange={(e) => handleChange('timeout', e.target.value)}
                            placeholder='e.g., 1h, 24h, 7d'
                            helperText='Optional timeout after which the workflow continues'
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
                        <TextField
                            label='Expression'
                            fullWidth
                            multiline
                            rows={2}
                            value={formData.expression || ''}
                            onChange={(e) => handleChange('expression', e.target.value)}
                            placeholder="e.g., {{result}} === 'approved' or {{count}} > 10"
                            helperText='JavaScript-like expression that evaluates to true or false'
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
                        <TextField
                            label='URL'
                            fullWidth
                            value={formData.url || ''}
                            onChange={(e) => handleChange('url', e.target.value)}
                            placeholder='https://api.example.com/endpoint'
                            helperText='Use {{variableName}} for dynamic values'
                        />
                        <TextField
                            label='Headers (JSON)'
                            fullWidth
                            multiline
                            rows={2}
                            value={
                                typeof formData.headers === 'object' ? JSON.stringify(formData.headers, null, 2) : formData.headers || ''
                            }
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value)
                                    handleChange('headers', parsed)
                                } catch {
                                    handleChange('headers', e.target.value)
                                }
                            }}
                            placeholder='{"Authorization": "Bearer {{token}}"}'
                        />
                        <TextField
                            label='Body (JSON)'
                            fullWidth
                            multiline
                            rows={3}
                            value={formData.body || ''}
                            onChange={(e) => handleChange('body', e.target.value)}
                            placeholder='{"key": "{{value}}"}'
                            helperText='Request body for POST/PUT/PATCH requests'
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
