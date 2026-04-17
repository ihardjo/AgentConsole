import logo from '@/assets/images/ai_reinvention_engine.svg'
import logoDark from '@/assets/images/ai_reinvention_engine_dark.svg'

import { useSelector } from 'react-redux'
import { useEffect, useRef, useState } from 'react'

// localStorage key for logo active state — shared with platformconfiguration and ConfigContext
const LOGO_CACHE_KEY = 'platform_logo_active'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    const customization = useSelector((state) => state.customization)
    const [customLogo, setCustomLogo] = useState(null)
    const [logoLoading, setLogoLoading] = useState(true)
    const [logoTimestamp, setLogoTimestamp] = useState(null) // null = use cache if available
    // Track the current blob URL in a ref so cleanup always revokes the latest URL
    const blobUrlRef = useRef(null)

    // Fetch custom logo from server
    useEffect(() => {
        let cancelled = false

        const fetchCustomLogo = async (skipCache = false) => {
            // ── Cache-first ──────────────────────────────────────────────────
            // If cache says no active logo, show default immediately — no fetch.
            if (!skipCache) {
                try {
                    const cached = localStorage.getItem(LOGO_CACHE_KEY)
                    if (cached === '0') {
                        // Definitively no custom logo; skip network entirely.
                        setCustomLogo(null)
                        setLogoLoading(false)
                        return
                    }
                    // cached === '1' or null → fall through to fetch
                } catch (_) {
                    // intentionally empty
                }
            }

            // ── Network fetch ────────────────────────────────────────────────
            setLogoLoading(true)
            try {
                const ts = Date.now()
                const response = await fetch(`${window.location.origin}/api/v1/platform-configuration/logo?t=${ts}`)
                if (cancelled) return

                // 200 OK means an active logo exists. 204 No Content means none is active.
                // Check status === 200 explicitly — response.ok would also pass for 204.
                if (response.status === 200) {
                    const blob = await response.blob()
                    if (cancelled) return
                    if (blob.size > 0) {
                        // Revoke previous blob URL before creating a new one
                        if (blobUrlRef.current) {
                            URL.revokeObjectURL(blobUrlRef.current)
                        }
                        const url = URL.createObjectURL(blob)
                        blobUrlRef.current = url
                        setCustomLogo(url)
                        try {
                            localStorage.setItem(LOGO_CACHE_KEY, '1')
                        } catch (_) {
                            // intentionally empty
                        }
                    } else {
                        setCustomLogo(null)
                        try {
                            localStorage.setItem(LOGO_CACHE_KEY, '0')
                        } catch (_) {
                            // intentionally empty
                        }
                    }
                } else {
                    // 204 No Content (or other non-200) = no active logo
                    setCustomLogo(null)
                    try {
                        localStorage.setItem(LOGO_CACHE_KEY, '0')
                    } catch (_) {
                        // intentionally empty
                    }
                }
            } catch (error) {
                if (!cancelled) setCustomLogo(null)
            } finally {
                if (!cancelled) setLogoLoading(false)
            }
        }

        // logoTimestamp===null means initial mount → respect cache.
        // A non-null value is set by the event handler → force refresh.
        fetchCustomLogo(logoTimestamp !== null)

        // Cleanup: cancel in-flight fetch result and revoke blob URL on unmount / re-run
        return () => {
            cancelled = true
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current)
                blobUrlRef.current = null
            }
        }
    }, [logoTimestamp])

    // Listen for logo update events — bust cache and refetch
    useEffect(() => {
        const handleLogoUpdate = () => {
            // Clear the cache so the next fetch is unconditional,
            // then trigger a re-fetch via timestamp change.
            try {
                localStorage.removeItem(LOGO_CACHE_KEY)
            } catch (_) {
                // intentionally empty
            }
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
        <img
            style={{
                objectFit: 'contain',
                height: '44px',
                width: 'auto',
                // Keep dimensions stable during load to avoid layout shift.
                // Use visibility instead of conditional rendering so the space
                // is reserved and no flicker occurs when the logo resolves.
                visibility: logoLoading ? 'hidden' : 'visible'
            }}
            src={logoSrc}
            alt='AI Reinvention Engine'
        />
    )
}

export default Logo
