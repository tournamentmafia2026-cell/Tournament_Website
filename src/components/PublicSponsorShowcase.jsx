import React, { useState, useEffect, useMemo } from 'react'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'
import { fastDeepEqual } from '../utils/fastDeepEqual'

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

  // Watch storage and server changes dynamically in real-time
  useEffect(() => {
    const syncAds = () => {
      try {
        const savedAds = localStorage.getItem('badminton-stadium-ads')
        if (savedAds) {
          const parsedAds = JSON.parse(savedAds)
          setSponsorAds((prev) => (fastDeepEqual(prev, parsedAds) ? prev : parsedAds))
        }
        const savedSettings = localStorage.getItem('badminton-ad-settings')
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings)
          setAdSettings((prev) => (fastDeepEqual(prev, parsedSettings) ? prev : parsedSettings))
        }
      } catch {}
    }

    window.addEventListener('storage', syncAds)
    const interval = setInterval(syncAds, 4000)
    return () => {
      window.removeEventListener('storage', syncAds)
      clearInterval(interval)
    }
  }, [])

  const activeAds = useMemo(() => {
    return (sponsorAds || []).filter((a) => a.active !== false)
  }, [sponsorAds])

  // Dynamic user inputs for display timing and interval
  const durationSec = Math.max(3, Number(adSettings?.fullScreenDurationSeconds) || 10)
  const intervalMins = Math.max(1, Number(adSettings?.fullScreenIntervalMinutes) || 1)
  const rotationSec = Math.max(3, Number(adSettings?.standbySlideDurationSeconds) || durationSec)

  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0)
  const [activeVideoModal, setActiveVideoModal] = useState(null)
  const [isBannerVisible, setIsBannerVisible] = useState(true)

  // Smooth continuous sponsor rotation based on dynamic duration input
  useEffect(() => {
    if (activeAds.length <= 1) return
    const currentAd = activeAds[activeSponsorIndex]
    const effectiveSec = Number(currentAd?.displayDuration) || rotationSec || durationSec

    const timer = setInterval(() => {
      setActiveSponsorIndex((prev) => (prev + 1) % activeAds.length)
    }, Math.max(3000, effectiveSec * 1000))

    return () => clearInterval(timer)
  }, [activeAds, activeSponsorIndex, rotationSec, durationSec])

  // Dynamic ticker scroll duration
  const tickerDuration = useMemo(() => {
    const sp = adSettings?.tickerSpeed
    if (typeof sp === 'number') return `${sp}s`
    if (sp && !isNaN(Number(sp))) return `${Number(sp)}s`
    if (sp === 'ultra-fast') return '8s'
    if (sp === 'fast') return '14s'
    if (sp === 'normal') return '22s'
    if (sp === 'slow') return '32s'
    if (sp === 'ultra-slow') return '45s'
    return '28s'
  }, [adSettings?.tickerSpeed])

  if (activeAds.length === 0 && !adSettings?.topScrollingText && !adSettings?.bottomScrollingText) {
    return null
  }

  const currentFeaturedAd = activeAds[activeSponsorIndex] || activeAds[0]

  return (
    <div
      className="public-sponsor-showcase-wrap"
      style={{
        margin: position === 'top' ? '0 0 20px 0' : '20px 0',
        width: '100%',
        transition: 'all 0.3s ease',
      }}
    >
      {/* 1. OFFICIAL SPONSORS SHOWCASE BAR */}
      {activeAds.length > 0 && isBannerVisible && (
        <div style={{ marginBottom: '10px' }}>
          <div
            className="public-sponsor-ribbon"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.92) 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '16px',
              padding: '14px 18px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(56, 189, 248, 0.1)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Header / Spotlight Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Official Tournament Sponsors & Partners
                </span>
                {tournamentName && (
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                    • {tournamentName}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Spotlight: {currentFeaturedAd?.sponsorName} ({durationSec}s cycle)
                </span>
                <button
                  type="button"
                  onClick={() => setIsBannerVisible(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '13px',
                    cursor: 'pointer',
                    padding: '2px 6px',
                  }}
                  title="Hide Sponsors Banner"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sponsors Horizontal Cards Carousel */}
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
                const adColor = ad.accentColor || '#38bdf8'

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
                      maxWidth: '320px',
                      background: isFeatured ? 'rgba(30, 58, 138, 0.35)' : 'rgba(2, 6, 23, 0.75)',
                      border: `1.5px solid ${isFeatured ? '#38bdf8' : `${adColor}40`}`,
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: isVideo ? 'pointer' : 'default',
                      transition: 'all 0.3s ease',
                      boxShadow: isFeatured ? `0 0 16px ${adColor}30` : 'none',
                      transform: isFeatured ? 'translateY(-2px)' : 'none',
                    }}
                    title={isVideo ? 'Click to play Sponsor Video Commercial' : (ad.phoneOrLink || ad.tagline)}
                  >
                    {/* Logo / Video Thumbnail */}
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '8px',
                        background: isVideo ? 'rgba(16, 185, 129, 0.2)' : `${adColor}18`,
                        border: `1px solid ${adColor}40`,
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
                        <img src={ad.logoUrl} alt={ad.sponsorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '20px' }}>⭐</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 900, color: '#f8fafc', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ad.sponsorName}
                        </span>
                        {isVideo && (
                          <span style={{ background: '#10b981', color: '#ffffff', fontSize: '9px', fontWeight: 900, padding: '1px 5px', borderRadius: '4px' }}>
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
          </div>
        </div>
      )}

      {/* 2. DYNAMIC LIVE SCROLLING TICKERS */}
      {(adSettings.topScrollingText || adSettings.bottomScrollingText) && (
        <div
          className="public-ticker-bar"
          style={{
            background: 'linear-gradient(135deg, rgba(2, 6, 23, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
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
              <span style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', fontSize: '10px', fontWeight: 900, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
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
              <span style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontSize: '10px', fontWeight: 900, padding: '2px 7px', borderRadius: '4px', flexShrink: 0 }}>
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

      {/* Video Commercial Player Modal */}
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

            {activeVideoModal.phoneOrLink && (
              <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', color: '#38bdf8', fontWeight: 800 }}>
                📍 {activeVideoModal.phoneOrLink}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
