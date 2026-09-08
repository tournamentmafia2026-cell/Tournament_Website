import { useState, useEffect, useRef, useMemo } from 'react'
import {
  generateBadmintonDraw,
  sanitizeBadmintonDraw,
  propagateWinners,
  calculateBadmintonWinner,
  getRoundName,
  getNextPowerOfTwo,
  toRomanNumeral,
  format12HourTime,
} from '../utils/badmintonDrawEngine'
import { FixtureSeedingModal } from './FixtureSeedingModal'
import { MatchScoresheetModal } from './MatchScoresheetModal'
import { TournamentMasterScheduleModal } from './TournamentMasterScheduleModal'
import { StadiumAdManagerModal } from './StadiumAdManagerModal'
import { StadiumTvLiveCast } from './StadiumTvLiveCast'
import { CourtConfigModal } from './CourtConfigModal'
import { PublicSponsorShowcase } from './PublicSponsorShowcase'
import { DEFAULT_SPONSOR_ADS, DEFAULT_AD_SETTINGS } from './stadiumAdConstants'
import { getSavedCourtConfig, generateCourtsList } from '../utils/courtConfig'
import { printOfficialFixturesA4 } from '../utils/printFixturesEngine'
import { isDoublesCategory, sortBadmintonCategories } from '../utils/badmintonCategories'
import { fastDeepEqual } from '../utils/fastDeepEqual'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatPlaceOrClub,
  formatCategoryName,
  sanitizeParticipant,
  getMatchStatus,
  splitDoublesNames,
  joinDoublesNames,
  compareTournamentsChronological,
  compareTournamentsRecentCompleted,
} from '../utils/textFormatters'
import { SupabaseService } from '../utils/supabaseDb'

const DRAWS_STORAGE_KEY = 'badminton-tournament-draws'
const DEFAULT_CATEGORIES = ['Men Singles', 'Women Singles', 'Men Doubles']

export const BadmintonFixturesManager = ({
  publishedMatches = [],
  authenticators = {},
  selectedMatch: initialSelectedMatch = null,
  initialCategory = null,
  onSelectMatch = () => {},
  onAddParticipant = () => {},
  onUpdateParticipant = () => {},
  onDeleteParticipant = () => {},
  onBackToMatchManagement = null,
  isPublicView = false,
  onBackToPublicFeed = null,
  onOpenOrganizerLogin = null,
}) => {
  // Navigation level: 'tournaments' | 'categories' | 'draw'
  const [fixturesLevel, setFixturesLevel] = useState(() => {
    return (initialSelectedMatch && (initialCategory || isPublicView)) ? 'draw' : 'tournaments'
  })

  const [selectedMatchId, setSelectedMatchId] = useState(() => {
    return initialSelectedMatch?.id || (publishedMatches[0]?.id ?? 1)
  })

  useEffect(() => {
    if (initialSelectedMatch && initialCategory) {
      setSelectedMatchId(initialSelectedMatch.id)
      setSelectedCategory(initialCategory)
      setFixturesLevel('draw')
    } else if (!initialSelectedMatch) {
      setFixturesLevel('tournaments')
    }
  }, [initialSelectedMatch?.id, initialCategory])

  const selectedMatch = publishedMatches.find((m) => String(m.id) === String(selectedMatchId)) || publishedMatches[0] || null

  const categories = useMemo(
    () => sortBadmintonCategories(selectedMatch?.categories || DEFAULT_CATEGORIES),
    [selectedMatch?.categories]
  )
  const [selectedCategory, setSelectedCategory] = useState(() => initialCategory || categories[0] || 'Men Singles')
  const [isSeedingModalOpen, setIsSeedingModalOpen] = useState(false)
  const [isStadiumTvCastOpen, setIsStadiumTvCastOpen] = useState(false)

  // Unique session identifier to prevent self-broadcast echo loops
  const localSessionIdRef = useRef(`session_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`)
  const isModalActiveRef = useRef(false)

  // Live Cast Sponsor Advertisement Manager State
  const [isAdModalOpen, setIsAdModalOpen] = useState(false)
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

  const handleSaveAds = (newAds) => {
    setSponsorAds(newAds)
    try {
      localStorage.setItem('badminton-stadium-ads', JSON.stringify(newAds))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveAdSettings = (newSettings) => {
    setAdSettings(newSettings)
    try {
      localStorage.setItem('badminton-ad-settings', JSON.stringify(newSettings))
      window.dispatchEvent(new Event('storage'))
    } catch (e) {
      console.error(e)
    }
  }

  // Stadium Courts Configuration State
  const [isCourtConfigModalOpen, setIsCourtConfigModalOpen] = useState(false)
  const [courtConfig, setCourtConfig] = useState(() => getSavedCourtConfig())

  useEffect(() => {
    const handleStorageUpdate = () => {
      if (!isCourtConfigModalOpen) {
        setCourtConfig(getSavedCourtConfig())
      }
    }
    window.addEventListener('storage', handleStorageUpdate)
    return () => window.removeEventListener('storage', handleStorageUpdate)
  }, [isCourtConfigModalOpen])

  const configuredCourts = useMemo(() => {
    return generateCourtsList(courtConfig)
  }, [courtConfig])

  const activeAdsCount = (sponsorAds || []).filter((a) => a.active !== false).length

  const handleLaunchLiveTv = (tournamentId) => {
    const tid = tournamentId || selectedMatchId || publishedMatches[0]?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const targetWindowName = `BadmintonLiveCast_${tid || 'general'}`
    const win = window.open(url, targetWindowName, 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no')
    if (win) {
      win.focus()
    }
  }

  const handleCopyTvLink = (tournamentId) => {
    const tid = tournamentId || selectedMatchId || publishedMatches[0]?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    try {
      navigator.clipboard.writeText(url)
      setSwapToast('🔗 Stadium TV Display Link copied! Open this URL on your Smart TV or Second Monitor. The TV will permanently show ONLY this Live Cast!')
      setTimeout(() => setSwapToast(''), 5000)
    } catch {}
  }
  const [viewMode, setViewMode] = useState('official') // 'official' | 'diagram' | 'bracket' | 'schedule' | 'players'
  const [scheduleFilter, setScheduleFilter] = useState('all') // 'all' | 'live' | 'scheduled' | 'completed' | 'ready'
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('')
  const [scheduleRoundFilter, setScheduleRoundFilter] = useState('all')
  const [scheduleLayoutView, setScheduleLayoutView] = useState('cards') // 'cards' | 'table'
  const [quickScoreScheduleMatch, setQuickScoreScheduleMatch] = useState(null)
  const [editingScoreMatchId, setEditingScoreMatchId] = useState(null)
  const [quickPlayerName, setQuickPlayerName] = useState('')
  const [quickPlayer1Name, setQuickPlayer1Name] = useState('')
  const [quickPlayer2Name, setQuickPlayer2Name] = useState('')
  const [quickPlayerPlace, setQuickPlayerPlace] = useState('')
  const [quickPlayerCourt, setQuickPlayerCourt] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [editingDeskPlayer, setEditingDeskPlayer] = useState(null)
  const [deskEditForm, setDeskEditForm] = useState({
    name: '',
    name1: '',
    name2: '',
    place: '',
    court: '',
    category: '',
  })
  const [courtFilter, setCourtFilter] = useState('all')
  const [highlightedPath, setHighlightedPath] = useState(null) // { r1MIdx, slot: 'player1'|'player2', playerName }

  useEffect(() => {
    setHighlightedPath(null)
  }, [selectedMatch?.id, selectedCategory])

  const [reportedPlayers, setReportedPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-reported-players')
      const perm = localStorage.getItem('badminton-permanent-reported-cache')
      const savedObj = saved ? JSON.parse(saved) : {}
      const permObj = perm ? JSON.parse(perm) : {}
      return { ...permObj, ...savedObj }
    } catch {
      return {}
    }
  })
  const lastLocalReportedUpdateRef = useRef(Date.now())
  const lastLocalDrawUpdateRef = useRef(0)
  const [playerSearchQuery, setPlayerSearchQuery] = useState('')
  const [playerReportingFilter, setPlayerReportingFilter] = useState('all') // 'all' | 'reported' | 'pending'

  // Theme state for official draw sheet
  const [sheetTheme, setSheetTheme] = useState('dark')

  const [matchTotalSets, setMatchTotalSets] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-match-sets')
      return saved ? JSON.parse(saved) : 3
    } catch {
      return 3
    }
  })
  const [matchTotalPoints, setMatchTotalPoints] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-match-points')
      return saved ? JSON.parse(saved) : 30
    } catch {
      return 30
    }
  })

  // Drag and Drop & Tap-to-Exchange player swap states
  const [draggedSlot, setDraggedSlot] = useState(null) // { matchId, slotKey: 'player1' | 'player2', lineNum, player }
  const [dragOverSlotKey, setDragOverSlotKey] = useState(null)
  const [swapToast, setSwapToast] = useState(null)
  const [exchangeModalSource, setExchangeModalSource] = useState(null) // { matchId, slotKey, lineNum, player, match }
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState('')

  // Interactive Match Breakdown Details Popup Modal
  const [viewingMatchDetails, setViewingMatchDetails] = useState(null)
  const [scoresheetMatch, setScoresheetMatch] = useState(null)

  // Assign Official Umpire & Start Live Match Modal state
  const [assigningLiveMatch, setAssigningLiveMatch] = useState(null)
  const [availableUmpiresList, setAvailableUmpiresList] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-temporary-credentials')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          return parsed.filter((c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role)
        }
      }
    } catch {}
    return []
  })
  const [selectedUmpireUsername, setSelectedUmpireUsername] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-temporary-credentials')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed.find((c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role)
          return first?.username || ''
        }
      }
    } catch {}
    return ''
  })
  const [umpireSearchQuery, setUmpireSearchQuery] = useState('')
  const [selectedLiveCourt, setSelectedLiveCourt] = useState('Court 1')
  const [isQuickCreateUmpire, setIsQuickCreateUmpire] = useState(false)
  const [quickUmpireName, setQuickUmpireName] = useState('')
  const [quickUmpireUser, setQuickUmpireUser] = useState('')
  const [quickUmpirePass, setQuickUmpirePass] = useState('')

  // Live Umpire Mode (true: RED Live Umpire / false: GREEN Manual Scoring Mode)
  const [isLiveUmpireMode, setIsLiveUmpireMode] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-live-umpire-mode')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  // In-line seeding config bar state
  const [inlineTotalMembers, setInlineTotalMembers] = useState(16)
  const [inlineSeedsCount, setInlineSeedsCount] = useState(4)
  const [inlineSeedAssignments, setInlineSeedAssignments] = useState({}) // { [seedNum]: playerId or customName }
  const [activeSeedDropdown, setActiveSeedDropdown] = useState(null) // 1 | 2 | 3 | 4 | null
  const [seedSearchFilter, setSeedSearchFilter] = useState('')

  // Storage for draws keyed by `${matchId}-${category}`
  const [tournamentDraws, setTournamentDraws] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAWS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          const sanitized = {}
          Object.keys(parsed).forEach((k) => {
            sanitized[k] = sanitizeBadmintonDraw(parsed[k])
          })
          return sanitized
        }
      }
    } catch {
      // fallback
    }
    // Generate initial draws for published matches
    const initialDraws = {}
    const defaultMatches = publishedMatches

    defaultMatches.forEach((m) => {
      const cats = m.categories || DEFAULT_CATEGORIES
      cats.forEach((cat) => {
        const catPlayers = (authenticators[m.id] || []).filter((p) => (p.category || 'Men Singles') === cat)
        if (catPlayers.length < 2) return
        const count = catPlayers.length
        const dSize = getNextPowerOfTwo(count)
        const d = generateBadmintonDraw(catPlayers, {
          drawSize: dSize,
          totalMembers: count,
          seedsCount: Math.min(4, count),
          courtName: m.courtName || 'Court 1',
          venue: m.matchAddress || 'Badminton Arena',
          startTime: '09:00',
          matchDurationMinutes: 30,
        })
        if (d) {
          initialDraws[`${m.id}-${cat}`] = d
        }
      })
    })
    return initialDraws
  })

  // Production-Grade order-agnostic deep equality helper to guarantee 0 state update churn
  const isDeepEqual = fastDeepEqual

  // Realtime Live Draw, Reported Players, and Score Sync from Shared Database & Supabase
  useEffect(() => {
    const syncDraws = () => {
      // If user recently made a local draw modification or has a modal open, do not overwrite from background polling
      if (Date.now() - (lastLocalDrawUpdateRef.current || 0) < 60000 || isModalActiveRef.current) return

      // 1. Fetch from Local/Network Server DB
      fetch('/api/tournaments')
        .then((res) => res.json())
        .then((data) => {
          if (!data) return
          if (Date.now() - (lastLocalDrawUpdateRef.current || 0) < 60000 || isModalActiveRef.current) return

          if (data.tournamentDraws && typeof data.tournamentDraws === 'object') {
            const sanitized = {}
            Object.keys(data.tournamentDraws).forEach((k) => {
              sanitized[k] = sanitizeBadmintonDraw(data.tournamentDraws[k])
            })
            setTournamentDraws((prev) => {
              let changed = false
              const next = { ...prev }
              Object.keys(sanitized).forEach((k) => {
                if (!isDeepEqual(prev[k], sanitized[k])) {
                  next[k] = sanitized[k]
                  changed = true
                }
              })
              if (!changed) return prev
              try {
                localStorage.setItem(DRAWS_STORAGE_KEY, JSON.stringify(next))
              } catch (e) {}
              return next
            })
          }

          if (data.publishedStatus && typeof data.publishedStatus === 'object') {
            setPublishedStatusMap((prev) => {
              if (isDeepEqual(prev, { ...prev, ...data.publishedStatus })) return prev
              const next = { ...prev, ...data.publishedStatus }
              try {
                localStorage.setItem('badminton-published-status', JSON.stringify(next))
              } catch (e) {}
              return next
            })
          } else if (data.publishedStatusMap && typeof data.publishedStatusMap === 'object') {
            setPublishedStatusMap((prev) => {
              if (isDeepEqual(prev, { ...prev, ...data.publishedStatusMap })) return prev
              const next = { ...prev, ...data.publishedStatusMap }
              try {
                localStorage.setItem('badminton-published-status', JSON.stringify(next))
              } catch (e) {}
              return next
            })
          }

          if (data.reportedPlayers && typeof data.reportedPlayers === 'object') {
            // Only merge from background fetch if user has not performed a local reporting action in the last 60 seconds
            if (Date.now() - (lastLocalReportedUpdateRef.current || 0) > 60000) {
              setReportedPlayers((prev) => {
                let changed = false
                const next = { ...prev }
                Object.keys(data.reportedPlayers).forEach((k) => {
                  const sVal = data.reportedPlayers[k]
                  if (typeof sVal === 'object' && sVal !== null) {
                    const mergedSub = { ...(next[k] || {}), ...sVal }
                    if (!isDeepEqual(next[k], mergedSub)) {
                      next[k] = mergedSub
                      changed = true
                    }
                  } else if (sVal && next[k] !== sVal) {
                    next[k] = sVal
                    changed = true
                  }
                })
                if (!changed) return prev
                try {
                  localStorage.setItem('badminton-reported-players', JSON.stringify(next))
                } catch (e) {}
                return next
              })
            }
          }

          if (data.liveUmpireMode !== undefined) {
            setIsLiveUmpireMode((prev) => {
              if (prev === data.liveUmpireMode) return prev
              try {
                localStorage.setItem('badminton-live-umpire-mode', JSON.stringify(data.liveUmpireMode))
              } catch (e) {}
              return data.liveUmpireMode
            })
          }

          if (data.systemSettings?.matchPoints) {
            setMatchTotalPoints((prev) => (prev === data.systemSettings.matchPoints ? prev : data.systemSettings.matchPoints))
          }
          if (data.systemSettings?.matchSets) {
            setMatchTotalSets((prev) => (prev === data.systemSettings.matchSets ? prev : data.systemSettings.matchSets))
          }
        })
        .catch(() => {})

      // 2. Fetch reported players from Supabase Cloud DB (Smart merge)
      if (Date.now() - (lastLocalReportedUpdateRef.current || 0) > 60000) {
        SupabaseService.getReportedPlayers()
          .then((supaRep) => {
            if (supaRep && typeof supaRep === 'object') {
              setReportedPlayers((prev) => {
                let changed = false
                const next = { ...prev }
                Object.keys(supaRep).forEach((k) => {
                  const sVal = supaRep[k]
                  if (typeof sVal === 'object' && sVal !== null) {
                    const mergedSub = { ...(next[k] || {}), ...sVal }
                    if (!isDeepEqual(next[k], mergedSub)) {
                      next[k] = mergedSub
                      changed = true
                    }
                  } else if (sVal && next[k] !== sVal) {
                    next[k] = sVal
                    changed = true
                  }
                })
                if (!changed) return prev
                try {
                  localStorage.setItem('badminton-reported-players', JSON.stringify(next))
                } catch (e) {}
                return next
              })
            }
          })
          .catch(() => {})
      }

      // 3. Fetch from Supabase Cloud DB for selected tournament (if not recently updated locally)
      if (selectedMatch?.id && isPublicView) {
        SupabaseService.getTournamentDraws(selectedMatch.id)
          .then((rows) => {
            if (Date.now() - (lastLocalDrawUpdateRef.current || 0) < 60000 || isModalActiveRef.current) return
            if (rows && Array.isArray(rows) && rows.length > 0) {
              const supaDraws = {}
              rows.forEach((row) => {
                if (row.id && row.draw_data) {
                  supaDraws[row.id] = sanitizeBadmintonDraw(row.draw_data)
                }
              })
              setTournamentDraws((prev) => {
                let changed = false
                const next = { ...prev }
                Object.keys(supaDraws).forEach((k) => {
                  if (!isDeepEqual(prev[k], supaDraws[k])) {
                    next[k] = supaDraws[k]
                    changed = true
                  }
                })
                if (!changed) return prev
                try {
                  localStorage.setItem(DRAWS_STORAGE_KEY, JSON.stringify(next))
                } catch (e) {}
                return next
              })
            }
          })
          .catch(() => {})
      }
    }

    syncDraws()
    const timer = setInterval(syncDraws, 5000)
    return () => clearInterval(timer)
  }, [selectedMatch?.id, isPublicView])

  useEffect(() => {
    try {
      if (reportedPlayers && Object.keys(reportedPlayers).length > 0) {
        localStorage.setItem('badminton-reported-players', JSON.stringify(reportedPlayers))
      }
    } catch (e) {
      console.error('Error saving reported players', e)
    }
  }, [reportedPlayers])

  const PERMANENT_REPORTED_KEY = 'badminton-permanent-reported-cache'

  // Helper to extract clean normalized identifier tokens from any player object or ID/name string
  const getPlayerTokens = (playerOrId) => {
    if (!playerOrId) return []
    const tokens = new Set()
    
    if (typeof playerOrId === 'object') {
      if (playerOrId.id !== undefined && playerOrId.id !== null && playerOrId.id !== '') {
        const idStr = String(playerOrId.id).trim()
        tokens.add(idStr)
        tokens.add(idStr.toLowerCase())
      }
      if (playerOrId.name) {
        const rawName = String(playerOrId.name).trim()
        const cleanName = rawName.replace(/\[\s*S\d+\s*\]|\(\s*S\d+\s*\)|^S\d+\s+/gi, '').trim()
        tokens.add(rawName)
        tokens.add(rawName.toLowerCase())
        tokens.add(cleanName)
        tokens.add(cleanName.toLowerCase())
        // For doubles, include individual partner names as well
        if (cleanName.includes('/')) {
          cleanName.split('/').forEach((part) => {
            const pTrim = part.trim()
            if (pTrim) {
              tokens.add(pTrim)
              tokens.add(pTrim.toLowerCase())
            }
          })
        }
      }
    } else {
      const strVal = String(playerOrId).trim()
      const cleanVal = strVal.replace(/\[\s*S\d+\s*\]|\(\s*S\d+\s*\)|^S\d+\s+/gi, '').trim()
      tokens.add(strVal)
      tokens.add(strVal.toLowerCase())
      tokens.add(cleanVal)
      tokens.add(cleanVal.toLowerCase())
      if (cleanVal.includes('/')) {
        cleanVal.split('/').forEach((part) => {
          const pTrim = part.trim()
          if (pTrim) {
            tokens.add(pTrim)
            tokens.add(pTrim.toLowerCase())
          }
        })
      }
    }

    return Array.from(tokens)
  }

  const togglePlayerReporting = (player) => {
    if (!player) return
    lastLocalReportedUpdateRef.current = Date.now()

    const tournId = selectedMatch?.id || 1
    const key = `${tournId}-${selectedCategory}`
    const tokens = getPlayerTokens(player)

    setReportedPlayers((prev) => {
      const isCurrentlyReported = isPlayerReported(player)
      const nextFullMap = { ...prev }
      const currentCatMap = { ...(prev[key] || {}) }

      // Get permanent cache
      let permCache = {}
      try {
        const savedPerm = localStorage.getItem(PERMANENT_REPORTED_KEY)
        if (savedPerm) permCache = JSON.parse(savedPerm)
      } catch (e) {}
      const permTournCat = { ...(permCache[key] || {}) }

      if (isCurrentlyReported) {
        // UNTICK: User manually clicked to untick this player
        tokens.forEach((tok) => {
          delete currentCatMap[tok]
          delete nextFullMap[`${tournId}-${tok}`]
          delete nextFullMap[tok]
          delete permTournCat[tok]
          delete permCache[`${tournId}-${tok}`]
          delete permCache[tok]
        })
      } else {
        // TICK: User ticked this player as reported
        tokens.forEach((tok) => {
          currentCatMap[tok] = true
          nextFullMap[`${tournId}-${tok}`] = true
          permTournCat[tok] = true
          permCache[`${tournId}-${tok}`] = true
        })
      }

      nextFullMap[key] = currentCatMap
      permCache[key] = permTournCat

      // Synchronously write to primary and permanent localStorage
      try {
        localStorage.setItem('badminton-reported-players', JSON.stringify(nextFullMap))
        localStorage.setItem(PERMANENT_REPORTED_KEY, JSON.stringify(permCache))
      } catch (e) {}

      // Update participant list in authenticators so isReported is baked into player records
      try {
        const savedAuthStr = localStorage.getItem('badminton-authenticators') || localStorage.getItem('badminton-match-authenticators')
        if (savedAuthStr) {
          const allAuth = JSON.parse(savedAuthStr)
          const pList = allAuth[tournId] || allAuth[String(tournId)] || []
          let authChanged = false
          const nextPList = pList.map((p) => {
            const pTokens = getPlayerTokens(p)
            const matches = tokens.some((t) => pTokens.includes(t))
            if (matches) {
              authChanged = true
              return { ...p, isReported: !isCurrentlyReported, reported: !isCurrentlyReported }
            }
            return p
          })
          if (authChanged) {
            allAuth[tournId] = nextPList
            allAuth[String(tournId)] = nextPList
            localStorage.setItem('badminton-authenticators', JSON.stringify(allAuth))
            localStorage.setItem('badminton-match-authenticators', JSON.stringify(allAuth))
          }
        }
      } catch (e) {}

      // Also update player objects in currentDraw.matches so isReported stays attached directly to match nodes
      if (currentDraw?.matches) {
        let drawMatchesChanged = false
        const nextMatches = currentDraw.matches.map((m) => {
          let updatedM = { ...m }
          let mChanged = false
          if (m.player1 && !m.player1.isBye) {
            const p1Tokens = getPlayerTokens(m.player1)
            if (tokens.some((t) => p1Tokens.includes(t))) {
              updatedM.player1 = { ...m.player1, isReported: !isCurrentlyReported, reported: !isCurrentlyReported }
              mChanged = true
            }
          }
          if (m.player2 && !m.player2.isBye) {
            const p2Tokens = getPlayerTokens(m.player2)
            if (tokens.some((t) => p2Tokens.includes(t))) {
              updatedM.player2 = { ...m.player2, isReported: !isCurrentlyReported, reported: !isCurrentlyReported }
              mChanged = true
            }
          }
          if (m.winner && !m.winner.isBye) {
            const winTokens = getPlayerTokens(m.winner)
            if (tokens.some((t) => winTokens.includes(t))) {
              updatedM.winner = { ...m.winner, isReported: !isCurrentlyReported, reported: !isCurrentlyReported }
              mChanged = true
            }
          }
          if (mChanged) {
            drawMatchesChanged = true
            return updatedM
          }
          return m
        })

        if (drawMatchesChanged) {
          setTournamentDraws((prevDraws) => {
            const updatedDrawObj = { ...currentDraw, matches: nextMatches }
            const nextDraws = { ...prevDraws, [drawKey]: updatedDrawObj }
            try {
              localStorage.setItem(DRAWS_STORAGE_KEY, JSON.stringify(nextDraws))
            } catch (e) {}
            return nextDraws
          })
        }
      }

      // Fire background POST to shared DB
      fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedPlayers: nextFullMap }),
      }).catch(() => {})

      // Also persist to Supabase
      try {
        SupabaseService.upsertReportedPlayers(nextFullMap).catch(() => {})
      } catch (e) {}

      // Notify other tabs and components
      try {
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('badminton-reported-changed', { detail: nextFullMap }))
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('badminton_sync')
          ch.postMessage({ type: 'REPORTED_PLAYERS_UPDATED', senderId: localSessionIdRef.current, reportedPlayers: nextFullMap })
          ch.close()
        }
      } catch (e) {}

      return nextFullMap
    })
  }

  const isPlayerReported = (playerOrId) => {
    if (!playerOrId) return false
    if (typeof playerOrId === 'object' && playerOrId.isBye) return false

    // 1. Direct object property check
    if (typeof playerOrId === 'object') {
      if (playerOrId.isReported === true || playerOrId.reported === true || playerOrId.is_reported === true) {
        return true
      }
    }

    const tournId = selectedMatch?.id || 1
    const key = `${tournId}-${selectedCategory}`
    const tokens = getPlayerTokens(playerOrId)
    if (tokens.length === 0) return false

    // 2. Check primary in-memory reportedPlayers state under current category
    const catMap = reportedPlayers[key] || {}
    for (const tok of tokens) {
      if (catMap[tok]) return true
    }

    // 3. Check across ALL keys and categories in reportedPlayers
    for (const k of Object.keys(reportedPlayers)) {
      const sub = reportedPlayers[k]
      if (sub && typeof sub === 'object') {
        for (const tok of tokens) {
          if (sub[tok]) return true
        }
      } else if (sub === true) {
        for (const tok of tokens) {
          if (k === tok || k === `${tournId}-${tok}` || k.endsWith(`-${tok}`)) return true
        }
      }
    }

    // 4. Check permanent localStorage cache as ultimate fallback so no background sync can ever untick
    try {
      const savedPerm = localStorage.getItem(PERMANENT_REPORTED_KEY)
      if (savedPerm) {
        const permCache = JSON.parse(savedPerm)
        for (const k of Object.keys(permCache)) {
          const sub = permCache[k]
          if (sub && typeof sub === 'object') {
            for (const tok of tokens) {
              if (sub[tok]) return true
            }
          } else if (sub === true) {
            for (const tok of tokens) {
              if (k === tok || k === `${tournId}-${tok}` || k.endsWith(`-${tok}`)) return true
            }
          }
        }
      }
    } catch (e) {}

    // 5. Check authenticators in localStorage as additional safety
    try {
      const savedAuthStr = localStorage.getItem('badminton-authenticators') || localStorage.getItem('badminton-match-authenticators')
      if (savedAuthStr) {
        const allAuth = JSON.parse(savedAuthStr)
        const pList = allAuth[tournId] || allAuth[String(tournId)] || Object.values(allAuth).flat()
        if (Array.isArray(pList)) {
          for (const p of pList) {
            if (p && (p.isReported === true || p.reported === true)) {
              const pTokens = getPlayerTokens(p)
              if (tokens.some((t) => pTokens.includes(t))) return true
            }
          }
        }
      }
    } catch (e) {}

    return false
  }

  const isMatchBothReported = (m) => {
    if (!m || !m.player1 || !m.player2) return false
    if (m.player1.isBye || m.player2.isBye) return false
    return isPlayerReported(m.player1) && isPlayerReported(m.player2)
  }

  const handleMarkAllReported = (status = true) => {
    lastLocalReportedUpdateRef.current = Date.now()
    const tournId = selectedMatch?.id || 1
    const key = `${tournId}-${selectedCategory}`

    setReportedPlayers((prev) => {
      const nextFullMap = { ...prev }
      const newMap = {}

      let permCache = {}
      try {
        const savedPerm = localStorage.getItem(PERMANENT_REPORTED_KEY)
        if (savedPerm) permCache = JSON.parse(savedPerm)
      } catch (e) {}

      if (status) {
        categoryPlayers.forEach((p) => {
          const tokens = getPlayerTokens(p)
          tokens.forEach((tok) => {
            newMap[tok] = true
            nextFullMap[`${tournId}-${tok}`] = true
            if (!permCache[key]) permCache[key] = {}
            permCache[key][tok] = true
            permCache[`${tournId}-${tok}`] = true
          })
        })
      } else {
        categoryPlayers.forEach((p) => {
          const tokens = getPlayerTokens(p)
          tokens.forEach((tok) => {
            delete nextFullMap[`${tournId}-${tok}`]
            if (permCache[key]) delete permCache[key][tok]
            delete permCache[`${tournId}-${tok}`]
          })
        })
      }
      nextFullMap[key] = newMap

      try {
        localStorage.setItem('badminton-reported-players', JSON.stringify(nextFullMap))
        localStorage.setItem(PERMANENT_REPORTED_KEY, JSON.stringify(permCache))
      } catch (e) {}

      // Update authenticators list
      try {
        const savedAuthStr = localStorage.getItem('badminton-authenticators') || localStorage.getItem('badminton-match-authenticators')
        if (savedAuthStr) {
          const allAuth = JSON.parse(savedAuthStr)
          const pList = allAuth[tournId] || allAuth[String(tournId)] || []
          const nextPList = pList.map((p) => {
            if ((p.category || 'Men Singles').trim().toLowerCase() === selectedCategory.trim().toLowerCase()) {
              return { ...p, isReported: status, reported: status }
            }
            return p
          })
          allAuth[tournId] = nextPList
          allAuth[String(tournId)] = nextPList
          localStorage.setItem('badminton-authenticators', JSON.stringify(allAuth))
          localStorage.setItem('badminton-match-authenticators', JSON.stringify(allAuth))
        }
      } catch (e) {}

      // Sync directly to DB
      fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportedPlayers: nextFullMap }),
      }).catch(() => {})

      // Also persist to Supabase
      try {
        SupabaseService.upsertReportedPlayers(nextFullMap).catch(() => {})
      } catch (e) {}

      // Notify other tabs and components
      try {
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('badminton-reported-changed', { detail: nextFullMap }))
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('badminton_sync')
          ch.postMessage({ type: 'REPORTED_PLAYERS_UPDATED', senderId: localSessionIdRef.current, reportedPlayers: nextFullMap })
          ch.close()
        }
      } catch (e) {}

      return nextFullMap
    })
  }



  const drawKey = selectedMatch && selectedCategory ? `${selectedMatch.id}-${selectedCategory}` : (selectedMatch ? `${selectedMatch.id}-Men Singles` : '1-Men Singles')
  
  const allTournamentPlayers = useMemo(() => {
    if (!selectedMatch) return []
    const mId = selectedMatch.id
    const mIdStr = String(mId)
    const fromAuth = authenticators && (authenticators[mId] || authenticators[mIdStr])
    if (fromAuth && Array.isArray(fromAuth)) {
      return fromAuth
    }
    const fromParts = selectedMatch.participants || selectedMatch.authenticators || []
    return fromParts
  }, [selectedMatch, authenticators])

  const uploadedCategoryPlayers = useMemo(() => {
    if (!selectedMatch || !selectedCategory) return []
    const selCatNorm = selectedCategory.trim().toLowerCase()
    return allTournamentPlayers.filter(
      (p) => (p.category || 'Men Singles').trim().toLowerCase() === selCatNorm
    )
  }, [allTournamentPlayers, selectedMatch, selectedCategory])

  // Only use manually entered players. NEVER inject sample or dummy players!
  const categoryPlayers = uploadedCategoryPlayers

  // Current draw (strictly from saved tournamentDraws state to eliminate render-time object churn and blinking)
  const currentDraw = useMemo(() => {
    return tournamentDraws[drawKey] || null
  }, [tournamentDraws[drawKey]])

  // All Round 1 slots for the Tap-to-Exchange Player Picker
  const allRound1Slots = (currentDraw?.matches || [])
    .filter((m) => m.round === 1)
    .flatMap((m, mIdx) => [
      {
        matchId: m.id,
        slotKey: 'player1',
        lineNum: mIdx * 2 + 1,
        player: m.player1,
        matchIndex: mIdx,
        match: m,
      },
      {
        matchId: m.id,
        slotKey: 'player2',
        lineNum: mIdx * 2 + 2,
        player: m.player2,
        matchIndex: mIdx,
        match: m,
      },
    ])

  const [showModifierPanel, setShowModifierPanel] = useState(false)
  const [isMasterScheduleModalOpen, setIsMasterScheduleModalOpen] = useState(false)
  const [schedulingTournament, setSchedulingTournament] = useState(null)

  // Track active modal state so background intervals do not overwrite data during active user editing
  useEffect(() => {
    isModalActiveRef.current = Boolean(
      isSeedingModalOpen ||
      showModifierPanel ||
      isMasterScheduleModalOpen ||
      isCourtConfigModalOpen ||
      isAdModalOpen
    )
  }, [isSeedingModalOpen, showModifierPanel, isMasterScheduleModalOpen, isCourtConfigModalOpen, isAdModalOpen])

  // Centralized helper to persist and broadcast draw changes instantly to all components and tabs
  const broadcastAndPersistDraws = (nextDraws, targetKey = null, targetDraw = null) => {
    lastLocalDrawUpdateRef.current = Date.now()
    try {
      localStorage.setItem(DRAWS_STORAGE_KEY, JSON.stringify(nextDraws))
      window.dispatchEvent(new CustomEvent('badminton-draws-changed', { detail: { draws: nextDraws } }))
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('badminton_sync')
        channel.postMessage({
          type: 'DRAWS_UPDATED',
          draws: nextDraws,
          senderId: localSessionIdRef.current,
        })
        channel.close()
      }
    } catch (err) {
      console.error('Failed to save to localStorage', err)
    }

    // Sync with server middleware DB
    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentDraws: nextDraws }),
    }).catch(() => {})

    // Sync with Supabase Cloud DB
    if (selectedMatch) {
      if (targetKey && (targetDraw || nextDraws[targetKey])) {
        const drawData = targetDraw || nextDraws[targetKey]
        const cat = targetKey.replace(`${selectedMatch.id}-`, '')
        SupabaseService.upsertTournamentDraw(targetKey, selectedMatch.id, cat, drawData, true).catch(() => {})
      } else {
        Object.keys(nextDraws || {}).forEach((key) => {
          if (key.startsWith(`${selectedMatch.id}-`)) {
            const cat = key.replace(`${selectedMatch.id}-`, '')
            SupabaseService.upsertTournamentDraw(key, selectedMatch.id, cat, nextDraws[key], true).catch(() => {})
          }
        })
      }
    }
  }

  const handleSaveMasterSchedule = ({ isTimingsActive, config, updatedDrawsMap }) => {
    const targetTour = schedulingTournament || selectedMatch
    if (!targetTour) return
    const tourId = targetTour.id

    // updatedDrawsMap is keyed by category name (e.g., 'Men Singles') or full key ('1-Men Singles')
    const fullKeysDrawMap = {}
    if (updatedDrawsMap && typeof updatedDrawsMap === 'object') {
      Object.keys(updatedDrawsMap).forEach((catOrKey) => {
        const d = updatedDrawsMap[catOrKey]
        const storageKey = catOrKey.includes('-') ? catOrKey : `${tourId}-${catOrKey}`
        fullKeysDrawMap[storageKey] = d
      })
    }

    setTournamentDraws((prev) => {
      const nextDraws = { ...prev, ...fullKeysDrawMap }
      broadcastAndPersistDraws(nextDraws)
      return nextDraws
    })

    const countUpdated = Object.keys(updatedDrawsMap || {}).length
    setSwapToast(
      isTimingsActive
        ? `✓ Master Time Schedule applied across ${countUpdated} categories!`
        : '✓ Match Time Scheduling turned OFF.'
    )
    setTimeout(() => setSwapToast(null), 3500)
  }

  const getAllCategoryDrawsForTournament = (targetTour) => {
    if (!targetTour) return {}
    const tourId = targetTour.id
    const res = {}
    const cats = targetTour.categories || (targetTour.category ? [targetTour.category] : DEFAULT_CATEGORIES)
    cats.forEach((cat) => {
      let d = tournamentDraws[`${tourId}-${cat}`]
      if (!d) {
        const fromAuth = authenticators && (authenticators[tourId] || authenticators[String(tourId)])
        const allTourPlayers = (fromAuth && Array.isArray(fromAuth))
          ? fromAuth
          : (targetTour.participants || targetTour.authenticators || [])
        const catPlayers = allTourPlayers.filter((p) => (p.category || 'Men Singles').trim().toLowerCase() === cat.trim().toLowerCase())
        if (catPlayers.length >= 2) {
          d = generateBadmintonDraw(catPlayers, {
            drawSize: getNextPowerOfTwo(catPlayers.length),
            totalMembers: catPlayers.length,
            seedsCount: Math.min(4, catPlayers.length),
            courtName: targetTour.courtName || 'Court 1',
            venue: targetTour.matchAddress || 'Badminton Arena',
            startTime: '09:00',
            matchDurationMinutes: 30,
          })
        }
      }
      if (d) res[cat] = d
    })
    return res
  }

  const [publishedStatusMap, setPublishedStatusMap] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-published-status')
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      return {}
    }
  })
  // Listen to storage & broadcast events so draws, publish toggles & reporting sync instantly across views/tabs
  useEffect(() => {
    const handleStorage = () => {
      try {
        const savedPub = localStorage.getItem('badminton-published-status')
        if (savedPub) {
          const parsedPub = JSON.parse(savedPub)
          setPublishedStatusMap((prev) => (isDeepEqual(prev, parsedPub) ? prev : parsedPub))
        }
      } catch (e) {}

      try {
        if (Date.now() - (lastLocalDrawUpdateRef.current || 0) > 3000) {
          const savedDraws = localStorage.getItem(DRAWS_STORAGE_KEY)
          if (savedDraws) {
            const parsed = JSON.parse(savedDraws)
            if (parsed && typeof parsed === 'object') {
              const sanitized = {}
              Object.keys(parsed).forEach((k) => {
                sanitized[k] = sanitizeBadmintonDraw(parsed[k])
              })
              setTournamentDraws((prev) => {
                let changed = false
                const next = { ...prev }
                Object.keys(sanitized).forEach((k) => {
                  if (!isDeepEqual(prev[k], sanitized[k])) {
                    next[k] = sanitized[k]
                    changed = true
                  }
                })
                return changed ? next : prev
              })
            }
          }
        }
      } catch (e) {}

      try {
        const savedReported = localStorage.getItem('badminton-reported-players')
        const savedPerm = localStorage.getItem(PERMANENT_REPORTED_KEY)
        const repObj = savedReported ? JSON.parse(savedReported) : {}
        const permObj = savedPerm ? JSON.parse(savedPerm) : {}
        const mergedRep = { ...permObj, ...repObj }
        if (Object.keys(mergedRep).length > 0) {
          setReportedPlayers((prev) => (isDeepEqual(prev, mergedRep) ? prev : mergedRep))
        }
      } catch (e) {}
    }

    const handleReportedCustomEvent = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        const savedPerm = localStorage.getItem(PERMANENT_REPORTED_KEY)
        const permObj = savedPerm ? JSON.parse(savedPerm) : {}
        const merged = { ...permObj, ...e.detail }
        setReportedPlayers((prev) => (isDeepEqual(prev, merged) ? prev : merged))
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('badminton-draws-changed', handleStorage)
    window.addEventListener('badminton-reported-changed', handleReportedCustomEvent)

    let channel = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('badminton_sync')
        channel.onmessage = (e) => {
          if (e.data?.senderId && e.data.senderId === localSessionIdRef.current) return
          if (e.data?.type === 'DRAWS_UPDATED' || e.data?.type === 'PUBLISH_STATUS_UPDATED' || e.data?.type === 'SETTINGS_UPDATED') {
            handleStorage()
          } else if (e.data?.type === 'REPORTED_PLAYERS_UPDATED' && e.data?.reportedPlayers) {
            setReportedPlayers((prev) => (isDeepEqual(prev, e.data.reportedPlayers) ? prev : e.data.reportedPlayers))
          }
        }
      } catch (err) {}
    }

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('badminton-draws-changed', handleStorage)
      window.removeEventListener('badminton-reported-changed', handleReportedCustomEvent)
      if (channel) channel.close()
    }
  }, [])

  const publishedCategoryList = (categories || []).filter(
    (cat) => Boolean(publishedStatusMap[`${selectedMatch?.id}-${cat}`] || tournamentDraws[`${selectedMatch?.id}-${cat}`])
  )
  const visibleCategories = isPublicView ? (publishedCategoryList.length > 0 ? publishedCategoryList : categories || []) : (categories || [])

  // In spectator/public view, auto-select first published category if current category has no draw
  useEffect(() => {
    if (isPublicView && selectedMatch) {
      const pubCats = (categories || []).filter(
        (cat) => Boolean(publishedStatusMap[`${selectedMatch.id}-${cat}`] || tournamentDraws[`${selectedMatch.id}-${cat}`])
      )
      if (pubCats.length > 0 && !pubCats.includes(selectedCategory)) {
        setSelectedCategory(pubCats[0])
      }
    }
  }, [selectedMatch?.id, isPublicView])

  // Sync inline seeding bar defaults with the active draw or category when opened
  useEffect(() => {
    if (currentDraw) {
      if (currentDraw.drawSize) {
        setInlineTotalMembers(currentDraw.drawSize)
      }

      // Collect existing seeds from current draw
      const assignments = {}
      let maxSeedFound = 0

      if (Array.isArray(currentDraw.seeds) && currentDraw.seeds.length > 0) {
        currentDraw.seeds.forEach((s) => {
          if (s && s.seed) {
            assignments[s.seed] = s.id || s.name
            if (s.seed > maxSeedFound) maxSeedFound = s.seed
          }
        })
      } else if (currentDraw.matches) {
        currentDraw.matches
          .filter((m) => m.round === 1)
          .forEach((m) => {
            if (m.player1 && m.player1.seed) {
              assignments[m.player1.seed] = m.player1.id || m.player1.name
              if (m.player1.seed > maxSeedFound) maxSeedFound = m.player1.seed
            }
            if (m.player2 && m.player2.seed) {
              assignments[m.player2.seed] = m.player2.id || m.player2.name
              if (m.player2.seed > maxSeedFound) maxSeedFound = m.player2.seed
            }
          })
      }

      const effectiveSeedsCount = currentDraw.seedsCount !== undefined
        ? currentDraw.seedsCount
        : (maxSeedFound > 0 ? (maxSeedFound > 4 ? 8 : maxSeedFound > 2 ? 4 : maxSeedFound > 1 ? 2 : maxSeedFound) : 0)

      setInlineSeedsCount(effectiveSeedsCount)
      setInlineSeedAssignments(assignments)
    } else {
      const pCount = categoryPlayers.length
      const defSize = pCount <= 4 ? 4 : pCount <= 8 ? 8 : pCount <= 16 ? 16 : pCount <= 32 ? 32 : 64
      setInlineTotalMembers(defSize)
      const defSeeds = defSize <= 4 ? 2 : defSize <= 16 ? 4 : 8
      setInlineSeedsCount(defSeeds)
      const defAssignments = {}
      for (let i = 1; i <= defSeeds; i++) {
        if (categoryPlayers[i - 1]) {
          defAssignments[i] = categoryPlayers[i - 1].id
        }
      }
      setInlineSeedAssignments(defAssignments)
    }
  }, [drawKey, showModifierPanel])



  // Close dropdown on outside click
  const dropdownRef = useRef(null)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveSeedDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleGenerateDrawWithConfig = (cat, config) => {
    if (!selectedMatch) return

    const targetCategory = cat || selectedCategory
    const playersForCat = (authenticators[selectedMatch.id] || []).filter(
      (p) => (p.category || 'Men Singles') === targetCategory
    )

    const basePlayers = playersForCat.length > 0 ? playersForCat : categoryPlayers

    const draw = generateBadmintonDraw(basePlayers, config)
    const key = `${selectedMatch.id}-${targetCategory}`

    setPublishedStatusMap((prev) => {
      const nextPub = { ...prev, [key]: true }
      try {
        localStorage.setItem('badminton-published-status', JSON.stringify(nextPub))
      } catch (e) {}
      fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publishedStatus: nextPub }),
      }).catch(() => {})
      return nextPub
    })

    setTournamentDraws((prev) => {
      const nextDraws = {
        ...prev,
        [key]: draw,
      }
      broadcastAndPersistDraws(nextDraws, key, draw)
      return nextDraws
    })

    // Update player seeds and info in authenticators / tournament participants outside the draw as well!
    if (Array.isArray(config.seeds) && config.seeds.length > 0) {
      try {
        const savedAuthStr = localStorage.getItem('badminton-authenticators') || localStorage.getItem('badminton-match-authenticators')
        const allAuthMap = savedAuthStr ? JSON.parse(savedAuthStr) : { ...authenticators }
        const mId = selectedMatch.id
        const mIdStr = String(mId)
        const currentList = Array.isArray(allAuthMap[mId])
          ? allAuthMap[mId]
          : (Array.isArray(allAuthMap[mIdStr]) ? allAuthMap[mIdStr] : (selectedMatch.participants || []))

        const matchedSeedIds = new Set()
        const matchedSeedNames = new Set()

        const updatedList = currentList.map((p) => {
          if ((p.category || 'Men Singles').trim().toLowerCase() !== targetCategory.trim().toLowerCase()) {
            return p
          }
          const pId = String(p.id || '').trim()
          const pName = String(p.name || '').trim().toLowerCase()

          const matchedSeed = config.seeds.find((s) => {
            if (!s || !s.name) return false
            const sId = String(s.id || '').trim()
            const sName = String(s.name || '').trim().toLowerCase()
            return (sId && sId === pId) || (sName && sName === pName)
          })

          if (matchedSeed) {
            if (matchedSeed.id) matchedSeedIds.add(String(matchedSeed.id).trim())
            if (matchedSeed.name) matchedSeedNames.add(String(matchedSeed.name).trim().toLowerCase())
            return {
              ...p,
              name: formatPersonName(matchedSeed.name || p.name),
              seed: Number(matchedSeed.seed) || null,
              isSeed: true,
              place: matchedSeed.place !== undefined && matchedSeed.place !== '' ? formatPlaceOrClub(matchedSeed.place) : (p.place || ''),
              court: matchedSeed.court !== undefined && matchedSeed.court !== '' ? formatCourtName(matchedSeed.court) : (p.court || ''),
            }
          } else {
            return {
              ...p,
              seed: null,
              isSeed: false,
            }
          }
        })

        // Add any new players that were typed into seed slots in the modal
        config.seeds.forEach((s, idx) => {
          if (!s || !s.name) return
          const sName = String(s.name).trim()
          const sNameLower = sName.toLowerCase()
          const sId = String(s.id || '').trim()
          const isGeneric = /^seed\s*\d+$/i.test(sName)

          if (!isGeneric && !matchedSeedNames.has(sNameLower) && (!sId || !matchedSeedIds.has(sId))) {
            const newPlayerId = (s.id && !String(s.id).startsWith('seed-')) ? s.id : (Date.now() + idx + 100)
            const newPlayer = {
              id: newPlayerId,
              name: formatPersonName(sName),
              place: formatPlaceOrClub(s.place || ''),
              court: formatCourtName(s.court || ''),
              category: targetCategory,
              seed: Number(s.seed) || null,
              isSeed: true,
            }
            updatedList.push(newPlayer)
            matchedSeedNames.add(sNameLower)
            if (sId) matchedSeedIds.add(sId)
          }
        })

        allAuthMap[mId] = updatedList
        allAuthMap[mIdStr] = updatedList
        localStorage.setItem('badminton-authenticators', JSON.stringify(allAuthMap))
        localStorage.setItem('badminton-match-authenticators', JSON.stringify(allAuthMap))
        fetch('/api/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticators: allAuthMap }),
        }).catch(() => {})
        SupabaseService.upsertAuthenticators(mId, updatedList).catch(() => {})
      } catch (err) {
        console.error('Error syncing seeds to authenticators', err)
      }
    }

    setSelectedCategory(targetCategory)
    setFixturesLevel('draw')
    setViewMode('official') // Navigate screen directly to official fixtures!
    setShowModifierPanel(false) // Close the modifier bar so fixtures take center stage!
    setIsSeedingModalOpen(false) // Close modal if open!
    window.dispatchEvent(new Event('storage'))

    setSwapToast(`✨ Fixtures Generated & Updated (${config.drawSize || 16} Draw Bracket • ${config.totalPlayers || config.totalMembers} Players • ${config.byesCount || 0} Byes)!`)
    setTimeout(() => setSwapToast(null), 3500)
  }

  const handleGenerateDrawFromInline = (overrideSize = null) => {
    if (!selectedMatch || !selectedCategory) return

    const rawInput = Number(overrideSize || inlineTotalMembers) || 16
    const targetSize = Math.max(2, Math.min(1024, rawInput))
    const bracketSize = getNextPowerOfTwo(targetSize)

    let effectiveSeedsCount = inlineSeedsCount
    if (effectiveSeedsCount === undefined || effectiveSeedsCount === null) {
      effectiveSeedsCount = bracketSize >= 64 ? 8 : bracketSize >= 16 ? 4 : bracketSize >= 8 ? 2 : 1
    }

    const explicitSeeds = []
    for (let i = 1; i <= effectiveSeedsCount; i++) {
      const assigned = inlineSeedAssignments[i]
      if (assigned) {
        const pObj = categoryPlayers.find((p) => String(p.id) === String(assigned) || String(p.name) === String(assigned))
        if (pObj) {
          explicitSeeds.push({
            id: pObj.id,
            name: pObj.name,
            place: pObj.place || '',
            court: pObj.court || '',
            seed: i,
            isSeed: true,
          })
        } else {
          explicitSeeds.push({
            id: `custom-seed-${i}`,
            name: String(assigned),
            place: '',
            court: '',
            seed: i,
            isSeed: true,
          })
        }
      } else if (categoryPlayers[i - 1]) {
        explicitSeeds.push({
          id: categoryPlayers[i - 1].id,
          name: categoryPlayers[i - 1].name,
          place: categoryPlayers[i - 1].place || '',
          court: categoryPlayers[i - 1].court || '',
          seed: i,
          isSeed: true,
        })
      } else {
        explicitSeeds.push({
          id: `seed-${i}`,
          name: `Seed ${i}`,
          place: '',
          court: '',
          seed: i,
          isSeed: true,
        })
      }
    }

    const calculatedByes = Math.max(0, bracketSize - targetSize)

    const config = {
      totalMembers: targetSize,
      drawSize: bracketSize,
      totalPlayers: targetSize,
      byesCount: calculatedByes,
      seedsCount: effectiveSeedsCount,
      seeds: explicitSeeds,
      courtName: selectedMatch.courtName || 'Court 1',
      venue: selectedMatch.matchAddress || 'Badminton Arena',
      startTime: currentDraw?.startTime || currentDraw?.config?.startTime || '09:00',
      matchDurationMinutes: currentDraw?.matchDuration || currentDraw?.config?.matchDuration || 30,
      showTimings: currentDraw?.showTimings !== undefined ? Boolean(currentDraw.showTimings) : (currentDraw?.config?.showTimings !== undefined ? Boolean(currentDraw.config.showTimings) : true),
    }

    handleGenerateDrawWithConfig(selectedCategory, config)
  }

  const handleSelectDrawSize = (size) => {
    const validSize = Math.max(2, Math.min(1024, Number(size) || 16))
    setInlineTotalMembers(validSize)
  }

  const handleUpdateMatch = (matchId, updates) => {
    if (!drawKey || !currentDraw) return

    const updatedMatches = currentDraw.matches.map((m) => {
      if (m.id === matchId) {
        const next = { ...m, ...updates }

        // Explicitly preserve reporting status on player1 and player2
        if (m.player1 && !m.player1.isBye) {
          const isP1Rep = isPlayerReported(m.player1)
          next.player1 = { ...m.player1, ...(updates.player1 || {}), isReported: isP1Rep, reported: isP1Rep }
        }
        if (m.player2 && !m.player2.isBye) {
          const isP2Rep = isPlayerReported(m.player2)
          next.player2 = { ...m.player2, ...(updates.player2 || {}), isReported: isP2Rep, reported: isP2Rep }
        }
        if (next.winner && !next.winner.isBye) {
          const isWinRep = isPlayerReported(next.winner)
          next.winner = { ...next.winner, isReported: isWinRep, reported: isWinRep }
        }

        // If reverting to scheduled status, reset all live points, sets, and scores to 0 / clean slate
        if (updates.status === 'scheduled') {
          next.isLive = false
          next.winner = null
          next.liveScore = {
            set1: { p1: 0, p2: 0 },
            set2: { p1: 0, p2: 0 },
            set3: { p1: 0, p2: 0 },
            set4: { p1: 0, p2: 0 },
            set5: { p1: 0, p2: 0 },
            currentSet: 1,
            server: 'p1',
            receiver: 'p2',
          }
          next.scoreSet1A = ''
          next.scoreSet1B = ''
          next.scoreSet2A = ''
          next.scoreSet2B = ''
          next.scoreSet3A = ''
          next.scoreSet3B = ''
          next.scoreSet4A = ''
          next.scoreSet4B = ''
          next.scoreSet5A = ''
          next.scoreSet5B = ''
          next.totalScoreA = ''
          next.totalScoreB = ''
          next.setsWonA = 0
          next.setsWonB = 0
        } else if (updates.status === 'live' && !next.liveScore) {
          next.liveScore = {
            set1: { p1: 0, p2: 0 },
            set2: { p1: 0, p2: 0 },
            set3: { p1: 0, p2: 0 },
            set4: { p1: 0, p2: 0 },
            set5: { p1: 0, p2: 0 },
            currentSet: 1,
            server: 'p1',
            receiver: 'p2',
          }
        }

        if (updates.winner !== undefined && updates.winner !== m.winner) {
          next.previousWinnerId = m.winner?.id
        }
        return next
      }
      return m
    })

    propagateWinners(updatedMatches)

    // Check if the final championship match of the current category has a winner
    const finalMatch = updatedMatches.find((m) => m.round === currentDraw.totalRounds)
    const isFinalWinner = Boolean(finalMatch?.winner && !finalMatch.winner.isBye)

    let nextDraws = null
    setTournamentDraws((prev) => {
      const updatedDrawObj = {
        ...currentDraw,
        matches: updatedMatches,
      }
      nextDraws = {
        ...prev,
        [drawKey]: updatedDrawObj,
      }
      broadcastAndPersistDraws(nextDraws, drawKey, updatedDrawObj)
      return nextDraws
    })

    // Update category-wise winners. ONLY transition tournament to completed if ALL categories have concluded!
    if (selectedMatch) {
      const configuredCategories = Array.isArray(selectedMatch.categories) && selectedMatch.categories.length > 0
        ? selectedMatch.categories
        : (selectedMatch.category ? [selectedMatch.category] : ['Men Singles'])

      try {
        const savedPubRaw = localStorage.getItem('badminton-published-matches')
        if (savedPubRaw) {
          const parsed = JSON.parse(savedPubRaw)
          const updated = parsed.map((pm) => {
            if (pm.id === selectedMatch.id) {
              const currentCatWinners = { ...(pm.categoryWinners || selectedMatch.categoryWinners || {}) }
              if (isFinalWinner) {
                currentCatWinners[selectedCategory] = finalMatch.winner.name
              } else if (finalMatch && !finalMatch.winner) {
                delete currentCatWinners[selectedCategory]
              }

              // Check if all configured categories have crowned winners
              const allCategoriesFinished = configuredCategories.length > 0 && configuredCategories.every((cat) => {
                if (cat === selectedCategory) {
                  return isFinalWinner
                }
                if (currentCatWinners[cat] && typeof currentCatWinners[cat] === 'string' && currentCatWinners[cat].trim().length > 0) {
                  return true
                }
                const catDraw = nextDraws?.[`${selectedMatch.id}-${cat}`]
                if (catDraw?.matches?.length > 0 && catDraw.totalRounds) {
                  const fMatch = catDraw.matches.find((m) => m.round === catDraw.totalRounds)
                  return Boolean(fMatch?.winner && !fMatch.winner.isBye)
                }
                return false
              })

              // Build winner summary string if all categories completed
              let winnerSummary = ''
              if (allCategoriesFinished) {
                if (configuredCategories.length === 1) {
                  winnerSummary = currentCatWinners[configuredCategories[0]] || finalMatch?.winner?.name || ''
                } else {
                  winnerSummary = configuredCategories
                    .map((cat) => `${cat}: ${currentCatWinners[cat] || 'Champion'}`)
                    .join(' | ')
                }
              }

              return {
                ...pm,
                categoryWinners: currentCatWinners,
                winner: allCategoriesFinished ? winnerSummary : '',
                status: allCategoriesFinished ? 'completed' : 'ongoing',
                isCompleted: allCategoriesFinished,
              }
            }
            return pm
          })
          localStorage.setItem('badminton-published-matches', JSON.stringify(updated))
          window.dispatchEvent(new Event('storage'))
        }
      } catch (e) {}
    }
  }

  const handleOpenScoresheet = (match) => {
    if (!match) return
    setScoresheetMatch(match)
  }

  const handleScoresheetPrinted = (match) => {
    if (!match) return
    if (!isLiveUmpireMode && (match.status === 'scheduled' || !match.winner)) {
      handleUpdateMatch(match.id, {
        status: 'live',
        isLive: true,
      })
      try {
        window.dispatchEvent(new Event('storage'))
      } catch (e) {}
      setSwapToast(`🖨️ Scoresheet printed! Match #${match.matchNumber || ''} is now LIVE on court!`)
      setTimeout(() => setSwapToast(null), 3500)
    }
  }

  const loadAvailableUmpires = (preferredCourt = null) => {
    let list = []
    try {
      const saved = localStorage.getItem('badminton-temporary-credentials')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          list = parsed.filter((c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role)
        }
      }
    } catch {}

    setAvailableUmpiresList(list)

    if (preferredCourt) {
      const courtMatch = list.find(
        (u) => (u.assignedCourt || u.courtName || '').toLowerCase() === preferredCourt.toLowerCase()
      )
      if (courtMatch) {
        setSelectedUmpireUsername(courtMatch.username)
      } else if (list.length > 0) {
        setSelectedUmpireUsername(list[0].username)
      } else {
        setSelectedUmpireUsername('')
      }
    } else if (list.length > 0) {
      setSelectedUmpireUsername((prev) => prev || list[0].username)
    } else {
      setSelectedUmpireUsername('')
    }

    fetch('/api/tournaments')
      .then((r) => {
        const ct = r.headers.get('content-type') || ''
        if (r.ok && ct.includes('application/json')) return r.json()
        return null
      })
      .then((d) => {
        if (!d) return
        if (d?.temporaryCredentials && Array.isArray(d.temporaryCredentials)) {
          const serverList = d.temporaryCredentials.filter(
            (c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role
          )
          setAvailableUmpiresList(serverList)
          try {
            localStorage.setItem('badminton-temporary-credentials', JSON.stringify(d.temporaryCredentials))
          } catch {}

          if (preferredCourt) {
            const courtMatch = serverList.find(
              (u) => (u.assignedCourt || u.courtName || '').toLowerCase() === preferredCourt.toLowerCase()
            )
            if (courtMatch) {
              setSelectedUmpireUsername(courtMatch.username)
            } else if (serverList.length > 0) {
              setSelectedUmpireUsername((prev) => prev || serverList[0].username)
            } else {
              setSelectedUmpireUsername('')
            }
          } else if (serverList.length > 0) {
            setSelectedUmpireUsername((prev) => prev || serverList[0].username)
          } else {
            setSelectedUmpireUsername('')
          }
        }
      })
      .catch(() => {})
  }

  const hasUmpireLogins = availableUmpiresList.length > 0

  const handleToggleLiveUmpireMode = () => {
    let curList = availableUmpiresList || []
    try {
      const saved = localStorage.getItem('badminton-temporary-credentials')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          curList = parsed.filter((c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role)
        }
      }
    } catch {}

    if (curList.length === 0 && !isLiveUmpireMode) {
      setSwapToast('🔒 Live Umpire Mode is LOCKED: No Umpire Logins found! Please create at least 1 Umpire Login in Logins Page first.')
      setTimeout(() => setSwapToast(null), 4000)
      return
    }

    const nextMode = !isLiveUmpireMode
    setIsLiveUmpireMode(nextMode)
    try {
      localStorage.setItem('badminton-live-umpire-mode', JSON.stringify(nextMode))
    } catch {}

    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveUmpireMode: nextMode }),
    }).catch(() => {})

    setSwapToast(
      nextMode
        ? '🔴 Live Umpire Mode ENABLED: Matches can be assigned to umpires for mobile live scoring.'
        : '🟢 Manual Scoring Mode ENABLED: Umpire login disabled. Scores are entered manually.'
    )
    setTimeout(() => setSwapToast(null), 3500)
  }

  const handlePromptStartLive = (match) => {
    if (!match) return

    let curList = availableUmpiresList || []
    try {
      const saved = localStorage.getItem('badminton-temporary-credentials')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          curList = parsed.filter((c) => c.role === 'umpire' || c.scope === 'umpire' || !c.role)
        }
      }
    } catch {}

    // When in Manual Mode (GREEN) or when NO umpire logins exist: Umpire selection is bypassed! Set to live and open manual scoring
    if (!isLiveUmpireMode || curList.length === 0) {
      handleUpdateMatch(match.id, { status: 'live', isLive: true })
      setQuickScoreScheduleMatch(match)
      setSwapToast(
        curList.length === 0
          ? `🟢 Match #${match.matchNumber || ''} is now LIVE (Manual Scoring Mode • No Umpires Created)!`
          : `🟢 Match #${match.matchNumber || ''} is now LIVE (Manual Scoring Mode)!`
      )
      setTimeout(() => setSwapToast(null), 3500)
      return
    }

    const targetCourt = match.court || selectedMatch?.courtName || 'Court 1'
    loadAvailableUmpires(targetCourt)
    setAssigningLiveMatch(match)
    setSelectedLiveCourt(targetCourt)
    setIsQuickCreateUmpire(false)
    setUmpireSearchQuery('')

    // Pre-populate quick create defaults if user needs to create one
    const rand = Math.floor(100 + Math.random() * 900)
    setQuickUmpireUser(`umpire_${rand}`)
    setQuickUmpirePass(`1234`)
    setQuickUmpireName(`Match Umpire ${rand}`)
  }

  const handleConfirmStartLiveMatch = (startLiveImmediately = true) => {
    if (!assigningLiveMatch) return

    let targetUsername = selectedUmpireUsername
    let targetName = 'Official Umpire'

    if (isQuickCreateUmpire) {
      if (!quickUmpireUser.trim() || !quickUmpirePass.trim()) {
        alert('Please enter a username and password for the new umpire.')
        return
      }
      targetUsername = quickUmpireUser.trim()
      targetName = quickUmpireName.trim() || targetUsername

      const newCred = {
        id: `temp_${Date.now()}`,
        authName: targetName,
        username: targetUsername,
        password: quickUmpirePass.trim(),
        role: 'umpire',
        assignedCourt: selectedLiveCourt,
        assignedMatchId: selectedMatch?.id || '',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        accessCount: 0,
        isActive: true,
      }

      const nextCreds = [newCred, ...availableUmpiresList.filter((c) => c.username !== targetUsername)]
      setAvailableUmpiresList(nextCreds)
      try {
        localStorage.setItem('badminton-temporary-credentials', JSON.stringify(nextCreds))
      } catch {}

      fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryCredentials: nextCreds }),
      }).catch(() => {})

      SupabaseService.upsertCredential(newCred).catch(() => {})
    } else {
      const found = availableUmpiresList.find((u) => u.username === selectedUmpireUsername)
      if (found) {
        targetName = found.authName || found.name || found.username
      }
    }

    handleUpdateMatch(assigningLiveMatch.id, {
      status: startLiveImmediately ? 'live' : 'scheduled',
      isLive: Boolean(startLiveImmediately),
      court: selectedLiveCourt,
      assignedCourt: selectedLiveCourt,
      assignedUmpireUsername: targetUsername,
      assignedUmpireName: targetName,
    })

    if (startLiveImmediately) {
      setSwapToast(`🚀 Match #${assigningLiveMatch.matchNumber || ''} is now LIVE on ${selectedLiveCourt}! Assigned to Umpire: ${targetName}`)
    } else {
      setSwapToast(`📋 Match #${assigningLiveMatch.matchNumber || ''} assigned to ${targetName} on ${selectedLiveCourt} (Showing in Upcoming Queue)!`)
    }
    setTimeout(() => setSwapToast(null), 4000)

    setAssigningLiveMatch(null)
  }

  const handleResetMatchScore = (match) => {
    if (!match) return
    const clearedScores = {}
    const setsCount = Number(matchTotalSets) || 3
    for (let s = 1; s <= setsCount; s++) {
      clearedScores[`scoreSet${s}A`] = ''
      clearedScores[`scoreSet${s}B`] = ''
    }
    handleUpdateMatch(match.id, {
      ...clearedScores,
      winner: null,
      status: 'scheduled',
    })
    setQuickScoreScheduleMatch((prev) => ({
      ...prev,
      ...clearedScores,
      winner: null,
      status: 'scheduled',
    }))
  }

  const handleScoreChange = (match, field, value) => {
    const effectiveMatchSets = match.matchSets || (
      match.status === 'completed'
        ? Math.max(
            (match.scoreSet5A || match.scoreSet5B) ? 5 :
            (match.scoreSet4A || match.scoreSet4B) ? 4 :
            (match.scoreSet3A || match.scoreSet3B) ? 3 :
            (match.scoreSet2A || match.scoreSet2B) ? 2 :
            1,
            match.matchSets || 1
          )
        : matchTotalSets
    )
    const maxPts = Number(match.matchPoints || matchTotalPoints) || 30
    let finalVal = value

    if (value !== '' && value !== undefined) {
      const numVal = Number(value)
      if (!isNaN(numVal)) {
        if (numVal > maxPts) {
          // If user attempts to type greater than maximum points, cap to maxPts
          finalVal = maxPts
        } else if (numVal < 0) {
          finalVal = 0
        } else {
          finalVal = numVal
        }
      }
    }

    const nextMatch = { ...match, [field]: finalVal, matchSets: effectiveMatchSets, matchPoints: maxPts }
    const autoWinner = calculateBadmintonWinner(nextMatch, match.player1, match.player2, effectiveMatchSets)
    const isCompleted = autoWinner !== null

    // Automatic Status Transition:
    // If winner found -> 'completed'
    // If no winner -> 'live'
    const nextStatus = isCompleted ? 'completed' : 'live'

    handleUpdateMatch(match.id, {
      [field]: finalVal,
      matchSets: effectiveMatchSets,
      matchPoints: maxPts,
      winner: autoWinner,
      status: nextStatus,
    })
  }

  const handleSwapPlayers = (source, target) => {
    if (!currentDraw || !source || !target) return
    if (source.matchId === target.matchId && source.slotKey === target.slotKey) return

    const matchMap = new Map(currentDraw.matches.map((m) => [m.id, { ...m }]))
    const sourceMatch = matchMap.get(source.matchId)
    const targetMatch = matchMap.get(target.matchId)

    if (!sourceMatch || !targetMatch) return

    const playerA = sourceMatch[source.slotKey]
    const playerB = targetMatch[target.slotKey]

    // Prevent swapping if it would place two BYEs in the same match
    const targetOpponentSlotKey = target.slotKey === 'player1' ? 'player2' : 'player1'
    const targetOpponent = targetMatch[targetOpponentSlotKey]
    if (playerA?.isBye && targetOpponent?.isBye) {
      setSwapToast('⚠️ Cannot place BYE against another BYE!')
      setTimeout(() => setSwapToast(null), 3000)
      return
    }

    const sourceOpponentSlotKey = source.slotKey === 'player1' ? 'player2' : 'player1'
    const sourceOpponent = sourceMatch[sourceOpponentSlotKey]
    if (playerB?.isBye && sourceOpponent?.isBye) {
      setSwapToast('⚠️ Cannot place BYE against another BYE!')
      setTimeout(() => setSwapToast(null), 3000)
      return
    }

    // Preserve the Seed properties of each physical slot:
    // Seed 1 is fixed to Line 1, Seed 2 to Line 16, etc.
    // When a player is exchanged into a seeded slot, they become that Seed!
    // The player moving out of a seeded slot into an unseeded slot becomes unseeded!
    const sourceSeed = playerA?.seed ?? null
    const sourceIsSeed = Boolean(playerA?.isSeed || playerA?.seed)

    const targetSeed = playerB?.seed ?? null
    const targetIsSeed = Boolean(playerB?.isSeed || playerB?.seed)

    // Player B moves into Source Slot (adopts Source Slot's Seed & Line)
    const newPlayerInSource = playerB
      ? {
          ...playerB,
          seed: playerB.isBye ? null : (sourceIsSeed ? sourceSeed : null),
          isSeed: playerB.isBye ? false : sourceIsSeed,
          line: source.lineNum || (source.slotKey === 'player1' ? sourceMatch.line1 : sourceMatch.line2),
        }
      : null

    // Player A moves into Target Slot (adopts Target Slot's Seed & Line)
    const newPlayerInTarget = playerA
      ? {
          ...playerA,
          seed: playerA.isBye ? null : (targetIsSeed ? targetSeed : null),
          isSeed: playerA.isBye ? false : targetIsSeed,
          line: target.lineNum || (target.slotKey === 'player1' ? targetMatch.line1 : targetMatch.line2),
        }
      : null

    sourceMatch[source.slotKey] = newPlayerInSource
    targetMatch[target.slotKey] = newPlayerInTarget

    // For Round 1 matches, handle bye walkover advancement cleanly
    const recomputeMatchByeWinner = (m) => {
      const p1 = m.player1
      const p2 = m.player2
      if (p1 && p2) {
        if (p1.isBye && !p2.isBye) {
          m.winner = { ...p2, hasByeWalkover: true }
          m.status = 'completed'
          m.totalScoreA = '-'
          m.totalScoreB = 'W/O'
        } else if (p2.isBye && !p1.isBye) {
          m.winner = { ...p1, hasByeWalkover: true }
          m.status = 'completed'
          m.totalScoreA = 'W/O'
          m.totalScoreB = '-'
        } else if (!p1.isBye && !p2.isBye) {
          // If neither is a bye, reset winner if it was set due to a bye walkover
          if (m.winner?.hasByeWalkover || m.totalScoreA === 'W/O' || m.totalScoreB === 'W/O' || (!m.scoreSet1A && !m.scoreSet1B)) {
            m.winner = null
            m.status = 'scheduled'
            m.totalScoreA = ''
            m.totalScoreB = ''
          }
        }
      }
    }

    if (sourceMatch.round === 1) recomputeMatchByeWinner(sourceMatch)
    if (targetMatch.round === 1) recomputeMatchByeWinner(targetMatch)

    const updatedMatches = Array.from(matchMap.values())
    propagateWinners(updatedMatches)

    // Update active seeds list metadata
    const updatedSeeds = (currentDraw.seeds || []).map((s) => {
      if (sourceIsSeed && s.seed === sourceSeed) {
        return {
          ...s,
          id: newPlayerInSource?.id || s.id,
          name: newPlayerInSource?.name || s.name,
          place: newPlayerInSource?.place || '',
          court: newPlayerInSource?.court || '',
        }
      }
      if (targetIsSeed && s.seed === targetSeed) {
        return {
          ...s,
          id: newPlayerInTarget?.id || s.id,
          name: newPlayerInTarget?.name || s.name,
          place: newPlayerInTarget?.place || '',
          court: newPlayerInTarget?.court || '',
        }
      }
      return s
    })

    const updatedDrawObj = {
      ...currentDraw,
      seeds: updatedSeeds,
      matches: updatedMatches,
    }

    setTournamentDraws((prev) => {
      const nextDraws = {
        ...prev,
        [drawKey]: updatedDrawObj,
      }
      broadcastAndPersistDraws(nextDraws, drawKey, updatedDrawObj)
      return nextDraws
    })

    // Also sync player seeds to authenticators outside
    try {
      const savedAuthStr = localStorage.getItem('badminton-authenticators') || localStorage.getItem('badminton-match-authenticators')
      const allAuthMap = savedAuthStr ? JSON.parse(savedAuthStr) : { ...authenticators }
      const mId = selectedMatch.id
      const mIdStr = String(mId)
      const currentList = Array.isArray(allAuthMap[mId])
        ? allAuthMap[mId]
        : (Array.isArray(allAuthMap[mIdStr]) ? allAuthMap[mIdStr] : (selectedMatch.participants || []))

      let changed = false
      const updatedList = currentList.map((p) => {
        if ((p.category || 'Men Singles').trim().toLowerCase() !== selectedCategory.trim().toLowerCase()) return p
        const pId = String(p.id || '').trim()
        const pName = String(p.name || '').trim().toLowerCase()
        if (newPlayerInSource && (String(newPlayerInSource.id) === pId || String(newPlayerInSource.name || '').trim().toLowerCase() === pName)) {
          changed = true
          return {
            ...p,
            seed: newPlayerInSource.seed || null,
            isSeed: Boolean(newPlayerInSource.seed),
          }
        }
        if (newPlayerInTarget && (String(newPlayerInTarget.id) === pId || String(newPlayerInTarget.name || '').trim().toLowerCase() === pName)) {
          changed = true
          return {
            ...p,
            seed: newPlayerInTarget.seed || null,
            isSeed: Boolean(newPlayerInTarget.seed),
          }
        }
        return p
      })

      if (changed) {
        allAuthMap[mId] = updatedList
        allAuthMap[mIdStr] = updatedList
        localStorage.setItem('badminton-authenticators', JSON.stringify(allAuthMap))
        localStorage.setItem('badminton-match-authenticators', JSON.stringify(allAuthMap))
        fetch('/api/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticators: allAuthMap }),
        }).catch(() => {})
        SupabaseService.upsertAuthenticators(mId, updatedList).catch(() => {})
      }
    } catch (e) {}

    const nameA = playerA?.name || 'Player'
    const nameB = playerB?.name || 'Player'
    const sourceLabel = sourceIsSeed ? `[S${sourceSeed}] ${nameB}` : nameB
    const targetLabel = targetIsSeed ? `[S${targetSeed}] ${nameA}` : nameA
    setSwapToast(`🔄 Exchanged Position: Line ${source.lineNum} (${sourceLabel}) ⇄ Line ${target.lineNum} (${targetLabel})`)
    setTimeout(() => setSwapToast(null), 3500)
  }

  const handleQuickAddPlayer = (e) => {
    e.preventDefault()
    if (!selectedMatch) return

    const isDoubles = isDoublesCategory(selectedCategory)
    let finalName = ''
    if (isDoubles) {
      if (!quickPlayer1Name.trim() && !quickPlayer2Name.trim() && !quickPlayerName.trim()) return
      if (quickPlayer1Name.trim() && quickPlayer2Name.trim()) {
        finalName = joinDoublesNames(quickPlayer1Name, quickPlayer2Name)
      } else if (quickPlayer1Name.trim()) {
        finalName = formatPersonName(quickPlayer1Name)
      } else if (quickPlayer2Name.trim()) {
        finalName = formatPersonName(quickPlayer2Name)
      } else {
        finalName = formatPersonName(quickPlayerName)
      }
    } else {
      if (!quickPlayerName.trim()) return
      finalName = formatPersonName(quickPlayerName)
    }

    const newParticipant = {
      id: Date.now(),
      name: finalName,
      place: formatPlaceOrClub(quickPlayerPlace),
      court: formatCourtName(quickPlayerCourt, ''),
      category: formatCategoryName(selectedCategory),
    }

    if (onAddParticipant) {
      onAddParticipant(selectedMatch.id, newParticipant)
    }

    // Direct synchronous local storage update
    try {
      const matchKey = selectedMatch.id
      const matchKeyStr = String(matchKey)
      const savedAuth = localStorage.getItem('badminton-match-authenticators') || localStorage.getItem('badminton-authenticators')
      let parsedAuth = {}
      if (savedAuth) {
        try { parsedAuth = JSON.parse(savedAuth) } catch (err) {}
      }
      const currentList = parsedAuth[matchKey] || parsedAuth[matchKeyStr] || []
      const updatedList = [...currentList, newParticipant]
      parsedAuth[matchKey] = updatedList
      parsedAuth[matchKeyStr] = updatedList
      localStorage.setItem('badminton-match-authenticators', JSON.stringify(parsedAuth))
      localStorage.setItem('badminton-authenticators', JSON.stringify(parsedAuth))

      const savedPub = localStorage.getItem('badminton-published-matches')
      if (savedPub) {
        try {
          const parsedPub = JSON.parse(savedPub)
          if (Array.isArray(parsedPub)) {
            const nextPub = parsedPub.map((m) => {
              if (String(m.id) === matchKeyStr) {
                const parts = [...(m.participants || m.authenticators || []), newParticipant]
                return { ...m, participants: parts, authenticators: parts }
              }
              return m
            })
            localStorage.setItem('badminton-published-matches', JSON.stringify(nextPub))
          }
        } catch (err) {}
      }
    } catch (err) {}

    setQuickPlayerName('')
    setQuickPlayer1Name('')
    setQuickPlayer2Name('')
    setQuickPlayerPlace('')
    setQuickPlayerCourt('')
    setShowQuickAdd(false)
    setSwapToast(`✓ Successfully added "${finalName}" to ${selectedCategory}!`)
    setTimeout(() => setSwapToast(null), 3500)
  }

  const handleOpenEditDeskPlayer = (player) => {
    if (!player) return
    const pCat = player.category || selectedCategory || 'Men Singles'
    const [s1, s2] = splitDoublesNames(player.name || '')
    setEditingDeskPlayer(player)
    setDeskEditForm({
      name: player.name || '',
      name1: s1,
      name2: s2,
      place: player.place || '',
      court: player.court || '',
      category: pCat,
    })
  }

  const handleSaveEditDeskPlayer = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!editingDeskPlayer || !selectedMatch) return

    const targetCat = deskEditForm.category || selectedCategory
    const isDoubles = isDoublesCategory(targetCat)
    let finalName = ''
    if (isDoubles) {
      const p1 = (deskEditForm.name1 || '').trim()
      const p2 = (deskEditForm.name2 || '').trim()
      if (!p1 && !p2 && !deskEditForm.name?.trim()) return
      if (p1 && p2) finalName = joinDoublesNames(p1, p2)
      else if (p1) finalName = formatPersonName(p1)
      else if (p2) finalName = formatPersonName(p2)
      else finalName = formatPersonName(deskEditForm.name)
    } else {
      if (!deskEditForm.name?.trim()) return
      finalName = formatPersonName(deskEditForm.name)
    }

    const updatedParticipant = {
      ...editingDeskPlayer,
      name: finalName,
      place: formatPlaceOrClub(deskEditForm.place),
      court: formatCourtName(deskEditForm.court, ''),
      category: formatCategoryName(targetCat),
    }

    if (onUpdateParticipant) {
      onUpdateParticipant(selectedMatch.id, updatedParticipant)
    } else {
      try {
        const savedAuth = localStorage.getItem('badminton-match-authenticators') || localStorage.getItem('badminton-authenticators')
        if (savedAuth) {
          const parsed = JSON.parse(savedAuth)
          const list = parsed[selectedMatch.id] || parsed[String(selectedMatch.id)] || []
          const nextList = list.map((p) =>
            String(p.id) === String(editingDeskPlayer.id) ? updatedParticipant : p
          )
          parsed[selectedMatch.id] = nextList
          parsed[String(selectedMatch.id)] = nextList
          localStorage.setItem('badminton-match-authenticators', JSON.stringify(parsed))
          localStorage.setItem('badminton-authenticators', JSON.stringify(parsed))
        }
      } catch (err) {}
    }

    const oldName = editingDeskPlayer.name
    const pId = editingDeskPlayer.id
    if (currentDraw && Array.isArray(currentDraw.matches)) {
      const updateP = (pObj) => {
        if (!pObj) return pObj
        if (String(pObj.id) === String(pId) || pObj.name === oldName) {
          return {
            ...pObj,
            name: finalName,
            place: updatedParticipant.place,
            court: updatedParticipant.court,
          }
        }
        return pObj
      }

      const updatedMatches = currentDraw.matches.map((m) => ({
        ...m,
        player1: updateP(m.player1),
        player2: updateP(m.player2),
        winner: updateP(m.winner),
      }))

      const updatedDrawObj = {
        ...currentDraw,
        matches: updatedMatches,
        seeds: (currentDraw.seeds || []).map(updateP),
      }
      setTournamentDraws((prev) => {
        const next = {
          ...prev,
          [drawKey]: updatedDrawObj,
        }
        broadcastAndPersistDraws(next, drawKey, updatedDrawObj)
        return next
      })
    }

    setEditingDeskPlayer(null)
    setSwapToast(`✓ Updated details for "${finalName}"!`)
    setTimeout(() => setSwapToast(null), 3000)
  }

  const handlePrintDraw = () => {
    printOfficialFixturesA4({
      currentDraw,
      tournament: selectedMatch,
      selectedCategory,
    })
  }

  // Find champion if Final completed
  let champion = null
  if (currentDraw?.matches?.length > 0) {
    const finalMatch = currentDraw.matches.find((m) => m.round === currentDraw.totalRounds)
    if (finalMatch?.winner && !finalMatch.winner.isBye) {
      champion = finalMatch.winner
    }
  }

  // Group matches by round for bracket view
  const matchesByRound = {}
  if (currentDraw?.matches) {
    currentDraw.matches.forEach((m) => {
      if (!matchesByRound[m.round]) matchesByRound[m.round] = []
      matchesByRound[m.round].push(m)
    })
  }

  // Schedule statistics & computations
  const {
    validScheduleMatches,
    totalScheduleCount,
    liveScheduleCount,
    completedScheduleCount,
    scheduledScheduleCount,
    readyScheduleCount,
    progressPercent,
  } = useMemo(() => {
    const valid = (currentDraw?.matches || []).filter((m) => !(m.player1?.isBye && m.player2?.isBye))
    const total = valid.length
    const live = valid.filter((m) => m.status === 'live' || (m.isLive === true && m.status !== 'completed')).length
    const comp = valid.filter((m) => m.status === 'completed').length
    const sched = valid.filter((m) => (m.status === 'scheduled' || !m.status) && !m.isLive).length
    const ready = valid.filter((m) => (m.status === 'scheduled' || !m.status) && !m.isLive && isMatchBothReported(m)).length
    const progress = total > 0 ? Math.round((comp / total) * 100) : 0
    return {
      validScheduleMatches: valid,
      totalScheduleCount: total,
      liveScheduleCount: live,
      completedScheduleCount: comp,
      scheduledScheduleCount: sched,
      readyScheduleCount: ready,
      progressPercent: progress,
    }
  }, [currentDraw?.matches, reportedPlayers, selectedMatch?.id, selectedCategory])

  // Filtered & Natural Match Number-Sorted schedule list (Rock Solid & Zero Flicker)
  const filteredScheduleMatches = useMemo(() => {
    return (validScheduleMatches || [])
      .filter((m) => {
        if (scheduleFilter === 'ready' && !((m.status === 'scheduled' || !m.status) && !m.isLive && isMatchBothReported(m))) return false
        if (scheduleFilter === 'live' && !(m.status === 'live' || (m.isLive === true && m.status !== 'completed'))) return false
        if (scheduleFilter !== 'all' && scheduleFilter !== 'ready' && scheduleFilter !== 'live' && m.status !== scheduleFilter) return false
        if (courtFilter !== 'all' && m.court !== courtFilter) return false
        if (scheduleRoundFilter !== 'all' && String(m.round) !== String(scheduleRoundFilter)) return false
        if (scheduleSearchQuery.trim()) {
          const q = scheduleSearchQuery.toLowerCase().trim()
          const p1Name = m.player1?.name?.toLowerCase() || ''
          const p2Name = m.player2?.name?.toLowerCase() || ''
          const p1Place = m.player1?.place?.toLowerCase() || ''
          const p2Place = m.player2?.place?.toLowerCase() || ''
          const p1Court = m.player1?.court?.toLowerCase() || ''
          const p2Court = m.player2?.court?.toLowerCase() || ''
          const rName = m.roundName?.toLowerCase() || ''
          const mNum = `m#${m.matchNumber}`.toLowerCase()
          const mNum2 = `m${m.matchNumber}`.toLowerCase()
          const mNum3 = `${m.matchNumber}`
          const courtStr = m.court?.toLowerCase() || ''
          const venueStr = m.venue?.toLowerCase() || ''
          if (
            !p1Name.includes(q) &&
            !p2Name.includes(q) &&
            !p1Place.includes(q) &&
            !p2Place.includes(q) &&
            !p1Court.includes(q) &&
            !p2Court.includes(q) &&
            !rName.includes(q) &&
            !mNum.includes(q) &&
            !mNum2.includes(q) &&
            mNum3 !== q &&
            !courtStr.includes(q) &&
            !venueStr.includes(q)
          ) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => {
        if (a.round !== b.round) return (a.round || 1) - (b.round || 1)
        return (a.matchNumber || 0) - (b.matchNumber || 0)
      })
  }, [
    validScheduleMatches,
    scheduleFilter,
    courtFilter,
    scheduleRoundFilter,
    scheduleSearchQuery,
    reportedPlayers,
    selectedMatch?.id,
    selectedCategory,
  ])

  // Unique courts list (Combines configured courts and any active match courts, ignoring 'BYE')
  const uniqueCourts = useMemo(() => {
    const matchCourts = (currentDraw?.matches || []).map((m) => m.court).filter((c) => Boolean(c) && c !== 'BYE')
    return Array.from(new Set([...configuredCourts.filter((c) => c !== 'BYE'), ...matchCourts]))
  }, [configuredCourts, currentDraw?.matches])

  // Unique rounds list for round filter
  const uniqueRoundsList = Array.from(
    new Set((currentDraw?.matches || []).map((m) => m.round))
  ).map((r) => {
    const m = (currentDraw?.matches || []).find((match) => match.round === r)
    return { round: r, roundName: m?.roundName || `Round ${r}` }
  })

  // Player reporting computations
  const reportedCount = categoryPlayers.filter((p) => isPlayerReported(p)).length
  const pendingCount = categoryPlayers.length - reportedCount
  const reportedPercent = categoryPlayers.length > 0 ? Math.round((reportedCount / categoryPlayers.length) * 100) : 0

  // Filtered & Sorted category players list (Seeds first, then alphabetical)
  const filteredCategoryPlayers = categoryPlayers
    .filter((p) => {
      const isRep = isPlayerReported(p)
      if (playerReportingFilter === 'reported' && !isRep) return false
      if (playerReportingFilter === 'pending' && isRep) return false
      if (playerSearchQuery.trim()) {
        const q = playerSearchQuery.toLowerCase()
        const nameMatch = p.name?.toLowerCase().includes(q)
        const placeMatch = p.place?.toLowerCase().includes(q)
        const courtMatch = p.court?.toLowerCase().includes(q)
        const seedMatch = `s${p.seed}`.toLowerCase().includes(q)
        if (!nameMatch && !placeMatch && !courtMatch && !seedMatch) return false
      }
      return true
    })
    .sort((a, b) => {
      // 1. Seeds first (S1, S2, S3...)
      if (a.seed && b.seed) return Number(a.seed) - Number(b.seed)
      if (a.seed) return -1
      if (b.seed) return 1
      // 2. Alphabetical sort
      return (a.name || '').localeCompare(b.name || '')
    })

  const inlineTargetSize = Math.max(2, Math.min(1024, Number(inlineTotalMembers) || 16))
  const inlineBracketSize = getNextPowerOfTwo(inlineTargetSize)
  const calculatedByesInline = Math.max(0, inlineBracketSize - inlineTargetSize)

  // Helper for seed position description
  const getSeedPositionLabel = (seedNum, total) => {
    if (seedNum === 1) return `Line 1 • Top of Draw`
    if (seedNum === 2) return `Line ${total} • Bottom of Draw`
    if (seedNum === 3) return `Line ${Math.floor(total / 2)} • Upper Half`
    if (seedNum === 4) return `Line ${Math.floor(total / 2) + 1} • Lower Half`
    if (seedNum === 5) return `Line ${Math.floor(total / 4) + 1} • QF 2`
    if (seedNum === 6) return `Line ${total - Math.floor(total / 4)} • QF 3`
    return `Quarter Seed • Slot`
  }

  // Helper for Pool Topper Labels (Like photo: A1 v B1, C1 v D1, etc.)
  const getPoolMatchLabel = (round, matchIndex, totalRounds) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']
    if (round === 1) {
      const p1Letter = letters[matchIndex * 2] || 'A'
      const p2Letter = letters[matchIndex * 2 + 1] || 'B'
      const roundTitle = totalRounds === 3 
        ? `Quarter ${matchIndex + 1}` 
        : totalRounds === 2 
        ? `Semi Finals` 
        : `Match ${matchIndex + 1}`
      
      return {
        title: roundTitle,
        subtitle: `(${p1Letter}1 v ${p2Letter}1)`,
      }
    }
    if (round === totalRounds - 1) {
      return {
        title: 'Semi Finals',
        subtitle: `(Winner Q${matchIndex * 2 + 1} v Q${matchIndex * 2 + 2})`,
      }
    }
    if (round === totalRounds) {
      return {
        title: 'Finals',
        subtitle: `(SF1 Winner v SF2 Winner)`,
      }
    }
    return {
      title: getRoundName(round, totalRounds),
      subtitle: `Match ${matchIndex + 1}`,
    }
  }

  // =========================================================================
  // VIEW 1: TOURNAMENT LIST VIEW (When fixturesLevel === 'tournaments')
  // =========================================================================
  if (fixturesLevel === 'tournaments' || !selectedMatch) {
    return (
      <div className="badminton-points-fixture-manager">
        <div className="fixtures-header-panel">
          <div className="fixtures-header-left">
            <div className="fixtures-badge">FIXTURES</div>
            <h2 className="fixtures-title">Tournament Fixtures</h2>
            <p className="fixtures-subtitle">
              Select a tournament to view and manage match draws.
            </p>
          </div>
        </div>

        {publishedMatches.length > 0 ? (
          <div className="fixtures-tournaments-list">
            {[...publishedMatches].sort((a, b) => {
              const statusA = getMatchStatus(a)
              const statusB = getMatchStatus(b)
              if (statusA === 'ongoing' && statusB !== 'ongoing') return -1
              if (statusB === 'ongoing' && statusA !== 'ongoing') return 1
              if (statusA === 'completed' && statusB === 'completed') {
                return compareTournamentsRecentCompleted(a, b)
              }
              if (statusA === 'upcoming' && statusB === 'completed') return -1
              if (statusB === 'upcoming' && statusA === 'completed') return 1
              return compareTournamentsChronological(a, b)
            }).map((match) => {
              const status = getMatchStatus(match)
              const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
              const matchCats = match.categories || DEFAULT_CATEGORIES
              const matchDrawsCount = matchCats.filter(
                (c) => !!tournamentDraws[`${match.id}-${c}`]
              ).length

              return (
                <div
                  key={match.id}
                  className="fixtures-tournament-card"
                  onClick={() => {
                    setSelectedMatchId(match.id)
                    onSelectMatch(match)
                    const firstCat = (match.categories && match.categories[0]) || 'Men Singles'
                    setSelectedCategory(firstCat)
                    setViewMode('official')
                    setFixturesLevel('draw')
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    {match.image ? (
                      <img
                        src={match.image}
                        alt={match.matchName}
                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          fontSize: '22px',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        🏸
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                        Tournament
                      </div>
                      <strong style={{ display: 'block', color: '#f8fafc', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatTournamentName(match.matchName)}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        {formatAddress(match.matchAddress)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                      Court
                    </div>
                    <div style={{ color: '#e2e8f0', fontWeight: '600', fontSize: '13px' }}>
                      {formatCourtName(match.courtName || 'Court 1')}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dates</span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: status === 'upcoming' ? 'rgba(59,130,246,0.15)' : status === 'ongoing' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                          color: status === 'upcoming' ? '#93c5fd' : status === 'ongoing' ? '#86efac' : '#cbd5e1',
                          fontSize: '10px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '10.5px', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                      {match.startDate ? new Date(`${match.startDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date'} - {match.endDate ? new Date(`${match.endDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px', fontWeight: '700' }}>
                      {matchCats.length} Categories • {matchDrawsCount} Draws Active
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
                    <button
                      type="button"
                      className="btn-primary-gradient"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedMatchId(match.id)
                        onSelectMatch(match)
                        const firstCat = (match.categories && match.categories[0]) || 'Men Singles'
                        setSelectedCategory(firstCat)
                        setViewMode('official')
                        setFixturesLevel('draw')
                      }}
                      style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', width: '100%', fontWeight: '800' }}
                    >
                      ⚡ Manage Fixtures →
                    </button>
                    {(() => {
                      const isTourTimingsActive = matchCats.some(
                        (cat) => tournamentDraws[`${match.id}-${cat}`]?.scheduleConfig?.isTimingsActive
                      )
                      return (
                        <button
                          type="button"
                          className="btn-secondary-glow"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSchedulingTournament(match)
                            setIsMasterScheduleModalOpen(true)
                          }}
                          style={{
                            padding: '9px 14px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            background: isTourTimingsActive
                              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.22) 0%, rgba(16, 185, 129, 0.15) 100%)'
                              : 'rgba(30, 41, 59, 0.7)',
                            border: isTourTimingsActive
                              ? '1.5px solid rgba(34, 197, 94, 0.5)'
                              : '1.5px solid rgba(148, 163, 184, 0.25)',
                            color: isTourTimingsActive ? '#86efac' : '#cbd5e1',
                            borderRadius: '10px',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%',
                            boxShadow: isTourTimingsActive ? '0 4px 12px rgba(34, 197, 94, 0.25)' : 'none',
                            transition: 'all 0.2s ease',
                          }}
                          title="Configure Master Time Schedule & Court Allocations"
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: isTourTimingsActive ? '#22c55e' : '#94a3b8',
                              boxShadow: isTourTimingsActive ? '0 0 8px #22c55e' : 'none',
                            }}
                          />
                          <span>{isTourTimingsActive ? '📅 Time Schedule: ON' : '📅 Time Schedule: OFF'}</span>
                        </button>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-draw-card">
            <div className="empty-icon">🏸</div>
            <h3>No Published Tournaments Found</h3>
            <p>Please create or publish a tournament in Match Management first.</p>
          </div>
        )}

        {/* Master Tournament Multi-Category Scheduling Modal */}
        <TournamentMasterScheduleModal
          isOpen={isMasterScheduleModalOpen}
          onClose={() => {
            setIsMasterScheduleModalOpen(false)
            setSchedulingTournament(null)
          }}
          tournament={schedulingTournament || selectedMatch}
          categories={
            schedulingTournament
              ? (schedulingTournament.categories || (schedulingTournament.category ? [schedulingTournament.category] : DEFAULT_CATEGORIES))
              : (selectedMatch ? (selectedMatch.categories || DEFAULT_CATEGORIES) : DEFAULT_CATEGORIES)
          }
          allCategoryDraws={getAllCategoryDrawsForTournament(schedulingTournament || selectedMatch)}
          onSaveMasterSchedule={handleSaveMasterSchedule}
        />

        {/* Fullscreen Stadium TV Live Cast Screen */}
        {isStadiumTvCastOpen && (
          <StadiumTvLiveCast
            tournament={selectedMatch || publishedMatches[0]}
            allTournaments={publishedMatches}
            onClose={() => setIsStadiumTvCastOpen(false)}
          />
        )}

        {/* Sponsor Advertisement Manager Modal */}
        <StadiumAdManagerModal
          isOpen={isAdModalOpen}
          onClose={() => setIsAdModalOpen(false)}
          ads={sponsorAds}
          onSaveAds={handleSaveAds}
          adSettings={adSettings}
          onSaveSettings={handleSaveAdSettings}
        />
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: CATEGORIES OVERVIEW VIEW (When fixturesLevel === 'categories')
  // =========================================================================
  if (fixturesLevel === 'categories') {
    return (
      <div className="badminton-points-fixture-manager">
        {/* Breadcrumb Navigation */}
        <div className="fixtures-breadcrumb-nav">
          <button
            type="button"
            className="btn-breadcrumb"
            onClick={() => {
              onSelectMatch(null)
              setFixturesLevel('tournaments')
            }}
          >
            ← All Tournaments
          </button>
        </div>

        {/* Tournament Header Panel */}
        <div className="fixtures-header-panel">
          <div className="fixtures-header-left">
            <h2 className="fixtures-title">{formatTournamentName(selectedMatch.matchName)}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {selectedMatch.courtName && (
                <span className="fixtures-badge" style={{ margin: 0, padding: '3px 10px' }}>
                  {formatCourtName(selectedMatch.courtName)}
                </span>
              )}
              <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.02em' }}>
                📅 {selectedMatch.startDate}{selectedMatch.endDate && selectedMatch.endDate !== selectedMatch.startDate ? ` to ${selectedMatch.endDate}` : ''}
              </span>
            </div>
            <p className="fixtures-subtitle" style={{ marginTop: '8px' }}>
              Select any category below to view registered players, assign seeds, and generate knockout draws.
            </p>
          </div>
        </div>

        {/* Categories Grid */}
        {isPublicView && visibleCategories.length === 0 ? (
          <div className="empty-draw-card" style={{ border: '1.5px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(15, 23, 42, 0.85)', padding: '50px 20px', textAlign: 'center', borderRadius: '16px', margin: '20px auto', maxWidth: '600px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h3 style={{ color: '#f8fafc', margin: '0 0 10px 0', fontSize: '20px', fontWeight: '800' }}>Fixtures Not Published Yet</h3>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
              The official fixture draw has not been published yet by the organizers. Please check back once the draw is released.
            </p>
          </div>
        ) : (
          <div className="fixtures-categories-grid">
            {visibleCategories.map((cat) => {
              const count = (authenticators[selectedMatch.id] || []).filter(
                (p) => (p.category || 'Men Singles') === cat
              ).length
              const isDrawActive = !!tournamentDraws[`${selectedMatch.id}-${cat}`]
              const activeDrawObj = tournamentDraws[`${selectedMatch.id}-${cat}`]

              return (
                <div
                  key={cat}
                  className={`fixtures-category-card ${isDrawActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setViewMode('official')
                    setFixturesLevel('draw')
                  }}
                >
                  <div>
                    <div className="fixtures-category-header">
                      <h3 className="fixtures-category-title">{cat}</h3>
                      {isDrawActive ? (
                        <span className="category-draw-status-badge active">
                          ✓ {activeDrawObj.drawSize} Draw Active
                        </span>
                      ) : (
                        <span className="category-draw-status-badge pending">
                          Draw Pending
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>
                      {count > 0 ? `${count} player(s) registered in this category.` : 'No players added yet (Auto-fill supported).'}
                    </p>
                  </div>

                  <div className="fixtures-category-meta">
                    <span className="category-player-count-badge">
                      👥 {count} Players
                    </span>
                    <button
                      type="button"
                      className="btn-primary-gradient"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCategory(cat)
                        setViewMode('official')
                        setFixturesLevel('draw')
                      }}
                      style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: '11.5px', cursor: 'pointer', textAlign: 'center' }}
                    >
                      ⚡ Open Draw →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Master Tournament Multi-Category Scheduling Modal */}
        <TournamentMasterScheduleModal
          isOpen={isMasterScheduleModalOpen}
          onClose={() => {
            setIsMasterScheduleModalOpen(false)
            setSchedulingTournament(null)
          }}
          tournament={schedulingTournament || selectedMatch}
          categories={
            schedulingTournament
              ? (schedulingTournament.categories || (schedulingTournament.category ? [schedulingTournament.category] : DEFAULT_CATEGORIES))
              : (selectedMatch ? (selectedMatch.categories || DEFAULT_CATEGORIES) : DEFAULT_CATEGORIES)
          }
          allCategoryDraws={getAllCategoryDrawsForTournament(schedulingTournament || selectedMatch)}
          onSaveMasterSchedule={handleSaveMasterSchedule}
        />

        {/* Fullscreen Stadium TV Live Cast Screen */}
        {isStadiumTvCastOpen && (
          <StadiumTvLiveCast
            tournament={selectedMatch || publishedMatches[0]}
            allTournaments={publishedMatches}
            onClose={() => setIsStadiumTvCastOpen(false)}
          />
        )}

        {/* Sponsor Advertisement Manager Modal */}
        <StadiumAdManagerModal
          isOpen={isAdModalOpen}
          onClose={() => setIsAdModalOpen(false)}
          ads={sponsorAds}
          onSaveAds={handleSaveAds}
          adSettings={adSettings}
          onSaveSettings={handleSaveAdSettings}
        />
      </div>
    )
  }

  // Extract slots / line entries for Round 1
  const round1Matches = matchesByRound[1] || []
  const drawSize = currentDraw?.drawSize || inlineTotalMembers || 16
  const totalRounds = currentDraw?.totalRounds || Math.log2(drawSize) || 4

  // Match Pair Spacing Parameters
  const LINE_ROW_HEIGHT = 32
  const INTRA_MATCH_GAP = 10
  const INTER_MATCH_GAP = 28
  const MATCH_BLOCK_HEIGHT = LINE_ROW_HEIGHT * 2 + INTRA_MATCH_GAP // 74px

  // Compute top Y for each match m in Round 1
  const getMatch1TopY = (mIdx) => {
    const isQuarterGap = (drawSize >= 16) ? Math.floor(mIdx / 2) * 16 : 0
    return mIdx * (MATCH_BLOCK_HEIGHT + INTER_MATCH_GAP) + isQuarterGap
  }

  // Exact Y baselines for Slot 1 and Slot 2 in match mIdx
  const getPlayer1BaselineY = (mIdx) => getMatch1TopY(mIdx) + LINE_ROW_HEIGHT - 2
  const getPlayer2BaselineY = (mIdx) => getMatch1TopY(mIdx) + LINE_ROW_HEIGHT + INTRA_MATCH_GAP + LINE_ROW_HEIGHT - 2

  // Total area height based on last match bottom Y
  const totalAreaHeight = round1Matches.length > 0 
    ? getPlayer2BaselineY(round1Matches.length - 1) + 30 
    : drawSize * 38

  // Compute centers Y for each round's matches for SVG branch connections
  const matchCenters = {}
  matchCenters[1] = []
  for (let m = 0; m < round1Matches.length; m++) {
    const yTop = getPlayer1BaselineY(m)
    const yBot = getPlayer2BaselineY(m)
    matchCenters[1].push((yTop + yBot) / 2)
  }

  // Subsequent rounds centers
  for (let r = 2; r <= totalRounds; r++) {
    matchCenters[r] = []
    const prevCenters = matchCenters[r - 1]
    const countInRound = prevCenters.length / 2
    for (let m = 0; m < countInRound; m++) {
      const yTop = prevCenters[m * 2]
      const yBot = prevCenters[m * 2 + 1]
      matchCenters[r].push((yTop + yBot) / 2)
    }
  }

  // =========================================================================
  // RENDER: CLEAN MULTI-LEVEL FIXTURES VIEW
  // =========================================================================
  return (
    <div className={`badminton-points-fixture-manager ${sheetTheme === 'dark' ? 'official-sheet-dark-mode' : ''}`} ref={dropdownRef}>
      {/* Swap Confirmation Toast */}
      {swapToast && (
        <div className="swap-toast-banner">
          <span>{swapToast}</span>
        </div>
      )}



      {/* ========================================================= */}
      {/* LEVEL 3: FOCUSED DRAW SHEET FOR SELECTED CATEGORY        */}
      {/* ========================================================= */}
      {/* Top Bar for Public View vs Admin View */}
      {isPublicView ? (
        <>
          <div className="public-fixtures-topbar">
            {onBackToPublicFeed && (
              <button
                type="button"
                onClick={onBackToPublicFeed}
                className="public-fixtures-back-btn"
              >
                <span style={{ fontSize: '14px' }}>←</span>
                <span>Back to Tournaments</span>
              </button>
            )}

            {/* Theme Toggle Button on Right: Light Mode / Dark Mode */}
            <div className="public-fixtures-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSheetTheme(sheetTheme === 'white' ? 'dark' : 'white')}
                className="public-sheet-theme-btn"
              >
                {sheetTheme === 'white' ? '🌙 Dark Mode' : '☀️ Light Mode'}
              </button>
            </div>
          </div>

          {/* Dedicated Category Selector Bar below Topbar */}
          <div
            className="public-fixtures-category-bar"
            style={{
              marginBottom: '16px',
              padding: '12px 18px',
              background: 'linear-gradient(135deg, rgba(13, 22, 39, 0.95) 0%, rgba(20, 32, 54, 0.92) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '15px' }}>🏸</span>
              <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800' }}>
                Category:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
              {publishedCategoryList.length > 0 ? (
                publishedCategoryList.map((cat) => {
                  const isCompact = publishedCategoryList.length > 4
                  const isVeryCompact = publishedCategoryList.length > 7
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`public-fixtures-cat-pill ${selectedCategory === cat ? 'active' : ''} ${isVeryCompact ? 'pill-xs' : isCompact ? 'pill-sm' : ''}`}
                    >
                      <span className="cat-pill-dot" />
                      <span>{cat}</span>
                    </button>
                  )
                })
              ) : (
                <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: '700' }}>
                  📢 No categories published yet.
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
            <>
              {/* Breadcrumb & Navigation Bar */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectMatch(null)
                    setFixturesLevel('tournaments')
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(148, 163, 184, 0.12)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ← All Tournaments
                </button>
              </div>

              {/* Draw Top Header Bar */}
              <div className="fixtures-header-panel" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
                <div className="fixtures-header-left">
                  <div className="fixtures-badge">
                    {formatTournamentName(selectedMatch?.matchName)}
                  </div>
                  <h2 className="fixtures-title">{formatCategoryName(selectedCategory)} Draw</h2>
                  <p className="fixtures-subtitle">
                    Official knockout draw sheet, seeding, and schedule.
                  </p>
                </div>

                <div className="fixtures-header-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: '14px' }}>
                  {/* Top Row: 3 Primary Draw Actions with Equal Width */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => setIsSeedingModalOpen(true)}
                      className="btn-secondary-glow"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        cursor: 'pointer',
                        background: 'rgba(59, 130, 246, 0.18)',
                        border: '1.5px solid #38bdf8',
                        color: '#38bdf8',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span>✏️ Modify Draw & Seeds</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyPub = !!publishedStatusMap[drawKey]
                        const nextMap = { ...publishedStatusMap, [drawKey]: !isCurrentlyPub }
                        setPublishedStatusMap(nextMap)
                        localStorage.setItem('badminton-published-status', JSON.stringify(nextMap))
                        fetch('/api/tournaments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ publishedStatus: nextMap }),
                        }).catch(() => {})
                        window.dispatchEvent(new Event('storage'))
                      }}
                      className="btn-primary-gradient"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        background: publishedStatusMap[drawKey] ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : undefined,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span>{publishedStatusMap[drawKey] ? '✓ Published Live' : '📢 Publish Fixtures'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintDraw}
                      disabled={!currentDraw}
                      className="btn-secondary-glow"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#f8fafc',
                        opacity: currentDraw ? 1 : 0.45,
                        cursor: currentDraw ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span>🖨️ Print Fixtures</span>
                    </button>
                  </div>

                  {/* Bottom Row: Live Cast, Ads & Dark Mode with Equal Width */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', width: '100%' }}>
                    <button
                      type="button"
                      onClick={() => handleLaunchLiveTv(selectedMatch?.id)}
                      className="btn-secondary-glow"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(3, 105, 161, 0.35) 100%)',
                        border: '1.5px solid #38bdf8',
                        color: '#38bdf8',
                        boxShadow: '0 2px 10px rgba(56, 189, 248, 0.25)',
                        boxSizing: 'border-box',
                      }}
                      title="Launch standalone Stadium TV Live Cast in a separate window for your TV / Projector / OBS"
                    >
                      <span>📺 TV Broadcast (Pop-out)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAdModalOpen(true)}
                      className="btn-primary-gradient"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.4)',
                        border: 'none',
                        boxSizing: 'border-box',
                      }}
                      title="Manage Live Cast Advertisements & Tournament Sponsors"
                    >
                      <span>📢 Ads & Sponsors ({activeAdsCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSheetTheme(sheetTheme === 'white' ? 'dark' : 'white')}
                      className="btn-secondary-glow"
                      style={{
                        minHeight: '44px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        width: '100%',
                        cursor: 'pointer',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#f8fafc',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span>{sheetTheme === 'white' ? '🌙 Dark Mode' : '☀️ Light Mode'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 1. Dedicated Category Selector Bar (Admin/Management View only, Public View has Topbar Selector) */}
          {!isPublicView && (
            <div
              className="fixtures-category-selector-bar"
              style={{
                marginBottom: '12px',
                padding: '12px 18px',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>🏸</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800' }}>
                  Select Category:
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                {visibleCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '999px',
                      border: selectedCategory === cat ? '1.5px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.25)',
                      background: selectedCategory === cat ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'rgba(15, 23, 42, 0.65)',
                      color: selectedCategory === cat ? '#ffffff' : '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      transition: 'all 0.2s ease',
                      boxShadow: selectedCategory === cat ? '0 0 16px rgba(56, 189, 248, 0.45)' : 'none',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. View Mode Tabs Bar (Official Draw, Diagram, Schedule, Players) */}
          <div className="fixtures-selectors-card" style={{ marginBottom: '18px' }}>
            <div className="view-mode-tabs" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className={`tab-btn ${viewMode === 'official' ? 'active' : ''}`}
                onClick={() => setViewMode('official')}
              >
                📄 Official Draw Sheet (with Byes)
              </button>
              <button
                type="button"
                className={`tab-btn ${viewMode === 'diagram' ? 'active' : ''}`}
                onClick={() => setViewMode('diagram')}
              >
                🎯 Card Tree Diagram
              </button>
              <button
                type="button"
                className={`tab-btn ${viewMode === 'schedule' ? 'active' : ''}`}
                onClick={() => setViewMode('schedule')}
              >
                📋 Match Schedule
              </button>
              <button
                type="button"
                className={`tab-btn ${viewMode === 'players' ? 'active' : ''}`}
                onClick={() => setViewMode('players')}
              >
                👥 Players ({categoryPlayers.length})
              </button>
            </div>
          </div>


      {/* Champion Banner if Final Completed */}
      {champion && (
        <div className="champion-banner-card">
          <div className="trophy-icon">🏆</div>
          <div className="champion-info">
            <div className="champion-label">{selectedCategory} CHAMPION</div>
            <div className="champion-name">{champion.name}</div>
            <div className="champion-meta">{champion.place || champion.court || selectedMatch?.matchName}</div>
          </div>
          <div className="champion-badge">WINNER</div>
        </div>
      )}

      {/* Content Area according to viewMode */}
      {isPublicView && !publishedStatusMap[drawKey] && !tournamentDraws[drawKey] ? (
        <div className="empty-draw-card" style={{ border: '1.5px dashed rgba(239, 68, 68, 0.4)', background: 'rgba(15, 23, 42, 0.85)', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔒</div>
          <h3 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>Fixtures Not Published Yet</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>
            The official draw for {selectedCategory} has not been published yet. Only published fixtures are available to spectators.
          </p>
        </div>
      ) : !currentDraw ? (
        <div className="empty-draw-card">
          <div className="empty-icon">🏸</div>
          <h3>No Draw Created Yet for {selectedCategory}</h3>
          <p>
            {categoryPlayers.length > 0 ? (
              <>You have <strong>{categoryPlayers.length}</strong> player(s) registered. Click below to configure Seeding, Total Members, and Prioritized Byes.</>
            ) : (
              <>No players registered in Match Management yet. You can still auto-generate a tournament bracket by specifying Total Members and Seeds above!</>
            )}
          </p>
          <div className="empty-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" onClick={handleGenerateDrawFromInline} className="btn-primary-gradient">
              ⚡ Auto-Generate Fixtures & Configure Seeding
            </button>
            <button type="button" onClick={() => setShowQuickAdd(true)} className="btn-secondary-glow">
              + Quick Add Players
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* =========================================================
              1. OFFICIAL TOURNAMENT LINE DRAW SHEET (EXACT PHOTO STYLE)
             ========================================================= */}
          {viewMode === 'official' && (() => {
            const drawSize = currentDraw.drawSize || 16
            const totalRounds = currentDraw.totalRounds || Math.round(Math.log2(drawSize)) || 4
            const round1Matches = matchesByRound[1] || []
            const r1Count = round1Matches.length || Math.pow(2, totalRounds - 1)

            // Pixel-Perfect Official Tournament Sheet Spacing:
            const ROW_HEIGHT = 28 // Height of .official-sheet-line-row
            const INTRA_GAP = 12 // Space between Line 1 and Line 2 inside a match pair
            const BLOCK_GAP = 28 // Space between match pair blocks
            const BLOCK_HEIGHT = ROW_HEIGHT * 2 + INTRA_GAP // 28 + 12 + 28 = 68px
            const STEP_HEIGHT = BLOCK_HEIGHT + BLOCK_GAP // 68 + 28 = 96px

            const totalAreaHeight = Math.max(480, r1Count * STEP_HEIGHT + 60)

            // Exact bottom-border baseline of each player row
            const getPlayer1BaselineY = (mIdx) => mIdx * STEP_HEIGHT + ROW_HEIGHT
            const getPlayer2BaselineY = (mIdx) => mIdx * STEP_HEIGHT + ROW_HEIGHT + INTRA_GAP + ROW_HEIGHT
            const getMatchCenterY = (mIdx) => (getPlayer1BaselineY(mIdx) + getPlayer2BaselineY(mIdx)) / 2

            // Calculate match centers across all rounds for exact bracket lines
            const matchCenters = {}
            matchCenters[1] = round1Matches.map((_, mIdx) => getMatchCenterY(mIdx))
            for (let r = 2; r <= totalRounds; r++) {
              const count = Math.pow(2, totalRounds - r)
              matchCenters[r] = []
              for (let i = 0; i < count; i++) {
                const prevCenters = matchCenters[r - 1] || []
                const prev1 = prevCenters[i * 2] ?? 0
                const prev2 = prevCenters[i * 2 + 1] ?? (prev1 + 60)
                matchCenters[r].push((prev1 + prev2) / 2)
              }
            }

            const colWidth = 155
            const svgWidth = totalRounds * colWidth + 80

            // Calculate continuous path from selected player / match forward to the Finals
            const highlightedSegments = (() => {
              if (!highlightedPath) return []
              const segments = []
              const startR = highlightedPath.startRound || 1
              let currMIdx = highlightedPath.mIdx ?? highlightedPath.r1MIdx ?? 0
              let currSlot = highlightedPath.slot || 'player1'

              for (let r = startR; r <= totalRounds; r++) {
                const xStart = (r - 1) * colWidth
                const xBracket = xStart + 42
                const xEnd = xStart + colWidth

                let yTop, yBot, yMid
                if (r === 1) {
                  yTop = getPlayer1BaselineY(currMIdx)
                  yBot = getPlayer2BaselineY(currMIdx)
                  yMid = (yTop + yBot) / 2
                } else {
                  const prevCenters = matchCenters[r - 1] || []
                  yTop = prevCenters[currMIdx * 2] ?? 0
                  yBot = prevCenters[currMIdx * 2 + 1] ?? (yTop + 40)
                  yMid = (yTop + yBot) / 2
                }

                if (r === startR && currSlot === 'match') {
                  const d = `M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
                  segments.push({ round: r, mIdx: currMIdx, d })
                } else {
                  const yIn = currSlot === 'player1' ? yTop : yBot
                  const d = `M ${xStart} ${yIn} L ${xBracket} ${yIn} L ${xBracket} ${yMid} L ${xEnd} ${yMid}`
                  segments.push({ round: r, mIdx: currMIdx, d })
                }

                currSlot = currMIdx % 2 === 0 ? 'player1' : 'player2'
                currMIdx = Math.floor(currMIdx / 2)
              }
              return segments
            })()

            return (
              <>
                {isPublicView && (
                  <div className="mobile-scroll-hint">
                    <span>👉</span>
                    <span>Swipe sideways to view bracket rounds & finals 🏆 • Click any player to trace their path to the Finals!</span>
                  </div>
                )}

                {/* Active Highlighted Finals Path Indicator Banner */}
                {highlightedPath && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 16px',
                    marginBottom: '12px',
                    background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.22) 0%, rgba(3, 105, 161, 0.32) 100%)',
                    border: '1.5px solid #38bdf8',
                    borderRadius: '10px',
                    color: '#38bdf8',
                    fontSize: '13px',
                    fontWeight: '700',
                    boxShadow: '0 4px 14px rgba(56, 189, 248, 0.25)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>⚡</span>
                      <span>
                        Finals Road Highlighted: <strong style={{ color: '#ffffff', textDecoration: 'underline' }}>{highlightedPath.playerName}</strong> (Blue Line Path)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHighlightedPath(null)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        padding: '4px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      ✕ Clear Path
                    </button>
                  </div>
                )}

                <div className="official-draw-sheet-scroll-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '16px', boxSizing: 'border-box' }}>
                <div className={`official-draw-sheet-wrapper ${sheetTheme === 'dark' ? 'dark-theme' : ''}`}>
                {/* Framed Top Box Header from Photo */}
                <div className="official-sheet-header-box">
                  <h3 className="official-sheet-title">
                    {formatTournamentName(selectedMatch?.matchName)} to be held at {formatAddress(selectedMatch?.matchAddress) || formatCourtName(selectedMatch?.courtName)} on {selectedMatch?.startDate || ''} and {selectedMatch?.endDate || ''}
                  </h3>
                  <div className="official-sheet-subtitle">
                    Category: <strong>{formatCategoryName(selectedCategory)}</strong> • Knockout Draw ({drawSize} Draw Bracket • {currentDraw?.totalByes || 0} Byes)
                  </div>
                </div>

                {/* Tree Area with Numbered Lines and SVG Branch Lines */}
                <div className="official-sheet-tree-area" style={{ height: `${totalAreaHeight}px` }}>
                  {/* Column 1: Numbered Player Lines grouped into Match Pairs */}
                  <div className="official-sheet-names-column">
                    {round1Matches.map((m, mIdx) => {
                      const lineNum1 = mIdx * 2 + 1
                      const lineNum2 = mIdx * 2 + 2
                      const p1 = m.player1
                      const p2 = m.player2
                      const isP1Highlighted = highlightedPath?.r1MIdx === mIdx && highlightedPath?.slot === 'player1'
                      const isP2Highlighted = highlightedPath?.r1MIdx === mIdx && highlightedPath?.slot === 'player2'

                      return (
                        <div
                          key={mIdx}
                          className="official-match-pair-block"
                          style={{
                            marginBottom: `${BLOCK_GAP}px`,
                          }}
                        >
                          {/* Line 1 (Player 1) */}
                          <div
                            className={`official-sheet-line-row ${!isPublicView ? 'draggable-player-slot' : ''} ${dragOverSlotKey === `${m.id}-player1` ? 'drag-over-slot' : ''} ${isP1Highlighted ? 'highlighted-path-slot' : ''}`}
                            style={{ height: `${ROW_HEIGHT}px`, cursor: 'pointer' }}
                            draggable={!isPublicView && Boolean(p1)}
                            onDragStart={(e) => {
                              if (isPublicView || !p1) return
                              e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: m.id, slotKey: 'player1', lineNum: lineNum1 }))
                              setDraggedSlot({ matchId: m.id, slotKey: 'player1', lineNum: lineNum1, player: p1 })
                            }}
                            onDragOver={(e) => {
                              if (isPublicView) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              setDragOverSlotKey(`${m.id}-player1`)
                            }}
                            onDragLeave={() => setDragOverSlotKey(null)}
                            onDrop={(e) => {
                              if (isPublicView) return
                              e.preventDefault()
                              setDragOverSlotKey(null)
                              try {
                                const source = JSON.parse(e.dataTransfer.getData('text/plain'))
                                handleSwapPlayers(source, { matchId: m.id, slotKey: 'player1', lineNum: lineNum1 })
                              } catch (err) {
                                console.error('Drop error', err)
                              }
                              setDraggedSlot(null)
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (p1 && !p1.isBye) {
                                setHighlightedPath((prev) =>
                                  prev?.r1MIdx === mIdx && prev?.slot === 'player1'
                                    ? null
                                    : { startRound: 1, r1MIdx: mIdx, mIdx, slot: 'player1', playerName: p1.name }
                                )
                              }
                              if (isPublicView) return
                              setExchangeModalSource({
                                matchId: m.id,
                                slotKey: 'player1',
                                lineNum: lineNum1,
                                player: p1,
                                match: m,
                              })
                              setExchangeSearchQuery('')
                            }}
                            title={p1 ? `Click to trace ${p1.name || 'Player'}'s path to Finals 🏆` : "Player Slot"}
                          >
                            <span className="official-line-num">{lineNum1}</span>
                            <div className="official-player-label-container">
                              {p1 ? (
                                p1.isBye ? (
                                  <span className="official-bye-label">
                                    {!isPublicView && <span className="drag-handle-icon" title="Drag to exchange BYE slot">⠿</span>}
                                    BYE
                                  </span>
                                ) : (
                                  <span className="official-player-name-text">
                                    {!isPublicView && <span className="drag-handle-icon" title="Drag to exchange player position">⠿</span>}
                                    {Boolean(p1.seed || p1.isSeed) && (
                                      <span className="official-seed-pill" title={`Seed ${p1.seed || ''}`}>
                                        S{p1.seed || ''}
                                      </span>
                                    )}
                                    <span className="official-player-name-main">{p1.name}</span>
                                    {Boolean(p1.place || p1.court) && (
                                      <span className="official-player-meta-small">
                                        ({[p1.place, p1.court].filter(Boolean).join(' • ')})
                                      </span>
                                    )}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>TBD</span>
                              )}
                            </div>
                          </div>

                          {/* Intra-match gap between Player 1 & Player 2 */}
                          <div style={{ height: `${INTRA_GAP}px` }} />

                          {/* Line 2 (Player 2) */}
                          <div
                            className={`official-sheet-line-row ${!isPublicView ? 'draggable-player-slot' : ''} ${dragOverSlotKey === `${m.id}-player2` ? 'drag-over-slot' : ''} ${isP2Highlighted ? 'highlighted-path-slot' : ''}`}
                            style={{ height: `${ROW_HEIGHT}px`, cursor: 'pointer' }}
                            draggable={!isPublicView && Boolean(p2)}
                            onDragStart={(e) => {
                              if (isPublicView || !p2) return
                              e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: m.id, slotKey: 'player2', lineNum: lineNum2 }))
                              setDraggedSlot({ matchId: m.id, slotKey: 'player2', lineNum: lineNum2, player: p2 })
                            }}
                            onDragOver={(e) => {
                              if (isPublicView) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              setDragOverSlotKey(`${m.id}-player2`)
                            }}
                            onDragLeave={() => setDragOverSlotKey(null)}
                            onDrop={(e) => {
                              if (isPublicView) return
                              e.preventDefault()
                              setDragOverSlotKey(null)
                              try {
                                const source = JSON.parse(e.dataTransfer.getData('text/plain'))
                                handleSwapPlayers(source, { matchId: m.id, slotKey: 'player2', lineNum: lineNum2 })
                              } catch (err) {
                                console.error('Drop error', err)
                              }
                              setDraggedSlot(null)
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (p2 && !p2.isBye) {
                                setHighlightedPath((prev) =>
                                  prev?.r1MIdx === mIdx && prev?.slot === 'player2'
                                    ? null
                                    : { startRound: 1, r1MIdx: mIdx, mIdx, slot: 'player2', playerName: p2.name }
                                )
                              }
                              if (isPublicView) return
                              setExchangeModalSource({
                                matchId: m.id,
                                slotKey: 'player2',
                                lineNum: lineNum2,
                                player: p2,
                                match: m,
                              })
                              setExchangeSearchQuery('')
                            }}
                            title={p2 ? `Click to trace ${p2.name || 'Player'}'s path to Finals 🏆` : "Player Slot"}
                          >
                            <span className="official-line-num">{lineNum2}</span>
                            <div className="official-player-label-container">
                              {p2 ? (
                                p2.isBye ? (
                                  <span className="official-bye-label">
                                    {!isPublicView && <span className="drag-handle-icon" title="Drag to exchange BYE slot">⠿</span>}
                                    BYE
                                  </span>
                                ) : (
                                  <span className="official-player-name-text">
                                    {!isPublicView && <span className="drag-handle-icon" title="Drag to exchange player position">⠿</span>}
                                    {Boolean(p2.seed || p2.isSeed) && (
                                      <span className="official-seed-pill" title={`Seed ${p2.seed || ''}`}>
                                        S{p2.seed || ''}
                                      </span>
                                    )}
                                    <span className="official-player-name-main">{p2.name}</span>
                                    {Boolean(p2.place || p2.court) && (
                                      <span className="official-player-meta-small">
                                        ({[p2.place, p2.court].filter(Boolean).join(' • ')})
                                      </span>
                                    )}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>TBD</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* SVG Canvas for Branching Lines, Round Titles & Winners */}
                  <svg
                    className="official-svg-canvas"
                    style={{ width: `${svgWidth}px`, height: `${totalAreaHeight}px` }}
                  >
                    {/* 1. Base Bracket Lines */}
                    {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => {
                      const matches = matchesByRound[round] || []
                      const xStart = (round - 1) * colWidth
                      const xBracket = xStart + 42
                      const xEnd = xStart + colWidth

                      return (
                        <g key={round}>
                          {matches.map((m, mIdx) => {
                            const p1 = m.player1
                            const p2 = m.player2
                            let yTop, yBot, yMid

                            if (round === 1) {
                              yTop = getPlayer1BaselineY(mIdx)
                              yBot = getPlayer2BaselineY(mIdx)
                              yMid = (yTop + yBot) / 2
                            } else {
                              const prevCenters = matchCenters[round - 1] || []
                              yTop = prevCenters[mIdx * 2] ?? 0
                              yBot = prevCenters[mIdx * 2 + 1] ?? (yTop + 40)
                              yMid = (yTop + yBot) / 2
                            }

                            const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`

                            // Round titles without time
                            const roundTitle = getRoundName(round, totalRounds)
                            const isFinal = round === totalRounds
                            const isSemi = round === totalRounds - 1
                            const isQuarter = round === totalRounds - 2

                            const matchNum = mIdx + 1
                            const displayRoundTag = isFinal
                              ? 'FINAL'
                              : isSemi
                              ? `SEMI FINAL - ${matchNum}`
                              : isQuarter
                              ? `QR. FINAL - ${matchNum}`
                              : round === 1 && totalRounds >= 4
                              ? ''
                              : `${roundTitle} - ${matchNum}`

                            return (
                              <g
                                key={m.id}
                                className="official-match-branch-group"
                                onClick={() => setViewingMatchDetails(m)}
                                style={{ cursor: 'pointer' }}
                              >
                                {/* Branch Connecting Bracket Line */}
                                <path d={pathData} className="official-draw-branch-path" />

                                {/* Interactive Hover Border Box on Branch Node */}
                                <rect
                                  x={xBracket + 2}
                                  y={yMid - 16}
                                  width={colWidth - 10}
                                  height={34}
                                  rx={6}
                                  ry={6}
                                  className="official-branch-hover-box"
                                />

                                {/* Text Above the Line (Round Title) */}
                                {displayRoundTag && (
                                  <text
                                    x={xBracket + 8}
                                    y={yMid - 4}
                                    className="official-match-text-round"
                                  >
                                    {displayRoundTag}
                                  </text>
                                )}

                                {/* Winner Name Below the Line (Clean Player Name Only) */}
                                {m.winner && !m.winner.isBye && (() => {
                                  const winPlayer = typeof m.winner === 'object'
                                    ? m.winner
                                    : (m.winner === 'player1' ? p1 : m.winner === 'player2' ? p2 : null)
                                  const winName = winPlayer?.name || (typeof m.winner === 'string' && m.winner !== 'player1' && m.winner !== 'player2' ? m.winner : '')
                                  if (!winName || winName === 'BYE') return null
                                  return (
                                    <text
                                      x={xBracket + 6}
                                      y={yMid + 11}
                                      className="official-match-winner-text"
                                    >
                                      {winName}
                                    </text>
                                  )
                                })()}

                                {/* Clean Bold Scheduled Time Below the Line (No Box / Border) */}
                                {(m.time || m.scheduledTime) && !m.winner && (
                                  <text
                                    x={xBracket + 6}
                                    y={yMid + 11}
                                    className="official-match-time-text"
                                  >
                                    {m.time || m.scheduledTime} {m.court && m.court !== 'BYE' ? `• ${m.court}` : ''}
                                  </text>
                                )}

                                {(m.time || m.scheduledTime) && m.winner && !m.winner.isBye && (
                                  <text
                                    x={xBracket + 6}
                                    y={yMid + 21}
                                    className="official-match-time-text"
                                    style={{ fontSize: '8.5px', opacity: 0.85 }}
                                  >
                                    {m.time || m.scheduledTime} {m.court && m.court !== 'BYE' ? `• ${m.court}` : ''}
                                  </text>
                                )}
                              </g>
                            )
                          })}
                        </g>
                      )
                    })}

                    {/* 2. Highlighted Blue Path Layer from Clicked Player to Finals */}
                    {highlightedSegments.length > 0 && (
                      <g className="official-highlighted-path-layer">
                        {highlightedSegments.map((seg, sIdx) => (
                          <path
                            key={`hl-path-${seg.round}-${seg.mIdx}-${sIdx}`}
                            d={seg.d}
                            className="official-draw-branch-path-blue"
                          />
                        ))}
                      </g>
                    )}
                  </svg>
                </div>

                {/* Sheet Footer */}
                <div className="official-sheet-footer">
                  <p className="official-sheet-note">
                    Note: It may Please be noted that the matches will be held on {selectedMatch?.startDate || ''} and {selectedMatch?.endDate || ''}.
                  </p>
                </div>
                </div>
                </div>
              </>
            )
          })()}

          {/* Match Breakdown & Sets/Points Detail Modal (READ-ONLY Official Match Scorecard) */}
          {viewingMatchDetails && (() => {
            const m = currentDraw?.matches?.find((x) => x.id === viewingMatchDetails.id) || viewingMatchDetails
            const p1 = m.player1
            const p2 = m.player2
            const setsArray = Array.from({ length: matchTotalSets }, (_, idx) => idx + 1)

            let p1SetsTotal = 0
            let p2SetsTotal = 0

            const setWinFlags = setsArray.map((setNum) => {
              const keyA = `scoreSet${setNum}A`
              const keyB = `scoreSet${setNum}B`
              const hasA = m[keyA] !== '' && m[keyA] !== undefined && m[keyA] !== null
              const hasB = m[keyB] !== '' && m[keyB] !== undefined && m[keyB] !== null
              const valA = Number(m[keyA]) || 0
              const valB = Number(m[keyB]) || 0

              const p1WonSet = hasA && hasB && valA > valB
              const p2WonSet = hasA && hasB && valB > valA
              if (p1WonSet) p1SetsTotal++
              if (p2WonSet) p2SetsTotal++
              return { p1WonSet, p2WonSet, hasA, hasB, valA, valB }
            })

            const hasRecordedScores = setsArray.some((setNum) => {
              const keyA = `scoreSet${setNum}A`
              const keyB = `scoreSet${setNum}B`
              return (m[keyA] !== '' && m[keyA] !== undefined && m[keyA] !== null) ||
                     (m[keyB] !== '' && m[keyB] !== undefined && m[keyB] !== null)
            })

            const isByeWalkover = Boolean(m.winner?.hasByeWalkover || (p1?.isBye && !p2?.isBye) || (p2?.isBye && !p1?.isBye))
            const isScoreUpdated = hasRecordedScores || (m.winner && !isByeWalkover)

            const isP1Winner = m.winner && p1 && String(m.winner.id) === String(p1.id)
            const isP2Winner = m.winner && p2 && String(m.winner.id) === String(p2.id)

            return (
              <div className="match-details-modal-overlay" onClick={() => setViewingMatchDetails(null)}>
                <div className="match-details-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="match-details-modal-header">
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#38bdf8' }}>
                        Match #{m.matchNumber} • {m.roundName}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.15)', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          🏟️ {m.court || selectedMatch?.courtName || 'Court 1'}
                        </span>
                        {m.time && (
                          <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(2, 132, 199, 0.2)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                            ⏱ {m.time}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Category: <strong>{selectedCategory}</strong>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewingMatchDetails(null)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '16px',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="match-details-modal-body">
                    {/* VS Head to Head Summary */}
                    <div className="match-details-vs-banner">
                      <div className="match-details-player-box">
                        <div className={`match-details-player-name ${isP1Winner ? 'is-winner' : ''}`}>
                          {p1 ? (p1.isBye ? 'BYE' : p1.name) : 'TBD'}
                        </div>
                        {p1?.seed && <span className="player-seed-badge-gold" style={{ marginTop: '4px', display: 'inline-block' }}>S{p1.seed}</span>}
                        {p1?.place && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p1.place}</div>}
                        <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: '900', color: isP1Winner ? '#4ade80' : isScoreUpdated ? '#38bdf8' : '#64748b' }}>
                          {isScoreUpdated ? `${p1SetsTotal} Sets` : '-'}
                        </div>
                      </div>

                      <div className="match-details-vs-badge">VS</div>

                      <div className="match-details-player-box">
                        <div className={`match-details-player-name ${isP2Winner ? 'is-winner' : ''}`}>
                          {p2 ? (p2.isBye ? 'BYE' : p2.name) : 'TBD'}
                        </div>
                        {p2?.seed && <span className="player-seed-badge-gold" style={{ marginTop: '4px', display: 'inline-block' }}>S{p2.seed}</span>}
                        {p2?.place && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p2.place}</div>}
                        <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: '900', color: isP2Winner ? '#4ade80' : isScoreUpdated ? '#38bdf8' : '#64748b' }}>
                          {isScoreUpdated ? `${p2SetsTotal} Sets` : '-'}
                        </div>
                      </div>
                    </div>

                    {/* Live Match Active Umpire Scorecard */}
                    {m.status === 'live' && (
                      <div style={{
                        padding: '16px',
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.12) 100%)',
                        border: '2px solid rgba(239, 68, 68, 0.55)',
                        borderRadius: '14px',
                        margin: '14px 0',
                        boxShadow: '0 0 24px rgba(239, 68, 68, 0.25)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: '900', fontSize: '13px' }}>
                            <span className="live-pulse-dot" style={{ background: '#ef4444' }} />
                            🔴 LIVE COURT SCORE
                          </span>
                          <span style={{ fontSize: '12px', color: '#fca5a5', fontWeight: '700' }}>
                            {m.liveScore?.currentSet ? `Set ${m.liveScore.currentSet} in progress` : 'Ongoing'}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                              {p1?.name || 'Player 1'}
                              {m.liveScore?.servingPlayer === 'p1' && <span style={{ marginLeft: '4px', color: '#fde047' }}>🏸 (Server)</span>}
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#38bdf8' }}>
                              {m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p1 ?? (m[`scoreSet${m.liveScore.currentSet || 1}A`] || 0)) : (m.scoreSet1A || 0)}
                            </div>
                          </div>

                          <div style={{ fontSize: '20px', fontWeight: '900', color: '#cbd5e1' }}>:</div>

                          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                              {p2?.name || 'Player 2'}
                              {m.liveScore?.servingPlayer === 'p2' && <span style={{ marginLeft: '4px', color: '#fde047' }}>🏸 (Server)</span>}
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#38bdf8' }}>
                              {m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p2 ?? (m[`scoreSet${m.liveScore.currentSet || 1}B`] || 0)) : (m.scoreSet1B || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scenario 1: Bye Walkover */}
                    {isByeWalkover && (
                      <div style={{
                        padding: '12px 16px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1.5px solid rgba(56, 189, 248, 0.35)',
                        borderRadius: '12px',
                        color: '#38bdf8',
                        fontWeight: '800',
                        fontSize: '13px',
                        textAlign: 'center',
                        margin: '12px 0 16px 0',
                      }}>
                        🛡️ Walkover: {m.winner?.name || 'Player'} advanced to next round via BYE
                      </div>
                    )}

                    {/* Scenario 2: Score Not Updated Yet */}
                    {!isScoreUpdated && !isByeWalkover && (
                      <div
                        style={{
                          padding: '24px 20px',
                          background: 'rgba(234, 179, 8, 0.08)',
                          border: '1.5px dashed rgba(234, 179, 8, 0.45)',
                          borderRadius: '14px',
                          textAlign: 'center',
                          margin: '16px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '32px' }}>⏳</span>
                        <div style={{ color: '#fde047', fontWeight: '800', fontSize: '16px' }}>
                          Score Not Updated
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '12.5px', maxWidth: '340px', lineHeight: '1.5' }}>
                          Match is scheduled. Scores have not been updated yet.
                        </div>
                      </div>
                    )}

                    {/* Scenario 3: Score Updated -> Show Read-Only Scoreboard */}
                    {isScoreUpdated && !isByeWalkover && (
                      <>
                        {m.winner && (
                          <div style={{
                            padding: '12px 16px',
                            background: 'rgba(34, 197, 94, 0.15)',
                            border: '1.5px solid #22c55e',
                            borderRadius: '12px',
                            color: '#4ade80',
                            fontWeight: '800',
                            fontSize: '13.5px',
                            textAlign: 'center',
                            marginBottom: '16px',
                          }}>
                            🏆 Match Winner: {m.winner.name} ({p1SetsTotal} - {p2SetsTotal} Sets)
                          </div>
                        )}

                        {/* Detailed Sets & Points Breakdown Table (READ-ONLY) */}
                        <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px' }}>
                          📊 Match Scorecard (Official Sets & Points):
                        </h4>

                        <table className="match-details-sets-table">
                          <thead>
                            <tr>
                              <th>SET</th>
                              <th>{p1?.name || 'P1'} POINTS</th>
                              <th>{p2?.name || 'P2'} POINTS</th>
                              <th>SET RESULT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {setsArray.map((setNum, sIdx) => {
                              const keyA = `scoreSet${setNum}A`
                              const keyB = `scoreSet${setNum}B`
                              const flag = setWinFlags[sIdx]
                              const hasAnyInSet = flag.hasA || flag.hasB

                              return (
                                <tr key={setNum}>
                                  <td style={{ fontWeight: '800', color: '#93c5fd' }}>
                                    Set {setNum}
                                  </td>
                                  <td style={{ fontWeight: flag.p1WonSet ? '900' : '600', color: flag.p1WonSet ? '#4ade80' : '#ffffff', fontSize: '15px' }}>
                                    {flag.hasA ? m[keyA] : '-'}
                                  </td>
                                  <td style={{ fontWeight: flag.p2WonSet ? '900' : '600', color: flag.p2WonSet ? '#4ade80' : '#ffffff', fontSize: '15px' }}>
                                    {flag.hasB ? m[keyB] : '-'}
                                  </td>
                                  <td style={{ fontSize: '12px', fontWeight: '700' }}>
                                    {flag.p1WonSet ? (
                                      <span style={{ color: '#4ade80' }}>✓ {p1?.name || 'P1'} Won Set</span>
                                    ) : flag.p2WonSet ? (
                                      <span style={{ color: '#4ade80' }}>✓ {p2?.name || 'P2'} Won Set</span>
                                    ) : hasAnyInSet ? (
                                      <span style={{ color: '#fde047' }}>In Progress</span>
                                    ) : (
                                      <span style={{ color: '#64748b' }}>-</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </>
                    )}

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setViewingMatchDetails(null)}
                        className="btn-primary-gradient"
                        style={{ padding: '8px 24px', fontSize: '13px', borderRadius: '8px' }}
                      >
                        ✓ Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* =========================================================
              2. LINE-BRANCHED DIAGRAM TREE (EXACT PHOTO STYLE)
             ========================================================= */}
          {viewMode === 'diagram' && (() => {
            const totalRounds = currentDraw.totalRounds
            const r1Matches = matchesByRound[1] || []
            const r1Count = r1Matches.length || Math.pow(2, totalRounds - 1)

            const CARD_WIDTH = 190
            const CARD_HEIGHT = 76
            const HORIZ_GAP = 60
            const COL_WIDTH = CARD_WIDTH + HORIZ_GAP
            const UNIT_HEIGHT = 108

            const totalDiagramHeight = Math.max(360, r1Count * UNIT_HEIGHT + 40)
            const totalDiagramWidth = totalRounds * COL_WIDTH + 60

            // 1. Calculate precise (x, y) coordinates for all cards across every round
            const matchPositions = {}
            for (let r = 1; r <= totalRounds; r++) {
              const matches = matchesByRound[r] || []
              matchPositions[r] = []
              const leftX = (r - 1) * COL_WIDTH + 20

              matches.forEach((m, mIdx) => {
                let centerY
                if (r === 1) {
                  centerY = mIdx * UNIT_HEIGHT + UNIT_HEIGHT / 2 + 20
                } else {
                  const prevRoundPositions = matchPositions[r - 1] || []
                  const parent1 = prevRoundPositions[mIdx * 2]
                  const parent2 = prevRoundPositions[mIdx * 2 + 1]
                  if (parent1 && parent2) {
                    centerY = (parent1.centerY + parent2.centerY) / 2
                  } else if (parent1) {
                    centerY = parent1.centerY + 40
                  } else {
                    centerY = mIdx * UNIT_HEIGHT * Math.pow(2, r - 1) + 60
                  }
                }

                matchPositions[r].push({
                  match: m,
                  mIdx,
                  round: r,
                  leftX,
                  topY: centerY - CARD_HEIGHT / 2,
                  centerY,
                  centerX: leftX + CARD_WIDTH / 2,
                  rightX: leftX + CARD_WIDTH,
                })
              })
            }

            // 2. Generate all connecting fork paths matching the photo exactly
            const connectorPaths = []
            for (let r = 1; r < totalRounds; r++) {
              const nextRoundPositions = matchPositions[r + 1] || []
              const currentRoundPositions = matchPositions[r] || []

              nextRoundPositions.forEach((childNode, cIdx) => {
                const parent1 = currentRoundPositions[cIdx * 2]
                const parent2 = currentRoundPositions[cIdx * 2 + 1]

                if (parent1 && parent2) {
                  const xStart = parent1.rightX
                  const xMid = xStart + HORIZ_GAP / 2
                  const xEnd = childNode.leftX
                  const yTop = parent1.centerY
                  const yBot = parent2.centerY
                  const yMid = childNode.centerY

                  const pathData = `M ${xStart} ${yTop} L ${xMid} ${yTop} L ${xMid} ${yBot} L ${xStart} ${yBot} M ${xMid} ${yMid} L ${xEnd - 3} ${yMid}`
                  connectorPaths.push({ id: `conn-${r}-${cIdx}`, pathData })
                } else if (parent1) {
                  const xStart = parent1.rightX
                  const xEnd = childNode.leftX
                  const yStart = parent1.centerY
                  const yEnd = childNode.centerY
                  const xMid = xStart + HORIZ_GAP / 2

                  const pathData = `M ${xStart} ${yStart} L ${xMid} ${yStart} L ${xMid} ${yEnd} L ${xEnd - 3} ${yEnd}`
                  connectorPaths.push({ id: `conn-${r}-${cIdx}`, pathData })
                }
              })
            }

            return (
              <div className="diagram-tree-container">
                {/* Notice Banner from Photo */}
                <div style={{ marginBottom: '16px' }}>
                  <span className="diagram-top-banner">
                    *Pool Toppers of the specified pools
                  </span>
                </div>

                {/* Absolute Geometric Canvas for Perfect Alignment & Lines */}
                <div
                  className="diagram-tree-canvas-viewport"
                  style={{
                    position: 'relative',
                    width: `${totalDiagramWidth}px`,
                    height: `${totalDiagramHeight}px`,
                    minHeight: '360px',
                    margin: '0 auto',
                  }}
                >
                  {/* SVG Connecting Bracket Lines with Arrows */}
                  <svg
                    className="diagram-svg-connector-canvas"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${totalDiagramWidth}px`,
                      height: `${totalDiagramHeight}px`,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                  >
                    <defs>
                      <marker
                        id="diagram-photo-arrow"
                        viewBox="0 0 10 10"
                        refX="7"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f4c6e" />
                      </marker>
                    </defs>

                    {connectorPaths.map(({ id, pathData }) => (
                      <path
                        key={id}
                        d={pathData}
                        className="diagram-photo-connector-line"
                        markerEnd="url(#diagram-photo-arrow)"
                      />
                    ))}
                  </svg>

                  {/* Render Round Cards at Exact Mathematical Positions */}
                  {Object.values(matchPositions).flat().map((pos) => {
                    const m = pos.match
                    const poolInfo = getPoolMatchLabel(pos.round, pos.mIdx, totalRounds)
                    const p1 = m.player1
                    const p2 = m.player2
                    const isCompleted = m.status === 'completed' || Boolean(m.winner)
                    const isFinal = pos.round === totalRounds

                    return (
                      <div
                        key={m.id}
                        className={`diagram-photo-card ${isFinal ? 'is-final' : ''} ${isCompleted ? 'is-completed' : ''}`}
                        style={{
                          position: 'absolute',
                          left: `${pos.leftX}px`,
                          top: `${pos.topY}px`,
                          width: `${CARD_WIDTH}px`,
                          height: `${CARD_HEIGHT}px`,
                          zIndex: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                        onClick={() => setViewingMatchDetails(m)}
                        title="Click to view match details & breakdown"
                      >
                        <div className="diagram-card-main-title">{poolInfo.title}</div>
                        <div className="diagram-card-pool-text">{poolInfo.subtitle}</div>

                        {/* Matchup Details with BYE support */}
                        {(() => {
                          const isByeMatch = p1?.isBye || p2?.isBye
                          const winPlayer = typeof m.winner === 'object'
                            ? m.winner
                            : (m.winner === 'player1' ? p1 : m.winner === 'player2' ? p2 : null)
                          const winName = winPlayer?.name || (typeof m.winner === 'string' && m.winner !== 'player1' && m.winner !== 'player2' ? m.winner : '')
                          const hasValidWinner = Boolean(winName && winName !== 'BYE' && !m.winner?.isBye)

                          if (isByeMatch) {
                            const advPlayer = p1?.isBye ? p2 : p1
                            return (
                              <div className="diagram-bye-matchup-container">
                                <div className="diagram-bye-vs-row">
                                  {Boolean(advPlayer?.seed || advPlayer?.isSeed) && (
                                    <span className="official-seed-pill" style={{ padding: '1px 4px', fontSize: '8px', margin: 0 }}>S{advPlayer?.seed || ''}</span>
                                  )}
                                  <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{advPlayer?.name || 'Player'}</span>
                                  <span style={{ color: '#94a3b8', fontSize: '9px' }}>vs</span>
                                  <span className="diagram-bye-pill">BYE</span>
                                </div>
                                <div className="diagram-bye-walkover-badge">
                                  🛡️ Advanced via BYE
                                </div>
                              </div>
                            )
                          }

                          if (hasValidWinner) {
                            const isSeeded = Boolean(winPlayer?.seed || winPlayer?.isSeed)
                            return (
                              <div style={{ marginTop: '3px', fontSize: '11px', fontWeight: '800', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                {isSeeded && <span className="official-seed-pill" style={{ padding: '1px 5px', fontSize: '9px', margin: 0 }}>S{winPlayer?.seed || ''}</span>}
                                <span>✓ {winName}</span>
                              </div>
                            )
                          }

                          if (p1 || p2) {
                            return (
                              <div style={{ marginTop: '3px', fontSize: '10px', color: '#e0f2fe', fontWeight: '600', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                {Boolean(p1?.seed || p1?.isSeed) && <span className="official-seed-pill" style={{ padding: '1px 4px', fontSize: '8px', margin: 0 }}>S{p1.seed || ''}</span>}
                                <span>{p1 ? (p1.isBye ? 'BYE' : p1.name) : 'TBD'}</span>
                                <span style={{ color: '#94a3b8', fontSize: '9px' }}>vs</span>
                                {Boolean(p2?.seed || p2?.isSeed) && <span className="official-seed-pill" style={{ padding: '1px 4px', fontSize: '8px', margin: 0 }}>S{p2.seed || ''}</span>}
                                <span>{p2 ? (p2.isBye ? 'BYE' : p2.name) : 'TBD'}</span>
                              </div>
                            )
                          }

                          return null
                        })()}

                        {m.time && (
                          <div
                            style={{
                              marginTop: '5px',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              background: 'rgba(2, 132, 199, 0.16)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              fontSize: '9.5px',
                              color: '#38bdf8',
                              fontWeight: '800',
                              letterSpacing: '0.02em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>⏱</span>
                            <span>{m.time}</span>
                            {m.court && <span style={{ color: '#94a3b8', fontSize: '9px' }}>• {m.court}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* =========================================================
              3. PROFESSIONAL FULL SCOREBOARD VIEW (BWF Live Broadcast Style)
             ========================================================= */}
          {viewMode === 'bracket' && (
            <div className="pro-scoreboard-wrapper">
              {/* Championship Stats Overview Bar */}
              {(() => {
                const allMatches = currentDraw.matches || []
                const totalCount = allMatches.length
                const completedCount = allMatches.filter((m) => m.status === 'completed' || (m.winner && (m.player1?.isBye || m.player2?.isBye))).length
                const liveCount = allMatches.filter((m) => m.status === 'live').length
                const scheduledCount = totalCount - completedCount - liveCount
                const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

                return (
                  <div className="pro-scoreboard-stats-bar">
                    <div className="pro-stats-group">
                      <div className="pro-stat-chip">
                        <span>🏸 Total Matches:</span>
                        <strong style={{ color: '#38bdf8' }}>{totalCount}</strong>
                      </div>
                      {liveCount > 0 && (
                        <div className="pro-stat-chip live">
                          <span className="pro-pulse-dot" />
                          <span>{liveCount} Live On Court</span>
                        </div>
                      )}
                      <div className="pro-stat-chip completed">
                        <span>✓ Completed:</span>
                        <strong style={{ color: '#4ade80' }}>{completedCount} / {totalCount}</strong>
                      </div>
                      <div className="pro-stat-chip">
                        <span>⏰ Scheduled:</span>
                        <strong style={{ color: '#cbd5e1' }}>{scheduledCount}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Progress: {progressPct}%</span>
                      <div style={{ flex: 1, height: '8px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                        <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="pro-scoreboard-columns-container">
                {Array.from({ length: currentDraw.totalRounds }, (_, i) => i + 1).map((round) => {
                  const matches = matchesByRound[round] || []
                  const roundName = getRoundName(round, currentDraw.totalRounds)
                  const isFinal = round === currentDraw.totalRounds
                  const isSemi = round === currentDraw.totalRounds - 1

                  return (
                    <div key={round} className="pro-round-column">
                      <div className="pro-round-header">
                        <div className="pro-round-title">
                          <span>{isFinal ? '👑' : isSemi ? '🏆' : round === 1 ? '🔥' : '⚡'}</span>
                          <span>{roundName}</span>
                        </div>
                        <span className="pro-match-count-badge">{matches.length} Match{matches.length > 1 ? 'es' : ''}</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {matches.map((m) => {
                          const p1 = m.player1
                          const p2 = m.player2
                          const isP1Winner = m.winner && p1 && String(m.winner.id) === String(p1.id)
                          const isP2Winner = m.winner && p2 && String(m.winner.id) === String(p2.id)
                          const isEditing = editingScoreMatchId === m.id
                          const isByeMatch = p1?.isBye || p2?.isBye

                          const matchEffectiveSets = m.matchSets || (
                            m.status === 'completed'
                              ? Math.max(
                                  (m.scoreSet5A || m.scoreSet5B) ? 5 :
                                  (m.scoreSet4A || m.scoreSet4B) ? 4 :
                                  (m.scoreSet3A || m.scoreSet3B) ? 3 :
                                  (m.scoreSet2A || m.scoreSet2B) ? 2 :
                                  1,
                                  m.matchSets || 1
                                )
                              : matchTotalSets
                          )
                          const setsArray = Array.from({ length: Math.max(1, matchEffectiveSets) }, (_, idx) => idx + 1)
                          const maxPts = Number(m.matchPoints || matchTotalPoints) || 30

                          // Calculate set wins dynamically for all configured sets
                          const s1A = Number(m.scoreSet1A) || 0
                          const s1B = Number(m.scoreSet1B) || 0
                          const s2A = Number(m.scoreSet2A) || 0
                          const s2B = Number(m.scoreSet2B) || 0

                          const p1Set1Win = (m.scoreSet1A !== '' && m.scoreSet1A !== undefined && m.scoreSet1B !== '' && m.scoreSet1B !== undefined && s1A > s1B)
                          const p2Set1Win = (m.scoreSet1A !== '' && m.scoreSet1A !== undefined && m.scoreSet1B !== '' && m.scoreSet1B !== undefined && s1B > s1A)
                          const p1Set2Win = (m.scoreSet2A !== '' && m.scoreSet2A !== undefined && m.scoreSet2B !== '' && m.scoreSet2B !== undefined && s2A > s2B)
                          const p2Set2Win = (m.scoreSet2A !== '' && m.scoreSet2A !== undefined && m.scoreSet2B !== '' && m.scoreSet2B !== undefined && s2B > s2A)

                          const is2ZeroP1 = p1Set1Win && p1Set2Win
                          const is2ZeroP2 = p2Set1Win && p2Set2Win
                          const isOneOneTie = (p1Set1Win && p2Set2Win) || (p2Set1Win && p1Set2Win)

                          let p1SetsTotal = 0
                          let p2SetsTotal = 0
                          const setWinFlags = setsArray.map((setNum) => {
                            const rawA = m[`scoreSet${setNum}A`]
                            const rawB = m[`scoreSet${setNum}B`]
                            const hasA = rawA !== '' && rawA !== undefined
                            const hasB = rawB !== '' && rawB !== undefined
                            const sA = Number(rawA) || 0
                            const sB = Number(rawB) || 0
                            const p1WonSet = hasA && hasB && sA > sB
                            const p2WonSet = hasA && hasB && sB > sA
                            if (p1WonSet) p1SetsTotal++
                            if (p2WonSet) p2SetsTotal++
                            return { p1WonSet, p2WonSet, hasA, hasB }
                          })

                          return (
                            <div
                              key={m.id}
                              className={`pro-match-card ${m.status === 'live' ? 'is-live' : ''} ${m.status === 'completed' || isP1Winner || isP2Winner ? 'is-completed' : ''}`}
                            >
                              <div className="pro-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span className="pro-match-num">MATCH #{m.matchNumber}</span>
                                  <span className="pro-court-badge">• {m.court || selectedMatch.courtName}</span>
                                  {m.time && <span className="pro-court-badge" style={{ color: '#38bdf8', fontWeight: '800' }}>• ⏰ {m.time}</span>}
                                </div>
                                <span className={`pro-status-tag ${isByeMatch ? 'walkover' : m.status}`}>
                                  {isByeMatch ? '🛡️ W/O BYE' : m.status === 'live' ? '🔴 LIVE' : m.status === 'completed' ? '✓ COMPLETED' : 'SCHEDULED'}
                                </span>
                              </div>

                              <table className="pro-scoreboard-table">
                                <thead>
                                  <tr>
                                    <th className="player-col">PLAYER / TEAM</th>
                                    {setsArray.map((setNum) => (
                                      <th key={setNum}>
                                        {setNum === 3 && matchTotalSets === 3 ? 'S3 (Opt)' : `S${setNum}`}
                                      </th>
                                    ))}
                                    <th style={{ color: '#38bdf8' }}>SETS</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Player 1 Row */}
                                  <tr
                                    className={`pro-player-row ${isP1Winner ? 'winner-row' : ''} ${round === 1 && p1 && !isPublicView ? 'draggable-player-slot' : ''} ${dragOverSlotKey === `${m.id}-player1` ? 'drag-over-slot' : ''}`}
                                    draggable={!isPublicView && Boolean(round === 1 && p1)}
                                    onDragStart={(e) => {
                                      if (isPublicView || round !== 1 || !p1) return
                                      e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: m.id, slotKey: 'player1', lineNum: m.line1 }))
                                      setDraggedSlot({ matchId: m.id, slotKey: 'player1', lineNum: m.line1, player: p1 })
                                    }}
                                    onDragOver={(e) => {
                                      if (isPublicView || round !== 1) return
                                      e.preventDefault()
                                      e.dataTransfer.dropEffect = 'move'
                                      setDragOverSlotKey(`${m.id}-player1`)
                                    }}
                                    onDragLeave={() => setDragOverSlotKey(null)}
                                    onDrop={(e) => {
                                      if (isPublicView || round !== 1) return
                                      e.preventDefault()
                                      setDragOverSlotKey(null)
                                      try {
                                        const source = JSON.parse(e.dataTransfer.getData('text/plain'))
                                        handleSwapPlayers(source, { matchId: m.id, slotKey: 'player1', lineNum: m.line1 })
                                      } catch (err) {
                                        console.error('Drop error', err)
                                      }
                                      setDraggedSlot(null)
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isPublicView) {
                                        setViewingMatchDetails(m)
                                        return
                                      }
                                      if (round === 1 && p1) {
                                        setExchangeModalSource({
                                          matchId: m.id,
                                          slotKey: 'player1',
                                          lineNum: m.line1,
                                          player: p1,
                                          match: m,
                                        })
                                        setExchangeSearchQuery('')
                                      } else {
                                        setViewingMatchDetails(m)
                                      }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td className="pro-player-cell">
                                      <div className="pro-player-info">
                                        {round === 1 && !isPublicView && (
                                          <span className="drag-handle-icon" title="Drag to exchange player position">⠿</span>
                                        )}
                                        {round === 1 && m.line1 && <span className="pro-line-tag">#{m.line1}</span>}
                                        {(p1?.seed || p1?.isSeed) ? (
                                          <span className="player-seed-badge-gold">S{p1.seed || ''}</span>
                                        ) : null}

                                        <div style={{ minWidth: 0 }}>
                                          <span className="pro-player-name">
                                            {p1 ? (p1.isBye ? 'BYE' : p1.name) : <span style={{ color: '#64748b', fontStyle: 'italic' }}>TBD</span>}
                                          </span>
                                          {isP1Winner && <span className="pro-winner-badge">👑 WINNER</span>}
                                          {round === 1 && !p1?.isBye && Boolean(p1?.place || p1?.court) && (
                                            <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '1px', fontWeight: '600' }}>
                                              {[p1.place, p1.court].filter(Boolean).join(' • ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    {setsArray.map((setNum, sIdx) => {
                                      const keyA = `scoreSet${setNum}A`
                                      const p1WonSet = setWinFlags[sIdx]?.p1WonSet
                                      const hasVal = setWinFlags[sIdx]?.hasA

                                      // If match won 2-0 in 3-set match and no set 3 score
                                      const isSet3NotNeeded = setNum === 3 && matchTotalSets === 3 && (is2ZeroP1 || is2ZeroP2) && !hasVal

                                      return (
                                        <td key={setNum} className="pro-score-cell">
                                          <span className={`pro-set-box ${p1WonSet ? 'set-winner' : ''}`} style={isSet3NotNeeded ? { opacity: 0.4, fontStyle: 'italic', fontSize: '11px' } : undefined}>
                                            {isSet3NotNeeded ? '-' : (hasVal ? m[keyA] : (p1?.isBye ? '-' : ''))}
                                          </span>
                                        </td>
                                      )
                                    })}
                                    <td className="pro-score-cell">
                                      <span className={`pro-total-box ${isP1Winner ? 'match-winner' : ''}`}>
                                        {isP1Winner && isByeMatch ? 'W' : (p1SetsTotal > 0 || p2SetsTotal > 0 ? p1SetsTotal : (isP1Winner ? 'W' : '-'))}
                                      </span>
                                    </td>
                                  </tr>

                                  {/* Player 2 Row */}
                                  <tr
                                    className={`pro-player-row ${isP2Winner ? 'winner-row' : ''} ${round === 1 && p2 && !isPublicView ? 'draggable-player-slot' : ''} ${dragOverSlotKey === `${m.id}-player2` ? 'drag-over-slot' : ''}`}
                                    draggable={!isPublicView && Boolean(round === 1 && p2)}
                                    onDragStart={(e) => {
                                      if (isPublicView || round !== 1 || !p2) return
                                      e.dataTransfer.setData('text/plain', JSON.stringify({ matchId: m.id, slotKey: 'player2', lineNum: m.line2 }))
                                      setDraggedSlot({ matchId: m.id, slotKey: 'player2', lineNum: m.line2, player: p2 })
                                    }}
                                    onDragOver={(e) => {
                                      if (isPublicView || round !== 1) return
                                      e.preventDefault()
                                      e.dataTransfer.dropEffect = 'move'
                                      setDragOverSlotKey(`${m.id}-player2`)
                                    }}
                                    onDragLeave={() => setDragOverSlotKey(null)}
                                    onDrop={(e) => {
                                      if (isPublicView || round !== 1) return
                                      e.preventDefault()
                                      setDragOverSlotKey(null)
                                      try {
                                        const source = JSON.parse(e.dataTransfer.getData('text/plain'))
                                        handleSwapPlayers(source, { matchId: m.id, slotKey: 'player2', lineNum: m.line2 })
                                      } catch (err) {
                                        console.error('Drop error', err)
                                      }
                                      setDraggedSlot(null)
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (isPublicView) {
                                        setViewingMatchDetails(m)
                                        return
                                      }
                                      if (round === 1 && p2) {
                                        setExchangeModalSource({
                                          matchId: m.id,
                                          slotKey: 'player2',
                                          lineNum: m.line2,
                                          player: p2,
                                          match: m,
                                        })
                                        setExchangeSearchQuery('')
                                      } else {
                                        setViewingMatchDetails(m)
                                      }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td className="pro-player-cell">
                                      <div className="pro-player-info">
                                        {round === 1 && !isPublicView && (
                                          <span className="drag-handle-icon" title="Drag to exchange player position">⠿</span>
                                        )}
                                        {round === 1 && m.line2 && <span className="pro-line-tag">#{m.line2}</span>}
                                        {(p2?.seed || p2?.isSeed) ? (
                                          <span className="player-seed-badge-gold">S{p2.seed || ''}</span>
                                        ) : null}

                                        <div style={{ minWidth: 0 }}>
                                          <span className="pro-player-name">
                                            {p2 ? (p2.isBye ? 'BYE' : p2.name) : <span style={{ color: '#64748b', fontStyle: 'italic' }}>TBD</span>}
                                          </span>
                                          {isP2Winner && <span className="pro-winner-badge">👑 WINNER</span>}
                                          {round === 1 && !p2?.isBye && Boolean(p2?.place || p2?.court) && (
                                            <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '1px', fontWeight: '600' }}>
                                              {[p2.place, p2.court].filter(Boolean).join(' • ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    {setsArray.map((setNum, sIdx) => {
                                      const keyB = `scoreSet${setNum}B`
                                      const p2WonSet = setWinFlags[sIdx]?.p2WonSet
                                      const hasVal = setWinFlags[sIdx]?.hasB

                                      const isSet3NotNeeded = setNum === 3 && matchTotalSets === 3 && (is2ZeroP1 || is2ZeroP2) && !hasVal

                                      return (
                                        <td key={setNum} className="pro-score-cell">
                                          <span className={`pro-set-box ${p2WonSet ? 'set-winner' : ''}`} style={isSet3NotNeeded ? { opacity: 0.4, fontStyle: 'italic', fontSize: '11px' } : undefined}>
                                            {isSet3NotNeeded ? '-' : (hasVal ? m[keyB] : (p2?.isBye ? '-' : ''))}
                                          </span>
                                        </td>
                                      )
                                    })}
                                    <td className="pro-score-cell">
                                      <span className={`pro-total-box ${isP2Winner ? 'match-winner' : ''}`}>
                                        {isP2Winner && isByeMatch ? 'W' : (p1SetsTotal > 0 || p2SetsTotal > 0 ? p2SetsTotal : (isP2Winner ? 'W' : '-'))}
                                      </span>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>

                              {/* Card Bottom Actions */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                {!isByeMatch && p1 && p2 && (
                                  !isPublicView ? (
                                    <button
                                      type="button"
                                      onClick={() => setEditingScoreMatchId(isEditing ? null : m.id)}
                                      style={{
                                        background: isEditing ? 'rgba(56, 189, 248, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        borderRadius: '8px',
                                        color: '#93c5fd',
                                        padding: '5px 10px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      {isEditing ? '✕ Close Score Editor' : '⚡ Enter Sets Score (Auto Winner)'}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setViewingMatchDetails(m)}
                                      style={{
                                        background: 'rgba(59, 130, 246, 0.18)',
                                        border: '1px solid rgba(96, 165, 250, 0.4)',
                                        borderRadius: '8px',
                                        color: '#bfdbfe',
                                        padding: '5px 12px',
                                        fontSize: '11.5px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                      }}
                                    >
                                      📊 View Scorecard
                                    </button>
                                  )
                                )}

                                {isByeMatch && (
                                  <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: '700' }}>
                                    ✓ Seed Advanced to Round 2
                                  </span>
                                )}
                              </div>

                              {/* Interactive Live Score & Winner Modifier Drawer */}
                              {!isPublicView && isEditing && (
                                <div className="pro-score-drawer">
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div>
                                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8' }}>
                                        ⚡ Manual Points Entry (Max {maxPts} Pts / Set):
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {['scheduled', 'live', 'completed'].map((st) => (
                                        <button
                                          key={st}
                                          type="button"
                                          onClick={() => handleUpdateMatch(m.id, { status: st })}
                                          style={{
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '10px',
                                            fontWeight: '800',
                                            textTransform: 'uppercase',
                                            background: m.status === st ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                                            color: '#fff',
                                            border: 'none',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {st}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Sets Steppers with Set 3 Optional Support */}
                                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${matchTotalSets}, 1fr)`, gap: '10px', marginBottom: '12px' }}>
                                    {setsArray.map((setNum) => {
                                      const keyA = `scoreSet${setNum}A`
                                      const keyB = `scoreSet${setNum}B`
                                      const valA = Number(m[keyA]) || 0
                                      const valB = Number(m[keyB]) || 0

                                      // Set 3 Condition badge
                                      let set3Label = `SET ${setNum}`
                                      let isOptionalUnneeded = false

                                      if (setNum === 3 && matchTotalSets === 3) {
                                        if (is2ZeroP1 || is2ZeroP2) {
                                          set3Label = `SET 3 (Optional - Won 2-0)`
                                          isOptionalUnneeded = true
                                        } else if (isOneOneTie) {
                                          set3Label = `🔥 SET 3 (1-1 Tie Decider)`
                                        } else {
                                          set3Label = `SET 3 (Optional - If 1-1)`
                                        }
                                      }

                                      return (
                                        <div
                                          key={setNum}
                                          style={{
                                            background: isOneOneTie && setNum === 3 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                                            padding: '8px',
                                            borderRadius: '8px',
                                            border: isOneOneTie && setNum === 3 ? '1.5px solid #eab308' : '1px solid rgba(148, 163, 184, 0.2)',
                                            opacity: isOptionalUnneeded && m[keyA] === '' && m[keyB] === '' ? 0.75 : 1,
                                          }}
                                        >
                                          <div style={{ fontSize: '10px', color: isOneOneTie && setNum === 3 ? '#fde047' : '#94a3b8', fontWeight: '800', textAlign: 'center', marginBottom: '6px' }}>
                                            {set3Label}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                            <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(m, keyA, Math.max(0, valA - 1))}>-</button>
                                            <input
                                              type="number"
                                              min="0"
                                              max={maxPts}
                                              value={m[keyA] !== undefined ? m[keyA] : ''}
                                              onChange={(e) => {
                                                const raw = e.target.value
                                                if (raw === '') {
                                                  handleScoreChange(m, keyA, '')
                                                } else {
                                                  const num = Number(raw)
                                                  if (num > maxPts) {
                                                    handleScoreChange(m, keyA, maxPts)
                                                  } else {
                                                    handleScoreChange(m, keyA, Math.max(0, num))
                                                  }
                                                }
                                              }}
                                              placeholder="0"
                                              style={{ width: '42px', padding: '4px', textAlign: 'center', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontWeight: '800', fontSize: '13px' }}
                                            />
                                            <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(m, keyA, Math.min(maxPts, valA + 1))}>+</button>
                                          </div>

                                          <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', margin: '2px 0' }}>vs</div>

                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(m, keyB, Math.max(0, valB - 1))}>-</button>
                                            <input
                                              type="number"
                                              min="0"
                                              max={maxPts}
                                              value={m[keyB] !== undefined ? m[keyB] : ''}
                                              onChange={(e) => {
                                                const raw = e.target.value
                                                if (raw === '') {
                                                  handleScoreChange(m, keyB, '')
                                                } else {
                                                  const num = Number(raw)
                                                  if (num > maxPts) {
                                                    handleScoreChange(m, keyB, maxPts)
                                                  } else {
                                                    handleScoreChange(m, keyB, Math.max(0, num))
                                                  }
                                                }
                                              }}
                                              placeholder="0"
                                              style={{ width: '42px', padding: '4px', textAlign: 'center', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#fff', fontWeight: '800', fontSize: '13px' }}
                                            />
                                            <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(m, keyB, Math.min(maxPts, valB + 1))}>+</button>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>

                                  {/* Auto Winner Status Banner */}
                                  <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: m.winner ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(21, 128, 61, 0.2))' : isOneOneTie ? 'rgba(234, 179, 8, 0.15)' : 'rgba(30, 41, 59, 0.5)', border: m.winner ? '1.5px solid #22c55e' : isOneOneTie ? '1.5px solid #eab308' : '1px solid rgba(148, 163, 184, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div>
                                      {m.winner ? (
                                        <div style={{ color: '#4ade80', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span>🏆 Match Winner:</span>
                                          <strong style={{ color: '#ffffff', background: '#16a34a', padding: '2px 8px', borderRadius: '6px' }}>
                                            {m.winner.name} ({p1SetsTotal} - {p2SetsTotal} Sets)
                                          </strong>
                                          <span style={{ fontSize: '11px', color: '#86efac' }}>✓ Auto-Advanced in Draw Tree</span>
                                        </div>
                                      ) : isOneOneTie ? (
                                        <div style={{ color: '#fde047', fontWeight: '800', fontSize: '12px' }}>
                                          ⚔️ 1-1 Equal Tie! Enter Set 3 points to decide the winner.
                                        </div>
                                      ) : (
                                        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                                          🏸 Enter points manually or use +/- steppers. The player with more sets won will be automatically declared winner!
                                        </div>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const resetUpdates = {
                                          winner: null,
                                          status: 'scheduled',
                                        }
                                        setsArray.forEach((sNum) => {
                                          resetUpdates[`scoreSet${sNum}A`] = ''
                                          resetUpdates[`scoreSet${sNum}B`] = ''
                                        })
                                        handleUpdateMatch(m.id, resetUpdates)
                                      }}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        borderRadius: '6px',
                                        color: '#fca5a5',
                                        padding: '4px 8px',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      ✕ Reset Scores
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              4. PROFESSIONAL ENHANCED SCHEDULE LIST VIEW (REBUILT CLEAN)
             ========================================================= */}
          {viewMode === 'schedule' && (
            <div className="fixtures-schedule-container">
              {/* 1. Top Hero Progress Banner */}
              <div className="schedule-hero-banner">
                <div className="schedule-hero-top">
                  <div className="schedule-hero-title-group">
                    <h3>
                      <span>🏸</span>
                      <span>{formatCategoryName(selectedCategory)} Match Schedule & Live Status</span>
                    </h3>
                    <div className="schedule-hero-subtitle">
                      <span>Tournament: <strong>{formatTournamentName(selectedMatch?.matchName)}</strong></span>
                      <span>•</span>
                      <span>Category: <strong>{formatCategoryName(selectedCategory)}</strong></span>
                      <span>•</span>
                      <span>Bracket: <strong>{currentDraw?.drawSize || 16} Draw Bracket ({currentDraw?.totalByes || 0} Byes)</strong></span>
                    </div>
                  </div>

                  <div className="schedule-progress-box">
                    <div className="schedule-progress-header">
                      <span>Tournament Progress</span>
                      <span className="schedule-progress-percent">{progressPercent}% Completed</span>
                    </div>
                    <div className="schedule-progress-track">
                      <div
                        className="schedule-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Counter Badges Grid - Interactive Status Filters */}
                <div className="schedule-stats-grid">
                  <div
                    className={`schedule-stat-card ${scheduleFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setScheduleFilter('all')}
                    title="Click to show All Matches"
                  >
                    <span className="schedule-stat-icon">📊</span>
                    <div className="schedule-stat-info">
                      <span className="schedule-stat-num">{totalScheduleCount}</span>
                      <span className="schedule-stat-label">Total Matches</span>
                    </div>
                  </div>

                  <div
                    className={`schedule-stat-card ready ${scheduleFilter === 'ready' ? 'active' : ''}`}
                    onClick={() => setScheduleFilter((prev) => (prev === 'ready' ? 'all' : 'ready'))}
                    title="Click to filter Ready to Play matches (both players checked in at desk)"
                  >
                    <span className="schedule-stat-icon">⚡</span>
                    <div className="schedule-stat-info">
                      <span className="schedule-stat-num">{readyScheduleCount}</span>
                      <span className="schedule-stat-label">Ready to Play</span>
                    </div>
                  </div>

                  <div
                    className={`schedule-stat-card live ${scheduleFilter === 'live' ? 'active' : ''}`}
                    onClick={() => setScheduleFilter((prev) => (prev === 'live' ? 'all' : 'live'))}
                    title="Click to filter Live matches only"
                  >
                    <span className="schedule-stat-icon">
                      <span className="live-pulse-dot" style={{ width: '10px', height: '10px' }} />
                    </span>
                    <div className="schedule-stat-info">
                      <span className="schedule-stat-num">{liveScheduleCount}</span>
                      <span className="schedule-stat-label">Live In Progress</span>
                    </div>
                  </div>

                  <div
                    className={`schedule-stat-card scheduled ${scheduleFilter === 'scheduled' ? 'active' : ''}`}
                    onClick={() => setScheduleFilter((prev) => (prev === 'scheduled' ? 'all' : 'scheduled'))}
                    title="Click to filter Scheduled matches only"
                  >
                    <span className="schedule-stat-icon">⏳</span>
                    <div className="schedule-stat-info">
                      <span className="schedule-stat-num">{scheduledScheduleCount}</span>
                      <span className="schedule-stat-label">Scheduled</span>
                    </div>
                  </div>

                  <div
                    className={`schedule-stat-card completed ${scheduleFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setScheduleFilter((prev) => (prev === 'completed' ? 'all' : 'completed'))}
                    title="Click to filter Completed matches only"
                  >
                    <span className="schedule-stat-icon">✓</span>
                    <div className="schedule-stat-info">
                      <span className="schedule-stat-num">{completedScheduleCount}</span>
                      <span className="schedule-stat-label">Completed</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Interactive Search & Filter Controls Toolbar */}
              <div className="schedule-toolbar-card">
                <div className="schedule-toolbar-top">
                  {/* Search input */}
                  <div className="schedule-search-box">
                    <span className="schedule-search-icon">🔍</span>
                    <input
                      type="text"
                      className="schedule-search-input"
                      placeholder="Search player, seed (S1), match #, court, round..."
                      value={scheduleSearchQuery}
                      onChange={(e) => setScheduleSearchQuery(e.target.value)}
                    />
                    {scheduleSearchQuery && (
                      <button
                        type="button"
                        className="schedule-search-clear"
                        onClick={() => setScheduleSearchQuery('')}
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* View layout toggle & admin controls */}
                  <div className="schedule-toolbar-actions">
                    <div className="schedule-view-toggle">
                      <button
                        type="button"
                        className={`schedule-view-btn ${scheduleLayoutView === 'cards' ? 'active' : ''}`}
                        onClick={() => setScheduleLayoutView('cards')}
                      >
                        📇 Match Cards
                      </button>
                      <button
                        type="button"
                        className={`schedule-view-btn ${scheduleLayoutView === 'table' ? 'active' : ''}`}
                        onClick={() => setScheduleLayoutView('table')}
                      >
                        📊 Detailed Table
                      </button>
                    </div>

                    {/* MATCH SETS SELECTOR (ADMIN ONLY) */}
                    {!isPublicView && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                        }}
                        title="Select number of sets for matches in this tournament (Default: 3 Sets)"
                      >
                        <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '700' }}>🏆 Sets:</span>
                        <select
                          value={matchTotalSets}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 3
                            setMatchTotalSets(val)
                            try {
                              localStorage.setItem('badminton-match-sets', JSON.stringify(val))
                              window.dispatchEvent(new Event('storage'))
                              window.dispatchEvent(new CustomEvent('badminton-settings-changed', { detail: { matchSets: val, matchPoints: matchTotalPoints } }))
                              if (typeof BroadcastChannel !== 'undefined') {
                                const channel = new BroadcastChannel('badminton_sync')
                                channel.postMessage({ type: 'SETTINGS_UPDATED', matchSets: val, matchPoints: matchTotalPoints })
                                channel.close()
                              }
                            } catch {}
                            fetch('/api/tournaments', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ systemSettings: { matchSets: val, matchPoints: matchTotalPoints } }),
                            }).catch(() => {})
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            fontWeight: '800',
                            fontSize: '12px',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={1} style={{ background: '#0f172a', color: '#f8fafc' }}>1 Set (Single)</option>
                          <option value={3} style={{ background: '#0f172a', color: '#f8fafc' }}>3 Sets (Best of 3)</option>
                          <option value={5} style={{ background: '#0f172a', color: '#f8fafc' }}>5 Sets (Best of 5)</option>
                        </select>
                      </div>
                    )}

                    {/* MATCH POINTS SELECTOR (ADMIN ONLY) */}
                    {!isPublicView && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(15, 23, 42, 0.85)',
                          padding: '6px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                        }}
                        title="Select points per set for this tournament (Default: 30 Points)"
                      >
                        <span style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: '700' }}>🏸 Points:</span>
                        <select
                          value={matchTotalPoints}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 30
                            setMatchTotalPoints(val)
                            try {
                              localStorage.setItem('badminton-match-points', JSON.stringify(val))
                              window.dispatchEvent(new Event('storage'))
                              window.dispatchEvent(new CustomEvent('badminton-settings-changed', { detail: { matchPoints: val, matchSets: matchTotalSets } }))
                              if (typeof BroadcastChannel !== 'undefined') {
                                const channel = new BroadcastChannel('badminton_sync')
                                channel.postMessage({ type: 'SETTINGS_UPDATED', matchPoints: val, matchSets: matchTotalSets })
                                channel.close()
                              }
                            } catch {}
                            fetch('/api/tournaments', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ systemSettings: { matchPoints: val, matchSets: matchTotalSets } }),
                            }).catch(() => {})
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            fontWeight: '800',
                            fontSize: '12px',
                            outline: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <option value={30} style={{ background: '#0f172a', color: '#f8fafc' }}>30 Points (Max)</option>
                          <option value={21} style={{ background: '#0f172a', color: '#f8fafc' }}>21 Points (BWF)</option>
                          <option value={15} style={{ background: '#0f172a', color: '#f8fafc' }}>15 Points (Fast)</option>
                          <option value={11} style={{ background: '#0f172a', color: '#f8fafc' }}>11 Points</option>
                        </select>
                      </div>
                    )}

                    {/* LIVE UMPIRE / MANUAL SCORING TOGGLE BUTTON (ADMIN ONLY) */}
                    {!isPublicView && (
                      <button
                        type="button"
                        onClick={handleToggleLiveUmpireMode}
                        title={
                          !hasUmpireLogins
                            ? '🔒 Locked: Create at least 1 Umpire Login in Logins Page to enable Live Umpire Mode.'
                            : isLiveUmpireMode
                              ? 'Live Umpire Mode is Active (Red). Click to switch to Manual Scoring (Green).'
                              : 'Manual Scoring Mode is Active (Green). Click to switch to Live Umpire Mode (Red).'
                        }
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          background: !hasUmpireLogins
                            ? 'rgba(30, 41, 59, 0.85)'
                            : isLiveUmpireMode
                              ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                              : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                          border: !hasUmpireLogins
                            ? '1.5px solid rgba(148, 163, 184, 0.35)'
                            : isLiveUmpireMode
                              ? '1.5px solid #f87171'
                              : '1.5px solid #34d399',
                          color: !hasUmpireLogins ? '#94a3b8' : '#ffffff',
                          fontWeight: '800',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: !hasUmpireLogins
                            ? 'none'
                            : isLiveUmpireMode
                              ? '0 0 16px rgba(239, 68, 68, 0.45)'
                              : '0 0 16px rgba(16, 185, 129, 0.45)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {!hasUmpireLogins ? (
                          <>
                            <span style={{ fontSize: '13px' }}>🔒</span>
                            <span>Live Umpire: LOCKED (0 Logins)</span>
                          </>
                        ) : isLiveUmpireMode ? (
                          <>
                            <span
                              className="live-pulse-dot"
                              style={{ width: '8px', height: '8px', background: '#ffffff', display: 'inline-block' }}
                            />
                            <span>🔴 Live Umpire: ON ({availableUmpiresList.length})</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '13px' }}>🟢</span>
                            <span>Live Umpire: OFF (Manual)</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* CONFIGURE COURTS BUTTON */}
                    {!isPublicView && (
                      <button
                        type="button"
                        onClick={() => setIsCourtConfigModalOpen(true)}
                        title="Configure Courts Count & Naming Style (Numeric, Alphabetical, Roman, Custom)"
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(3, 105, 161, 0.35) 100%)',
                          border: '1.5px solid rgba(56, 189, 248, 0.4)',
                          color: '#38bdf8',
                          fontWeight: '800',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <span>🏟️</span>
                        <span>Courts: {configuredCourts.length}</span>
                        <span style={{ fontSize: '11px', opacity: 0.85 }}>✏️</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary Filters Bar */}
                <div className="schedule-filters-row">
                  {/* Status chips */}
                  <div className="schedule-status-chips">
                    <button
                      type="button"
                      className={`schedule-status-chip ${scheduleFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('all')}
                    >
                      <span>All Matches</span>
                      <span className="schedule-chip-count">{totalScheduleCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`schedule-status-chip ready ${scheduleFilter === 'ready' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('ready')}
                      title="Matches where BOTH players have reported at desk and are ready to play!"
                    >
                      <span>⚡ Ready to Play</span>
                      <span className="schedule-chip-count">{readyScheduleCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`schedule-status-chip live ${scheduleFilter === 'live' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('live')}
                    >
                      <span className="live-pulse-dot" />
                      <span>Live</span>
                      <span className="schedule-chip-count">{liveScheduleCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`schedule-status-chip scheduled ${scheduleFilter === 'scheduled' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('scheduled')}
                    >
                      <span>Scheduled</span>
                      <span className="schedule-chip-count">{scheduledScheduleCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`schedule-status-chip completed ${scheduleFilter === 'completed' ? 'active' : ''}`}
                      onClick={() => setScheduleFilter('completed')}
                    >
                      <span>Completed</span>
                      <span className="schedule-chip-count">{completedScheduleCount}</span>
                    </button>
                  </div>

                  {/* Dropdowns for Round and Court */}
                  <div className="schedule-select-filters">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="schedule-select-label">Round:</span>
                      <select
                        className="schedule-select-input"
                        value={scheduleRoundFilter}
                        onChange={(e) => setScheduleRoundFilter(e.target.value)}
                      >
                        <option value="all">All Rounds</option>
                        {uniqueRoundsList.map((r) => (
                          <option key={r.round} value={r.round}>
                            {r.roundName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {uniqueCourts.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="schedule-select-label">Court:</span>
                        <select
                          className="schedule-select-input"
                          value={courtFilter}
                          onChange={(e) => setCourtFilter(e.target.value)}
                        >
                          <option value="all">All Courts</option>
                          {uniqueCourts.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Schedule Content: Cards View or Table View */}
              {filteredScheduleMatches.length === 0 ? (
                <div className="schedule-empty-state">
                  <div className="schedule-empty-icon">🔍</div>
                  <h4>No Matches Found</h4>
                  <p>
                    {scheduleSearchQuery
                      ? `No matches match your search "${scheduleSearchQuery}". Try changing or clearing your filters.`
                      : 'No matches found under the selected filters.'}
                  </p>
                </div>
              ) : scheduleLayoutView === 'cards' ? (
                /* Cards View */
                <div className="schedule-cards-grid">
                  {filteredScheduleMatches.map((m) => {
                    const matchUniqueKey = m.id || `m_${m.round}_${m.matchNumber}`
                    const p1 = m.player1
                    const p2 = m.player2
                    const isP1Rep = isPlayerReported(p1)
                    const isP2Rep = isPlayerReported(p2)
                    const isBothRep = isMatchBothReported(m) && (m.status === 'scheduled' || !m.status) && !m.isLive
                    const isP1Winner = m.winner && p1 && m.winner.id === p1.id
                    const isP2Winner = m.winner && p2 && m.winner.id === p2.id
                    const matchEffectiveSets = m.matchSets || (
                      m.status === 'completed'
                        ? Math.max(
                            (m.scoreSet5A || m.scoreSet5B) ? 5 :
                            (m.scoreSet4A || m.scoreSet4B) ? 4 :
                            (m.scoreSet3A || m.scoreSet3B) ? 3 :
                            (m.scoreSet2A || m.scoreSet2B) ? 2 :
                            1,
                            m.matchSets || 1
                          )
                        : matchTotalSets
                    )
                    const setsArray = Array.from({ length: Number(matchEffectiveSets) || 3 }, (_, i) => i + 1)
                    const isFinal = m.round === currentDraw.totalRounds
                    const isSemi = m.round === currentDraw.totalRounds - 1

                    // Compute set wins count
                    let p1SetsWon = 0
                    let p2SetsWon = 0
                    const setPills = []

                    setsArray.forEach((s) => {
                      const sA = m[`scoreSet${s}A`]
                      const sB = m[`scoreSet${s}B`]
                      if (sA !== '' && sB !== '' && sA !== undefined && sB !== undefined) {
                        const numA = Number(sA)
                        const numB = Number(sB)
                        if (numA > numB) p1SetsWon++
                        else if (numB > numA) p2SetsWon++
                        setPills.push({ setNum: s, scoreA: sA, scoreB: sB, winner: numA > numB ? 1 : numB > numA ? 2 : 0 })
                      }
                    })

                    return (
                      <div
                        key={matchUniqueKey}
                        className={`schedule-card ${m.status === 'live' ? 'is-live' : m.status === 'completed' ? 'is-completed' : ''} ${isBothRep ? 'both-reported' : ''}`}
                      >
                        {/* Ready to Play Banner when BOTH players reported */}
                        {isBothRep && (
                          <div className="schedule-ready-banner">
                            <span>⚡ Court Ready • Both Players Reported</span>
                            <span style={{ fontSize: '10.5px', background: 'rgba(56, 189, 248, 0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                              Ready to Play
                            </span>
                          </div>
                        )}

                        {/* Header: Match Num, Round Badge, Dynamic Status Selector */}
                        <div className="schedule-card-header">
                          <div className="schedule-card-tags">
                            <span className="schedule-match-badge">M#{m.matchNumber}</span>
                            <span className={`schedule-round-badge ${isFinal ? 'final' : isSemi ? 'semi' : ''}`}>
                              {isFinal ? '🏆 ' : isSemi ? '🔥 ' : ''}{m.roundName}
                            </span>
                            {m.time && (
                              <span
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  background: 'rgba(2, 132, 199, 0.22)',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  color: '#38bdf8',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                ⏱ {m.time}
                              </span>
                            )}
                          </div>

                          <div className="schedule-status-dynamic-wrap">
                            {isPublicView ? (
                              <span
                                className={`schedule-status-dropdown ${m.status || 'scheduled'}`}
                                style={{ cursor: 'default', pointerEvents: 'none', display: 'inline-block', padding: '4px 8px' }}
                              >
                                {m.status === 'live' ? '🔴 Live' : m.status === 'completed' ? '✓ Completed' : '⏰ Scheduled'}
                              </span>
                            ) : (
                              <select
                                value={m.status || 'scheduled'}
                                onChange={(e) => {
                                  const newStatus = e.target.value
                                  if (newStatus === 'live') {
                                    handlePromptStartLive(m)
                                  } else {
                                    handleUpdateMatch(m.id, { status: newStatus, isLive: false })
                                  }
                                }}
                                className={`schedule-status-dropdown ${m.status || 'scheduled'}`}
                                title="Click to switch status: Scheduled / Live / Completed"
                              >
                                <option value="scheduled">⏰ Scheduled</option>
                                <option value="live">🔴 Live</option>
                                <option value="completed">✓ Completed</option>
                              </select>
                            )}
                          </div>
                        </div>

                        {/* Meta Line: Court, Time, Venue */}
                        <div className="schedule-card-meta">
                          {m.court && m.court !== 'BYE' && <span>🏟️ {m.court}</span>}
                          {m.time && (
                            <span style={{ color: '#38bdf8', fontWeight: '800' }}>
                              ⏱ {m.time}
                            </span>
                          )}
                          {m.venue && !m.court && <span>📍 {m.venue}</span>}
                          {(m.player1?.isBye || m.player2?.isBye || m.winner?.hasByeWalkover) && (
                            <span style={{ color: '#c084fc', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '800' }}>
                              ⚡ BYE Walkover
                            </span>
                          )}
                        </div>

                        {/* Matchup Players */}
                        <div className="schedule-matchup-box">
                          {/* Player 1 */}
                          <div className={`schedule-player-row ${isP1Winner ? 'is-winner' : ''} ${p1?.isBye ? 'is-bye-player' : ''}`}>
                            <div className="schedule-player-info">
                              {Boolean(p1?.seed || p1?.isSeed) && (
                                <span className="official-seed-pill" title={`Seed #${p1.seed}`}>
                                  S{p1.seed || ''}
                                </span>
                              )}
                              {p1?.isBye ? (
                                <span className="schedule-bye-pill">BYE</span>
                              ) : (
                                <span className={`schedule-player-name ${isP1Rep ? 'is-reported' : ''}`}>
                                  {p1?.name || 'TBD'}
                                </span>
                              )}
                              {isP1Rep && (
                                <span className="schedule-player-reported-badge" title="Reported at desk">
                                  ✓ Reported
                                </span>
                              )}
                              {Boolean(!p1?.isBye && (p1?.place || p1?.court)) && (
                                <span className="schedule-player-meta-tag">
                                  ({[p1.place, p1.court].filter(Boolean).join(' • ')})
                                </span>
                              )}
                              {isP1Winner && <span className="schedule-winner-crown" title="Winner">👑</span>}
                            </div>
                            <span className="schedule-sets-won-badge">{p1?.isBye ? '-' : p1SetsWon}</span>
                          </div>

                          {/* Player 2 */}
                          <div className={`schedule-player-row ${isP2Winner ? 'is-winner' : ''} ${p2?.isBye ? 'is-bye-player' : ''}`}>
                            <div className="schedule-player-info">
                              {Boolean(p2?.seed || p2?.isSeed) && (
                                <span className="official-seed-pill" title={`Seed #${p2.seed}`}>
                                  S{p2.seed || ''}
                                </span>
                              )}
                              {p2?.isBye ? (
                                <span className="schedule-bye-pill">BYE</span>
                              ) : (
                                <span className={`schedule-player-name ${isP2Rep ? 'is-reported' : ''}`}>
                                  {p2?.name || 'TBD'}
                                </span>
                              )}
                              {isP2Rep && (
                                <span className="schedule-player-reported-badge" title="Reported at desk">
                                  ✓ Reported
                                </span>
                              )}
                              {Boolean(!p2?.isBye && (p2?.place || p2?.court)) && (
                                <span className="schedule-player-meta-tag">
                                  ({[p2.place, p2.court].filter(Boolean).join(' • ')})
                                </span>
                              )}
                              {isP2Winner && <span className="schedule-winner-crown" title="Winner">👑</span>}
                            </div>
                            <span className="schedule-sets-won-badge">{p2?.isBye ? '-' : p2SetsWon}</span>
                          </div>
                        </div>

                        {/* Sets Score Breakdown & Live Points - Shown whenever match is live or has recorded scores */}
                        {(setPills.length > 0 || m.status === 'live') && (
                          <div className="schedule-score-breakdown">
                            <span style={{ color: m.status === 'live' ? '#f87171' : '#94a3b8', fontWeight: '800' }}>
                              {m.status === 'live' ? '🔴 Live Score:' : 'Sets Score:'}
                            </span>
                            <div className="schedule-score-pills">
                              {m.status === 'live' && (
                                <span
                                  className="schedule-set-pill live"
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderColor: '#ef4444',
                                    color: '#fca5a5',
                                    fontWeight: '800',
                                  }}
                                >
                                  <span className="live-pulse-dot" style={{ width: '6px', height: '6px', display: 'inline-block', marginRight: '4px', background: '#ef4444' }} />
                                  Set {m.liveScore?.currentSet || 1}: {m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p1 ?? m.scoreSet1A ?? 0) : (m.scoreSet1A || 0)} - {m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p2 ?? m.scoreSet1B ?? 0) : (m.scoreSet1B || 0)} 🏸
                                </span>
                              )}
                              {setPills.map((pill) => (
                                <span
                                  key={pill.setNum}
                                  className="schedule-set-pill"
                                  style={{
                                    borderColor: pill.winner === 1 || pill.winner === 2 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(148, 163, 184, 0.2)',
                                  }}
                                >
                                  S{pill.setNum}: <strong>{pill.scoreA} - {pill.scoreB}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions Footer */}
                        <div className="schedule-card-actions">
                          {!isPublicView && (m.status === 'scheduled' || !m.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePromptStartLive(m)}
                                style={{
                                  background: isLiveUmpireMode
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  boxShadow: isLiveUmpireMode ? '0 2px 8px rgba(239, 68, 68, 0.35)' : '0 2px 8px rgba(16, 185, 129, 0.35)',
                                }}
                              >
                                <span className="live-pulse-dot" style={{ width: '6px', height: '6px', background: '#ffffff' }} />
                                <span>{isLiveUmpireMode ? '🔴 Start Live (Umpire)' : '🟢 Start Live (Manual)'}</span>
                              </button>

                              {!isLiveUmpireMode && (
                                <button
                                  type="button"
                                  className="btn-schedule-score"
                                  style={{
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                  }}
                                  onClick={() => setQuickScoreScheduleMatch(m)}
                                >
                                  ⚡ Score
                                </button>
                              )}
                            </>
                          )}

                          {!isPublicView && m.status === 'live' && (
                            <>
                              <button
                                type="button"
                                className="btn-schedule-score"
                                style={{
                                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                  color: '#ffffff',
                                  fontWeight: '800',
                                }}
                                onClick={() => setQuickScoreScheduleMatch(m)}
                                title="Enter live set scores / points directly"
                              >
                                ⚡ Live Points
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateMatch(m.id, { status: 'scheduled', isLive: false })}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1.5px solid rgba(239, 68, 68, 0.5)',
                                  color: '#fca5a5',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                                title="Stop Live and move back to Scheduled"
                              >
                                <span>⏹️ Stop Live</span>
                              </button>
                            </>
                          )}

                          {!isPublicView && m.status === 'completed' && (
                            <button
                              type="button"
                              className="btn-schedule-score"
                              style={{
                                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                              }}
                              onClick={() => setQuickScoreScheduleMatch(m)}
                            >
                              ✏️ Modify Result
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn-schedule-status-toggle"
                            onClick={() => setViewingMatchDetails(m)}
                            title="View Live Match Scorecard & Details"
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              borderColor: 'rgba(56, 189, 248, 0.4)',
                              color: '#38bdf8',
                              fontWeight: '800',
                            }}
                          >
                            👁️ Details
                          </button>

                          {!isPublicView && (
                            <button
                              type="button"
                              className="btn-schedule-status-toggle"
                              onClick={() => handleOpenScoresheet(m)}
                              title="Print Official Scoresheet for this match"
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                borderColor: 'rgba(59, 130, 246, 0.35)',
                                color: '#93c5fd',
                                fontWeight: '700',
                              }}
                            >
                              🖨️ Scoresheet
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Table View */
                <div className="schedule-table-card">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="schedule-pro-table">
                      <thead>
                        <tr>
                          <th>Match</th>
                          <th>Round</th>
                          <th className="matchup-cell">Matchup & Seed</th>
                          <th>Court / Location</th>
                          <th>Sets / Points</th>
                          <th>Winner</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredScheduleMatches.map((m) => {
                          const matchUniqueKey = m.id || `m_${m.round}_${m.matchNumber}`
                          const p1 = m.player1
                          const p2 = m.player2
                          const isP1Rep = isPlayerReported(p1)
                          const isP2Rep = isPlayerReported(p2)
                          const isBothRep = isMatchBothReported(m) && (m.status === 'scheduled' || !m.status) && !m.isLive
                          const isP1Win = m.winner && p1 && m.winner.id === p1.id
                          const isP2Win = m.winner && p2 && m.winner.id === p2.id
                          const isFinal = m.round === currentDraw.totalRounds
                          const isSemi = m.round === currentDraw.totalRounds - 1

                          return (
                            <tr key={matchUniqueKey} className={isBothRep ? 'schedule-table-row-ready' : ''}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span className="schedule-match-badge">M#{m.matchNumber}</span>
                                  {isBothRep && (
                                    <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '800' }}>
                                      ⚡ Ready
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={`schedule-round-badge ${isFinal ? 'final' : isSemi ? 'semi' : ''}`}>
                                  {m.roundName}
                                </span>
                              </td>
                              <td className="matchup-cell">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div className={`schedule-table-player ${isP1Win ? 'winner' : ''} ${isP1Rep ? 'is-reported' : ''}`}>
                                    {Boolean(p1?.seed || p1?.isSeed) && <span className="official-seed-pill">S{p1.seed}</span>}
                                    {p1?.isBye ? (
                                      <span className="schedule-bye-pill">BYE</span>
                                    ) : (
                                      <span style={{ color: isP1Rep ? '#38bdf8' : undefined, fontWeight: isP1Rep ? '800' : undefined }}>
                                        {p1?.name || 'TBD'}
                                      </span>
                                    )}
                                    {isP1Rep && <span className="schedule-player-reported-badge">✓ Reported</span>}
                                    {Boolean(!p1?.isBye && (p1?.place || p1?.court)) && (
                                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        ({[p1.place, p1.court].filter(Boolean).join(' • ')})
                                      </span>
                                    )}
                                    {isP1Win && <span>👑</span>}
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>vs</span>
                                  <div className={`schedule-table-player ${isP2Win ? 'winner' : ''} ${isP2Rep ? 'is-reported' : ''}`}>
                                    {Boolean(p2?.seed || p2?.isSeed) && <span className="official-seed-pill">S{p2.seed}</span>}
                                    {p2?.isBye ? (
                                      <span className="schedule-bye-pill">BYE</span>
                                    ) : (
                                      <span style={{ color: isP2Rep ? '#38bdf8' : undefined, fontWeight: isP2Rep ? '800' : undefined }}>
                                        {p2?.name || 'TBD'}
                                      </span>
                                    )}
                                    {isP2Rep && <span className="schedule-player-reported-badge">✓ Reported</span>}
                                    {Boolean(!p2?.isBye && (p2?.place || p2?.court)) && (
                                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        ({[p2.place, p2.court].filter(Boolean).join(' • ')})
                                      </span>
                                    )}
                                    {isP2Win && <span>👑</span>}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {m.court && m.court !== 'BYE' && (
                                    <span style={{ fontWeight: '700', color: '#f8fafc' }}>
                                      🏟️ {m.court}
                                    </span>
                                  )}
                                  {(m.time || m.scheduledTime) && (
                                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      ⏰ {m.time || m.scheduledTime}
                                    </span>
                                  )}
                                  {(m.player1?.isBye || m.player2?.isBye || m.winner?.hasByeWalkover) && (
                                    <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: '800', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                                      ⚡ BYE Walkover
                                    </span>
                                  )}
                                  {m.venue && !m.court && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      📍 {m.venue}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                {m.status === 'live' ? (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span className="schedule-set-pill live" style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444', color: '#fca5a5', fontWeight: '800' }}>
                                      <span className="live-pulse-dot" style={{ width: '6px', height: '6px', display: 'inline-block', marginRight: '4px', background: '#ef4444' }} />
                                      Set {m.liveScore?.currentSet || 1}: {m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p1 ?? m.scoreSet1A ?? 0) : (m.scoreSet1A || 0)}-{m.liveScore ? (m.liveScore[`set${m.liveScore.currentSet || 1}`]?.p2 ?? m.scoreSet1B ?? 0) : (m.scoreSet1B || 0)} 🏸
                                    </span>
                                  </div>
                                ) : (m.scoreSet1A !== undefined && m.scoreSet1A !== '' && m.scoreSet1B !== undefined && m.scoreSet1B !== '') ? (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {[1, 2, 3, 4, 5].map((sNum) => {
                                      const sA = m[`scoreSet${sNum}A`]
                                      const sB = m[`scoreSet${sNum}B`]
                                      if (sA === '' || sA === undefined || sB === '' || sB === undefined) return null
                                      return (
                                        <span key={sNum} className="schedule-set-pill">
                                          {sA}-{sB}
                                        </span>
                                      )
                                    })}
                                  </div>
                                ) : (m.player1?.isBye || m.player2?.isBye || m.winner?.hasByeWalkover) ? (
                                  <span style={{ color: '#c084fc', fontWeight: '800', fontSize: '12px' }}>W.O.</span>
                                ) : (
                                  <span style={{ color: '#64748b' }}>-</span>
                                )}
                              </td>
                              <td>
                                {m.winner ? (
                                  <strong style={{ color: '#4ade80' }}>🏆 {m.winner.name}</strong>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>Pending</span>
                                )}
                              </td>
                              <td>
                                <div className="schedule-status-dynamic-wrap">
                                  {isPublicView ? (
                                    <span
                                      className={`schedule-status-dropdown ${m.status || 'scheduled'}`}
                                      style={{ cursor: 'default', pointerEvents: 'none', display: 'inline-block', padding: '4px 8px' }}
                                    >
                                      {m.status === 'live' ? '🔴 Live' : m.status === 'completed' ? '✓ Completed' : '⏰ Scheduled'}
                                    </span>
                                  ) : (
                                    <select
                                      value={m.status || 'scheduled'}
                                      onChange={(e) => {
                                        const newStatus = e.target.value
                                        if (newStatus === 'live') {
                                          handlePromptStartLive(m)
                                        } else {
                                          handleUpdateMatch(m.id, { status: newStatus, isLive: false })
                                        }
                                      }}
                                      className={`schedule-status-dropdown ${m.status || 'scheduled'}`}
                                      title="Change Match Status"
                                    >
                                      <option value="scheduled">⏰ Scheduled</option>
                                      <option value="live">🔴 Live</option>
                                      <option value="completed">✓ Completed</option>
                                    </select>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {!isPublicView && (m.status === 'scheduled' || !m.status) && (
                                    <button
                                      type="button"
                                      onClick={() => handlePromptStartLive(m)}
                                      style={{
                                        background: isLiveUmpireMode
                                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                          : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {isLiveUmpireMode ? '🔴 Live' : '🟢 Live'}
                                    </button>
                                  )}
                                  {!isPublicView && m.status === 'live' && (
                                    <button
                                      type="button"
                                      onClick={() => setQuickScoreScheduleMatch(m)}
                                      style={{
                                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      ⚡ Points
                                    </button>
                                  )}
                                  {!isPublicView && m.status === 'completed' && (
                                    <button
                                      type="button"
                                      onClick={() => setQuickScoreScheduleMatch(m)}
                                      style={{
                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      ✏️ Modify
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setViewingMatchDetails(m)}
                                    title="View Match Details & Scorecard"
                                    style={{
                                      background: 'rgba(56, 189, 248, 0.18)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.35)',
                                      borderRadius: '4px',
                                      padding: '5px 8px',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    👁️ Details
                                  </button>
                                  {!isPublicView && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenScoresheet(m)}
                                      title="Print Official Scoresheet for this match"
                                      style={{
                                        background: 'rgba(59, 130, 246, 0.18)',
                                        color: '#93c5fd',
                                        border: '1px solid rgba(59, 130, 246, 0.35)',
                                        borderRadius: '4px',
                                        padding: '5px 8px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      🖨️ Sheet
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Ultra-Clean, Simplified Score Update Modal (Admin Only) */}
              {!isPublicView && quickScoreScheduleMatch && (() => {
                const m = quickScoreScheduleMatch
                const p1 = m.player1
                const p2 = m.player2
                const setsCount = Number(matchTotalSets) || 3
                const maxPts = Number(matchTotalPoints) || 21

                // Calculate current sets won
                let p1Won = 0
                let p2Won = 0
                for (let s = 1; s <= setsCount; s++) {
                  const sA = m[`scoreSet${s}A`]
                  const sB = m[`scoreSet${s}B`]
                  if (sA !== '' && sB !== '' && sA !== undefined && sB !== undefined) {
                    if (Number(sA) > Number(sB)) p1Won++
                    else if (Number(sB) > Number(sA)) p2Won++
                  }
                }

                return (
                  <div className="custom-modal-overlay" onClick={() => setQuickScoreScheduleMatch(null)}>
                    <div
                      className="custom-modal-box"
                      style={{ maxWidth: '460px', width: '92%' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="custom-modal-header" style={{ paddingBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="schedule-match-badge" style={{ fontSize: '12px' }}>
                              M#{m.matchNumber}
                            </span>
                            <span style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '700' }}>
                              {m.roundName}
                            </span>
                          </div>
                          <h3 style={{ margin: '4px 0 0 0', fontSize: '17px', color: '#f8fafc' }}>
                            ⚡ Enter Match Scores ({setsCount} {setsCount === 1 ? 'Set' : 'Sets'})
                          </h3>
                        </div>
                        <button
                          type="button"
                          className="btn-modal-close"
                          onClick={() => setQuickScoreScheduleMatch(null)}
                        >
                          ✕
                        </button>
                      </div>

                      {/* Players & Sets Won Summary */}
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          marginBottom: '16px',
                          display: 'grid',
                          gridTemplateColumns: '1fr auto 1fr',
                          alignItems: 'center',
                          gap: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: '800', color: p1Won > p2Won ? '#4ade80' : '#f8fafc', fontSize: '14px' }}>
                            {p1?.name || 'Player 1'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Sets Won: <strong style={{ color: '#38bdf8' }}>{p1Won}</strong>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b' }}>VS</div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '800', color: p2Won > p1Won ? '#4ade80' : '#f8fafc', fontSize: '14px' }}>
                            {p2?.name || 'Player 2'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            Sets Won: <strong style={{ color: '#38bdf8' }}>{p2Won}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Sets Inputs */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                        {Array.from({ length: setsCount }, (_, i) => i + 1).map((sNum) => {
                          const keyA = `scoreSet${sNum}A`
                          const keyB = `scoreSet${sNum}B`
                          const valA = m[keyA] !== undefined ? m[keyA] : ''
                          const valB = m[keyB] !== undefined ? m[keyB] : ''

                          return (
                            <div
                              key={sNum}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.03)',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              <span style={{ fontWeight: '800', color: '#94a3b8', fontSize: '12.5px', width: '50px' }}>
                                Set {sNum}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={3}
                                  value={valA}
                                  placeholder="0"
                                  className="simple-score-input"
                                  style={{ width: '54px', height: '36px', fontSize: '16px', fontWeight: '800' }}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, '')
                                    const v = raw === '' ? '' : Math.min(maxPts, Number(raw))
                                    handleScoreChange(m, keyA, v)
                                    setQuickScoreScheduleMatch((prev) => ({ ...prev, [keyA]: v }))
                                  }}
                                />
                                <span style={{ color: '#64748b', fontWeight: '800' }}>-</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={3}
                                  value={valB}
                                  placeholder="0"
                                  className="simple-score-input"
                                  style={{ width: '54px', height: '36px', fontSize: '16px', fontWeight: '800' }}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, '')
                                    const v = raw === '' ? '' : Math.min(maxPts, Number(raw))
                                    handleScoreChange(m, keyB, v)
                                    setQuickScoreScheduleMatch((prev) => ({ ...prev, [keyB]: v }))
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Modal Footer Actions */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn-modal-cancel"
                          onClick={() => setQuickScoreScheduleMatch(null)}
                          style={{ flex: 1, padding: '9px 14px', borderRadius: '8px', fontSize: '13px' }}
                        >
                          Close
                        </button>
                        {!isLiveUmpireMode && (
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenScoresheet(m)
                              setQuickScoreScheduleMatch(null)
                            }}
                            style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#93c5fd',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: '8px',
                              padding: '9px 14px',
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            🖨️ Sheet
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-primary-gradient"
                          onClick={() => setQuickScoreScheduleMatch(null)}
                          style={{
                            flex: 1,
                            padding: '9px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                          }}
                        >
                          ✓ Save Score
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* =========================================================
              5. PLAYERS TAB & DESK REPORTING VIEW
             ========================================================= */}
          {viewMode === 'players' && (
            <div className="fixtures-players-container">
              {/* 1. Players Hero & Reporting Summary Header */}
              <div className="players-hero-card">
                <div className="players-hero-title-group">
                  <h3>
                    <span>👥</span>
                    <span>{formatCategoryName(selectedCategory)} Registered Players ({categoryPlayers.length})</span>
                  </h3>
                  <div className="players-hero-subtitle">
                    <span>Tournament: <strong>{formatTournamentName(selectedMatch?.matchName)}</strong></span>
                    <span>•</span>
                    <span>Category: <strong>{formatCategoryName(selectedCategory)}</strong></span>
                  </div>
                </div>

                {/* Reporting desk stats badge */}
                <div className="players-reporting-summary">
                  <span className="reporting-badge-icon">📋</span>
                  <div className="reporting-badge-info">
                    <span className="reporting-badge-count">
                      {reportedCount} / {categoryPlayers.length} Reported ({reportedPercent}%)
                    </span>
                    <span className="reporting-badge-label">
                      {pendingCount > 0 ? `${pendingCount} Players Pending Arrival` : '✓ All Players Reported at Desk'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Search & Reporting Actions Toolbar */}
              <div className="players-toolbar">
                <div className="players-search-box">
                  <span className="schedule-search-icon">🔍</span>
                  <input
                    type="text"
                    className="players-search-input"
                    placeholder="Search player name, seed (S1), place..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  />
                  {playerSearchQuery && (
                    <button
                      type="button"
                      className="schedule-search-clear"
                      onClick={() => setPlayerSearchQuery('')}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Reporting Status Filter Chips */}
                <div className="players-filter-chips">
                  <button
                    type="button"
                    className={`players-filter-chip ${playerReportingFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setPlayerReportingFilter('all')}
                  >
                    <span>All Players</span>
                    <span className="schedule-chip-count">{categoryPlayers.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`players-filter-chip reported ${playerReportingFilter === 'reported' ? 'active' : ''}`}
                    onClick={() => setPlayerReportingFilter('reported')}
                  >
                    <span>✓ Reported</span>
                    <span className="schedule-chip-count">{reportedCount}</span>
                  </button>

                  <button
                    type="button"
                    className={`players-filter-chip pending ${playerReportingFilter === 'pending' ? 'active' : ''}`}
                    onClick={() => setPlayerReportingFilter('pending')}
                  >
                    <span>⏳ Pending</span>
                    <span className="schedule-chip-count">{pendingCount}</span>
                  </button>
                </div>

                {/* Action Buttons (Organizer Only) */}
                {!isPublicView && (
                  <div className="players-actions-group">
                    <button
                      type="button"
                      onClick={() => handleMarkAllReported(true)}
                      className="btn-secondary-glow"
                      style={{ fontSize: '12px', padding: '7px 12px' }}
                      title="Mark all registered players in this category as reported"
                    >
                      ✓ Mark All Reported
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkAllReported(false)}
                      style={{
                        background: 'rgba(148, 163, 184, 0.15)',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        color: '#cbd5e1',
                        borderRadius: '8px',
                        padding: '7px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                      title="Reset reporting checkboxes"
                    >
                      ✕ Reset
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(!showQuickAdd)}
                      className="btn-primary-gradient"
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                    >
                      {showQuickAdd ? '✕ Close Quick Add' : '+ Quick Add Player'}
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Add Form Drawer (Organizer Only) */}
              {!isPublicView && showQuickAdd && (
                <form onSubmit={handleQuickAddPlayer} className="quick-add-form">
                  <div className="form-row-grid">
                    {isDoublesCategory(selectedCategory) ? (
                      <>
                        <input
                          type="text"
                          placeholder="👤 Player 1 Name *"
                          value={quickPlayer1Name}
                          onChange={(e) => setQuickPlayer1Name(e.target.value)}
                          required
                        />
                        <input
                          type="text"
                          placeholder="👥 Player 2 Name (Partner) *"
                          value={quickPlayer2Name}
                          onChange={(e) => setQuickPlayer2Name(e.target.value)}
                          required
                        />
                      </>
                    ) : (
                      <input
                        type="text"
                        placeholder="Player Name *"
                        value={quickPlayerName}
                        onChange={(e) => setQuickPlayerName(e.target.value)}
                        required
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Place / Club (Optional)"
                      value={quickPlayerPlace}
                      onChange={(e) => setQuickPlayerPlace(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Court (Optional)"
                      value={quickPlayerCourt}
                      onChange={(e) => setQuickPlayerCourt(e.target.value)}
                    />
                    <button type="submit" className="btn-primary-gradient">
                      {isDoublesCategory(selectedCategory) ? '+ Add Doubles Pair' : 'Add to Category'}
                    </button>
                  </div>
                </form>
              )}

              {/* 3. Players Table with Reporting Tick Box */}
              <div className="players-table-wrap">
                {filteredCategoryPlayers.length === 0 ? (
                  <div className="schedule-empty-state">
                    <div className="schedule-empty-icon">👥</div>
                    <h4>No Players Found</h4>
                    <p>
                      {playerSearchQuery
                        ? `No players match "${playerSearchQuery}". Try changing or clearing your search filter.`
                        : 'No players found under the selected reporting status.'}
                    </p>
                  </div>
                ) : (
                  <table className="players-table">
                    <thead>
                      <tr>
                        <th style={{ width: '45px' }}>#</th>
                        <th style={{ width: '160px' }}>Reporting Desk</th>
                        <th>Player Name</th>
                        <th>Place / Club</th>
                        <th>Court</th>
                        <th>Category</th>
                        {!isPublicView && <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategoryPlayers.map((player, idx) => {
                        const isReported = isPlayerReported(player)

                        return (
                          <tr
                            key={player.id || idx}
                            className={isReported ? 'player-row-reported' : ''}
                          >
                            <td style={{ color: '#94a3b8', fontWeight: '700' }}>{idx + 1}</td>

                            {/* Reporting Column with Tick Box & Status Badge */}
                            <td>
                              <div
                                className="reporting-tick-container"
                                onClick={isPublicView ? undefined : () => togglePlayerReporting(player)}
                                style={isPublicView ? { cursor: 'default' } : undefined}
                                title={isPublicView ? (isReported ? 'Reported at Desk' : 'Pending Reporting') : 'Click to toggle reporting status'}
                              >
                                <div className={`reporting-custom-checkbox ${isReported ? 'checked' : ''}`} style={isPublicView ? { pointerEvents: 'none' } : undefined}>
                                  {isReported && '✓'}
                                </div>
                                <span className={`reporting-status-pill ${isReported ? 'reported' : 'pending'}`}>
                                  {isReported ? '✓ Reported' : '⏳ Pending'}
                                </span>
                              </div>
                            </td>

                            {/* Player Name Column */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {Boolean(player.seed || player.isSeed) && (
                                  <span className="official-seed-pill" title={`Seed #${player.seed}`}>
                                    S{player.seed || ''}
                                  </span>
                                )}

                                <strong style={{ color: isReported ? '#4ade80' : '#f8fafc', fontSize: '13.5px' }}>
                                  {formatPersonName(player.name)}
                                </strong>

                                {isReported && (
                                  <span style={{ color: '#10b981', fontWeight: '800', fontSize: '12px' }} title="Reported at desk">
                                    ✓
                                  </span>
                                )}
                              </div>
                            </td>

                            <td>{formatPlaceOrClub(player.place)}</td>
                            <td>{formatCourtName(player.court, '')}</td>
                            <td>
                              <span className="category-pill-tag">{formatCategoryName(selectedCategory)}</span>
                            </td>
                            {!isPublicView && (
                              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditDeskPlayer(player)}
                                    style={{
                                      padding: '5px 12px',
                                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%)',
                                      border: '1px solid rgba(96, 165, 250, 0.5)',
                                      color: '#93c5fd',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title="Modify player or doubles pair details"
                                  >
                                    ✏️ Modify
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to remove "${player.name}" from ${selectedCategory}?`)) {
                                        if (onDeleteParticipant) {
                                          onDeleteParticipant(selectedMatch.id, player.id || player.name)
                                        }
                                        setSwapToast(`✓ Removed "${player.name}" from ${selectedCategory}!`)
                                        setTimeout(() => setSwapToast(null), 3000)
                                      }
                                    }}
                                    style={{
                                      padding: '5px 10px',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.4)',
                                      color: '#fca5a5',
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title="Delete player from tournament category"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Seeding & Draw Generator Modal */}
      <FixtureSeedingModal
        isOpen={isSeedingModalOpen}
        onClose={() => setIsSeedingModalOpen(false)}
        match={selectedMatch}
        authenticators={authenticators}
        initialCategory={selectedCategory}
        existingDraw={currentDraw}
        availablePlayers={categoryPlayers}
        onGenerate={handleGenerateDrawWithConfig}
      />

      {/* Tap-to-Exchange Player Position Modal with Search Bar (Admin Only) */}
      {!isPublicView && exchangeModalSource && (() => {
        const sourcePlayer = exchangeModalSource.player
        const sourceLine = exchangeModalSource.lineNum
        const cleanQuery = exchangeSearchQuery.trim().toLowerCase()

        const eligibleTargetSlots = allRound1Slots.filter((s) => {
          // Exclude source slot itself
          if (s.matchId === exchangeModalSource.matchId && s.slotKey === exchangeModalSource.slotKey) {
            return false
          }

          // STRICTLY EXCLUDE ALL BYE SLOTS! Only show real players
          if (!s.player || s.player.isBye || s.player.name === 'BYE') {
            return false
          }

          if (!cleanQuery) return true

          const p = s.player
          const name = p?.name ? p.name.toLowerCase() : ''
          const place = p?.place ? p.place.toLowerCase() : ''
          const lineStr = String(s.lineNum)
          const seedStr = p?.seed ? `s${p.seed}` : ''

          return (
            name.includes(cleanQuery) ||
            place.includes(cleanQuery) ||
            lineStr === cleanQuery ||
            lineStr.includes(cleanQuery) ||
            seedStr.includes(cleanQuery)
          )
        })

        return (
          <div
            className="exchange-modal-backdrop"
            onClick={() => setExchangeModalSource(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(3, 7, 18, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
          >
            <div
              className="exchange-modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '460px',
                maxWidth: '95vw',
                maxHeight: '88vh',
                background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                border: '1.5px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '20px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                  background: 'rgba(15, 23, 42, 0.6)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>⇄</span>
                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '16px', fontWeight: '800' }}>
                      Exchange Player Position
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExchangeModalSource(null)}
                    style={{
                      background: 'rgba(148, 163, 184, 0.15)',
                      border: 'none',
                      color: '#94a3b8',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '700',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Selected Source Player Card */}
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Line {sourceLine}
                    </span>
                    <div>
                      <div style={{ color: '#ffffff', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {Boolean(sourcePlayer?.seed || sourcePlayer?.isSeed) && (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: '900',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            S{sourcePlayer.seed}
                          </span>
                        )}
                        <span>{sourcePlayer ? (sourcePlayer.isBye ? 'BYE' : sourcePlayer.name) : 'TBD'}</span>
                      </div>
                      {Boolean(sourcePlayer?.place || sourcePlayer?.court) && (
                        <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '1px', fontWeight: '600' }}>
                          {[sourcePlayer.place, sourcePlayer.court].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '700' }}>
                    Currently Selected
                  </span>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '14px 20px 8px 20px' }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      pointerEvents: 'none',
                    }}
                  >
                    🔍
                  </span>
                  <input
                    type="text"
                    value={exchangeSearchQuery}
                    onChange={(e) => setExchangeSearchQuery(e.target.value)}
                    placeholder="Search player name, academy or line number..."
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1.5px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      padding: '10px 36px 10px 36px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease',
                    }}
                  />
                  {exchangeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setExchangeSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '12px',
                        padding: '4px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px', fontWeight: '600' }}>
                  Choose which player or slot to swap Line {sourceLine} with:
                </div>
              </div>

              {/* Scrollable Player Slots List */}
              <div
                style={{
                  padding: '8px 20px 16px 20px',
                  overflowY: 'auto',
                  maxHeight: '42vh',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {eligibleTargetSlots.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '30px 10px',
                      color: '#94a3b8',
                      fontSize: '13px',
                    }}
                  >
                    No matching player or slot found for &ldquo;{exchangeSearchQuery}&rdquo;
                  </div>
                ) : (
                  eligibleTargetSlots.map((targetSlot) => {
                    const tp = targetSlot.player
                    const isBye = Boolean(tp?.isBye)
                    const isSeed = Boolean(tp?.seed || tp?.isSeed)

                    return (
                      <div
                        key={`${targetSlot.matchId}-${targetSlot.slotKey}`}
                        onClick={() => {
                          handleSwapPlayers(exchangeModalSource, {
                            matchId: targetSlot.matchId,
                            slotKey: targetSlot.slotKey,
                            lineNum: targetSlot.lineNum,
                          })
                          setExchangeModalSource(null)
                          setExchangeSearchQuery('')
                        }}
                        style={{
                          background: 'rgba(30, 41, 59, 0.65)',
                          border: '1px solid rgba(148, 163, 184, 0.15)',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          gap: '10px',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)'
                          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span
                            style={{
                              background: 'rgba(148, 163, 184, 0.2)',
                              color: '#cbd5e1',
                              fontWeight: '800',
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              flexShrink: 0,
                            }}
                          >
                            Line {targetSlot.lineNum}
                          </span>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {isSeed && (
                                <span
                                  style={{
                                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                    color: '#ffffff',
                                    fontSize: '9.5px',
                                    fontWeight: '900',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  S{tp.seed}
                                </span>
                              )}
                              <span
                                style={{
                                  color: isBye ? '#94a3b8' : '#f8fafc',
                                  fontWeight: '700',
                                  fontSize: '13px',
                                  fontStyle: isBye ? 'italic' : 'normal',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {tp ? (isBye ? 'BYE' : tp.name) : 'TBD'}
                              </span>
                            </div>

                            {Boolean(tp?.place || tp?.court) && (
                              <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '1px', fontWeight: '600' }}>
                                {[tp.place, tp.court].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          style={{
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#38bdf8',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>⇄</span>
                          <span>Swap</span>
                        </button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const targetM = exchangeModalSource.match
                    setExchangeModalSource(null)
                    setViewingMatchDetails(targetM)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  📊 View Match Scorecard & Status
                </button>

                <button
                  type="button"
                  onClick={() => setExchangeModalSource(null)}
                  style={{
                    background: 'rgba(148, 163, 184, 0.2)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#cbd5e1',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Dedicated Modify Player / Doubles Pair Modal in Players Desk (Admin Only) */}
      {!isPublicView && editingDeskPlayer && (() => {
        const targetCat = deskEditForm.category || selectedCategory
        const isDoubles = isDoublesCategory(targetCat)
        const isFormValid = isDoubles
          ? Boolean((deskEditForm.name1?.trim() && deskEditForm.name2?.trim()) || deskEditForm.name?.trim())
          : Boolean(deskEditForm.name?.trim() || deskEditForm.name1?.trim())

        return (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5, 10, 20, 0.85)',
              backdropFilter: 'blur(10px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflowY: 'auto',
            }}
            onClick={() => setEditingDeskPlayer(null)}
          >
            <div
              className="modal-content"
              style={{
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 29, 0.98) 100%)',
                border: isDoubles ? '1.5px solid rgba(168, 85, 247, 0.5)' : '1.5px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: isDoubles
                  ? '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 85, 247, 0.2)'
                  : '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.2)',
                color: '#f8fafc',
                padding: '24px 28px',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.2s ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: isDoubles ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      border: isDoubles ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)',
                      color: isDoubles ? '#d8b4fe' : '#93c5fd',
                      fontSize: '11px',
                      fontWeight: '800',
                      letterSpacing: '0.06em',
                      marginBottom: '6px',
                    }}
                  >
                    {isDoubles ? '👥 DOUBLES PAIR MODIFICATION' : '👤 PLAYER MODIFICATION'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#f8fafc' }}>
                    {isDoubles ? 'Modify Doubles Pair' : 'Modify Player Details'}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    {isDoubles
                      ? 'Update Player 1 and Player 2 (Partner) names. Both will be saved and reflected in the draw.'
                      : 'Update participant name, court, or place.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingDeskPlayer(null)}
                  style={{
                    background: 'rgba(148, 163, 184, 0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '700',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEditDeskPlayer}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '22px' }}>
                  {isDoubles ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <label>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#60a5fa', marginBottom: '6px' }}>
                          👤 Player 1 Name *
                        </span>
                        <input
                          type="text"
                          required
                          value={deskEditForm.name1}
                          onChange={(e) => {
                            const val = e.target.value
                            setDeskEditForm((prev) => ({
                              ...prev,
                              name1: val,
                              name: joinDoublesNames(val, prev.name2),
                            }))
                          }}
                          placeholder="e.g. Player 1"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: !deskEditForm.name1?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                            color: '#f8fafc',
                            fontSize: '13.5px',
                            fontWeight: '600',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      </label>

                      <label>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#c084fc', marginBottom: '6px' }}>
                          👥 Player 2 Name (Partner) *
                        </span>
                        <input
                          type="text"
                          required
                          value={deskEditForm.name2}
                          onChange={(e) => {
                            const val = e.target.value
                            setDeskEditForm((prev) => ({
                              ...prev,
                              name2: val,
                              name: joinDoublesNames(prev.name1, val),
                            }))
                          }}
                          placeholder="e.g. Partner Name"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: !deskEditForm.name2?.trim() ? '1px solid rgba(192, 132, 252, 0.3)' : '1.5px solid rgba(168, 85, 247, 0.8)',
                            color: '#f8fafc',
                            fontSize: '13.5px',
                            fontWeight: '600',
                            boxSizing: 'border-box',
                            outline: 'none',
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <label>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                        👤 Player Name *
                      </span>
                      <input
                        type="text"
                        required
                        value={deskEditForm.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setDeskEditForm((prev) => ({
                            ...prev,
                            name: val,
                            name1: val,
                            name2: '',
                          }))
                        }}
                        placeholder="Player Name"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: !deskEditForm.name?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                          color: '#f8fafc',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </label>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <label>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                        Court Name (Optional)
                      </span>
                      <input
                        type="text"
                        value={deskEditForm.court}
                        onChange={(e) => setDeskEditForm((prev) => ({ ...prev, court: e.target.value }))}
                        placeholder="e.g. Court 1"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          color: '#f8fafc',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </label>

                    <label>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                        Place / Club (Optional)
                      </span>
                      <input
                        type="text"
                        value={deskEditForm.place}
                        onChange={(e) => setDeskEditForm((prev) => ({ ...prev, place: e.target.value }))}
                        placeholder="e.g. Chennai"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          color: '#f8fafc',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingDeskPlayer(null)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      background: 'rgba(148, 163, 184, 0.15)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      color: '#cbd5e1',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!isFormValid}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '10px',
                      background: isFormValid
                        ? (isDoubles
                          ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                        : 'rgba(100, 116, 139, 0.3)',
                      border: 'none',
                      color: isFormValid ? '#ffffff' : '#64748b',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: isFormValid ? 'pointer' : 'not-allowed',
                      boxShadow: isFormValid
                        ? (isDoubles ? '0 4px 16px rgba(168, 85, 247, 0.4)' : '0 4px 16px rgba(59, 130, 246, 0.4)')
                        : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    💾 Save & Update {isDoubles ? 'Doubles Pair' : 'Player'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {/* ==================================================================== */}
      {/* ASSIGN OFFICIAL UMPIRE & START LIVE MATCH MODAL (Admin Only)         */}
      {/* ==================================================================== */}
      {!isPublicView && assigningLiveMatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
          onClick={() => setAssigningLiveMatch(null)}
        >
          <div
            style={{
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              border: '1.5px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.35), 0 0 40px rgba(0, 0, 0, 0.8)',
              color: '#f8fafc',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="live-pulse-dot" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Live Court Match Initialization
                  </span>
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
                  Assign Official Umpire & Start Live
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssigningLiveMatch(null)}
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Match Summary Card */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '14px',
                padding: '14px 16px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                <span style={{ fontWeight: '800', color: '#38bdf8' }}>Match #{assigningLiveMatch.matchNumber} • {assigningLiveMatch.roundName || 'Knockout Round'}</span>
                <span>{selectedCategory}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px', color: '#ffffff' }}>
                <span style={{ color: '#60a5fa' }}>{assigningLiveMatch.player1?.name || 'Player 1'}</span>
                <span style={{ fontSize: '12px', color: '#64748b', padding: '0 8px' }}>VS</span>
                <span style={{ color: '#f43f5e' }}>{assigningLiveMatch.player2?.name || 'Player 2'}</span>
              </div>
            </div>

            {/* Court Selection */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  🏸 Select Match Court ({configuredCourts.length} Available):
                </label>
                <button
                  type="button"
                  onClick={() => setIsCourtConfigModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                >
                  ⚙️ Edit Courts
                </button>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, configuredCourts.length))}, 1fr)`,
                  gap: '8px',
                  maxHeight: '140px',
                  overflowY: 'auto',
                }}
              >
                {configuredCourts.map((court) => (
                  <button
                    key={court}
                    type="button"
                    onClick={() => setSelectedLiveCourt(court)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: selectedLiveCourt === court ? 'rgba(59, 130, 246, 0.35)' : 'rgba(15, 23, 42, 0.6)',
                      border: selectedLiveCourt === court ? '2px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                      color: selectedLiveCourt === court ? '#ffffff' : '#94a3b8',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: selectedLiveCourt === court ? '0 0 10px rgba(56, 189, 248, 0.35)' : 'none',
                    }}
                  >
                    {court}
                  </button>
                ))}
              </div>
            </div>

            {/* Umpire Selection Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  👤 Select Official Umpire Login ({availableUmpiresList.length} Available):
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCreateUmpire(!isQuickCreateUmpire)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {isQuickCreateUmpire ? '← Choose From Available Umpires' : '➕ Create New Umpire'}
                </button>
              </div>

              {!isQuickCreateUmpire ? (
                <>
                  {/* Search Filter for Umpires if > 4 */}
                  {availableUmpiresList.length > 4 && (
                    <div style={{ marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={umpireSearchQuery}
                        onChange={(e) => setUmpireSearchQuery(e.target.value)}
                        placeholder="🔍 Search umpire by name, username, or court..."
                        style={{
                          width: '100%',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          color: '#fff',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  {availableUmpiresList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '2px' }}>
                      {availableUmpiresList
                        .filter((umpire) => {
                          if (!umpireSearchQuery.trim()) return true
                          const q = umpireSearchQuery.toLowerCase()
                          const name = (umpire.authName || umpire.name || '').toLowerCase()
                          const user = (umpire.username || '').toLowerCase()
                          const court = (umpire.assignedCourt || umpire.courtName || '').toLowerCase()
                          return name.includes(q) || user.includes(q) || court.includes(q)
                        })
                        .map((umpire) => {
                          const isSelected = selectedUmpireUsername === umpire.username
                          return (
                            <div
                              key={umpire.username || umpire.id}
                              onClick={() => {
                                setSelectedUmpireUsername(umpire.username)
                                if (umpire.assignedCourt && umpire.assignedCourt !== 'All Courts') {
                                  setSelectedLiveCourt(umpire.assignedCourt)
                                } else if (umpire.courtName && umpire.courtName !== 'Main Stadium' && umpire.courtName !== 'All Courts') {
                                  setSelectedLiveCourt(umpire.courtName)
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: isSelected ? 'rgba(59, 130, 246, 0.22)' : 'rgba(15, 23, 42, 0.5)',
                                border: isSelected ? '2px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    border: isSelected ? '5px solid #3b82f6' : '2px solid #64748b',
                                    background: '#0f172a',
                                    flexShrink: 0,
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: '800', color: isSelected ? '#ffffff' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {umpire.authName || umpire.name || 'Official Umpire'}
                                    {umpire.expiry === 'Permanent' && (
                                      <span style={{ fontSize: '9.5px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
                                        Official
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    Username: <code style={{ color: '#38bdf8', fontWeight: '700' }}>{umpire.username}</code> • Pass: <code style={{ color: '#94a3b8' }}>{umpire.password || '••••'}</code>
                                  </div>
                                </div>
                              </div>
                              {umpire.assignedCourt && (
                                <span style={{ fontSize: '10px', fontWeight: '700', background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(148, 163, 184, 0.15)', padding: '3px 8px', borderRadius: '5px', color: isSelected ? '#93c5fd' : '#94a3b8', border: isSelected ? '1px solid #3b82f6' : 'none' }}>
                                  {umpire.assignedCourt}
                                </span>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '10px', border: '1px dashed rgba(148, 163, 184, 0.3)' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#94a3b8' }}>
                        No umpire logins available. Click below to create one instantly!
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsQuickCreateUmpire(true)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: '800',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        ➕ Quick Create Umpire
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Quick Create Umpire Box */
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1.5px solid rgba(56, 189, 248, 0.4)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px', color: '#38bdf8', fontWeight: '800' }}>
                    ⚡ Instant Umpire Credential Setup:
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>Umpire Official Name:</label>
                    <input
                      type="text"
                      value={quickUmpireName}
                      onChange={(e) => setQuickUmpireName(e.target.value)}
                      placeholder="e.g. Court 1 Umpire"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>Username:</label>
                      <input
                        type="text"
                        value={quickUmpireUser}
                        onChange={(e) => setQuickUmpireUser(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', color: '#38bdf8', fontWeight: '800', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>Password:</label>
                      <input
                        type="text"
                        value={quickUmpirePass}
                        onChange={(e) => setQuickUmpirePass(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.3)', color: '#4ade80', fontWeight: '800', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                disabled={!isQuickCreateUmpire && !selectedUmpireUsername && availableUmpiresList.length === 0}
                onClick={() => handleConfirmStartLiveMatch(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '900',
                  fontSize: '14px',
                  cursor: (!isQuickCreateUmpire && !selectedUmpireUsername && availableUmpiresList.length === 0) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(239, 68, 68, 0.45)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span className="live-pulse-dot" style={{ width: '8px', height: '8px', background: '#ffffff' }} />
                <span>🚀 Launch Live</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigningLiveMatch(null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#94a3b8',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Match Breakdown Details & Quick Scoring Popup Modal */}
      {viewingMatchDetails && (() => {
        const liveMatch = (currentDraw?.matches || []).find((m) => m.id === viewingMatchDetails.id) || viewingMatchDetails
        const p1 = liveMatch.player1
        const p2 = liveMatch.player2
        const isP1Winner = liveMatch.winner?.id === p1?.id || liveMatch.winner === 'player1'
        const isP2Winner = liveMatch.winner?.id === p2?.id || liveMatch.winner === 'player2'
        const maxPts = Number(liveMatch.matchPoints || matchTotalPoints) || 30
        const totalSets = Number(liveMatch.matchSets || (
          liveMatch.status === 'completed'
            ? Math.max(
                (liveMatch.scoreSet5A || liveMatch.scoreSet5B) ? 5 :
                (liveMatch.scoreSet4A || liveMatch.scoreSet4B) ? 4 :
                (liveMatch.scoreSet3A || liveMatch.scoreSet3B) ? 3 :
                (liveMatch.scoreSet2A || liveMatch.scoreSet2B) ? 2 :
                1,
                liveMatch.matchSets || 1
              )
            : matchTotalSets
        )) || 3
        const setsArr = Array.from({ length: totalSets }, (_, i) => i + 1)
        const isByeMatch = p1?.isBye || p2?.isBye

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2, 6, 23, 0.88)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '16px',
            }}
            onClick={() => setViewingMatchDetails(null)}
          >
            <div
              style={{
                background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '20px',
                maxWidth: '620px',
                width: '100%',
                padding: '24px',
                boxShadow: '0 25px 60px -15px rgba(56, 189, 248, 0.3), 0 0 40px rgba(0, 0, 0, 0.85)',
                color: '#f8fafc',
                position: 'relative',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                      Match #{liveMatch.matchNumber || liveMatch.id}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: '700' }}>
                      {liveMatch.roundName || (liveMatch.round ? `Round ${liveMatch.round}` : 'Knockout Round')}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>•</span>
                    <span style={{ fontSize: '11.5px', color: '#a78bfa', fontWeight: '700' }}>
                      {selectedCategory}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>🏸 {liveMatch.court || selectedMatch?.courtName || 'Court 1'}</span>
                    {liveMatch.time && <span>⏰ {format12HourTime(liveMatch.time)}</span>}
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        background: liveMatch.status === 'live' ? 'rgba(239, 68, 68, 0.2)' : liveMatch.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: liveMatch.status === 'live' ? '#f87171' : liveMatch.status === 'completed' ? '#4ade80' : '#60a5fa',
                        border: `1px solid ${liveMatch.status === 'live' ? 'rgba(239, 68, 68, 0.4)' : liveMatch.status === 'completed' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                      }}
                    >
                      {liveMatch.status === 'live' ? '🔴 LIVE ON COURT' : liveMatch.status === 'completed' ? '🏆 COMPLETED' : '🔵 SCHEDULED'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingMatchDetails(null)}
                  style={{
                    background: 'rgba(148, 163, 184, 0.1)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '10px',
                    color: '#94a3b8',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Player 1 vs Player 2 Comparison Card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '16px', padding: '16px', marginBottom: '18px' }}>
                {/* Player 1 */}
                <div style={{ textAlign: 'center', padding: '10px', borderRadius: '12px', background: isP1Winner ? 'rgba(34, 197, 94, 0.15)' : 'rgba(30, 41, 59, 0.5)', border: isP1Winner ? '1.5px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.1)' }}>
                  {p1?.seed && (
                    <span style={{ fontSize: '10px', fontWeight: '900', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>
                      Seed {p1.seed}
                    </span>
                  )}
                  <div style={{ fontSize: '15px', fontWeight: '800', color: isP1Winner ? '#4ade80' : '#60a5fa' }}>
                    {p1 ? (p1.isBye ? 'BYE' : p1.name) : 'TBD'}
                  </div>
                  {Boolean(p1?.place || p1?.court) && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                      {[p1.place, p1.court].filter(Boolean).join(' • ')}
                    </div>
                  )}
                  {isP1Winner && (
                    <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '800', marginTop: '6px' }}>
                      👑 WINNER
                    </div>
                  )}
                </div>

                {/* VS Badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.15)', border: '1.5px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '900', color: '#38bdf8' }}>
                    VS
                  </div>
                </div>

                {/* Player 2 */}
                <div style={{ textAlign: 'center', padding: '10px', borderRadius: '12px', background: isP2Winner ? 'rgba(34, 197, 94, 0.15)' : 'rgba(30, 41, 59, 0.5)', border: isP2Winner ? '1.5px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.1)' }}>
                  {p2?.seed && (
                    <span style={{ fontSize: '10px', fontWeight: '900', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>
                      Seed {p2.seed}
                    </span>
                  )}
                  <div style={{ fontSize: '15px', fontWeight: '800', color: isP2Winner ? '#4ade80' : '#f43f5e' }}>
                    {p2 ? (p2.isBye ? 'BYE' : p2.name) : 'TBD'}
                  </div>
                  {Boolean(p2?.place || p2?.court) && (
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                      {[p2.place, p2.court].filter(Boolean).join(' • ')}
                    </div>
                  )}
                  {isP2Winner && (
                    <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: '800', marginTop: '6px' }}>
                      👑 WINNER
                    </div>
                  )}
                </div>
              </div>

              {/* Set Scores Breakdown & Quick Entry */}
              {!isByeMatch && p1 && p2 && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '14px', padding: '14px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      📊 Match Sets Scores (Max {maxPts} Points):
                    </div>
                    {!isPublicView && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {['scheduled', 'live', 'completed'].map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateMatch(liveMatch.id, { status: st })}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              background: liveMatch.status === st ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${totalSets}, 1fr)`, gap: '10px' }}>
                    {setsArr.map((setNum) => {
                      const keyA = `scoreSet${setNum}A`
                      const keyB = `scoreSet${setNum}B`
                      const valA = Number(liveMatch[keyA]) || 0
                      const valB = Number(liveMatch[keyB]) || 0

                      return (
                        <div
                          key={setNum}
                          style={{
                            background: 'rgba(30, 41, 59, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '10px',
                            padding: '10px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '800', marginBottom: '8px' }}>
                            SET {setNum}
                          </div>
                          {!isPublicView ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
                                <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(liveMatch, keyA, Math.max(0, valA - 1))}>-</button>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxPts}
                                  value={liveMatch[keyA] !== undefined ? liveMatch[keyA] : ''}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    if (raw === '') handleScoreChange(liveMatch, keyA, '')
                                    else handleScoreChange(liveMatch, keyA, Math.max(0, Math.min(maxPts, Number(raw))))
                                  }}
                                  placeholder="0"
                                  style={{ width: '42px', padding: '4px', textAlign: 'center', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', color: '#60a5fa', fontWeight: '800', fontSize: '13px' }}
                                />
                                <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(liveMatch, keyA, Math.min(maxPts, valA + 1))}>+</button>
                              </div>
                              <div style={{ fontSize: '9px', color: '#64748b', margin: '2px 0' }}>vs</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(liveMatch, keyB, Math.max(0, valB - 1))}>-</button>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxPts}
                                  value={liveMatch[keyB] !== undefined ? liveMatch[keyB] : ''}
                                  onChange={(e) => {
                                    const raw = e.target.value
                                    if (raw === '') handleScoreChange(liveMatch, keyB, '')
                                    else handleScoreChange(liveMatch, keyB, Math.max(0, Math.min(maxPts, Number(raw))))
                                  }}
                                  placeholder="0"
                                  style={{ width: '42px', padding: '4px', textAlign: 'center', background: '#0f172a', border: '1px solid #f43f5e', borderRadius: '6px', color: '#f43f5e', fontWeight: '800', fontSize: '13px' }}
                                />
                                <button type="button" className="pro-stepper-btn" onClick={() => handleScoreChange(liveMatch, keyB, Math.min(maxPts, valB + 1))}>+</button>
                              </div>
                            </>
                          ) : (
                            <div style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc', padding: '8px 0' }}>
                              <span style={{ color: '#60a5fa' }}>{liveMatch[keyA] !== undefined && liveMatch[keyA] !== '' ? liveMatch[keyA] : '-'}</span>
                              <span style={{ color: '#64748b', margin: '0 6px' }}>-</span>
                              <span style={{ color: '#f43f5e' }}>{liveMatch[keyB] !== undefined && liveMatch[keyB] !== '' ? liveMatch[keyB] : '-'}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '16px' }}>
                {!isPublicView && !isByeMatch && p1 && p2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingMatchDetails(null)
                      handlePromptStartLive(liveMatch)
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: '800',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <span>🚀 Launch to Live Scoring</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    handleOpenScoresheet(liveMatch)
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontWeight: '800',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🖨️ Print Scoresheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingMatchDetails(null)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    background: 'rgba(148, 163, 184, 0.1)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    color: '#94a3b8',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Official Match Scoresheet Printable Modal */}
      <MatchScoresheetModal
        isOpen={!!scoresheetMatch}
        onClose={() => setScoresheetMatch(null)}
        onPrint={handleScoresheetPrinted}
        match={scoresheetMatch}
        tournament={selectedMatch}
        category={selectedCategory}
      />

      {/* Master Tournament Multi-Category Scheduling Modal */}
      <TournamentMasterScheduleModal
        isOpen={isMasterScheduleModalOpen}
        onClose={() => {
          setIsMasterScheduleModalOpen(false)
          setSchedulingTournament(null)
        }}
        tournament={schedulingTournament || selectedMatch}
        categories={
          schedulingTournament
            ? (schedulingTournament.categories || (schedulingTournament.category ? [schedulingTournament.category] : DEFAULT_CATEGORIES))
            : categories
        }
        allCategoryDraws={getAllCategoryDrawsForTournament(schedulingTournament || selectedMatch)}
        onSaveMasterSchedule={handleSaveMasterSchedule}
      />

      {/* Fullscreen Stadium TV Live Cast Screen */}
      {isStadiumTvCastOpen && (
        <StadiumTvLiveCast
          tournament={selectedMatch || publishedMatches[0]}
          allTournaments={publishedMatches}
          onClose={() => setIsStadiumTvCastOpen(false)}
        />
      )}

      {/* Sponsor Advertisement Manager Modal */}
      <StadiumAdManagerModal
        isOpen={isAdModalOpen}
        onClose={() => setIsAdModalOpen(false)}
        ads={sponsorAds}
        onSaveAds={handleSaveAds}
        adSettings={adSettings}
        onSaveSettings={handleSaveAdSettings}
      />

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
