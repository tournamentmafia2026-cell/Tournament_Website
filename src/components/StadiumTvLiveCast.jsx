import React, { useState, useEffect, useMemo } from 'react'
import { formatCategoryName, formatTournamentName, formatCourtName, formatAddress } from '../utils/textFormatters'
import { sortBadmintonCategories } from '../utils/badmintonCategories'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'
import { getSavedCourtConfig, saveCourtConfig, generateCourtsList } from '../utils/courtConfig'
import { fastDeepEqual } from '../utils/fastDeepEqual'
import { CourtConfigModal } from './CourtConfigModal'

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

  const [isCourtConfigModalOpen, setIsCourtConfigModalOpen] = useState(false)
  const [courtConfig, setCourtConfig] = useState(() => getSavedCourtConfig())

  useEffect(() => {
    const handleStorageChange = () => {
      if (!isCourtConfigModalOpen) {
        setCourtConfig(getSavedCourtConfig())
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [isCourtConfigModalOpen])

  const configuredCourts = useMemo(() => {
    return generateCourtsList(courtConfig)
  }, [courtConfig])

  const [numCourts, setNumCourts] = useState(() => {
    return courtConfig.count || 4
  })

  useEffect(() => {
    if (courtConfig.count) {
      setNumCourts(courtConfig.count)
    }
  }, [courtConfig.count])

  const handleCourtCountChange = (count) => {
    const val = Math.max(1, Math.min(32, parseInt(count, 10) || 1))
    setNumCourts(val)
    const nextCfg = { ...courtConfig, count: val }
    setCourtConfig(nextCfg)
    saveCourtConfig(nextCfg)
  }

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
        if (savedAds) {
          const parsedAds = JSON.parse(savedAds)
          setSponsorAds((prev) => (fastDeepEqual(prev, parsedAds) ? prev : parsedAds))
        }
        const savedSettings = localStorage.getItem('badminton-ad-settings')
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings)
          setAdSettings((prev) => (fastDeepEqual(prev, parsedSettings) ? prev : parsedSettings))
        }
      } catch (e) {
        console.error(e)
      }
    }
    window.addEventListener('storage', syncAds)
    const interval = setInterval(syncAds, 2500)
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
    const sp = adSettings?.tickerSpeed
    if (typeof sp === 'number') return `${sp}s`
    if (sp && !isNaN(Number(sp))) return `${Number(sp)}s`
    if (sp === 'ultra-fast') return '8s'
    if (sp === 'fast') return '14s'
    if (sp === 'normal') return '22s'
    if (sp === 'slow') return '32s'
    if (sp === 'ultra-slow') return '45s'
    return '32s'
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
    const handleActivity = () => {
      setShowControls(true)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        setShowControls(false)
      }, 2500)
    }

    // Auto-hide after initial 2.5s on screen load
    idleTimerRef.current = setTimeout(() => {
      setShowControls(false)
    }, 2500)

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('pointermove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('pointermove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
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

  // Auto-reload tournament draws and scores with real-time storage events & fast 1.5s interval from server DB & localStorage
  useEffect(() => {
    let isMounted = true
    const syncDraws = async () => {
      // 1. Fetch from shared server DB for cross-device & cross-origin sync
      try {
        const res = await fetch('/api/tournaments')
        if (res.ok) {
          const data = await res.json()
          if (!isMounted) return
          if (data && data.tournamentDraws && typeof data.tournamentDraws === 'object') {
            setTournamentDraws((prev) => (fastDeepEqual(prev, data.tournamentDraws) ? prev : data.tournamentDraws))
            try {
              localStorage.setItem('badminton-tournament-draws', JSON.stringify(data.tournamentDraws))
            } catch {}
          }
          if (data?.liveUmpireMode !== undefined) {
            setIsLiveUmpireMode((prev) => (prev === data.liveUmpireMode ? prev : data.liveUmpireMode))
          }
          return
        }
      } catch {}

      // 2. Fallback to localStorage
      try {
        const saved = localStorage.getItem('badminton-tournament-draws')
        if (saved && isMounted) {
          const parsed = JSON.parse(saved)
          setTournamentDraws((prev) => (fastDeepEqual(prev, parsed) ? prev : parsed))
        }
      } catch {}
    }

    syncDraws()
    window.addEventListener('storage', syncDraws)
    const syncInterval = setInterval(syncDraws, 2000)
    return () => {
      isMounted = false
      window.removeEventListener('storage', syncDraws)
      clearInterval(syncInterval)
    }
  }, [])

  const [isLiveUmpireMode, setIsLiveUmpireMode] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-live-umpire-mode')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  // Auto-sync live umpire mode in real-time
  useEffect(() => {
    const syncUmpireMode = () => {
      try {
        const saved = localStorage.getItem('badminton-live-umpire-mode')
        if (saved !== null) {
          const parsed = JSON.parse(saved)
          setIsLiveUmpireMode((prev) => (prev === parsed ? prev : parsed))
        }
      } catch {}
    }
    window.addEventListener('storage', syncUmpireMode)
    const interval = setInterval(syncUmpireMode, 2000)
    return () => {
      window.removeEventListener('storage', syncUmpireMode)
      clearInterval(interval)
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
    
    // Ensure Live Stream status is active
    try {
      localStorage.setItem('badminton-live-stream-active', 'true')
      window.dispatchEvent(new Event('storage'))
    } catch (err) {}

    const targetWindowName = `BadmintonLiveCast_${tid || 'general'}`
    const win = window.open(url, targetWindowName, 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no')
    if (win) {
      win.focus()
    }
    if (onClose) {
      onClose()
    }
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
    let isMounted = true
    const syncTournaments = async () => {
      try {
        const res = await fetch('/api/tournaments')
        if (res.ok) {
          const data = await res.json()
          if (!isMounted) return
          if (data && Array.isArray(data.matches) && data.matches.length > 0) {
            setLiveTournaments(data.matches)
            try {
              localStorage.setItem('badminton-published-matches', JSON.stringify(data.matches))
            } catch {}
            return
          }
        }
      } catch {}

      try {
        const saved = localStorage.getItem('badminton-published-matches')
        if (saved && isMounted) {
          const parsed = JSON.parse(saved)
          setLiveTournaments((prev) => (fastDeepEqual(prev, parsed) ? prev : parsed))
        }
      } catch {}
    }

    syncTournaments()
    window.addEventListener('storage', syncTournaments)
    const interval = setInterval(syncTournaments, 3000)
    return () => {
      isMounted = false
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
    const raw = currentTournament.categories || [
      'Men Singles', 'Men Doubles', 'Women Singles', 'Women Doubles', 'Mixed Doubles', 'Boys Under 15', 'Girls Under 15'
    ]
    return sortBadmintonCategories(raw)
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

  // Partition matches:
  // ONLY matches that Admin launched to 'live' in Schedule List appear in Live Cast!
  // 1. UPCOMING: Matches launched to live by Admin, waiting for Umpire to start
  // 2. LIVE: Matches where Umpire has actively started match / scoring
  const { displayLiveMatches, displayUpcomingMatches } = useMemo(() => {
    const uncompleted = activePool.filter((m) => {
      const isCompleted = m.status === 'completed' || !!m.winner || m.isCompleted
      if (isCompleted) return false
      if (m.player1?.isBye && m.player2?.isBye) return false
      return true
    })

    // Filter strictly to matches changed to 'live' in Schedule list
    const launchedMatches = uncompleted.filter(
      (m) => m.status === 'live' || (m.isLive === true && m.status !== 'completed')
    )

    const activeLive = []
    const upcomingQueue = []

    launchedMatches.forEach((m) => {
      // Check if match is actively in-play (points scored or umpire started)
      const currentSet = m.liveScore?.currentSet || 1
      const p1Pts = m.liveScore?.pointsA ?? m[`scoreSet${currentSet}A`] ?? 0
      const p2Pts = m.liveScore?.pointsB ?? m[`scoreSet${currentSet}B`] ?? 0
      const hasPoints = (
        (p1Pts !== undefined && p1Pts !== '' && Number(p1Pts) > 0) ||
        (p2Pts !== undefined && p2Pts !== '' && Number(p2Pts) > 0) ||
        (m.scoreSet1A !== undefined && m.scoreSet1A !== '' && Number(m.scoreSet1A) > 0) ||
        (m.scoreSet1B !== undefined && m.scoreSet1B !== '' && Number(m.scoreSet1B) > 0) ||
        (m.scoreSet2A !== undefined && m.scoreSet2A !== '' && Number(m.scoreSet2A) > 0) ||
        (m.scoreSet2B !== undefined && m.scoreSet2B !== '' && Number(m.scoreSet2B) > 0)
      )
      const isUmpireStarted = m.liveScore?.isStarted === true || Boolean(m.liveScore?.startedAt) || hasPoints

      if (isUmpireStarted) {
        activeLive.push({
          ...m,
          assignedCourtName: m.court || null,
          isLiveDisplay: true,
        })
      } else {
        upcomingQueue.push({
          ...m,
          assignedCourtName: m.court || null,
          isLiveDisplay: false,
        })
      }
    })

    return { displayLiveMatches: activeLive, displayUpcomingMatches: upcomingQueue }
  }, [activePool])

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

  // --- SPONSOR VISUAL DATA & FULL-SCREEN SHOWCASE LOGIC ---
  const [fullScreenAdIndex, setFullScreenAdIndex] = useState(0)
  const [isIntervalAdVisible, setIsIntervalAdVisible] = useState(false)
  const [countdownRemaining, setCountdownRemaining] = useState(10)
  const [isStandbyDismissed, setIsStandbyDismissed] = useState(false)

  const visualAds = useMemo(() => {
    const list = (activeAds || []).filter((a) => a.active !== false)
    return list.length > 0 ? list : DEFAULT_SPONSOR_ADS
  }, [activeAds])

  const hasLiveMatches = (displayLiveMatches || []).length > 0
  const hasUpcomingMatches = (displayUpcomingMatches || []).length > 0
  const hasAnyMatches = hasLiveMatches || hasUpcomingMatches

  // 1. Standby mode: Active when NO matches are on screen
  const isStandbyShowcaseActive = !hasAnyMatches && visualAds.length > 0 && !isStandbyDismissed

  // Reset standby dismissal when matches appear or change
  useEffect(() => {
    if (hasAnyMatches) {
      setIsStandbyDismissed(false)
    }
  }, [hasAnyMatches])

  // Continuous rotation in Standby mode (when no matches)
  useEffect(() => {
    if (!isStandbyShowcaseActive || visualAds.length <= 1) return
    const curAd = visualAds[fullScreenAdIndex] || visualAds[0]
    const durSec = Number(curAd?.displayDuration) || Number(adSettings?.fullScreenDurationSeconds) || 10
    const timer = setTimeout(() => {
      setFullScreenAdIndex((prev) => (prev + 1) % visualAds.length)
    }, Math.max(3000, durSec * 1000))
    return () => clearTimeout(timer)
  }, [isStandbyShowcaseActive, visualAds, fullScreenAdIndex, adSettings?.fullScreenDurationSeconds])

  // 2. Interval mode: Trigger full-screen showcase during matches on configured interval
  useEffect(() => {
    if (!hasAnyMatches) {
      setIsIntervalAdVisible(false)
      return
    }

    const intervalMins = Number(adSettings?.fullScreenIntervalMinutes) || 1
    if (intervalMins <= 0 || visualAds.length === 0) return

    const intervalMs = Math.max(15000, intervalMins * 60 * 1000)
    const intervalTimer = setInterval(() => {
      setFullScreenAdIndex((prev) => (prev + 1) % visualAds.length)
      const durSec = Number(adSettings?.fullScreenDurationSeconds) || 10
      setCountdownRemaining(durSec)
      setIsIntervalAdVisible(true)
    }, intervalMs)

    return () => clearInterval(intervalTimer)
  }, [hasAnyMatches, adSettings?.fullScreenIntervalMinutes, adSettings?.fullScreenDurationSeconds, visualAds.length])

  // Countdown timer for Interval mode
  useEffect(() => {
    if (!isIntervalAdVisible) return
    const timer = setInterval(() => {
      setCountdownRemaining((prev) => {
        if (prev <= 1) {
          setIsIntervalAdVisible(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isIntervalAdVisible])

  const activeFullScreenAd = visualAds[fullScreenAdIndex] || visualAds[0] || null
  const shouldRenderFullScreenAd = (isStandbyShowcaseActive || isIntervalAdVisible) && Boolean(activeFullScreenAd)

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
      className={`stadium-tv-cast-container tv-rotate-${rotation} ${isPortrait ? 'is-portrait-tv' : 'is-landscape-tv'} ${liveCountClass} ${displayUpcomingMatches.length === 0 ? 'no-upcoming' : 'has-upcoming'}`}
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

            {/* Stadium Courts Count & Format Settings */}
            <button
              type="button"
              onClick={() => setIsCourtConfigModalOpen(true)}
              className="stadium-tv-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(3, 105, 161, 0.45) 100%)',
                border: '1.5px solid #38bdf8',
                color: '#e0f2fe',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Configure Courts Count & Naming Style"
            >
              <span>🏟️</span>
              <span>Courts ({configuredCourts.length})</span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>⚙️</span>
            </button>

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

            {/* Fullscreen TV Trigger */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="stadium-tv-btn fullscreen-btn"
              title="Toggle TV Fullscreen (F11)"
            >
              {isFullscreen ? '🗗 Exit Fullscreen' : '⛶ Fullscreen'}
            </button>

            {/* Stop Live Stream */}
            <button
              type="button"
              onClick={handleStopStreamAction}
              className="stadium-tv-btn back-to-app-btn"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 10px rgba(239, 68, 68, 0.4)',
                fontWeight: '800',
              }}
              title="Turn OFF Live Stream and Exit"
            >
              ⏹️ Stop Live Stream
            </button>

            {/* Back to App */}
            <button
              type="button"
              onClick={handleExitLiveCast}
              className="stadium-tv-btn back-to-app-btn"
              title="Return to App (Stream remains ON)"
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

      {/* 2. MAIN TV BODY */}
      <main className="stadium-tv-main">
        {displayLiveMatches.length === 0 && displayUpcomingMatches.length === 0 ? (
          <div className="stadium-empty-live-box">
            <div className="stadium-empty-icon">🏸</div>
            <h3>No Matches Currently Available</h3>
            <p>Schedule list-ல் இருந்து மேட்ச்களை add அல்லது start செய்யும்போது தானாக இங்கே நேரலையில் காண்பிக்கப்படும்.</p>
          </div>
        ) : (
          <>
            {/* =========================================================
               SECTION 1: 🔴 LIVE MATCHES (First N Court Matches)
               ========================================================= */}
            {displayLiveMatches.length > 0 && (
              <section className="stadium-broadcast-section live-section">
                <div className="stadium-section-header">
                  <div className="stadium-section-title-wrap">
                    <span className="stadium-live-pulse-dot" />
                    <h2 className="stadium-section-title">🔴 LIVE MATCHES ({displayLiveMatches.length})</h2>
                    <span className="stadium-section-subtitle">
                      • In-Play on {configuredCourts.length > 0 ? `${configuredCourts[0]}..${configuredCourts[configuredCourts.length - 1]}` : `Courts 1..${numCourts || displayLiveMatches.length}`}
                    </span>
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
                        const courtDisplay = m.court || `Match #${m.matchNumber || idx + 1}`

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
                              <span className="table-match-pill">{m.court ? `Match #${m.matchNumber || idx + 1}` : 'Live'}</span>
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
              </section>
            )}

            {/* =========================================================
               DISTINCT SEPARATION & DIVIDER (10cm visual spacing)
               ========================================================= */}
            {displayLiveMatches.length > 0 && displayUpcomingMatches.length > 0 && (
              <div className="stadium-live-upcoming-divider">
                <div className="stadium-divider-line" />
                <span className="stadium-divider-pill">⏳ UPCOMING MATCHES QUEUE</span>
                <div className="stadium-divider-line" />
              </div>
            )}

            {/* =========================================================
               SECTION 2: ⏳ UPCOMING MATCHES (Launched from Schedule)
               ========================================================= */}
            {displayUpcomingMatches.length > 0 && (
              <section className="stadium-broadcast-section upcoming-section">
                <div className="stadium-section-header">
                  <div className="stadium-section-title-wrap">
                    <span className="stadium-upcoming-pulse-dot" />
                    <h2 className="stadium-section-title">⏳ UPCOMING MATCHES ({displayUpcomingMatches.length})</h2>
                    <span className="stadium-section-subtitle">• Ready on Court (Waiting for Umpire to start)</span>
                  </div>
                  <span className="stadium-mode-tag upcoming-dispatch">
                    🏸 Court Queue
                  </span>
                </div>

                <div className="stadium-table-container upcoming-table-wrap">
                  <table className="stadium-broadcast-table stadium-upcoming-table">
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
                        const courtDisplay = m.court || `Match #${m.matchNumber || idx + 1}`

                        return (
                          <tr
                            key={m.id || `upcoming-${idx}`}
                            className="stadium-table-row upcoming-row"
                          >
                            {/* 1. Court & Match Pill */}
                            <td className="table-court-cell">
                              <div className="table-court-tag">
                                <span className="clean-upcoming-dot" />
                                <span className="court-name-bold" style={{ color: '#fbbf24' }}>{courtDisplay}</span>
                              </div>
                              <span className="table-match-pill">{m.court ? `Match #${m.matchNumber || idx + 1}` : 'Upcoming'}</span>
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
                                <span className="table-set-label">{m.roundName || 'Ready on Court'}</span>
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
                                ⏳ READY
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* 3. DUAL AUTO-SCROLLING TICKER MARQUEES (TOP ANNOUNCEMENT + BOTTOM SPONSOR BANNER) */}
      <footer className="stadium-tv-footer">
        {/* ROW 1: TOP SCROLLING ANNOUNCEMENT & LIVE MATCHES */}
        <div className="stadium-ticker-row row-top">
          <div className="stadium-ticker-content">
            <div className="stadium-ticker-marquee" style={{ animationDuration: tickerAnimationDuration }}>
              {/* User Configured Top Scrolling Announcement */}
              {adSettings.topScrollingText && (
                <span className="ticker-item highlight-text-top">
                  📢 {adSettings.topScrollingText}
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
                  📢 {adSettings.topScrollingText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: BOTTOM SCROLLING OFFICIAL SPONSORS & OFFERS */}
        <div className="stadium-ticker-row row-bottom">
          <div className="stadium-ticker-content">
            <div className="stadium-ticker-marquee" style={{ animationDuration: tickerAnimationDuration }}>
              {/* Official Sponsor Title Tag */}
              <span className="ticker-item highlight-text-bottom" style={{ fontWeight: '900', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                🏷️ OFFICIAL SPONSORS
              </span>

              {/* User Configured Bottom Scrolling Text */}
              {adSettings.bottomScrollingText && (
                <span className="ticker-item highlight-text-bottom">
                  ⭐ {adSettings.bottomScrollingText}
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

              {/* Seamless Repeat of Official Sponsor Tag & Sponsors */}
              <span className="ticker-item highlight-text-bottom" style={{ fontWeight: '900', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                🏷️ OFFICIAL SPONSORS
              </span>

              {adSettings.bottomScrollingText && (
                <span className="ticker-item highlight-text-bottom">
                  ⭐ {adSettings.bottomScrollingText}
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

      {/* FULL-SCREEN SPONSOR SHOWCASE OVERLAY (STANDBY WHEN NO MATCHES / INTERVAL DURING MATCHES) */}
      {shouldRenderFullScreenAd && (
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
            animation: 'fadeIn 0.35s ease-out',
          }}
        >
          {/* Top Sponsor Branding Header */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '32px' }}>🏸</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: activeFullScreenAd.accentColor || '#38bdf8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ⭐ OFFICIAL TOURNAMENT SPONSOR
                  </span>
                  {isIntervalAdVisible && (
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        padding: '3px 12px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: '800',
                      }}
                    >
                      ⏳ Returning in {countdownRemaining}s
                    </span>
                  )}
                </div>
                <h1 style={{ margin: '4px 0 0', fontSize: '30px', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {activeFullScreenAd.sponsorName}
                </h1>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (isIntervalAdVisible) {
                    setIsIntervalAdVisible(false)
                  } else {
                    setIsStandbyDismissed(true)
                  }
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
                  transition: 'all 0.2s ease',
                }}
                title={hasAnyMatches ? 'Return to live matches' : 'View empty scoreboard screen'}
              >
                {hasAnyMatches ? '✕ Skip to Matches' : '✕ View Scoreboard'}
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
              boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 50px ${activeFullScreenAd.accentColor || '#38bdf8'}25`,
              border: `2px solid ${activeFullScreenAd.accentColor || '#38bdf8'}60`,
              background: '#030712',
            }}
          >
            {activeFullScreenAd.mediaType === 'video' || activeFullScreenAd.videoUrl ? (
              <video
                src={activeFullScreenAd.videoUrl}
                autoPlay
                loop
                playsInline
                muted={adSettings?.videoMuted !== false}
                style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '68vh' }}
              />
            ) : activeFullScreenAd.logoUrl ? (
              <img
                src={activeFullScreenAd.logoUrl}
                alt={activeFullScreenAd.sponsorName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '68vh' }}
              />
            ) : (
              <div className="stadium-billboard-card" style={{ '--ad-accent': activeFullScreenAd.accentColor || '#38bdf8' }}>
                <span
                  className="stadium-billboard-badge"
                  style={{
                    color: activeFullScreenAd.accentColor || '#38bdf8',
                    borderColor: `${activeFullScreenAd.accentColor || '#38bdf8'}50`,
                    background: `${activeFullScreenAd.accentColor || '#38bdf8'}15`,
                  }}
                >
                  ⭐ OFFICIAL SPONSOR SHOWCASE
                </span>

                <h1 className="stadium-billboard-title">
                  {activeFullScreenAd.sponsorName}
                </h1>

                {activeFullScreenAd.tagline && (
                  <p className="stadium-billboard-tagline">
                    “{activeFullScreenAd.tagline}”
                  </p>
                )}

                {activeFullScreenAd.description && (
                  <p className="stadium-billboard-desc">
                    {activeFullScreenAd.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom Headline & Call To Action Banner */}
          <div
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
              border: `1.5px solid ${activeFullScreenAd.accentColor || '#38bdf8'}40`,
              borderRadius: '16px',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            <div style={{ maxWidth: '75%' }}>
              <p
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: '800',
                  color: '#f8fafc',
                  lineHeight: 1.3,
                  fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                “{activeFullScreenAd.tagline}”
              </p>
              {activeFullScreenAd.description && (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                  {activeFullScreenAd.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {activeFullScreenAd.phoneOrLink && (
                <span
                  style={{
                    fontSize: '13.5px',
                    fontWeight: '800',
                    color: '#38bdf8',
                    background: 'rgba(56, 189, 248, 0.12)',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    letterSpacing: '0.02em',
                  }}
                >
                  📍 {activeFullScreenAd.phoneOrLink}
                </span>
              )}
              {activeFullScreenAd.ctaText && (
                <span
                  style={{
                    fontSize: '13.5px',
                    fontWeight: '900',
                    color: '#ffffff',
                    background: `linear-gradient(135deg, ${activeFullScreenAd.accentColor || '#0284c7'} 0%, #0369a1 100%)`,
                    padding: '9px 20px',
                    borderRadius: '10px',
                    boxShadow: `0 4px 16px ${activeFullScreenAd.accentColor || '#38bdf8'}40`,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {activeFullScreenAd.ctaText}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stadium Courts Configuration Modal */}
      <CourtConfigModal
        isOpen={isCourtConfigModalOpen}
        initialConfig={courtConfig}
        onClose={() => setIsCourtConfigModalOpen(false)}
        onSave={(newCfg) => setCourtConfig(newCfg)}
      />
    </div>
  )
}
