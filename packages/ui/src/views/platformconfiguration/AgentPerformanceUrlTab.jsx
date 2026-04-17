import PropTypes from 'prop-types'
// material-ui
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// icons
import { IconDeviceFloppy } from '@tabler/icons-react'

// ==============================|| AGENT PERFORMANCE URL TAB ||============================== //

const AgentPerformanceUrlTab = ({ agentPerformanceUrl, originalAgentPerformanceUrl, saving, onChange, onSave }) => {
    const theme = useTheme()
    const hasUnsavedChanges = agentPerformanceUrl !== originalAgentPerformanceUrl

    return (
        <Box>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 2, lineHeight: 1.6, letterSpacing: '0.01em' }}>
                Set the Agent Performance URL for agent performance and monitoring. This will be used to track and analyze your AI
                agent&apos;s performance.
            </Typography>

            <Stack direction='row' spacing={2} alignItems='center'>
                <TextField
                    label='Agent Performance URL'
                    value={agentPerformanceUrl}
                    onChange={(e) => onChange(e.target.value)}
                    variant='outlined'
                    size='small'
                    placeholder='https://example.com/agent-performance/'
                    sx={{
                        width: 400,
                        '& .MuiOutlinedInput-root': {
                            '&:hover fieldset': { borderColor: theme.palette.primary.main }
                        }
                    }}
                />
                <Button
                    variant='contained'
                    onClick={onSave}
                    disabled={saving || !hasUnsavedChanges}
                    startIcon={saving ? <CircularProgress size={16} /> : <IconDeviceFloppy size={18} />}
                    sx={{
                        textTransform: 'none',
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        px: 3,
                        '&.Mui-disabled': {
                            boxShadow: 'none',
                            backgroundColor: theme.palette.action.disabledBackground,
                            color: theme.palette.action.disabled
                        }
                    }}
                >
                    Save
                </Button>
            </Stack>

            {hasUnsavedChanges && (
                <Alert severity='info' sx={{ mt: 2, '& .MuiAlert-message': { fontSize: '0.875rem', letterSpacing: '0.01em' } }}>
                    You have unsaved changes. Click Save to apply.
                </Alert>
            )}
        </Box>
    )
}

AgentPerformanceUrlTab.propTypes = {
    agentPerformanceUrl: PropTypes.string.isRequired,
    originalAgentPerformanceUrl: PropTypes.string.isRequired,
    saving: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired
}

export default AgentPerformanceUrlTab
