import platformsettingsApi from '@/api/platformsettings'
import platformConfigApi from '@/api/platformConfig'
import PropTypes from 'prop-types'
import { createContext, useContext, useEffect, useState } from 'react'

const ConfigContext = createContext()

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState({})
    const [loading, setLoading] = useState(true)
    const [isEnterpriseLicensed, setEnterpriseLicensed] = useState(false)
    const [isCloud, setCloudLicensed] = useState(false)
    const [isOpenSource, setOpenSource] = useState(false)
    const [appName, setAppName] = useState('AI Reinvention Engine')

    // Function to update document title
    const updateDocumentTitle = (name) => {
        if (name) {
            document.title = name
            setAppName(name)
        }
    }

    // Function to update favicon using public route (no auth required for browser to load)
    const updateFavicon = (hasActiveFavicon) => {
        // Use the public route that serves the active favicon
        // Add timestamp to bust browser cache
        const faviconUrl = hasActiveFavicon
            ? `/api/v1/platform-configuration/favicon?t=${Date.now()}`
            : '/favicon.ico'
        
        // Find existing favicon link or create new one
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
            appleTouchIcon.href = hasActiveFavicon ? faviconUrl : '/logo192.png'
        }
    }

    useEffect(() => {
        const userSettings = platformsettingsApi.getSettings()
        const activeConfig = platformConfigApi.getActiveConfig()
        
        Promise.all([userSettings, activeConfig])
            .then(([currentSettingsData, activeConfigData]) => {
                const finalData = {
                    ...currentSettingsData.data
                }
                setConfig(finalData)
                if (finalData.PLATFORM_TYPE) {
                    if (finalData.PLATFORM_TYPE === 'enterprise') {
                        setEnterpriseLicensed(true)
                        setCloudLicensed(false)
                        setOpenSource(false)
                    } else if (finalData.PLATFORM_TYPE === 'cloud') {
                        setCloudLicensed(true)
                        setEnterpriseLicensed(false)
                        setOpenSource(false)
                    } else {
                        setOpenSource(true)
                        setEnterpriseLicensed(false)
                        setCloudLicensed(false)
                    }
                }

                // Set document title from platform config
                if (activeConfigData?.data?.applicationName) {
                    updateDocumentTitle(activeConfigData.data.applicationName)
                }

                // Set favicon from platform config (use boolean to check if active favicon exists)
                if (activeConfigData?.data?.activeFavicon?.id) {
                    updateFavicon(true)
                }

                setLoading(false)
            })
            .catch((error) => {
                console.error('Error fetching data:', error)
                setLoading(false)
            })
    }, [])

    return (
        <ConfigContext.Provider value={{ config, loading, isEnterpriseLicensed, isCloud, isOpenSource, appName, updateDocumentTitle, updateFavicon }}>{children}</ConfigContext.Provider>
    )
}

export const useConfig = () => useContext(ConfigContext)

ConfigProvider.propTypes = {
    children: PropTypes.any
}
