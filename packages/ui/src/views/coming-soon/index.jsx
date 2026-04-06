// material-ui
import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// assets
import { IconHourglass } from '@tabler/icons-react'

// ==============================|| COMING SOON PAGE ||============================== //

const ComingSoon = () => {
    const theme = useTheme()

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 'calc(100vh - 200px)',
                gap: 2,
                color: theme.palette.text.secondary
            }}
        >
            <IconHourglass size={56} stroke={1} color={theme.palette.primary.main} />
            <Typography variant='h2' color='textPrimary'>
                Coming Soon
            </Typography>
            <Typography variant='body1' color='textSecondary' align='center' maxWidth={400}>
                This feature is currently under development. Stay tuned for updates!
            </Typography>
        </Box>
    )
}

export default ComingSoon
