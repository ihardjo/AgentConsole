import { useEffect } from 'react'

/**
 * Hook to load and update platform configuration (app name and favicon)
 * This runs when the user is authenticated and has access to the platform
 */
export const usePlatformConfig = () => {
    useEffect(() => {
        const loadPlatformConfig = async () => {
            try {
                // Load app name
                const appNameResponse = await fetch(`${window.location.origin}/api/v1/platform-configuration/app-name`)
                if (appNameResponse.ok) {
                    const data = await appNameResponse.json()
                    if (data.applicationName && data.applicationName.trim()) {
                        document.title = data.applicationName
                    }
                }

                // Load favicon — use URL-based approach (no Blob URL, no memory leak)
                // Add timestamp to bust browser cache
                const faviconCheckResponse = await fetch(`${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`)
                if (faviconCheckResponse.ok) {
                    const faviconUrl = `${window.location.origin}/api/v1/platform-configuration/favicon?t=${Date.now()}`

                    // Update favicon link
                    let faviconLink = document.querySelector("link[rel*='icon']")
                    if (!faviconLink) {
                        faviconLink = document.createElement('link')
                        faviconLink.rel = 'icon'
                        document.head.appendChild(faviconLink)
                    }
                    faviconLink.href = faviconUrl

                    // Also update apple-touch-icon if it exists
                    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']")
                    if (appleTouchIcon) {
                        appleTouchIcon.href = faviconUrl
                    }
                }
            } catch (error) {
                console.log('Using default platform configuration')
            }
        }

        loadPlatformConfig()

        // Listen for platform configuration updates
        const handleLogoUpdate = () => {
            loadPlatformConfig()
        }

        const handleFaviconUpdate = () => {
            loadPlatformConfig()
        }

        const handleAppNameUpdate = () => {
            loadPlatformConfig()
        }

        window.addEventListener('platformLogoUpdated', handleLogoUpdate)
        window.addEventListener('platformFaviconUpdated', handleFaviconUpdate)
        window.addEventListener('platformAppNameUpdated', handleAppNameUpdate)

        return () => {
            window.removeEventListener('platformLogoUpdated', handleLogoUpdate)
            window.removeEventListener('platformFaviconUpdated', handleFaviconUpdate)
            window.removeEventListener('platformAppNameUpdated', handleAppNameUpdate)
        }
    }, [])
}
