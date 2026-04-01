import PropTypes from 'prop-types'
import { Box, List, ListItemButton, ListItem, ListItemText, Typography, Stack, Chip } from '@mui/material'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { useSelector } from 'react-redux'
import { IconVariable, IconBox } from '@tabler/icons-react'

/**
 * TemporalSelectVariable - Variable selector for Temporal workflow nodes.
 * Displays available variables grouped by category (Input Variables, Node Outputs).
 */
const TemporalSelectVariable = ({ variables, disabled = false, onSelectVariable }) => {
    const customization = useSelector((state) => state.customization)

    // Group variables by category
    const inputVariables = variables.filter((v) => v.category === 'Input Variables')
    const nodeOutputs = variables.filter((v) => v.category === 'Node Outputs')

    // Group node outputs by node
    const nodeOutputsByNode = nodeOutputs.reduce((acc, variable) => {
        const nodeLabel = variable.nodeLabel || 'Unknown'
        if (!acc[nodeLabel]) {
            acc[nodeLabel] = []
        }
        acc[nodeLabel].push(variable)
        return acc
    }, {})

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

    const handleSelect = (variable) => {
        if (!disabled) {
            onSelectVariable(variable)
        }
    }

    if (variables.length === 0) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                    No variables available. Add input variables to the Start node or connect upstream nodes.
                </Typography>
            </Box>
        )
    }

    return (
        <Box sx={{ width: 320 }}>
            <Stack flexDirection='row' sx={{ mb: 1, px: 2, pt: 2 }}>
                <Typography variant='h6'>Select Variable</Typography>
            </Stack>
            <PerfectScrollbar style={{ height: '100%', maxHeight: 'calc(100vh - 220px)', overflowX: 'hidden' }}>
                <Box sx={{ px: 2, pb: 2 }}>
                    {/* Input Variables Section */}
                    {inputVariables.length > 0 && (
                        <>
                            <Typography
                                variant='subtitle2'
                                sx={{ mt: 1, mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                                <IconVariable size={16} />
                                Input Variables
                            </Typography>
                            <List dense disablePadding>
                                {inputVariables.map((variable, index) => (
                                    <ListItemButton
                                        key={`input-${index}`}
                                        sx={{
                                            p: 1,
                                            borderRadius: `${customization.borderRadius}px`,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            mb: 0.5,
                                            '&:hover': {
                                                borderColor: 'primary.main',
                                                bgcolor: 'action.hover'
                                            }
                                        }}
                                        disabled={disabled}
                                        onClick={() => handleSelect(variable)}
                                    >
                                        <ListItem disablePadding>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant='body2' fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                                                            {variable.displayLabel}
                                                        </Typography>
                                                        <Chip label={variable.type} size='small' color={getTypeColor(variable.type)} />
                                                        {variable.required && <Chip label='required' size='small' variant='outlined' />}
                                                    </Box>
                                                }
                                                secondary={variable.description}
                                            />
                                        </ListItem>
                                    </ListItemButton>
                                ))}
                            </List>
                        </>
                    )}

                    {/* Node Outputs Section */}
                    {Object.keys(nodeOutputsByNode).length > 0 && (
                        <>
                            <Typography
                                variant='subtitle2'
                                sx={{ mt: 2, mb: 1, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                                <IconBox size={16} />
                                Node Outputs
                            </Typography>
                            {Object.entries(nodeOutputsByNode).map(([nodeLabel, outputs]) => (
                                <Box key={nodeLabel} sx={{ mb: 1 }}>
                                    <Typography variant='caption' sx={{ color: 'text.secondary', ml: 1 }}>
                                        {nodeLabel}
                                    </Typography>
                                    <List dense disablePadding>
                                        {outputs.map((variable, index) => (
                                            <ListItemButton
                                                key={`output-${nodeLabel}-${index}`}
                                                sx={{
                                                    p: 1,
                                                    borderRadius: `${customization.borderRadius}px`,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    mb: 0.5,
                                                    '&:hover': {
                                                        borderColor: 'primary.main',
                                                        bgcolor: 'action.hover'
                                                    }
                                                }}
                                                disabled={disabled}
                                                onClick={() => handleSelect(variable)}
                                            >
                                                <ListItem disablePadding>
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography
                                                                    variant='body2'
                                                                    fontWeight={500}
                                                                    sx={{ fontFamily: 'monospace' }}
                                                                >
                                                                    {variable.displayLabel}
                                                                </Typography>
                                                                <Chip
                                                                    label={variable.type}
                                                                    size='small'
                                                                    color={getTypeColor(variable.type)}
                                                                />
                                                            </Box>
                                                        }
                                                        secondary={variable.description}
                                                    />
                                                </ListItem>
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Box>
                            ))}
                        </>
                    )}
                </Box>
            </PerfectScrollbar>
        </Box>
    )
}

TemporalSelectVariable.propTypes = {
    variables: PropTypes.arrayOf(
        PropTypes.shape({
            category: PropTypes.string.isRequired,
            displayLabel: PropTypes.string.isRequired,
            actualPath: PropTypes.string.isRequired,
            type: PropTypes.string,
            description: PropTypes.string,
            required: PropTypes.bool,
            nodeId: PropTypes.string,
            nodeLabel: PropTypes.string
        })
    ).isRequired,
    disabled: PropTypes.bool,
    onSelectVariable: PropTypes.func.isRequired
}

export default TemporalSelectVariable
