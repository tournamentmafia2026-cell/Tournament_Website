import React, { useState, useEffect, useMemo, useRef } from 'react'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'

export function PublicSponsorShowcase({
  tournamentName = '',
  position = 'top', // 'top' | 'middle' | 'bottom'
}) {
  const [sponsorAds, setSponsorAds] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-stadium-ads')
      return saved ? JSON.parse(saved) : DEFAULT_SPONSOR_ADS
    } catch {
      return DEFAULT_SPONSOR_ADS
    }
  })

  const [adSettings, setAdSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-ad-settings')
      return saved ? JSON.parse(saved) : DEFAULT_AD_SETTINGS
    } catch {
      return DEFAULT_AD_SETTINGS
    }
  })

  // Watch storage changes in real-time
  useEffect(() => {
    const syncAds = () => {
      try {
        const savedAds = localStorage.getItem('badminton-stadium-ads')
        if (savedAds) setSponsorAds(JSON.parse(savedAds))
        const savedSettings = localStorage.getItem('badminton-ad-settings')
        if (savedSettings) setAdSettings(JSON.parse(savedSettings))
      } catch {}
    }
    window.addEventListener('storage', syncAds)
    return () => window.removeEventListener('storage', syncAds)
  }, [])

  // Active duration & interval timing in seconds
  const durationSec = Number(adSettings?.fullScreenDurationSeconds) || 10
  const intervalMins = Number(adSettings?.fullScreenIntervalMinutes) || 1
  const intervalSec = Math.max(intervalMins * 60, durationSec + 5)

  // Is display mode periodic or static
  const isPeriodic = adSettings?.publicDisplayMode !== 'static'

  // Periodic display state
  const [isBannerActive, setIsBannerActive] = useState(true)
  const [countdown, setCountdown] = useState(durationSec)
  const [secondsToNext, setSecondsToNext] = useState(intervalSec - durationSec)
  const [userPinned, setUserPinned] = useState(false)
  const [activeVideoModal, setActiveVideoModal] = useState(null)
  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0)

  const activeAds = useMemo(() => {
    return sponsorAds.filter((a) => a.active !== false)
  }, [sponsorAds])

  // Periodic 1-minute interval / 10-second appearance cycle
  useEffect(() => {
    if (!isPeriodic || userPinned || activeAds.length === 0) {
      setIsBannerActive(true)
      return
    }

    let isShown = true
    setIsBannerActive(true)
    setCountdown(durationSec)
    setSecondsToNext(intervalSec - durationSec)

    let currentCountdown = durationSec
    let currentSleep = intervalSec - durationSec

    const timer = setInterval(() => {
      if (isShown) {
        currentCountdown -= 1
        setCountdown(currentCountdown)
        if (currentCountdown <= 0) {
          isShown = false
          setIsBannerActive(false)
          currentSleep = intervalSec - durationSec
          setSecondsToNext(currentSleep)
        }
      } else {
        currentSleep -= 1
        setSecondsToNext(currentSleep)
        if (currentSleep <= 0) {
          isShown = true
          setIsBannerActive(true)
          currentCountdown = durationSec
          setCountdown(durationSec)
          // Cycle to next sponsor
          setActiveSponsorIndex((prev) => (prev + 1) % Math.max(activeAds.length, 1))
        }
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [isPeriodic, userPinned, durationSec, intervalSec, activeAds.length])

  const tickerDuration = useMemo(() => {
    const sp = adSettings?.tickerSpeed
    if (typeof sp === 'number') return `${sp}s`
    if (sp && !isNaN(Number(sp))) return `${Number(sp)}s`
    if (sp === 'ultra-fast') return '8s'
    if (sp === 'fast') return '14s'
    if (sp === 'normal') return '22s'
    if (sp === 'slow') return '32s'
    if (sp === 'ultra-slow') return '45s'
    return '30s'
  }, [adSettings?.tickerSpeed])

  if (adSettings?.showOnPublicPage === false) return null
  if (activeAds.length === 0 && !adSettings?.topScrollingText && !adSettings?.bottomScrollingText) return null

  const currentFeaturedAd = activeAds[activeSponsorIndex] || activeAds[0]

  return (
    <div className="public-sponsor-showcase-wrap" style={{ margin: position === 'top' ? '0 0 16px 0' : '16px 0', width: '100%', transition: 'all 0.3s ease' }}>
      {/* 1. OFFICIAL SPONSORS SHOWCASE */}
      {activeAds.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          {isBannerActive || userPinned ? (
            /* ACTIVE EXPANDED SPONSOR BANNER (Shown for 10s or when Pinned) */
            <div
              className="public-sponsor-ribbon"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '16px',
                padding: '12px 16px',
                boxShadow: '0 10px 35px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.15)',
                overflow: 'hidden',
                animation: 'sponsorBannerPopIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
              }}
            >
              {/* Top Bar with Spotlight Label & Auto-Hide Countdown */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px' }}>✨</span>
                  <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Official Tournament Partners & Sponsors
                  </span>
                  {tournamentName && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                      • {tournamentName}
                    </span>
                  )}
                </div>

                {/* Right Controls: Pin / Dismiss */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUserPinned(!userPinned)}
                    style={{
                      background: userPinned ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                      border: userPinned ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                      color: userPinned ? '#38bdf8' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                    title={userPinned ? 'Unpin (enable auto-cycle)' : 'Pin on screen'}
                  >
                    {userPinned ? '📌 Pinned' : '📌 Keep Open'}
                  </button>

                  {isPeriodic && !userPinned && (
                    <button
                      type="button"
                      onClick={() => setIsBannerActive(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '13px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Minimize Sponsor Bar"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sponsors Horizontal Scroll Cards */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  scrollbarWidth: 'thin',
                }}
              >
                {activeAds.map((ad, idx) => {
                  const isVideo = ad.mediaType === 'video' || Boolean(ad.videoUrl)
                  const isFeatured = idx === activeSponsorIndex
                  return (
                    <div
                      key={ad.id || idx}
                      onClick={() => {
                        if (isVideo && ad.videoUrl) {
                          setActiveVideoModal(ad)
                        }
                      }}
                      style={{
                        flex: '0 0 auto',
                        minWidth: '220px',
                        maxWidth: '310px',
                        background: isFeatured ? 'rgba(30, 58, 138, 0.4)' : 'rgba(2, 6, 23, 0.75)',
                        border: `1.5px solid ${isFeatured ? '#38bdf8' : isVideo ? '#10b981' : (ad.accentColor || 'rgba(56, 189, 248, 0.35)')}`,
                        borderRadius: '12px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: isVideo ? 'pointer' : 'default',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        boxShadow: isFeatured ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none',
                      }}
                      title={isVideo ? 'Click to play Sponsor Video Commercial' : (ad.phoneOrLink || ad.tagline)}
                    >
                      {/* Logo or Video Play Thumbnail */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: isVideo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {isVideo ? (
                          <span style={{ fontSize: '20px' }}>▶️</span>
                        ) : ad.logoUrl ? (
                          <img src={ad.logoUrl} alt={ad.sponsorName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '20px' }}>🏸</span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 900, color: '#f8fafc', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ad.sponsorName}
                          </span>
                          {isVideo && (
                            <span style={{ background: '#10b981', color: '#ffffff', fontSize: '9px', fontWeight: 900, padding: '1px 4px', borderRadius: '4px' }}>
                              VIDEO
                            </span>
                          )}
                        </div>
                        {ad.tagline && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                            {ad.tagline}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Progress bar line counting down the 10 seconds */}
              {isPeriodic && !userPinned && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '3px',
                    width: `${(countdown / durationSec) * 100}%`,
                    background: 'linear-gradient(90deg, #38bdf8 0%, #10b981 100%)',
                    transition: 'width 1s linear',
                  }}
                />
              )}
            </div>
          ) : (
            /* COMPACT MINIMIZED DISCRETE PILL (During the ~50s sleep period) */
            <div
              onClick={() => {
                setIsBannerActive(true)
                setCountdown(durationSec)
              }}
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.8) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '24px',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
              }}
              title="Click to view Tournament Sponsors & Offers"
            >
              <span style={{ fontSize: '13px' }}>✨</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#94a3b8' }}>
                Featured Sponsor: <strong style={{ color: '#38bdf8' }}>{currentFeaturedAd?.sponsorName || 'Partners'}</strong>
              </span>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '12px',
                }}
              >
                Next spotlight in {secondsToNext}s
              </span>
              <span style={{ fontSize: '11px', color: '#cbd5e1', textDecoration: 'underline' }}>
                View All Sponsors →
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. PUBLIC PAGE SCROLLING TICKER */}
      {(adSettings.topScrollingText || adSettings.bottomScrollingText) && (
        <div
          className="public-ticker-bar"
          style={{
            background: 'linear-gradient(135deg, rgba(2, 6, 23, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '8px 14px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          {adSettings.topScrollingText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                NEWS
              </span>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                <div
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    animation: `stadiumSponsorScroll ${tickerDuration} linear infinite`,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#38bdf8',
                  }}
                >
                  📢 {adSettings.topScrollingText} • 📢 {adSettings.topScrollingText} • 
                </div>
              </div>
            </div>
          )}

          {adSettings.bottomScrollingText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <span style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                OFFER
              </span>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                <div
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    animation: `stadiumSponsorScroll ${tickerDuration} linear infinite`,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#4ade80',
                  }}
                >
                  ⭐ {adSettings.bottomScrollingText} • ⭐ {adSettings.bottomScrollingText} • 
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Popup Modal for Spectators */}
      {activeVideoModal && (
        <div
          onClick={() => setActiveVideoModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              background: '#090d16',
              border: '2px solid #10b981',
              borderRadius: '20px',
              padding: '20px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(16, 185, 129, 0.3)',
              color: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#34d399' }}>
                  🎬 {activeVideoModal.sponsorName}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {activeVideoModal.tagline}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            <video
              src={activeVideoModal.videoUrl}
              controls
              autoPlay
              playsInline
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '12px',
                backgroundColor: '#000',
              }}
            />

            {activeVideoModal.ctaText && (
              <div style={{ marginTop: '14px', textAlign: 'center' }}>
                <span
                  style={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontWeight: 800,
                    padding: '8px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                  }}
                >
                  👉 {activeVideoModal.ctaText}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
