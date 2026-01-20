// material-ui
import { Box, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MainCard from '@/ui-component/cards/MainCard'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'

// icons
import { IconRocket } from '@tabler/icons-react'

const ComingSoonPage = ({ title = 'New Feature', IconComponent = IconRocket }) => {
    const theme = useTheme()
    const CenterIcon = IconComponent

    return (
        <MainCard>
            <Stack flexDirection='column' sx={{ gap: 3 }}>
                <Stack
                    sx={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60vh'
                    }}
                    flexDirection='column'
                >
                    <Box sx={{ p: 2, height: 'auto', mb: 1 }}>
                        <CenterIcon
                            size={64}
                            stroke={1.5}
                            style={{
                                color: theme.palette.secondary.main,
                                opacity: 0.7
                            }}
                        />
                    </Box>

                    <Typography variant='h4' sx={{ mt: 1, fontWeight: 600, color: theme.palette.text.primary }}>
                        {title} Coming Soon!
                    </Typography>

                    <Typography
                        variant='subtitle1'
                        sx={{ mt: 0.5, color: theme.palette.text.secondary, textAlign: 'center', maxWidth: 400 }}
                    >
                        We are actively building this feature to enhance your capabilities. Stay tuned for the launch.
                    </Typography>
                </Stack>
            </Stack>
            <ConfirmDialog />
        </MainCard>
    )
}

export default ComingSoonPage