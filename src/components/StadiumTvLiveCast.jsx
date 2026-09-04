import React, { useState, useEffect, useMemo } from 'react'
import { formatCategoryName, formatTournamentName, formatCourtName, formatAddress } from '../utils/textFormatters'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'

export const StadiumTvLiveCast = ({
  tournament,
  allTournaments = [],
  onClose,
  onStopStream,
  isPublicView = false,
}) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const urlTid = p.get('tid')
      if (urlTid) return urlTid
    } catch {}
    return tournament?.id || allTournaments[0]?.id || null
  })

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const urlTid = p.get('tid')
      if (urlTid) {
        setSelectedTournamentId(urlTid)
        return
      }
    } catch {}
    if (tournament?.id) {
      setSelectedTournamentId(tournament.id)
    }
  }, [tournament?.id])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const idleTimerRef = React.useRef(null)

  const [numCourts, setNumCourts] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-stadium-courts-count')
      return saved ? parseInt(saved, 10) : 4
    } catch {
      return 4
    }
  })

  // TV Screen Rotation / Orientation (0, 90, 180, 270 degrees)
  const [rotation, setRotation] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-tv-rotation')
      return saved ? parseInt(saved, 10) : 0
    } catch {
      return 0
    }
  })

  const handleRotateChange = (deg) => {
    const val = parseInt(deg, 10) || 0
    setRotation(val)
    try {
      localStorage.setItem('badminton-tv-rotation', val.toString())
    } catch (e) {
      console.error(e)
    }
  }

  const handleCycleRotate = () => {
    const nextRotation = (rotation + 90) % 360
    handleRotateChange(nextRotation)
  }

  // --- SPONSOR & ADVERTISEMENT BROADCAST SYNC ---
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

  // Auto-sync sponsor ads & settings from localStorage when updated on Fixtures page
  useEffect(() => {
    const syncAds = () => {
      try {
        const savedAds = localStorage.getItem('badminton-stadium-ads')
        if (savedAds) setSponsorAds(JSON.parse(savedAds))
        const savedSettings = localStorage.getItem('badminton-ad-settings')
        if (savedSettings) setAdSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error(e)
      }
    }
    window.addEventListener('storage', syncAds)
    const interval = setInterval(syncAds, 2000)
    return () => {
      window.removeEventListener('storage', syncAds)
      clearInterval(interval)
    }
  }, [])

  const activeAds = useMemo(() => {
    return (sponsorAds || []).filter((a) => a.active !== false)
  }, [sponsorAds])

  const [currentAdIndex, setCurrentAdIndex] = useState(0)

  const tickerAnimationDuration = useMemo(() => {
    if (adSettings?.tickerSpeed === 'fast') return '16s'
    if (adSettings?.tickerSpeed === 'normal') return '24s'
    return '32s' // Unified identical speed for all 3 scrolls
  }, [adSettings?.tickerSpeed])

  useEffect(() => {
    if (activeAds.length <= 1) return
    const intervalSec = (adSettings?.rotationInterval || 10) * 1000
    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % activeAds.length)
    }, intervalSec)
    return () => clearInterval(timer)
  }, [activeAds.length, adSettings?.rotationInterval])

  const currentHighlightAd = activeAds[currentAdIndex] || activeAds[0] || null

  // Auto-hide buttons when mouse is inactive for clean TV broadcast
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleMouseMove)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  const [tournamentDraws, setTournamentDraws] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-tournament-draws')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Track active score changes for BWF TV broadcast point flash effect
  const [flashScoredKeys, setFlashScoredKeys] = useState({})
  const prevScoresMapRef = React.useRef({})

  // Helper to compute International BWF Match/Game Point/Interval status
  const getBwfStatusBadge = (m, p1Pts, p2Pts, currentSet, p1SetsWon, p2SetsWon) => {
    // 11-point interval break
    if ((p1Pts === 11 && p2Pts < 11) || (p2Pts === 11 && p1Pts < 11)) {
      return { label: '☕ 11-PT INTERVAL', type: 'interval', player: null }
    }

    const isP1GamePoint = p1Pts >= 20 && p1Pts - p2Pts >= 1
    const isP2GamePoint = p2Pts >= 20 && p2Pts - p1Pts >= 1

    if (isP1GamePoint) {
      if (p1SetsWon === 1 && (currentSet === 2 || currentSet === 3)) {
        return { label: '🔥 MATCH POINT', type: 'match-point', player: 'player1' }
      }
      return { label: '⚡ GAME POINT', type: 'game-point', player: 'player1' }
    }
    if (isP2GamePoint) {
      if (p2SetsWon === 1 && (currentSet === 2 || currentSet === 3)) {
        return { label: '🔥 MATCH POINT', type: 'match-point', player: 'player2' }
      }
      return { label: '⚡ GAME POINT', type: 'game-point', player: 'player2' }
    }

    return { label: 'LIVE', type: 'live', player: null }
  }

  // Live real-time digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-reload tournament draws and scores with real-time storage events & fast 1.5s interval
  useEffect(() => {
    const syncDraws = () => {
      try {
        const saved = localStorage.getItem('badminton-tournament-draws')
        if (saved) {
          setTournamentDraws(JSON.parse(saved))
        }
      } catch {}
    }
    window.addEventListener('storage', syncDraws)
    const syncInterval = setInterval(syncDraws, 1500)
    return () => {
      window.removeEventListener('storage', syncDraws)
      clearInterval(syncInterval)
    }
  }, [])

  const [adminOpenedNotice, setAdminOpenedNotice] = useState(false)
  const [isCastTabGuideOpen, setIsCastTabGuideOpen] = useState(false)

  // Persist URL in livecast mode so page refresh never exits the live broadcast
  useEffect(() => {
    try {
      if (!window.location.search.includes('livecast=true')) {
        const tid = selectedTournamentId || tournament?.id || ''
        const newUrl = `${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
        window.history.replaceState(null, '', newUrl)
      }
    } catch {}
  }, [selectedTournamentId, tournament?.id])

  // Open Admin App in New Tab so THIS screen stays 100% on Live Stream Broadcast
  const handleOpenAdminInNewTab = (e) => {
    e?.stopPropagation()
    const adminUrl = `${window.location.origin}${window.location.pathname}`
    const win = window.open(adminUrl, '_blank')
    if (win) {
      win.focus()
    }
    setAdminOpenedNotice(true)
    setTimeout(() => setAdminOpenedNotice(false), 5000)
  }

  const handleExitLiveCast = (e) => {
    e?.stopPropagation()
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {}
    if (window.opener) {
      window.close()
    } else {
      onClose?.()
    }
  }

  const handleStopStreamAction = (e) => {
    e?.stopPropagation()
    try {
      localStorage.setItem('badminton-live-stream-active', 'false')
      window.dispatchEvent(new Event('storage'))
    } catch (err) {}
    if (onStopStream) {
      onStopStream()
    }
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {}
    if (window.opener) {
      window.close()
    } else {
      onClose?.()
    }
  }

  // Handle Dedicated Pop-out Window for TV / Projector / OBS Browser Source
  const handlePopoutWindow = (e) => {
    e?.stopPropagation()
    const tid = selectedTournamentId || tournament?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const targetWindowName = `BadmintonLiveCast_${tid || 'general'}`
    const win = window.open(url, targetWindowName, 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no')
    if (win) {
      win.focus()
    }
  }

  // Handle Court Count Change
  const handleCourtCountChange = (count) => {
    setNumCourts(count)
    try {
      localStorage.setItem('badminton-stadium-courts-count', String(count))
    } catch {}
  }

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // Live auto-sync tournaments list from localStorage so newly added tournaments appear immediately on TV
  const [liveTournaments, setLiveTournaments] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-published-matches')
      return saved ? JSON.parse(saved) : (allTournaments.length > 0 ? allTournaments : (tournament ? [tournament] : []))
    } catch {
      return allTournaments.length > 0 ? allTournaments : (tournament ? [tournament] : [])
    }
  })

  useEffect(() => {
    const syncTournaments = () => {
      try {
        const saved = localStorage.getItem('badminton-published-matches')
        if (saved) setLiveTournaments(JSON.parse(saved))
      } catch {}
    }
    window.addEventListener('storage', syncTournaments)
    const interval = setInterval(syncTournaments, 2500)
    return () => {
      window.removeEventListener('storage', syncTournaments)
      clearInterval(interval)
    }
  }, [])

  // Copy Direct TV Display Link
  const handleCopyTvLink = (e) => {
    e?.stopPropagation()
    const tid = selectedTournamentId || currentTournament?.id || ''
    const tvUrl = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    try {
      navigator.clipboard.writeText(tvUrl)
    } catch {}
    setAdminOpenedNotice('🔗 TV Display Link copied! Open this URL on your Smart TV, Projector, or Second Monitor. The TV will permanently show ONLY this Live Cast!')
    setTimeout(() => setAdminOpenedNotice(false), 5000)
  }

  // Active Tournament Object
  const currentTournament = useMemo(() => {
    const list = liveTournaments.length > 0 ? liveTournaments : allTournaments
    if (selectedTournamentId) {
      const found = list.find((t) => String(t.id) === String(selectedTournamentId))
      if (found) return found
    }
    return tournament || list[0] || null
  }, [selectedTournamentId, liveTournaments, allTournaments, tournament])

  // Extract all categories for this tournament
  const tournamentCategories = useMemo(() => {
    if (!currentTournament) return []
    return currentTournament.categories || [
      'Men Singles', 'Men Doubles', 'Women Singles', 'Women Doubles', 'Mixed Doubles', 'Boys Under 15', 'Girls Under 15'
    ]
  }, [currentTournament])

  // Aggregate all matches across all categories
  const allCategoryMatches = useMemo(() => {
    if (!currentTournament) return []
    const tId = currentTournament.id
    const matchesList = []

    tournamentCategories.forEach((cat) => {
      const drawKey = `${tId}-${cat}`
      const draw = tournamentDraws[drawKey]
      if (draw && draw.matches && Array.isArray(draw.matches)) {
        draw.matches.forEach((m) => {
          // Exclude BYE vs BYE placeholder matches
          if (m.player1?.isBye && m.player2?.isBye) return
          matchesList.push({
            ...m,
            categoryName: cat,
            drawKey,
          })
        })
      }
    })

    return matchesList
  }, [currentTournament, tournamentCategories, tournamentDraws])

  // Filter matches based on selected category
  const activePool = useMemo(() => {
    if (selectedCategory === 'all') return allCategoryMatches
    return allCategoryMatches.filter((m) => m.categoryName === selectedCategory)
  }, [allCategoryMatches, selectedCategory])

  // 1. STRICT LIVE MATCHES: Launched to 'live' by Umpire
  const allLiveLaunchedMatches = useMemo(() => {
    const list = activePool.filter((m) => {
      const isCompleted = m.status === 'completed' || !!m.winner || m.isCompleted
      if (isCompleted) return false
      if (m.player1?.isBye && m.player2?.isBye) return false
      return m.status === 'live' || (m.isLive === true && m.status !== 'scheduled')
    })

    return [...list].sort((a, b) => {
      const numA = parseInt(a.matchNumber, 10) || parseInt(a.line1, 10) || 9999
      const numB = parseInt(b.matchNumber, 10) || parseInt(b.line1, 10) || 9999
      if (numA !== numB) return numA - numB
      return (Number(a.round) || 1) - (Number(b.round) || 1)
    })
  }, [activePool])

  // 2. UPCOMING / SCHEDULED MATCHES: Not yet in-play
  const allUpcomingMatches = useMemo(() => {
    const list = activePool.filter((m) => {
      const isCompleted = m.status === 'completed' || !!m.winner || m.isCompleted
      if (isCompleted) return false
      if (m.player1?.isBye && m.player2?.isBye) return false
      const isLive = m.status === 'live' || (m.isLive === true && m.status !== 'scheduled')
      return !isLive
    })

    return [...list].sort((a, b) => {
      const numA = parseInt(a.matchNumber, 10) || parseInt(a.line1, 10) || 9999
      const numB = parseInt(b.matchNumber, 10) || parseInt(b.line1, 10) || 9999
      if (numA !== numB) return numA - numB
      return (Number(a.round) || 1) - (Number(b.round) || 1)
    })
  }, [activePool])

  // Display representations
  const displayLiveMatches = useMemo(() => {
    return allLiveLaunchedMatches.map((m, idx) => ({
      ...m,
      assignedCourtName: m.court || `Court ${idx + 1}`,
    }))
  }, [allLiveLaunchedMatches])

  const displayUpcomingMatches = useMemo(() => {
    return allUpcomingMatches.map((m, idx) => ({
      ...m,
      assignedCourtName: m.court || `Court ${((idx) % (numCourts || 4)) + 1}`,
    }))
  }, [allUpcomingMatches, numCourts])

  // Score change watcher for international TV point flash burst
  useEffect(() => {
    displayLiveMatches.forEach((m) => {
      const currentSet = m.liveScore?.currentSet || 1
      const p1Pts = m.liveScore?.pointsA ?? m[`scoreSet${currentSet}A`] ?? 0
      const p2Pts = m.liveScore?.pointsB ?? m[`scoreSet${currentSet}B`] ?? 0
      const key1 = `${m.id}-p1`
      const key2 = `${m.id}-p2`
      const prev1 = prevScoresMapRef.current[key1]
      const prev2 = prevScoresMapRef.current[key2]

      if (prev1 !== undefined && p1Pts > prev1) {
        setFlashScoredKeys((prev) => ({ ...prev, [key1]: true }))
        setTimeout(() => {
          setFlashScoredKeys((prev) => ({ ...prev, [key1]: false }))
        }, 1800)
      }
      if (prev2 !== undefined && p2Pts > prev2) {
        setFlashScoredKeys((prev) => ({ ...prev, [key2]: true }))
        setTimeout(() => {
          setFlashScoredKeys((prev) => ({ ...prev, [key2]: false }))
        }, 1800)
      }
      prevScoresMapRef.current[key1] = p1Pts
      prevScoresMapRef.current[key2] = p2Pts
    })
  }, [displayLiveMatches])

  // --- FULL-SCREEN SPONSOR INTERVAL & NO-LIVE-MATCH AUTO-SHOWCASE ---
  const [isFullScreenAdVisible, setIsFullScreenAdVisible] = useState(false)
  const [fullScreenAdIndex, setFullScreenAdIndex] = useState(0)
  const [fullScreenCountdown, setFullScreenCountdown] = useState(10)
  const [isManualDismissedNoLive, setIsManualDismissedNoLive] = useState(false)

  const visualAds = useMemo(() => {
    return activeAds.filter((a) => a.mediaType === 'video' || a.mediaType === 'image' || a.logoUrl || a.videoUrl)
  }, [activeAds])

  const hasLiveMatches = (displayLiveMatches || []).length > 0

  // When there are NO live matches: Auto-run full screen showcase continuously
  const isNoLiveAutoShowcase = !hasLiveMatches && visualAds.length > 0 && !isManualDismissedNoLive

  // Reset manual dismissal if a live match starts or stops
  useEffect(() => {
    setIsManualDismissedNoLive(false)
  }, [hasLiveMatches])

  // Continuous auto-rotation between all visual ads when no live matches are active
  useEffect(() => {
    if (!isNoLiveAutoShowcase || visualAds.length <= 1) return
    const durSec = (parseInt(adSettings?.fullScreenDurationSeconds, 10) || 10) * 1000
    const autoLoopTimer = setInterval(() => {
      setFullScreenAdIndex((prev) => (prev + 1) % visualAds.length)
    }, durSec)
    return () => clearInterval(autoLoopTimer)
  }, [isNoLiveAutoShowcase, visualAds.length, adSettings?.fullScreenDurationSeconds])

  // When live matches ARE active: trigger full-screen ad on configured interval
  useEffect(() => {
    if (!hasLiveMatches) return

    const intervalMins = parseInt(adSettings?.fullScreenIntervalMinutes, 10)
    if (!intervalMins || intervalMins <= 0 || visualAds.length === 0 || adSettings?.intermissionMode) return

    const intervalMs = intervalMins * 60 * 1000
    const timer = setInterval(() => {
      setFullScreenAdIndex((prev) => (prev + 1) % visualAds.length)
      const durSec = parseInt(adSettings?.fullScreenDurationSeconds, 10) || 10
      setFullScreenCountdown(durSec)
      setIsFullScreenAdVisible(true)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [hasLiveMatches, adSettings?.fullScreenIntervalMinutes, adSettings?.fullScreenDurationSeconds, adSettings?.intermissionMode, visualAds.length])

  // Countdown timer when interval full-screen ad is active during live matches
  useEffect(() => {
    if (!isFullScreenAdVisible) return
    const countTimer = setInterval(() => {
      setFullScreenCountdown((prev) => {
        if (prev <= 1) {
          setIsFullScreenAdVisible(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countTimer)
  }, [isFullScreenAdVisible])

  const currentFullScreenAd = visualAds[fullScreenAdIndex] || visualAds[0] || activeAds[0] || null

  const handleTriggerManualSpotlight = () => {
    if (visualAds.length === 0 && activeAds.length === 0) {
      alert('No active image or video sponsors configured. Please add an image or video sponsor in Ads & Sponsors manager.')
      return
    }
    const durSec = parseInt(adSettings?.fullScreenDurationSeconds, 10) || 10
    setFullScreenCountdown(durSec)
    setIsFullScreenAdVisible(true)
  }

  // Synchronize fullscreen state with browser fullscreen changes (e.g. F11 or Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Dynamic Viewport Aspect Ratio calculation for perfect auto-adjustment in 0, 90, 180, 270 deg rotations
  const [viewportRatio, setViewportRatio] = useState(() => {
    try {
      const w = window.innerWidth || 1920
      const h = window.innerHeight || 1080
      return (rotation === 90 || rotation === 270) ? h / w : w / h
    } catch {
      return 16 / 9
    }
  })

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 1920
      const h = window.innerHeight || document.documentElement.clientHeight || 1080
      const effRatio = (rotation === 90 || rotation === 270) ? h / w : w / h
      setViewportRatio(effRatio)
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [rotation])

  const isPortrait = viewportRatio < 1.15
  const liveCountClass = `live-count-${Math.min(Math.max(displayLiveMatches.length, 1), 8)}`

  const containerStyle = useMemo(() => {
    if (rotation === 90) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        width: '100dvh',
        height: '100dvw',
        maxWidth: 'none',
        maxHeight: 'none',
        transform: 'translate(-50%, -50%) rotate(90deg)',
        transformOrigin: 'center center',
      }
    }
    if (rotation === 180) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        width: '100dvw',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        transform: 'translate(-50%, -50%) rotate(180deg)',
        transformOrigin: 'center center',
      }
    }
    if (rotation === 270) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        width: '100dvh',
        height: '100dvw',
        maxWidth: 'none',
        maxHeight: 'none',
        transform: 'translate(-50%, -50%) rotate(270deg)',
        transformOrigin: 'center center',
      }
    }
    return {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      transform: 'none',
    }
  }, [rotation])

  return (
    <div
      style={containerStyle}
      className={`stadium-tv-cast-container tv-rotate-${rotation} ${isPortrait ? 'is-portrait-tv' : 'is-landscape-tv'} ${liveCountClass} no-upcoming`}
      onDoubleClick={handleToggleFullscreen}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* 1. TOP STADIUM TV BROADCAST HEADER */}
      <header className="stadium-tv-header">
        <div className="stadium-tv-brand">
          <div>
            <h1 className="stadium-tv-title">
              {formatTournamentName(currentTournament?.matchName || 'Badminton Championship')}
            </h1>
            <div className="stadium-tv-venue-meta">
              <span>🏟️ {formatAddress(currentTournament?.matchAddress) || formatCourtName(currentTournament?.courtName) || 'Main Stadium Arena'}</span>
              <span>•</span>
              <span>📅 {currentTournament?.startDate || 'Today'}</span>
            </div>
          </div>
        </div>

        {/* Real-time Clock, Category Filter & Controls */}
        <div className="stadium-tv-top-controls" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Action Buttons - Auto-fade out on idle for 100% clean TV broadcast */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.4s ease',
              pointerEvents: showControls ? 'auto' : 'none',
            }}
          >
            {/* Live Stream Active Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
                border: '1.5px solid rgba(239, 68, 68, 0.6)',
                color: '#fca5a5',
                fontWeight: '900',
                fontSize: '13px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 10px #ef4444',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <span>Live Broadcast</span>
            </div>


            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="stadium-tv-select"
            >
              <option value="all">⚡ All Categories ({allCategoryMatches.length} Matches)</option>
              {tournamentCategories.map((c) => (
                <option key={c} value={c}>
                  {formatCategoryName(c)}
                </option>
              ))}
            </select>

            {/* TV Screen Rotation / Orientation Selector */}
            <select
              value={rotation}
              onChange={(e) => handleRotateChange(e.target.value)}
              className="stadium-tv-select"
              title="TV Orientation (Rotate for Vertical TV Mounts)"
            >
              <option value={0}>🖥️ 0° Landscape (Horizontal)</option>
              <option value={90}>📱 90° Portrait (Vertical Right)</option>
              <option value={180}>🔄 180° Inverted</option>
              <option value={270}>📱 270° Portrait (Vertical Left)</option>
            </select>

            {/* Quick Rotate Button */}
            <button
              type="button"
              onClick={handleCycleRotate}
              className="stadium-tv-btn rotate-btn"
              title="Quick Rotate Screen 90°"
            >
              🔄 Rotate ({rotation}°)
            </button>

            {/* Fullscreen TV Trigger */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="stadium-tv-btn fullscreen-btn"
              title="Toggle TV Fullscreen (F11)"
            >
              {isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen'}
            </button>

            {/* Manual Fullscreen Sponsor Commercial Trigger */}
            <button
              type="button"
              onClick={handleTriggerManualSpotlight}
              className="stadium-tv-btn sponsor-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.4) 100%)',
                border: '1.5px solid #10b981',
                color: '#6ee7b7',
                fontWeight: '800',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              title="Showcase Full Screen Sponsor Commercial Now"
            >
              ⭐ Sponsor Spotlight
            </button>

            {/* Dedicated Stop Live Stream Button */}
            <button
              type="button"
              onClick={handleStopStreamAction}
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.5) 100%)',
                border: '1.5px solid #ef4444',
                color: '#fee2e2',
                padding: '7px 14px',
                borderRadius: '10px',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.45)',
                transition: 'all 0.2s ease',
              }}
              title="Stop Live Stream & Exit Broadcast"
            >
              <span style={{ fontSize: '13px' }}>⏹️</span>
              <span>Stop Live Stream</span>
            </button>

            {/* Back to App / Exit Live Cast */}
            <button
              type="button"
              onClick={handleExitLiveCast}
              className="stadium-tv-btn back-to-app-btn"
              title="Exit and return to App"
            >
              ✕ Back to App
            </button>
          </div>

          {/* Real-time Digital Clock - Fixed Firmly on the Right Corner */}
          <div
            className="stadium-tv-clock-badge"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              boxShadow: '0 0 16px rgba(56, 189, 248, 0.25)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: '900',
              color: '#38bdf8',
              letterSpacing: '0.05em',
            }}
          >
            <span className="clock-icon" style={{ fontSize: '15px' }}>⏱</span>
            <span className="clock-time" style={{ fontFamily: 'monospace' }}>{currentTime}</span>
          </div>
        </div>
      </header>

      {/* Admin Opened / Notification Banner */}
      {adminOpenedNotice && (
        <div
          style={{
            position: 'fixed',
            top: '75px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            border: '2px solid #38bdf8',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(56, 189, 248, 0.5)',
            borderRadius: '16px',
            padding: '12px 24px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '90vw',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <span style={{ fontSize: '22px' }}>{typeof adminOpenedNotice === 'string' && adminOpenedNotice.includes('🔗') ? '🔗' : '🚀'}</span>
          <div>
            <div style={{ fontWeight: '900', fontSize: '14px', color: '#38bdf8' }}>
              {typeof adminOpenedNotice === 'string' && adminOpenedNotice.includes('🔗') ? 'TV Broadcast Display Link' : 'Admin Portal Opened in New Tab!'}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
              {typeof adminOpenedNotice === 'string' ? adminOpenedNotice : (
                <>This screen will stay on <strong>Live Broadcast</strong>. Update scores in the new tab; changes sync here instantly.</>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SPONSOR BANNER RIBBON STRIP - AUTO-SCROLLING */}
      {adSettings.showBannerBar && activeAds.length > 0 && !adSettings.intermissionMode && (
        <div className="stadium-sponsor-ribbon">
          <div className="stadium-sponsor-label">
            <span>✨ OFFICIAL SPONSORS</span>
          </div>
          <div className="stadium-sponsor-chips-carousel">
            <div className="stadium-sponsor-marquee-track" style={{ animationDuration: tickerAnimationDuration }}>
              {/* First loop of sponsor chips */}
              {activeAds.map((ad, idx) => (
                <div
                  key={`top-sponsor-1-${ad.id || idx}`}
                  className="stadium-sponsor-chip"
                  style={{
                    borderLeftColor: ad.accentColor || '#38bdf8',
                  }}
                >
                  {ad.logoUrl ? (
                    <img src={ad.logoUrl} alt={ad.sponsorName} className="sponsor-chip-logo" />
                  ) : (
                    <span className="sponsor-chip-icon">🏸</span>
                  )}
                  <span className="sponsor-chip-name">{ad.sponsorName}</span>
                  <span className="sponsor-chip-badge" style={{ color: ad.accentColor || '#38bdf8' }}>
                    {ad.badge || 'Official Sponsor'}
                  </span>
                  {ad.tagline && (
                    <span className="sponsor-chip-tagline">“{ad.tagline}”</span>
                  )}
                </div>
              ))}

              {/* Second duplicated loop for seamless infinite scrolling */}
              {activeAds.map((ad, idx) => (
                <div
                  key={`top-sponsor-2-${ad.id || idx}`}
                  className="stadium-sponsor-chip"
                  style={{
                    borderLeftColor: ad.accentColor || '#38bdf8',
                  }}
                >
                  {ad.logoUrl ? (
                    <img src={ad.logoUrl} alt={ad.sponsorName} className="sponsor-chip-logo" />
                  ) : (
                    <span className="sponsor-chip-icon">🏸</span>
                  )}
                  <span className="sponsor-chip-name">{ad.sponsorName}</span>
                  <span className="sponsor-chip-badge" style={{ color: ad.accentColor || '#38bdf8' }}>
                    {ad.badge || 'Official Sponsor'}
                  </span>
                  {ad.tagline && (
                    <span className="sponsor-chip-tagline">“{ad.tagline}”</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INTERMISSION FULLSCREEN SPONSOR SHOWCASE OVERLAY */}
      {adSettings.intermissionMode && currentHighlightAd && (
        <div className="stadium-intermission-overlay">
          <div className="stadium-intermission-card" style={{ borderColor: currentHighlightAd.accentColor || '#38bdf8' }}>
            <span className="intermission-badge" style={{ background: currentHighlightAd.accentColor || '#38bdf8' }}>
              {currentHighlightAd.badge || '👑 Title Sponsor'}
            </span>

            {/* Video or Image Media Showcase */}
            {Boolean(currentHighlightAd.videoUrl) ? (
              <div className="intermission-video-frame">
                <video
                  src={currentHighlightAd.videoUrl}
                  autoPlay
                  loop
                  muted={adSettings.videoMuted !== false}
                  playsInline
                  className="intermission-video-elem"
                />
              </div>
            ) : currentHighlightAd.logoUrl ? (
              <div className="intermission-img-frame">
                <img src={currentHighlightAd.logoUrl} alt={currentHighlightAd.sponsorName} className="intermission-logo" />
              </div>
            ) : (
              <div className="intermission-icon">🏸</div>
            )}

            <h1 className="intermission-title">{currentHighlightAd.sponsorName}</h1>
            <p className="intermission-tagline">“{currentHighlightAd.tagline}”</p>
            {currentHighlightAd.description && (
              <p className="intermission-desc">{currentHighlightAd.description}</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', margin: '14px 0 20px' }}>
              {currentHighlightAd.ctaText && (
                <span className="intermission-cta-btn" style={{ background: currentHighlightAd.accentColor || '#38bdf8' }}>
                  {currentHighlightAd.ctaText}
                </span>
              )}
              {currentHighlightAd.phoneOrLink && (
                <div className="intermission-contact">
                  📍 {currentHighlightAd.phoneOrLink}
                </div>
              )}
            </div>

            <div className="intermission-footer">
              <span>🏆 Official Partner of {formatTournamentName(currentTournament?.matchName || 'Badminton Championship')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN TV BODY - DYNAMICALLY DRIVEN BY LIVE UMPIRE STATUS */}
      <main className="stadium-tv-main">
        {displayLiveMatches.length > 0 ? (
          /* CASE 1: LIVE MATCHES IN-PLAY ON COURTS */
          <section className="stadium-broadcast-section live-section fill-full-screen">
            <div className="stadium-section-header">
              <div className="stadium-section-title-wrap">
                <span className="stadium-live-pulse-dot" />
                <h2 className="stadium-section-title">🔴 LIVE MATCHES ({displayLiveMatches.length})</h2>
                <span className="stadium-section-subtitle">• In-Play on Courts (Live Umpire Active)</span>
              </div>
              <span className="stadium-mode-tag auto-dispatch">
                ⚡ Live Scoreboard
              </span>
            </div>

            <div className="stadium-table-container live-table-wrap">
              <table className="stadium-broadcast-table stadium-live-table">
                <thead>
                  <tr>
                    <th className="th-court">COURT & MATCH</th>
                    <th className="th-cat">CATEGORY & ROUND</th>
                    <th className="th-p1" style={{ textAlign: 'right' }}>PLAYER / TEAM 1</th>
                    <th className="th-score" style={{ textAlign: 'center' }}>LIVE SCORE</th>
                    <th className="th-p2" style={{ textAlign: 'left' }}>PLAYER / TEAM 2</th>
                    <th className="th-status" style={{ textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLiveMatches.map((m, idx) => {
                    const p1 = m.player1
                    const p2 = m.player2
                    const p1Name = p1?.name || 'Player 1'
                    const p2Name = p2?.name || 'Player 2'
                    const currentSet = m.liveScore?.currentSet || 1
                    const p1Pts = m.liveScore?.pointsA ?? m[`scoreSet${currentSet}A`] ?? 0
                    const p2Pts = m.liveScore?.pointsB ?? m[`scoreSet${currentSet}B`] ?? 0
                    const courtDisplay = m.assignedCourtName || m.court || `Court ${idx + 1}`

                    const bwfStatus = getBwfStatusBadge(m, p1Pts, p2Pts, currentSet, m.liveScore?.setsWonA || 0, m.liveScore?.setsWonB || 0)
                    const isP1Flashing = Boolean(flashScoredKeys[`${m.id}-p1`])
                    const isP2Flashing = Boolean(flashScoredKeys[`${m.id}-p2`])

                    return (
                      <tr
                        key={m.id || `live-${idx}`}
                        className={`stadium-table-row live-row ${bwfStatus.type === 'match-point' ? 'row-match-point' : ''}`}
                      >
                        {/* 1. Court & Match Pill */}
                        <td className="table-court-cell">
                          <div className="table-court-tag">
                            <span className="clean-live-dot" />
                            <span className="court-name-bold">{courtDisplay}</span>
                          </div>
                          <span className="table-match-pill">Match #{m.matchNumber || idx + 1}</span>
                        </td>

                        {/* 2. Category & Round */}
                        <td className="table-category-cell">
                          <div className="table-cat-title">{formatCategoryName(m.categoryName)}</div>
                          {m.roundName && <div className="table-cat-sub">{m.roundName}</div>}
                        </td>

                        {/* 3. Player 1 */}
                        <td className="table-player-cell p1-cell">
                          <div className="table-player-wrap right-align">
                            <span className="table-player-name">{p1Name}</span>
                            {Boolean(p1?.seed || p1?.isSeed) && (
                              <span className="stadium-seed-badge">S{p1.seed || p1.seedNumber || ''}</span>
                            )}
                          </div>
                          {p1?.place && <div className="table-player-place right-align">{p1.place}</div>}
                        </td>

                        {/* 4. Live Sets & Points Score */}
                        <td className="table-score-cell">
                          <div className="table-set-pill-wrap">
                            <div className="table-live-points-main">
                              <span className={`live-point-num ${isP1Flashing ? 'bwf-point-flash' : ''}`}>{p1Pts}</span>
                              <span className="live-pts-dash">-</span>
                              <span className={`live-point-num ${isP2Flashing ? 'bwf-point-flash' : ''}`}>{p2Pts}</span>
                            </div>
                            <div className="table-sets-sub-line">
                              <span className="table-set-label">Set {currentSet}</span>
                              {(m.scoreSet1A !== undefined || m.scoreSet2A !== undefined) && (
                                <span className="table-sets-box">
                                  {m.scoreSet1A || 0}-{m.scoreSet1B || 0}
                                  {m.scoreSet2A !== undefined ? `, ${m.scoreSet2A || 0}-${m.scoreSet2B || 0}` : ''}
                                  {m.scoreSet3A !== undefined ? `, ${m.scoreSet3A || 0}-${m.scoreSet3B || 0}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 5. Player 2 */}
                        <td className="table-player-cell p2-cell">
                          <div className="table-player-wrap left-align">
                            {Boolean(p2?.seed || p2?.isSeed) && (
                              <span className="stadium-seed-badge">S{p2.seed || p2.seedNumber || ''}</span>
                            )}
                            <span className="table-player-name">{p2Name}</span>
                          </div>
                          {p2?.place && <div className="table-player-place left-align">{p2.place}</div>}
                        </td>

                        {/* 6. Status Badge */}
                        <td className="table-status-cell">
                          <span className={`stadium-bwf-badge ${bwfStatus.type}`}>
                            {bwfStatus.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* UPCOMING MATCHES QUEUE (Shown below live matches when in-play) */}
            {displayUpcomingMatches.length > 0 && (
              <div className="stadium-upcoming-preview-strip">
                <div className="upcoming-preview-label">
                  <span className="clean-upcoming-dot" />
                  <span>⏳ NEXT UP ({displayUpcomingMatches.length}):</span>
                </div>
                <div className="upcoming-preview-chips">
                  {displayUpcomingMatches.slice(0, 6).map((up) => (
                    <div key={`up-preview-${up.id || up.matchNumber}`} className="upcoming-preview-chip">
                      <span className="up-court-tag">{up.assignedCourtName}</span>
                      <span className="up-match-tag">#{up.matchNumber || ''}</span>
                      <span className="up-names">{up.player1?.name || 'P1'} vs {up.player2?.name || 'P2'}</span>
                      <span className="up-cat-badge">{formatCategoryName(up.categoryName)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          /* CASE 2: NO LIVE MATCHES IN-PLAY -> SHOW FULL UPCOMING MATCHES QUEUE */
          <section className="stadium-broadcast-section live-section fill-full-screen">
            <div className="stadium-section-header">
              <div className="stadium-section-title-wrap">
                <span className="stadium-upcoming-pulse-dot" />
                <h2 className="stadium-section-title">⏳ UPCOMING MATCHES ({displayUpcomingMatches.length})</h2>
                <span className="stadium-section-subtitle">• Tournament Fixtures & Court Queue</span>
              </div>
              <span className="stadium-mode-tag upcoming-dispatch">
                🏸 Match Queue
              </span>
            </div>

            {displayUpcomingMatches.length === 0 ? (
              <div className="stadium-empty-live-box">
                <div className="stadium-empty-icon">🏸</div>
                <h3>No Matches Currently Scheduled</h3>
                <p>Schedule list-ல் இருந்து மேட்ச்களை "Live" அல்லது Scheduled செய்யும்போது தானாக இங்கே காண்பிக்கப்படும்.</p>
              </div>
            ) : (
              <div className="stadium-table-container live-table-wrap">
                <table className="stadium-broadcast-table stadium-live-table">
                  <thead>
                    <tr>
                      <th className="th-court">COURT & MATCH</th>
                      <th className="th-cat">CATEGORY & ROUND</th>
                      <th className="th-p1" style={{ textAlign: 'right' }}>PLAYER / TEAM 1</th>
                      <th className="th-score" style={{ textAlign: 'center' }}>SCORE / STATUS</th>
                      <th className="th-p2" style={{ textAlign: 'left' }}>PLAYER / TEAM 2</th>
                      <th className="th-status" style={{ textAlign: 'center' }}>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUpcomingMatches.map((m, idx) => {
                      const p1 = m.player1
                      const p2 = m.player2
                      const p1Name = p1?.name || 'Player 1'
                      const p2Name = p2?.name || 'Player 2'
                      const courtDisplay = m.assignedCourtName || m.court || `Court ${idx + 1}`

                      return (
                        <tr
                          key={m.id || `upcoming-${idx}`}
                          className="stadium-table-row upcoming-row"
                        >
                          {/* 1. Court & Match Pill */}
                          <td className="table-court-cell">
                            <div className="table-court-tag">
                              <span className="clean-upcoming-dot" />
                              <span className="court-name-bold">{courtDisplay}</span>
                            </div>
                            <span className="table-match-pill">Match #{m.matchNumber || idx + 1}</span>
                          </td>

                          {/* 2. Category & Round */}
                          <td className="table-category-cell">
                            <div className="table-cat-title">{formatCategoryName(m.categoryName)}</div>
                            {m.roundName && <div className="table-cat-sub">{m.roundName}</div>}
                          </td>

                          {/* 3. Player 1 */}
                          <td className="table-player-cell p1-cell">
                            <div className="table-player-wrap right-align">
                              <span className="table-player-name">{p1Name}</span>
                              {Boolean(p1?.seed || p1?.isSeed) && (
                                <span className="stadium-seed-badge">S{p1.seed || p1.seedNumber || ''}</span>
                              )}
                            </div>
                            {p1?.place && <div className="table-player-place right-align">{p1.place}</div>}
                          </td>

                          {/* 4. VS / Scheduled Status */}
                          <td className="table-score-cell">
                            <div className="table-set-pill-wrap">
                              <span className="table-vs-pill">VS</span>
                              <span className="table-set-label">{m.roundName || 'Scheduled'}</span>
                            </div>
                          </td>

                          {/* 5. Player 2 */}
                          <td className="table-player-cell p2-cell">
                            <div className="table-player-wrap left-align">
                              {Boolean(p2?.seed || p2?.isSeed) && (
                                <span className="stadium-seed-badge">S{p2.seed || p2.seedNumber || ''}</span>
                              )}
                              <span className="table-player-name">{p2Name}</span>
                            </div>
                            {p2?.place && <div className="table-player-place left-align">{p2.place}</div>}
                          </td>

                          {/* 6. Status Badge */}
                          <td className="table-status-cell">
                            <span className="stadium-bwf-badge badge-upcoming">
                              ⏳ UPCOMING
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ROTATING FLOATING CORNER SPOTLIGHT AD (PiP) */}
      {adSettings.showFloatingSpotlight && !adSettings.intermissionMode && currentHighlightAd && (
        <div
          className="stadium-floating-ad-card"
          style={{ borderLeftColor: currentHighlightAd.accentColor || '#38bdf8' }}
        >
          {Boolean(currentHighlightAd.videoUrl) ? (
            <div className="floating-ad-video-box">
              <video
                src={currentHighlightAd.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="floating-ad-video-elem"
              />
            </div>
          ) : currentHighlightAd.logoUrl ? (
            <div className="floating-ad-img-box">
              <img src={currentHighlightAd.logoUrl} alt={currentHighlightAd.sponsorName} className="floating-ad-img-elem" />
            </div>
          ) : null}

          <div className="floating-ad-top">
            <span className="floating-ad-badge" style={{ color: currentHighlightAd.accentColor || '#38bdf8' }}>
              {currentHighlightAd.badge}
            </span>
            <span className="floating-ad-brand">{currentHighlightAd.sponsorName}</span>
          </div>
          <p className="floating-ad-text">{currentHighlightAd.tagline}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '6px' }}>
            {currentHighlightAd.ctaText && (
              <span className="floating-ad-cta" style={{ background: `${currentHighlightAd.accentColor || '#38bdf8'}30`, color: currentHighlightAd.accentColor || '#38bdf8', borderColor: currentHighlightAd.accentColor || '#38bdf8' }}>
                {currentHighlightAd.ctaText}
              </span>
            )}
            {currentHighlightAd.phoneOrLink && (
              <span className="floating-ad-sub">📍 {currentHighlightAd.phoneOrLink}</span>
            )}
          </div>
        </div>
      )}

      {/* 3. DUAL AUTO-SCROLLING TICKER MARQUEES (TOP ANNOUNCEMENT + BOTTOM SPONSOR BANNER) */}
      <footer className="stadium-tv-footer">
        {/* ROW 1: TOP SCROLLING ANNOUNCEMENT & LIVE MATCHES */}
        <div className="stadium-ticker-row row-top">
          <div className="stadium-ticker-label label-top">
            <span>📢 ANNOUNCEMENT</span>
          </div>
          <div className="stadium-ticker-content">
            <div className="stadium-ticker-marquee" style={{ animationDuration: tickerAnimationDuration }}>
              {/* User Configured Top Scrolling Announcement */}
              {adSettings.topScrollingText && (
                <span className="ticker-item highlight-text-top">
                  ⭐ <strong>NOTICE:</strong> {adSettings.topScrollingText}
                </span>
              )}

              {/* Live Match Court Statuses */}
              {displayLiveMatches.length > 0 ? (
                displayLiveMatches.map((m) => (
                  <span key={`live-1-${m.id || m.matchNumber}`} className="ticker-item live-item">
                    🔴 <strong>{m.assignedCourtName || m.court || 'Court'}</strong>: {m.player1?.name || 'P1'} vs {m.player2?.name || 'P2'} ({formatCategoryName(m.categoryName)})
                  </span>
                ))
              ) : (
                <span className="ticker-item">
                  🏸 Welcome to {formatTournamentName(currentTournament?.matchName || 'Badminton Championship')}
                </span>
              )}

              {/* Seamless Repeat of Top Scrolling Announcement */}
              {adSettings.topScrollingText && (
                <span className="ticker-item highlight-text-top">
                  ⭐ <strong>NOTICE:</strong> {adSettings.topScrollingText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: BOTTOM SCROLLING SPONSORS & OFFERS WITH EXIT BUTTON */}
        <div className="stadium-ticker-row row-bottom">
          <div className="stadium-ticker-label label-bottom">
            <span>⭐ SPONSORS & OFFERS</span>
          </div>
          <div className="stadium-ticker-content">
            <div className="stadium-ticker-marquee" style={{ animationDuration: tickerAnimationDuration }}>
              {/* User Configured Bottom Scrolling Text */}
              {adSettings.bottomScrollingText && (
                <span className="ticker-item highlight-text-bottom">
                  🔥 <strong>SPECIAL:</strong> {adSettings.bottomScrollingText}
                </span>
              )}

              {/* Active Sponsor Highlights */}
              {adSettings.showInTicker && activeAds.map((ad, idx) => (
                <span
                  key={`ad-tick-1-${ad.id || idx}`}
                  className="ticker-item sponsor-ticker-item"
                  style={{ color: ad.accentColor || (ad.mediaType === 'video' ? '#34d399' : ad.mediaType === 'image' ? '#38bdf8' : '#fbbf24') }}
                >
                  {ad.mediaType === 'video' ? '🎬' : ad.mediaType === 'image' ? '🖼️' : '📢'} <strong>{ad.sponsorName}</strong>: {ad.tagline} {ad.phoneOrLink ? `[${ad.phoneOrLink}]` : ''}
                </span>
              ))}

              {/* Seamless Repeat of Bottom Scrolling Text */}
              {adSettings.bottomScrollingText && (
                <span className="ticker-item highlight-text-bottom">
                  🔥 <strong>SPECIAL:</strong> {adSettings.bottomScrollingText}
                </span>
              )}

              {adSettings.showInTicker && activeAds.map((ad, idx) => (
                <span
                  key={`ad-tick-2-${ad.id || idx}`}
                  className="ticker-item sponsor-ticker-item"
                  style={{ color: ad.accentColor || (ad.mediaType === 'video' ? '#34d399' : ad.mediaType === 'image' ? '#38bdf8' : '#fbbf24') }}
                >
                  {ad.mediaType === 'video' ? '🎬' : ad.mediaType === 'image' ? '🖼️' : '📢'} <strong>{ad.sponsorName}</strong>: {ad.tagline} {ad.phoneOrLink ? `[${ad.phoneOrLink}]` : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Dedicated Bottom Exit / Turn Off Button */}
          <div className="stadium-footer-actions" style={{ paddingRight: '10px', flexShrink: 0, zIndex: 10 }}>
            <button
              type="button"
              onClick={handleStopStreamAction}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                border: '1.5px solid #fca5a5',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '8px',
                fontWeight: '900',
                fontSize: '11.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.45)',
                whiteSpace: 'nowrap',
              }}
              title="Stop Live Stream & Exit Broadcast"
            >
              <span style={{ fontSize: '12px' }}>⏹️</span>
              <span>Stop Stream</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Tab Only Cast Guide Modal */}
      {isCastTabGuideOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsCastTabGuideOpen(false)}
        >
          <div
            style={{
              maxWidth: '580px',
              width: '100%',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '2px solid #38bdf8',
              borderRadius: '20px',
              padding: '26px',
              color: '#ffffff',
              boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(56, 189, 248, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📡</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#38bdf8' }}>
                  How to Cast ONLY this Tab to TV
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCastTabGuideOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '18px',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', marginTop: 0 }}>
              Prevent your entire laptop screen from being shared. Choose your setup below so the TV <strong>ONLY shows this Live Cast</strong>:
            </p>

            {/* Method A */}
            <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1.5px solid rgba(56, 189, 248, 0.4)', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ fontWeight: '900', fontSize: '14px', color: '#38bdf8', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🖥️ Method 1: HDMI Cable / Dual Monitor (Most Common)</span>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: '#e2e8f0', lineHeight: '1.6' }}>
                <li>On your keyboard, press <strong>Windows Key + P</strong>.</li>
                <li>Select <strong>"Extend"</strong> (Do NOT select "Duplicate").</li>
                <li>Drag this Live Cast browser window to your TV screen and click <strong>Fullscreen</strong>!</li>
              </ol>
            </div>

            {/* Method B */}
            <div style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1.5px solid rgba(196, 181, 253, 0.4)', borderRadius: '14px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ fontWeight: '900', fontSize: '14px', color: '#c4b5fd', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📶 Method 2: Chromecast / Smart TV (Wi-Fi Wireless Cast)</span>
              </div>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: '#e2e8f0', lineHeight: '1.6' }}>
                <li>In Chrome browser, click the <strong>3 dots (⋮)</strong> in the top-right corner.</li>
                <li>Click <strong>"Cast..."</strong> (Save and share).</li>
                <li>In the Cast popup, click <strong>"Sources"</strong> and choose <strong>"Cast Tab"</strong> (NOT "Cast Screen").</li>
                <li>Select your Smart TV name. Only this tab will stream to TV!</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setIsCastTabGuideOpen(false)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Got it, Close
            </button>
          </div>
        </div>
      )}

      {/* FULL-SCREEN SPONSOR SHOWCASE OVERLAY (IMAGE / VIDEO AUTO-INTERVAL & STANDBY SHOWCASE) */}
      {(isNoLiveAutoShowcase || isFullScreenAdVisible || adSettings?.intermissionMode) && currentFullScreenAd && (
        <div
          className="stadium-fullscreen-sponsor-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#020617',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 36px',
            overflow: 'hidden',
            animation: 'fadeIn 0.4s ease-out',
          }}
        >
          {/* Top Sponsor Branding Header */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '32px' }}>🏸</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: currentFullScreenAd.accentColor || '#38bdf8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ⭐ {currentFullScreenAd.badge || 'OFFICIAL TOURNAMENT SPONSOR'}
                  </span>
                  <span style={{ background: hasLiveMatches ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)', border: `1px solid ${hasLiveMatches ? 'rgba(56, 189, 248, 0.3)' : '#22c55e'}`, color: hasLiveMatches ? '#38bdf8' : '#4ade80', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '800' }}>
                    {hasLiveMatches ? 'LIVE INTERVAL COMMERCIAL' : 'AUTO SPONSOR SHOWCASE'}
                  </span>
                </div>
                <h1 style={{ margin: '4px 0 0', fontSize: '30px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {currentFullScreenAd.sponsorName}
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {hasLiveMatches && !adSettings?.intermissionMode ? (
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(148, 163, 184, 0.3)', padding: '6px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#38bdf8', fontWeight: '900', fontSize: '16px', fontFamily: 'monospace' }}>
                    ⏱ {fullScreenCountdown}s
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Returning to live matches</span>
                </div>
              ) : !hasLiveMatches ? (
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '6px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="clean-live-dot" style={{ background: '#22c55e' }} />
                  <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: 800 }}>Standby Loop (No Live Matches)</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsFullScreenAdVisible(false)
                  if (!hasLiveMatches) setIsManualDismissedNoLive(true)
                }}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1.5px solid #ef4444',
                  color: '#fca5a5',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                title={hasLiveMatches ? 'Return to live matches' : 'View scoreboard screen'}
              >
                {hasLiveMatches ? '✕ Skip to Matches' : '✕ View Scoreboard'}
              </button>
            </div>
          </div>

          {/* Center High-Impact Visual Area */}
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative',
              margin: '18px 0',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 50px ${currentFullScreenAd.accentColor || '#38bdf8'}25`,
              border: `2px solid ${currentFullScreenAd.accentColor || '#38bdf8'}60`,
              background: '#030712',
            }}
          >
            {currentFullScreenAd.mediaType === 'video' || currentFullScreenAd.videoUrl ? (
              <video
                src={currentFullScreenAd.videoUrl}
                autoPlay
                loop
                playsInline
                muted={adSettings?.videoMuted !== false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '68vh' }}
              />
            ) : currentFullScreenAd.logoUrl ? (
              <img
                src={currentFullScreenAd.logoUrl}
                alt={currentFullScreenAd.sponsorName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '68vh' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
                <span style={{ fontSize: '64px', marginBottom: '16px' }}>🏸</span>
                <h2 style={{ fontSize: '36px', color: currentFullScreenAd.accentColor || '#38bdf8', margin: 0, fontWeight: 900 }}>
                  {currentFullScreenAd.sponsorName}
                </h2>
                <p style={{ fontSize: '20px', color: '#e2e8f0', margin: '12px 0 0', maxWidth: '800px' }}>
                  {currentFullScreenAd.tagline}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Headline & Call To Action Banner */}
          <div
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
              border: `1.5px solid ${currentFullScreenAd.accentColor || '#38bdf8'}40`,
              borderRadius: '16px',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <div style={{ maxWidth: '75%' }}>
              <p style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#f8fafc', lineHeight: 1.3 }}>
                “{currentFullScreenAd.tagline}”
              </p>
              {currentFullScreenAd.description && (
                <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#cbd5e1' }}>
                  {currentFullScreenAd.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {currentFullScreenAd.phoneOrLink && (
                <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  📍 {currentFullScreenAd.phoneOrLink}
                </span>
              )}
              {currentFullScreenAd.ctaText && (
                <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#ffffff', background: `linear-gradient(135deg, ${currentFullScreenAd.accentColor || '#0284c7'} 0%, #0369a1 100%)`, padding: '8px 18px', borderRadius: '10px', boxShadow: `0 4px 16px ${currentFullScreenAd.accentColor || '#38bdf8'}40` }}>
                  {currentFullScreenAd.ctaText}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
