import { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    IconButton,
    FormControlLabel,
    Switch,
    Alert,
    Chip
} from '@mui/material'
import { IconX, IconPlayerPlay } from '@tabler/icons-react'

// ==============================|| RUN WORKFLOW DIALOG ||============================== //

/**
 * RunWorkflowDialog - Form-based dialog for entering input values when running manual workflows.
 * Dynamically generates form fields based on inputVariables array.
 * Validates required fields and coerces types before submitting.
 */
const RunWorkflowDialog = ({ open, onClose, workflow, inputVariables = [], onRun }) => {
    const [formData, setFormData] = useState({})
    const [errors, setErrors] = useState({})

    // Initialize form data with default values
    useEffect(() => {
        if (open) {
            const initial = {}
            for (const variable of inputVariables) {
                if (variable.defaultValue !== undefined && variable.defaultValue !== '') {
                    initial[variable.name] = variable.defaultValue
                } else if (variable.type === 'boolean') {
                    initial[variable.name] = false
                } else {
                    initial[variable.name] = ''
                }
            }
            setFormData(initial)
            setErrors({})
        }
    }, [open, inputVariables])

    const handleChange = (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
        // Clear error when field changes
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    // Client-side validation
    const validate = () => {
        const newErrors = {}

        for (const variable of inputVariables) {
            const value = formData[variable.name]

            // Check required fields
            if (variable.required) {
                if (value === undefined || value === null || value === '') {
                    newErrors[variable.name] = 'This field is required'
                    continue
                }
            }

            // Skip validation for empty optional fields
            if (value === undefined || value === null || value === '') continue

            // Type-specific validation
            switch (variable.type) {
                case 'number':
                    if (isNaN(Number(value))) {
                        newErrors[variable.name] = 'Must be a valid number'
                    }
                    break
                case 'object':
                    try {
                        const parsed = JSON.parse(value)
                        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                            newErrors[variable.name] = 'Must be a valid JSON object'
                        }
                    } catch {
                        newErrors[variable.name] = 'Must be valid JSON'
                    }
                    break
                case 'array':
                    try {
                        const parsed = JSON.parse(value)
                        if (!Array.isArray(parsed)) {
                            newErrors[variable.name] = 'Must be a valid JSON array'
                        }
                    } catch {
                        newErrors[variable.name] = 'Must be valid JSON array'
                    }
                    break
            }
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // Type coercion before submission
    const coerceValues = () => {
        const coerced = {}

        for (const variable of inputVariables) {
            let value = formData[variable.name]

            // Skip empty optional fields
            if ((value === undefined || value === null || value === '') && !variable.required) {
                continue
            }

            switch (variable.type) {
                case 'number':
                    coerced[variable.name] = Number(value)
                    break
                case 'boolean':
                    coerced[variable.name] = typeof value === 'boolean' ? value : value?.toLowerCase?.() === 'true'
                    break
                case 'object':
                case 'array':
                    try {
                        coerced[variable.name] = typeof value === 'string' ? JSON.parse(value) : value
                    } catch {
                        coerced[variable.name] = value
                    }
                    break
                default:
                    coerced[variable.name] = value
            }
        }

        return coerced
    }

    const handleSubmit = () => {
        if (validate()) {
            const coercedInput = coerceValues()
            onRun(coercedInput)
        }
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'string':
                return 'primary'
            case 'number':
                return 'secondary'
            case 'boolean':
                return 'warning'
            case 'object':
                return 'info'
            case 'array':
                return 'success'
            default:
                return 'default'
        }
    }

    const renderField = (variable) => {
        const value = formData[variable.name] ?? ''
        const error = errors[variable.name]

        switch (variable.type) {
            case 'boolean':
                return (
                    <FormControlLabel
                        control={
                            <Switch checked={!!value} onChange={(e) => handleChange(variable.name, e.target.checked)} color='primary' />
                        }
                        label={value ? 'True' : 'False'}
                    />
                )
            case 'object':
            case 'array':
                return (
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                        onChange={(e) => handleChange(variable.name, e.target.value)}
                        error={!!error}
                        helperText={error || (variable.type === 'object' ? 'Enter valid JSON object' : 'Enter valid JSON array')}
                        placeholder={variable.type === 'object' ? '{"key": "value"}' : '["item1", "item2"]'}
                    />
                )
            case 'number':
                return (
                    <TextField
                        fullWidth
                        type='number'
                        value={value}
                        onChange={(e) => handleChange(variable.name, e.target.value)}
                        error={!!error}
                        helperText={error || 'Enter a number'}
                    />
                )
            default:
                return (
                    <TextField
                        fullWidth
                        value={value}
                        onChange={(e) => handleChange(variable.name, e.target.value)}
                        error={!!error}
                        helperText={error}
                        placeholder={variable.description || ''}
                    />
                )
        }
    }

    const hasRequiredFields = useMemo(() => inputVariables.some((v) => v.required), [inputVariables])

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconPlayerPlay size={20} />
                    <Typography variant='h6'>Run {workflow?.name || 'Workflow'}</Typography>
                </Box>
                <IconButton onClick={onClose} size='small'>
                    <IconX size={20} />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {inputVariables.length === 0 ? (
                    <Typography color='text.secondary'>No input variables defined. The workflow will run with default values.</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant='body2' color='text.secondary'>
                            Provide values for the workflow input variables.
                        </Typography>

                        {inputVariables.map((variable) => (
                            <Box key={variable.name} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant='body2' fontWeight={500}>
                                        {variable.name}
                                    </Typography>
                                    <Chip label={variable.type} size='small' color={getTypeColor(variable.type)} />
                                    {variable.required && <Chip label='required' size='small' variant='outlined' color='error' />}
                                </Box>
                                {variable.description && (
                                    <Typography variant='caption' color='text.secondary'>
                                        {variable.description}
                                    </Typography>
                                )}
                                {renderField(variable)}
                            </Box>
                        ))}

                        {Object.keys(errors).length > 0 && <Alert severity='error'>Please fix the errors above before running.</Alert>}
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSubmit} variant='contained' startIcon={<IconPlayerPlay size={18} />}>
                    Run Workflow
                </Button>
            </DialogActions>
        </Dialog>
    )
}

RunWorkflowDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    workflow: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string
    }),
    inputVariables: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            type: PropTypes.oneOf(['string', 'number', 'boolean', 'object', 'array']).isRequired,
            required: PropTypes.bool,
            defaultValue: PropTypes.any,
            description: PropTypes.string
        })
    ),
    onRun: PropTypes.func.isRequired
}

export default RunWorkflowDialog
