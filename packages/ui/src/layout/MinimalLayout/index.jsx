import { Outlet } from 'react-router-dom'
import { usePlatformConfig } from '@/hooks/usePlatformConfig'

// ==============================|| MINIMAL LAYOUT ||============================== //

const MinimalLayout = () => {
    // Load platform configuration (app name and favicon) for public pages
    usePlatformConfig()

    return (
        <>
            <Outlet />
        </>
    )
}

export default MinimalLayout