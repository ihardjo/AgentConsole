import logo from '@/assets/images/flowise_white.svg'
import logoDark from '@/assets/images/flowise_dark.svg'

import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)
    const [customLogo, setCustomLogo] = useState(null)
    const [logoTimestamp, setLogoTimestamp] = useState(Date.now())

    // Fetch custom logo from server
    useEffect(() => {
        const fetchCustomLogo = async () => {
            try {
                const response = await fetch(`${window.location.origin}/api/v1/platform-configuration/logo?t=${logoTimestamp}`)
                // Check for 200 OK specifically (204 No Content means no custom logo)
                if (response.ok && response.status === 200) {
                    const blob = await response.blob()
                    // Only create blob URL if we got actual content
                    if (blob.size > 0) {
                        const url = URL.createObjectURL(blob)
                        setCustomLogo(url)
                    } else {
                        setCustomLogo(null)
                    }
                } else {
                    // 204 or other non-200 status means no custom logo
                    setCustomLogo(null)
                }
            } catch (error) {
                setCustomLogo(null)
            }
        }

        fetchCustomLogo()

        // Cleanup blob URL on unmount
        return () => {
            if (customLogo) {
                URL.revokeObjectURL(customLogo)
            }
        }
    }, [logoTimestamp])

    // Listen for logo update events
    useEffect(() => {
        const handleLogoUpdate = (event) => {
            setLogoTimestamp(Date.now())
        }

        window.addEventListener('platformLogoUpdated', handleLogoUpdate)

        return () => {
            window.removeEventListener('platformLogoUpdated', handleLogoUpdate)
        }
    }, [])

    // Use custom logo if available, otherwise fall back to default
    const logoSrc = customLogo || (customization.isDarkMode ? logoDark : logo)

    return (
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'row', marginLeft: '10px' }}>
            <img
                style={{ objectFit: 'contain', height: 'auto', width: 150 }}
                src={logoSrc}
                alt='Flowise'
            />
        </div>
    )
}

export default Logo
