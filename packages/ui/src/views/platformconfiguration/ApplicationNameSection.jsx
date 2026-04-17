import PropTypes from 'prop-types'
// material-ui
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
// icons
import { IconDeviceFloppy } from '@tabler/icons-react'

// ==============================|| APPLICATION NAME SECTION ||============================== //

const ApplicationNameSection = ({ applicationName, originalAppName, saving, onChange, onSave }) => {
    const theme = useTheme()
    const hasUnsavedChanges = applicationName !== originalAppName

    return (
        <Box>
            <Stack direction='row' alignItems='center' spacing={1} sx={{ mb: 2 }}>
                <Box
                    sx={{
                        width: 4,
                        height: 20,
                        backgroundColor: theme.palette.primary.main,
                        borderRadius: 1,
                        boxShadow: `0 0 8px ${theme.palette.primary.main}40`
                    }}
                />
                <Typography variant='h6' color='text.primary' sx={{ fontWeight: 600, letterSpacing: '0.01em' }}>
                    Application Name
                </Typography>
            </Stack>

            <Typography variant='body2' color='text.secondary' sx={{ mb: 2, lineHeight: 1.6, letterSpacing: '0.01em' }}>
                Set the name of your application. This will be displayed in the browser tab and throughout the application.
            </Typography>

            <Stack direction='row' spacing={2} alignItems='center'>
                <TextField
                    label='Application Name'
                    value={applicationName}
                    onChange={(e) => onChange(e.target.value)}
                    variant='outlined'
                    size='small'
                    sx={{
                        width: 300,
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

ApplicationNameSection.propTypes = {
    applicationName: PropTypes.string.isRequired,
    originalAppName: PropTypes.string.isRequired,
    saving: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired
}

export default ApplicationNameSection
