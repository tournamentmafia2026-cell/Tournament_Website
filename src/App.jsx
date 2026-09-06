import { useState, useEffect, useRef, useMemo } from 'react'
import { BadmintonFixturesManager } from './components/BadmintonFixturesManager'
import { BadmintonLoginsPage } from './components/BadmintonLoginsPage'
import { OrganizerAuthModal } from './components/OrganizerAuthModal'
import { UmpireLiveScoringDashboard } from './components/UmpireLiveScoringDashboard'
import { FixtureSeedingModal } from './components/FixtureSeedingModal'
import { MatchEditModal } from './components/MatchEditModal'
import { TournamentResultsModal } from './components/TournamentResultsModal'
import { StadiumTvLiveCast } from './components/StadiumTvLiveCast'
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal'
import { PublicSponsorShowcase } from './components/PublicSponsorShowcase'
import { generateBadmintonDraw } from './utils/badmintonDrawEngine'
import { getSavedCourtConfig, saveCourtConfig, generateCourtsList } from './utils/courtConfig'
import { SupabaseService } from './utils/supabaseDb'
import {
  BadmintonDatePicker,
  getTodayDateString,
  addDaysToDateString,
} from './components/BadmintonDatePicker'
import initialBadmintonDb from '../data/badminton_db.json'

const STORAGE_KEY = 'badminton-published-matches'
const AUTH_STORAGE_KEY = 'badminton-authenticators'

import {
  BADMINTON_CATEGORIES,
  CATEGORY_FILTER_GROUPS,
  isCategoryInGroup,
  matchesCategorySearch,
  isDoublesCategory,
} from './utils/badmintonCategories'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatPlaceOrClub,
  formatCategoryName,
  sanitizeTournament,
  sanitizeParticipant,
  getMatchStatus,
  splitDoublesNames,
  joinDoublesNames,
  compareTournamentsChronological,
  compareTournamentsRecentCompleted,
} from './utils/textFormatters'

const getInitialFormData = () => {
  const today = getTodayDateString()
  const defaultDays = 3
  return {
    matchName: '',
    matchAddress: '',
    courtName: 'Court 1',
    categories: ['Men Singles', 'Women Singles'],
    startDate: today,
    endDate: addDaysToDateString(today, defaultDays - 1),
    totalDays: defaultDays,
    organizerName: '',
    organizerMobile: '',
    image: '',
  }
}

const initialFormData = getInitialFormData()

const formatDisplayDate = (dateString) => {
  if (!dateString) return 'Date'

  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const calculateMatchDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0

  const diffInDays = Math.round((end - start) / (1000 * 60 * 60 * 24))
  return diffInDays >= 0 ? diffInDays + 1 : 0
}

const getMatchDateLabel = (match) => {
  const start = match?.startDate ? formatDisplayDate(match.startDate) : 'Date'
  const end = match?.endDate ? formatDisplayDate(match.endDate) : 'Date'
  const duration = match?.matchDuration ?? calculateMatchDuration(match?.startDate, match?.endDate)

  if (!match?.startDate || !match?.endDate) {
    return `${start} to ${end}`
  }

  return `${start} to ${end} • ${duration} days`
}

const getMatchCategories = (match) => {
  if (!match || !Array.isArray(match.categories)) {
    return ['Men Singles', 'Women Singles']
  }

  const validCategories = match.categories.filter((category) =>
    typeof category === 'string' && category.trim().length > 0
  )

  return validCategories.length > 0 ? validCategories : ['Men Singles', 'Women Singles']
}

const normalizeParticipant = (participant, fallbackCategory) => ({
  ...participant,
  category: participant?.category || fallbackCategory || 'Men Singles',
})

const generateAutoFixtures = (match, category, participants) => {
  if (!match || !category) return []

  const categoryParticipants = (participants || []).filter(
    (participant) => (participant.category || 'Men Singles') === category
  )

  if (categoryParticipants.length === 0) return []

  const playerNames = categoryParticipants.map((participant) => participant.name?.trim() || 'No-name')
  const fixtures = []

  for (let index = 0; index < playerNames.length; index += 2) {
    const firstPlayer = playerNames[index]
    const secondPlayer = playerNames[index + 1] || 'Bye'

    fixtures.push({
      id: `${match.id}-${category}-${index}`,
      round: `Fixture ${Math.floor(index / 2) + 1}`,
      players: [firstPlayer, secondPlayer],
      court: match.courtName || 'Court 1',
      venue: match.matchAddress || 'Venue',
    })
  }

  return fixtures
}

function getStoredInitialFixtures(matchId, category) {
  const defaultKey = `${matchId}-${category}`
  let fixtures = []
  try {
    const raw = localStorage.getItem('badminton-tournament-draws')
    if (raw) {
      const parsed = JSON.parse(raw)
      fixtures = parsed[defaultKey] || []
    }
  } catch (e) {
    fixtures = []
  }
  return fixtures
}

const getFixtureStorageKey = (matchId, categoryName) => `${matchId}-${categoryName}`

function App() {
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-organizer-session')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [authOpen, setAuthOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-organizer-session')
      return Boolean(saved)
    } catch {
      return false
    }
  })
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [publicMenuOpen, setPublicMenuOpen] = useState(false)
  const [activePage, setActivePage] = useState('fixturesManagement')
  const [fixturesCategory, setFixturesCategory] = useState(null)
  const [publishedMatches, setPublishedMatches] = useState(() => {
    try {
      const savedMatches = localStorage.getItem(STORAGE_KEY)
      if (savedMatches !== null) {
        const parsed = JSON.parse(savedMatches)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((m) => m && m.id !== 1 && m.id !== 2 && !String(m.matchName || '').includes('Chennai Badminton Championship') && !String(m.matchName || '').includes('State Open Badminton'))
            .map(sanitizeTournament)
        }
      }
    } catch (error) {
      // fallback
    }
    return (initialBadmintonDb?.matches || [])
      .filter((m) => m && m.id !== 1 && m.id !== 2)
      .map(sanitizeTournament)
  })
  const [formData, setFormData] = useState(getInitialFormData)
  const [imagePreview, setImagePreview] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [publicFilter, setPublicFilter] = useState('all')
  const [activeCategory, setActiveCategory] = useState(null)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryFilterGroup, setCategoryFilterGroup] = useState('popular')
  const categoryInputRef = useRef(null)
  const [authenticators, setAuthenticators] = useState(() => {
    try {
      const savedAuthenticators = localStorage.getItem(AUTH_STORAGE_KEY)
      if (savedAuthenticators) {
        const parsed = JSON.parse(savedAuthenticators)
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          const sanitized = {}
          Object.keys(parsed).forEach((k) => {
            const list = Array.isArray(parsed[k]) ? parsed[k] : []
            sanitized[k] = list
              .filter((p) => !(p.id >= 101 && p.id <= 116) && !(p.id >= 201 && p.id <= 204))
              .map(sanitizeParticipant)
          })
          return sanitized
        }
      }
    } catch (error) {
      // fallback
    }
    const initialAuth = initialBadmintonDb?.authenticators || {}
    const sanitized = {}
    Object.keys(initialAuth).forEach((k) => {
      const list = Array.isArray(initialAuth[k]) ? initialAuth[k] : []
      sanitized[k] = list.map(sanitizeParticipant)
    })
    return sanitized
  })
  const [participantForm, setParticipantForm] = useState({ name: '', name1: '', name2: '', court: '', place: '', category: 'Men Singles' })
  const [editingParticipantId, setEditingParticipantId] = useState(null)
  const [modifyingParticipant, setModifyingParticipant] = useState(null)
  const [modifyForm, setModifyForm] = useState({
    name: '',
    name1: '',
    name2: '',
    category: 'Men Singles',
    court: '',
    place: '',
  })
  const [seedingModalMatch, setSeedingModalMatch] = useState(null)
  const [seedingModalCategory, setSeedingModalCategory] = useState(null)
  const [editingMatch, setEditingMatch] = useState(null)
  const [winnerModalMatch, setWinnerModalMatch] = useState(null)
  const [winnerCategoryMap, setWinnerCategoryMap] = useState({})
  const [successToast, setSuccessToast] = useState('')
  const [deleteConfirmState, setDeleteConfirmState] = useState(null)
  const [playerFilterSearch, setPlayerFilterSearch] = useState('')
  const [publicViewingFixturesMatch, setPublicViewingFixturesMatch] = useState(null)
  const [publicViewingCategory, setPublicViewingCategory] = useState(null)
  const [resultModalMatch, setResultModalMatch] = useState(null)
  const [isStadiumTvCastOpen, setIsStadiumTvCastOpen] = useState(false)
  const [isLiveStreamSetupModalOpen, setIsLiveStreamSetupModalOpen] = useState(false)
  const [streamCourtConfig, setStreamCourtConfig] = useState(() => getSavedCourtConfig())
  const [streamCourtsCount, setStreamCourtsCount] = useState(() => streamCourtConfig.count || 4)
  const [streamCourtFormat, setStreamCourtFormat] = useState(() => streamCourtConfig.format || 'numbers')
  const [streamCourtPrefix, setStreamCourtPrefix] = useState(() => streamCourtConfig.prefix !== undefined ? streamCourtConfig.prefix : 'Court')
  const [streamCourtCustomNames, setStreamCourtCustomNames] = useState(() => streamCourtConfig.customNames || '')

  useEffect(() => {
    if (isLiveStreamSetupModalOpen) {
      const cfg = getSavedCourtConfig()
      setStreamCourtConfig(cfg)
      setStreamCourtsCount(cfg.count || 4)
      setStreamCourtFormat(cfg.format || 'numbers')
      setStreamCourtPrefix(cfg.prefix !== undefined ? cfg.prefix : 'Court')
      setStreamCourtCustomNames(cfg.customNames || '')
    }
  }, [isLiveStreamSetupModalOpen])

  const streamPreviewCourts = useMemo(() => {
    return generateCourtsList({
      count: streamCourtsCount,
      format: streamCourtFormat,
      prefix: streamCourtPrefix,
      customNames: streamCourtCustomNames,
    })
  }, [streamCourtsCount, streamCourtFormat, streamCourtPrefix, streamCourtCustomNames])

  const [isLiveStreamActive, setIsLiveStreamActive] = useState(() => {
    try {
      return localStorage.getItem('badminton-live-stream-active') === 'true'
    } catch {
      return false
    }
  })
  const [publishedStatusMap, setPublishedStatusMap] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-published-status')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && Object.keys(parsed).length > 0) return parsed
      }
    } catch {
      // fallback
    }
    return initialBadmintonDb?.publishedStatus || {}
  })

  // Auto-sync live stream broadcast active status with localStorage & storage events
  useEffect(() => {
    const syncStreamStatus = () => {
      try {
        const active = localStorage.getItem('badminton-live-stream-active') === 'true'
        setIsLiveStreamActive(active)
      } catch {}
    }
    window.addEventListener('storage', syncStreamStatus)
    const interval = setInterval(syncStreamStatus, 1500)
    return () => {
      window.removeEventListener('storage', syncStreamStatus)
      clearInterval(interval)
    }
  }, [])

  // Set initial category-wise winners when winner modal opens
  useEffect(() => {
    if (winnerModalMatch) {
      const cats = getMatchCategories(winnerModalMatch)
      const initialMap = {}
      cats.forEach((cat) => {
        initialMap[cat] = winnerModalMatch.categoryWinners?.[cat] || ''
      })
      if (cats.length === 1 && !initialMap[cats[0]] && winnerModalMatch.winner) {
        initialMap[cats[0]] = winnerModalMatch.winner
      }
      setWinnerCategoryMap(initialMap)
    }
  }, [winnerModalMatch])

  // Fetch and sync directly with Shared Server DB + Supabase Database for real-time mobile/PC sync
  useEffect(() => {
    let isMounted = true

    const syncAllData = async () => {
      // 1. Prioritize authoritative Cloud DB from Supabase
      try {
        const supaTournaments = await SupabaseService.getTournaments()
        if (!isMounted) return
        if (supaTournaments && Array.isArray(supaTournaments) && supaTournaments.length > 0) {
          const mapped = supaTournaments.map((t) => ({
            id: t.id,
            matchName: t.match_name || t.matchName,
            matchAddress: t.match_address || t.matchAddress,
            courtName: t.court_name || t.courtName,
            categories: t.categories || ['Men Singles'],
            participants: Array.isArray(t.participants) ? t.participants : (Array.isArray(t.authenticators) ? t.authenticators : []),
            authenticators: Array.isArray(t.authenticators) ? t.authenticators : (Array.isArray(t.participants) ? t.participants : []),
            startDate: t.start_date || t.startDate,
            endDate: t.end_date || t.endDate,
            totalDays: t.total_days || t.totalDays || 1,
            organizerName: t.organizer_name || t.organizerName,
            organizerMobile: t.organizer_mobile || t.organizerMobile,
            image: t.image || '',
            winner: t.winner || '',
            categoryWinners: t.category_winners || t.categoryWinners || {},
            completedAt: t.completed_at || t.completedAt || null,
          })).map(sanitizeTournament)

          setPublishedMatches((prev) => {
            const map = new Map()
            mapped.forEach((m) => map.set(String(m.id), m))
            prev.forEach((m) => {
              if (!map.has(String(m.id))) {
                map.set(String(m.id), m)
              }
            })
            const merged = Array.from(map.values())
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
            } catch (e) {}
            return merged
          })

          // Extract and merge participants from Supabase tournaments
          const authMap = {}
          supaTournaments.forEach((t) => {
            const tId = String(t.id)
            const pList = Array.isArray(t.authenticators) && t.authenticators.length > 0
              ? t.authenticators
              : (Array.isArray(t.participants) && t.participants.length > 0 ? t.participants : [])
            if (pList.length > 0) {
              authMap[tId] = pList
              authMap[t.id] = pList
            }
          })

          if (Object.keys(authMap).length > 0) {
            setAuthenticators((prev) => {
              const merged = { ...prev }
              Object.keys(authMap).forEach((k) => {
                const existing = merged[k] || []
                const existingIds = new Set(existing.map((p) => String(p.id)))
                const newOnes = authMap[k].filter((p) => !existingIds.has(String(p.id)))
                merged[k] = [...existing, ...newOnes]
              })
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(merged))
              } catch (e) {}
              return merged
            })
          }
        }

        // Sync Tournament Draws from Supabase
        const supaDraws = await SupabaseService.getAllTournamentDraws()
        if (supaDraws && Array.isArray(supaDraws) && supaDraws.length > 0) {
          try {
            const existingDraws = JSON.parse(localStorage.getItem('badminton-tournament-draws') || '{}')
            const mergedDraws = { ...existingDraws }
            supaDraws.forEach((row) => {
              if (row.id && row.draw_data) {
                mergedDraws[row.id] = row.draw_data
              }
            })
            localStorage.setItem('badminton-tournament-draws', JSON.stringify(mergedDraws))
          } catch (e) {}
        }

        // Sync Credentials from Supabase
        const supaCreds = await SupabaseService.getCredentials()
        if (supaCreds && Array.isArray(supaCreds) && supaCreds.length > 0) {
          try {
            const mappedCreds = supaCreds.map((c) => ({
              id: c.id,
              username: c.username,
              password: c.password,
              name: c.name,
              assignedMatchId: c.assigned_match_id,
              assignedMatchName: c.assigned_match_name,
              courtName: c.court_name,
              assignedCourt: c.court_name,
              scope: c.scope || 'umpire',
              expiry: c.expiry || '24 Hours',
              role: c.role || 'umpire',
              status: c.status || 'active',
            }))
            localStorage.setItem('badminton-temporary-credentials', JSON.stringify(mappedCreds))
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Supabase sync status:', err)
      }

      // 2. Also fetch and merge supplementary serverless state
      try {
        const res = await fetch('/api/tournaments')
        const contentType = res.headers.get('content-type') || ''
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json()
          if (!isMounted) return

          if (data && Array.isArray(data.matches) && data.matches.length > 0) {
            const sanitized = data.matches
              .filter((m) => m && m.id !== 1 && m.id !== 2 && !String(m.matchName || '').includes('Chennai Badminton Championship') && !String(m.matchName || '').includes('State Open Badminton'))
              .map(sanitizeTournament)

            setPublishedMatches((prev) => {
              const map = new Map()
              sanitized.forEach((m) => map.set(String(m.id), m))
              prev.forEach((m) => {
                if (!map.has(String(m.id))) {
                  map.set(String(m.id), m)
                }
              })
              const merged = Array.from(map.values())
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
              } catch (e) {}
              return merged
            })
          }

          if (data.publishedStatus && typeof data.publishedStatus === 'object') {
            setPublishedStatusMap((prev) => {
              const merged = { ...prev, ...data.publishedStatus }
              try {
                localStorage.setItem('badminton-published-status', JSON.stringify(merged))
              } catch (e) {}
              return merged
            })
          }

          if (data.authenticators && typeof data.authenticators === 'object') {
            setAuthenticators((prev) => {
              const merged = { ...prev }
              Object.keys(data.authenticators).forEach((k) => {
                const incoming = data.authenticators[k] || []
                if (Array.isArray(incoming) && incoming.length > 0) {
                  const existing = merged[k] || []
                  const existingIds = new Set(existing.map((p) => String(p.id)))
                  const extras = incoming.filter((p) => !existingIds.has(String(p.id)))
                  merged[k] = [...existing, ...extras]
                }
              })
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(merged))
              } catch (e) {}
              return merged
            })
          }

          if (data.courtConfig && typeof data.courtConfig === 'object') {
            try {
              localStorage.setItem('badminton-stadium-court-config', JSON.stringify(data.courtConfig))
            } catch (e) {}
          }
          if (data.systemSettings?.liveStreamActive !== undefined || data.liveStreamActive !== undefined) {
            const serverVal = Boolean(data.systemSettings?.liveStreamActive ?? data.liveStreamActive)
            const localVal = localStorage.getItem('badminton-live-stream-active')
            if (localVal === null) {
              setIsLiveStreamActive(serverVal)
            }
          }
        }
      } catch (err) {}
    }

    syncAllData()
    const pollTimer = setInterval(syncAllData, 2000)

    // Realtime Push Sync across all devices
    const tourSub = SupabaseService.subscribeToTournaments(() => {
      syncAllData()
    })
    const drawSub = SupabaseService.subscribeToTournamentDraws(() => {
      syncAllData()
    })

    return () => {
      isMounted = false
      clearInterval(pollTimer)
      if (tourSub?.unsubscribe) tourSub.unsubscribe()
      if (drawSub?.unsubscribe) drawSub.unsubscribe()
    }
  }, [])

  // Sync state back to server whenever organizer updates local state
  const syncServerData = (payload) => {
    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  // Keep published status and matches in sync locally
  useEffect(() => {
    const refreshPubStatus = () => {
      try {
        const saved = localStorage.getItem('badminton-published-status')
        if (saved) setPublishedStatusMap(JSON.parse(saved))
        const savedMatches = localStorage.getItem(STORAGE_KEY)
        if (savedMatches) {
          const parsed = JSON.parse(savedMatches)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPublishedMatches(parsed.map(sanitizeTournament))
          }
        }
      } catch (e) {}
    }

    refreshPubStatus()
    window.addEventListener('storage', refreshPubStatus)
    return () => window.removeEventListener('storage', refreshPubStatus)
  }, [])

  const handleSaveCategoryWinners = (matchId, catWinnersMap) => {
    const targetMatch = publishedMatches.find((m) => m.id === matchId)
    if (!targetMatch) return

    const cats = getMatchCategories(targetMatch)
    const cleanCatMap = {}
    let filledCount = 0

    cats.forEach((cat) => {
      const val = (catWinnersMap[cat] || '').trim()
      cleanCatMap[cat] = val
      if (val) filledCount++
    })

    const totalCount = cats.length
    const areAllDone = totalCount > 0 && filledCount === totalCount

    let winnerSummary = ''
    if (areAllDone) {
      if (cats.length === 1) {
        winnerSummary = cleanCatMap[cats[0]] || ''
      } else {
        winnerSummary = cats.map((cat) => `${cat}: ${cleanCatMap[cat]}`).join(' | ')
      }
    }

    let updatedTargetMatch = null

    setPublishedMatches((prev) => {
      const updated = prev.map((m) => {
        if (m.id === matchId) {
          const updatedItem = {
            ...m,
            categoryWinners: cleanCatMap,
            winner: areAllDone ? winnerSummary : '',
            status: areAllDone ? 'completed' : 'ongoing',
            isCompleted: areAllDone,
            completedAt: areAllDone ? (m.completedAt || Date.now()) : null,
          }
          updatedTargetMatch = updatedItem
          return updatedItem
        }
        return m
      })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (e) {}
      return updated
    })

    if (updatedTargetMatch) {
      SupabaseService.upsertTournament(updatedTargetMatch).catch(() => {})
      syncServerData({ matches: [updatedTargetMatch] })
    }

    if (selectedMatch?.id === matchId) {
      setSelectedMatch((prev) => ({
        ...prev,
        categoryWinners: cleanCatMap,
        winner: areAllDone ? winnerSummary : '',
        status: areAllDone ? 'completed' : 'ongoing',
        isCompleted: areAllDone,
        completedAt: areAllDone ? (prev.completedAt || Date.now()) : null,
      }))
    }
    setWinnerModalMatch(null)
    setSuccessToast(
      areAllDone
        ? `🏆 All ${totalCount} category winners updated! Tournament moved to Completed.`
        : filledCount > 0
        ? `✓ ${filledCount} of ${totalCount} category winners updated. Tournament stays Ongoing until all categories conclude.`
        : `✓ Category winners cleared. Tournament restored to Ongoing/Upcoming.`
    )
  }

  const handleSaveEditedMatch = (updatedMatch) => {
    const cleanMatch = sanitizeTournament(updatedMatch)
    const updated = publishedMatches.map((m) => (String(m.id) === String(cleanMatch.id) ? cleanMatch : m))
    setPublishedMatches(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {}

    syncServerData({ matches: updated })
    SupabaseService.upsertTournament(cleanMatch).catch(() => {})

    if (selectedMatch?.id === cleanMatch.id) {
      setSelectedMatch(cleanMatch)
      const cats = getMatchCategories(cleanMatch)
      if (activeCategory && activeCategory !== 'ALL' && !cats.includes(activeCategory)) {
        setActiveCategory(cats[0] || 'Men Singles')
      }
    }
    setEditingMatch(null)
    setSuccessToast(
      cleanMatch.winner
        ? `🏆 Tournament "${cleanMatch.matchName}" saved! Winner: ${cleanMatch.winner} (Completed)`
        : `✓ Tournament "${cleanMatch.matchName}" updated successfully!`
    )
  }

  const effectivePublishedMatches = useMemo(() => {
    let list = publishedMatches
    if (authSession?.role === 'temporary_authenticator' && authSession?.assignedMatchId) {
      list = publishedMatches.filter((m) => String(m.id) === String(authSession.assignedMatchId))
    }
    return [...list].sort((a, b) => {
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
    })
  }, [publishedMatches, authSession])

  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(''), 4000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  const handleToggleLiveStream = () => {
    if (!isLiveStreamActive) {
      setIsLiveStreamSetupModalOpen(true)
    } else {
      // Live Stream stays permanently ON; second tap re-opens / views Live Cast without turning OFF
      setIsStadiumTvCastOpen(true)
      setSuccessToast('📺 Live Stream is active. To stop streaming, click "Stop Live Stream" inside the Live Cast screen.')
    }
  }

  const handleStopLiveStream = () => {
    setIsStadiumTvCastOpen(false)
    setIsLiveStreamActive(false)
    try {
      localStorage.setItem('badminton-live-stream-active', 'false')
      syncServerData({ liveStreamActive: false })
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setSuccessToast('⚪ Live Stream Broadcast is now stopped.')
  }

  const handlePopoutLiveTv = (tournamentId) => {
    const tid = tournamentId || selectedMatch?.id || publishedMatches[0]?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const win = window.open(url, '_blank')
    if (win) {
      win.focus()
    }
    setIsLiveStreamActive(true)
    try {
      localStorage.setItem('badminton-live-stream-active', 'true')
      syncServerData({ liveStreamActive: true })
    } catch (e) {}
    setSuccessToast('📺 TV Live Stream opened in a new tab! Move it to your TV screen; this tab stays on your app for scoring.')
  }

  const handleLaunchPopoutBroadcast = (selectedCourts) => {
    const courtsNum = Number(selectedCourts) || streamCourtsCount || 4
    setStreamCourtsCount(courtsNum)
    setIsLiveStreamActive(true)
    setIsLiveStreamSetupModalOpen(false)
    try {
      localStorage.setItem('badminton-stadium-courts-count', String(courtsNum))
      localStorage.setItem('badminton-live-stream-active', 'true')
      syncServerData({ liveStreamActive: true })
    } catch (e) {}

    const tid = selectedMatch?.id || publishedMatches[0]?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const win = window.open(url, '_blank')
    if (win) {
      win.focus()
    }
    setSuccessToast(`📺 TV Live Broadcast opened in a new tab! This tab stays on your app for scoring & fixtures.`)
  }

  const handleConfirmLiveStreamSetup = (countOverride) => {
    const nextCfg = {
      count: typeof countOverride === 'number' ? countOverride : streamCourtsCount,
      format: streamCourtFormat,
      prefix: streamCourtPrefix.trim(),
      customNames: streamCourtCustomNames.trim(),
    }
    saveCourtConfig(nextCfg)
    setStreamCourtConfig(nextCfg)
    handleLaunchPopoutBroadcast(nextCfg.count)
  }

  const handleSelectMatchForManagement = (match) => {
    setSelectedMatch(match)
    if (match) {
      const cats = getMatchCategories(match)
      const initialCat = cats[0] || 'Men Singles'
      setActiveCategory(initialCat)
      setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: initialCat })
    }
    setEditingParticipantId(null)
  }
  const [fixtureResults, setFixtureResults] = useState(() => {
    try {
      const savedFixtures = localStorage.getItem('badminton-fixture-results')
      return savedFixtures ? JSON.parse(savedFixtures) : {}
    } catch (error) {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(publishedMatches))
      if (publishedMatches && publishedMatches.length > 0) {
        syncServerData({ matches: publishedMatches })
      }
    } catch (error) {
      console.error('Unable to save published matches', error)
    }
  }, [publishedMatches])

  useEffect(() => {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticators))
      if (authenticators && Object.keys(authenticators).length > 0) {
        syncServerData({ authenticators })
      }
    } catch (error) {
      console.error('Unable to save authenticators', error)
    }
  }, [authenticators])

  useEffect(() => {
    try {
      localStorage.setItem('badminton-published-status', JSON.stringify(publishedStatusMap))
      if (publishedStatusMap && Object.keys(publishedStatusMap).length > 0) {
        syncServerData({ publishedStatus: publishedStatusMap })
      }
    } catch (error) {
      console.error('Unable to save published status', error)
    }
  }, [publishedStatusMap])

  useEffect(() => {
    try {
      localStorage.setItem('badminton-fixture-results', JSON.stringify(fixtureResults))
    } catch (error) {
      console.error('Unable to save fixture results', error)
    }
  }, [fixtureResults])

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target

    if (type === 'file' && files && files[0]) {
      const file = files[0]
      const reader = new FileReader()

      reader.onloadend = () => {
        const fileDataUrl = typeof reader.result === 'string' ? reader.result : ''
        setImagePreview(fileDataUrl)
        setFormData((prev) => ({
          ...prev,
          image: fileDataUrl,
        }))
      }

      reader.readAsDataURL(file)
      return
    }

    if (name === 'category') {
      const isNowDoubles = isDoublesCategory(value)
      setParticipantForm((prev) => {
        if (isNowDoubles) {
          const [s1, s2] = splitDoublesNames(prev.name || '')
          return {
            ...prev,
            category: value,
            name1: prev.name1 || s1,
            name2: prev.name2 || s2,
          }
        }
        return {
          ...prev,
          category: value,
          name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
        }
      })
      return
    }

    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }

      if (name === 'startDate' && updatedData.startDate) {
        const start = new Date(`${updatedData.startDate}T00:00:00`)
        const totalDays = Number(updatedData.totalDays) || 1

        if (!Number.isNaN(start.getTime())) {
          const endDate = new Date(start)
          endDate.setDate(start.getDate() + totalDays - 1)
          updatedData.endDate = endDate.toISOString().slice(0, 10)
        }
      }

      if (name === 'totalDays' && updatedData.startDate) {
        const start = new Date(`${updatedData.startDate}T00:00:00`)
        const totalDays = Number(value) || 1

        if (!Number.isNaN(start.getTime())) {
          const endDate = new Date(start)
          endDate.setDate(start.getDate() + totalDays - 1)
          updatedData.endDate = endDate.toISOString().slice(0, 10)
        }
      }

      return updatedData
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const sanitizedName = formatTournamentName(formData.matchName)
    const sanitizedAddress = formatAddress(formData.matchAddress)
    const sanitizedCourt = formatCourtName(formData.courtName)
    const sanitizedOrganizer = formatPersonName(formData.organizerName, '')

    const matchDuration = Number(formData.totalDays) || calculateMatchDuration(formData.startDate, formData.endDate)
    const rawMatch = {
      id: formData.id || Date.now(),
      ...formData,
      matchName: sanitizedName,
      matchAddress: sanitizedAddress,
      courtName: sanitizedCourt,
      organizerName: sanitizedOrganizer,
      categories: Array.isArray(formData.categories) && formData.categories.length > 0
        ? formData.categories.map(formatCategoryName)
        : ['Men Singles', 'Women Singles'],
      matchDuration,
      image: formData.image || '',
    }
    const cleanMatch = sanitizeTournament(rawMatch)

    const isExisting = publishedMatches.some((m) => String(m.id) === String(cleanMatch.id))
    let updatedMatches = []
    if (isExisting) {
      updatedMatches = publishedMatches.map((m) => (String(m.id) === String(cleanMatch.id) ? cleanMatch : m))
    } else {
      updatedMatches = [cleanMatch, ...publishedMatches]
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMatches))
    } catch (e) {
      console.error('Error saving match to localStorage', e)
    }
    setPublishedMatches(updatedMatches)

    syncServerData({ matches: updatedMatches })
    SupabaseService.upsertTournament(cleanMatch).catch(() => {})

    setAuthenticators((prev) => {
      if (prev[cleanMatch.id]) return prev
      const updatedAuth = { ...prev, [cleanMatch.id]: [] }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth))
      } catch (e) {}
      syncServerData({ authenticators: updatedAuth })
      return updatedAuth
    })

    setSelectedMatch(cleanMatch)
    setActiveCategory(cleanMatch.categories[0] || 'Men Singles')
    setImagePreview('')
    setFormData(getInitialFormData())
    setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: cleanMatch.categories[0] || 'Men Singles' })

    // Keep user in Organizer Panel and go to Match Management to view the newly updated tournament
    setActivePage('matchManagement')
    setSuccessToast(
      isExisting
        ? `✓ Tournament "${cleanMatch.matchName}" updated successfully!`
        : `🎉 New Tournament "${cleanMatch.matchName}" created & published successfully!`
    )
  }

  const resetParticipantForm = (category = participantForm.category || getMatchCategories(selectedMatch)[0]) => {
    setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category })
    setEditingParticipantId(null)
  }

  const handleAddParticipant = () => {
    if (!selectedMatch) return
    const cats = getMatchCategories(selectedMatch)
    const targetCategory =
      (activeCategory && activeCategory !== 'ALL' && cats.includes(activeCategory))
        ? activeCategory
        : (participantForm.category && cats.includes(participantForm.category) ? participantForm.category : cats[0] || 'Men Singles')

    const isDoubles = isDoublesCategory(targetCategory)
    let finalName = ''

    if (isDoubles) {
      const p1 = (participantForm.name1 || '').trim()
      const p2 = (participantForm.name2 || '').trim()

      if (!p1 && !p2 && !participantForm.name?.trim()) {
        alert('Please enter both Player 1 and Player 2 names for Doubles.')
        return
      }

      if (p1 && p2) {
        finalName = joinDoublesNames(p1, p2)
      } else if (p1 && !p2) {
        finalName = formatPersonName(p1)
      } else if (!p1 && p2) {
        finalName = formatPersonName(p2)
      } else {
        finalName = formatPersonName(participantForm.name?.trim() || '')
      }
    } else {
      const rawName = participantForm.name?.trim()
      if (!rawName) return
      finalName = rawName
    }

    if (!finalName) return

    const courtVal = formatCourtName(participantForm.court, '')
    const placeVal = formatPlaceOrClub(participantForm.place, '')

    if (editingParticipantId) {
      setAuthenticators((prev) => {
        const matchKey = selectedMatch.id
        const matchPlayers = prev[matchKey] || prev[String(matchKey)] || []
        const updatedList = matchPlayers.map((p) =>
          String(p.id) === String(editingParticipantId)
            ? { ...p, name: formatPersonName(finalName), court: courtVal, place: placeVal, category: targetCategory }
            : p
        )
        const next = { ...prev, [matchKey]: updatedList, [String(matchKey)]: updatedList }
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
        } catch (err) {}
        syncServerData({ authenticators: next })
        return next
      })
      setSuccessToast(`✓ Updated ${isDoubles ? 'doubles pair' : 'player'} "${formatPersonName(finalName)}" in ${targetCategory}!`)
      resetParticipantForm(targetCategory)
      return
    }

    const names = isDoubles
      ? [finalName]
      : finalName.split(/[\n,]+/).map((n) => formatPersonName(n)).filter(Boolean)

    if (names.length === 0) return

    const newPlayers = names.map((pName, idx) => ({
      id: Date.now() + idx,
      name: formatPersonName(pName),
      court: courtVal,
      place: placeVal,
      category: targetCategory,
    }))

    const matchKey = selectedMatch.id
    const matchKeyStr = String(matchKey)
    let updatedPlayersList = []

    setAuthenticators((prev) => {
      const matchPlayers = prev[matchKey] || prev[matchKeyStr] || selectedMatch.authenticators || selectedMatch.participants || []
      updatedPlayersList = [...matchPlayers, ...newPlayers]
      const next = {
        ...prev,
        [matchKey]: updatedPlayersList,
        [matchKeyStr]: updatedPlayersList,
      }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (err) {}
      syncServerData({ authenticators: next })
      return next
    })

    const updatedMatchObj = {
      ...selectedMatch,
      authenticators: updatedPlayersList.length > 0 ? updatedPlayersList : [...(selectedMatch.authenticators || []), ...newPlayers],
      participants: updatedPlayersList.length > 0 ? updatedPlayersList : [...(selectedMatch.participants || []), ...newPlayers],
    }

    setSelectedMatch(updatedMatchObj)
    setPublishedMatches((prev) =>
      prev.map((m) => (String(m.id) === matchKeyStr ? updatedMatchObj : m))
    )
    SupabaseService.upsertTournament(updatedMatchObj).catch(() => {})

    if (activeCategory !== 'ALL') {
      setActiveCategory(targetCategory)
    }

    setSuccessToast(
      isDoubles
        ? `✓ Successfully added doubles pair "${finalName}" to ${targetCategory}!`
        : (names.length === 1
          ? `✓ Successfully added player "${names[0]}" to ${targetCategory}!`
          : `✓ Successfully added ${names.length} players to ${targetCategory}!`)
    )

    resetParticipantForm(targetCategory)
  }

  const handleOpenModifyModal = (participant) => {
    if (!participant) return
    const partCategory = participant.category || (selectedMatch ? getMatchCategories(selectedMatch)[0] : 'Men Singles')
    const [s1, s2] = splitDoublesNames(participant.name || '')
    setModifyingParticipant(participant)
    setModifyForm({
      name: participant.name || '',
      name1: s1,
      name2: s2,
      category: partCategory,
      court: participant.court || '',
      place: participant.place || '',
    })
  }

  const handleSaveModifiedParticipant = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!modifyingParticipant || !selectedMatch) return

    const isDoubles = isDoublesCategory(modifyForm.category)
    let finalName = ''

    if (isDoubles) {
      const p1 = (modifyForm.name1 || '').trim()
      const p2 = (modifyForm.name2 || '').trim()

      if (!p1 && !p2 && !modifyForm.name?.trim()) {
        alert('Please enter both Player 1 and Player 2 names for Doubles.')
        return
      }

      if (p1 && p2) {
        finalName = joinDoublesNames(p1, p2)
      } else if (p1 && !p2) {
        finalName = formatPersonName(p1)
      } else if (!p1 && p2) {
        finalName = formatPersonName(p2)
      } else {
        finalName = formatPersonName(modifyForm.name?.trim() || '')
      }
    } else {
      const rawName = (modifyForm.name || modifyForm.name1 || '').trim()
      if (!rawName) {
        alert('Please enter player name.')
        return
      }
      finalName = formatPersonName(rawName)
    }

    if (!finalName) return

    const courtVal = formatCourtName(modifyForm.court, '')
    const placeVal = formatPlaceOrClub(modifyForm.place, '')
    const targetCategory = modifyForm.category
    const participantId = modifyingParticipant.id
    const oldName = modifyingParticipant.name

    setAuthenticators((prev) => {
      const matchKey = selectedMatch.id
      const currentList = prev[matchKey] || prev[String(matchKey)] || []
      const updatedList = currentList.map((p) =>
        String(p.id) === String(participantId)
          ? { ...p, name: finalName, court: courtVal, place: placeVal, category: targetCategory }
          : p
      )
      const next = { ...prev, [matchKey]: updatedList, [String(matchKey)]: updatedList }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (err) {}
      syncServerData({ authenticators: next })
      return next
    })

    // Also synchronize tournament draw matches if draw exists
    try {
      const drawsRaw = localStorage.getItem('badminton-tournament-draws')
      if (drawsRaw) {
        const allDraws = JSON.parse(drawsRaw)
        const drawKey = `${selectedMatch.id}-${targetCategory}`
        const existingDraw = allDraws[drawKey]
        if (existingDraw && Array.isArray(existingDraw.matches)) {
          const updatePlayerObj = (pObj) => {
            if (!pObj) return pObj
            if (String(pObj.id) === String(participantId) || pObj.name === oldName) {
              return {
                ...pObj,
                name: finalName,
                place: placeVal || pObj.place,
                court: courtVal || pObj.court,
              }
            }
            return pObj
          }

          const updatedMatches = existingDraw.matches.map((m) => ({
            ...m,
            player1: updatePlayerObj(m.player1),
            player2: updatePlayerObj(m.player2),
            winner: updatePlayerObj(m.winner),
          }))

          allDraws[drawKey] = {
            ...existingDraw,
            matches: updatedMatches,
            seeds: (existingDraw.seeds || []).map(updatePlayerObj),
          }

          localStorage.setItem('badminton-tournament-draws', JSON.stringify(allDraws))
          syncServerData({ tournamentDraws: allDraws })
        }
      }
    } catch (err) {
      console.error('Error syncing modified name with draws:', err)
    }

    setModifyingParticipant(null)
    setSuccessToast(`✓ Successfully modified "${finalName}" in ${targetCategory}!`)
  }

  const updateFixtureResult = (matchId, categoryName, fixtureId, field, value) => {
    const matchKey = getFixtureStorageKey(matchId, categoryName)
    const current = fixtureResults[matchKey] || {}

    setFixtureResults((prev) => ({
      ...prev,
      [matchKey]: {
        ...current,
        [fixtureId]: {
          ...(current[fixtureId] || { playerA: '', playerB: '', winner: '', scoreA: '', scoreB: '' }),
          [field]: value,
        },
      },
    }))
  }

  const getFixtureResult = (matchId, categoryName, fixtureId) => {
    const matchKey = getFixtureStorageKey(matchId, categoryName)
    return fixtureResults[matchKey]?.[fixtureId] || { playerA: '', playerB: '', winner: '', scoreA: '', scoreB: '' }
  }

  const handleRemoveParticipant = (matchId, participantId) => {
    const matchIdStr = String(matchId)
    let filteredList = []
    setAuthenticators((prev) => {
      const matchPlayers = prev[matchId] || prev[matchIdStr] || []
      filteredList = matchPlayers.filter((p) => String(p.id) !== String(participantId))
      const next = {
        ...prev,
        [matchId]: filteredList,
        [matchIdStr]: filteredList,
      }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      syncServerData({ authenticators: next })
      return next
    })

    if (selectedMatch && String(selectedMatch.id) === matchIdStr) {
      const updatedMatchObj = {
        ...selectedMatch,
        authenticators: filteredList,
        participants: filteredList,
      }
      setSelectedMatch(updatedMatchObj)
      setPublishedMatches((prev) =>
        prev.map((m) => (String(m.id) === matchIdStr ? updatedMatchObj : m))
      )
      SupabaseService.upsertTournament(updatedMatchObj).catch(() => {})
    }
  }

  const handleDeleteMatch = (matchId) => {
    const targetIdStr = String(matchId)
    const updatedMatches = publishedMatches.filter((match) => String(match.id) !== targetIdStr)
    setPublishedMatches(updatedMatches)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMatches))
    } catch (e) {}

    const updatedAuth = { ...authenticators }
    delete updatedAuth[matchId]
    delete updatedAuth[targetIdStr]
    setAuthenticators(updatedAuth)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth))
    } catch (e) {}

    const updatedPubStatus = { ...publishedStatusMap }
    Object.keys(updatedPubStatus).forEach((key) => {
      if (key.startsWith(`${matchId}-`)) {
        delete updatedPubStatus[key]
      }
    })
    setPublishedStatusMap(updatedPubStatus)
    try {
      localStorage.setItem('badminton-published-status', JSON.stringify(updatedPubStatus))
    } catch (e) {}

    try {
      const draws = JSON.parse(localStorage.getItem('badminton-tournament-draws') || '{}')
      Object.keys(draws).forEach((key) => {
        if (key.startsWith(`${matchId}-`)) {
          delete draws[key]
        }
      })
      localStorage.setItem('badminton-tournament-draws', JSON.stringify(draws))
    } catch (e) {}

    if (selectedMatch && String(selectedMatch.id) === targetIdStr) {
      setSelectedMatch(null)
    }

    // Sync deletion to Server DB and Supabase
    syncServerData({
      matches: updatedMatches,
      authenticators: updatedAuth,
      publishedStatus: updatedPubStatus,
    })
    SupabaseService.deleteTournament(matchId).catch(() => {})

    setSuccessToast('🗑️ Tournament deleted successfully!')
  }

  const handleGenerateAndOpenFixtures = (category, config) => {
    if (!seedingModalMatch) return
    const match = seedingModalMatch
    const categoryPlayers = (authenticators[match.id] || []).filter(
      (p) => (p.category || 'Men Singles') === category
    )

    const draw = generateBadmintonDraw(categoryPlayers, config)
    const drawKey = `${match.id}-${category}`

    try {
      const existing = JSON.parse(localStorage.getItem('badminton-tournament-draws') || '{}')
      existing[drawKey] = draw
      localStorage.setItem('badminton-tournament-draws', JSON.stringify(existing))
      syncServerData({ tournamentDraws: existing })
    } catch (e) {
      console.error('Error saving draw', e)
    }

    setSelectedMatch(match)
    setFixturesCategory(category)
    setSeedingModalMatch(null)
    setSeedingModalCategory(null)
    setActivePage('fixturesManagement')
  }

  const sortedMatches = [...publishedMatches].sort(compareTournamentsChronological)

  const filteredPublicMatches = useMemo(() => {
    const list = [...sortedMatches].filter((match) => {
      if (publicFilter === 'all') return true
      return getMatchStatus(match) === publicFilter
    })

    // If viewing Completed matches: whichever was completed most recently shows first!
    if (publicFilter === 'completed') {
      return list.sort(compareTournamentsRecentCompleted)
    }

    // Otherwise (Upcoming or All): earliest starting match first
    return list.sort(compareTournamentsChronological)
  }, [sortedMatches, publicFilter])

  const selectedMatchCategories = selectedMatch ? getMatchCategories(selectedMatch) : []
  const groupedSelectedParticipants = selectedMatch
    ? selectedMatchCategories.reduce((entries, category) => {
        entries[category] = (authenticators[selectedMatch.id] || []).filter(
          (participant) => (participant.category || 'Men Singles') === category
        )
        return entries
      }, {})
    : {}
  const filteredCategories = BADMINTON_CATEGORIES.filter((category) => {
    if (categorySearch.trim()) {
      return matchesCategorySearch(category, categorySearch)
    }
    return isCategoryInGroup(category, categoryFilterGroup)
  })

  useEffect(() => {
    if (selectedMatch) {
      const cats = getMatchCategories(selectedMatch)
      setActiveCategory((prev) => (prev && cats.includes(prev) ? prev : (cats[0] || null)))
    } else {
      setActiveCategory(null)
    }
  }, [selectedMatch?.id])

  useEffect(() => {
    if (publicViewingFixturesMatch || selectedMatch) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [publicViewingFixturesMatch?.id, selectedMatch?.id])

  // Standalone Direct Live Cast Mode (e.g. for TV / Projector / OBS Browser Source / Smart TV)
  const isDirectLiveCastMode = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      return p.get('livecast') === 'true' || p.get('tv') === '1' || p.get('stream') === 'true'
    } catch {
      return false
    }
  }, [])

  if (isDirectLiveCastMode) {
    const p = new URLSearchParams(window.location.search)
    const targetTid = p.get('tid')
    let list = publishedMatches || []
    if (list.length === 0) {
      try {
        const saved = localStorage.getItem('badminton-published-matches')
        if (saved) list = JSON.parse(saved)
      } catch {}
    }
    const matchedTournament = list.find((m) => String(m.id) === String(targetTid)) || (targetTid ? { id: targetTid, matchName: 'Live Tournament', categories: ['Men Singles', 'Men Doubles', 'Women Singles'] } : list[0]) || { id: 1, matchName: 'Badminton Live Broadcast', categories: ['Men Singles', 'Men Doubles', 'Women Singles'] }
    return (
      <StadiumTvLiveCast
        tournament={matchedTournament}
        allTournaments={list}
        isPublicView={true}
        onClose={() => {
          if (window.opener) {
            window.close()
          } else {
            window.location.search = ''
          }
        }}
      />
    )
  }

  return (
    <div className="page-shell">
      {!authOpen && (
        <div className="blank-page">
          {publicViewingFixturesMatch ? (
            <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '16px', boxSizing: 'border-box' }}>
              <BadmintonFixturesManager
                isPublicView={true}
                publishedMatches={publishedMatches}
                authenticators={authenticators}
                selectedMatch={publicViewingFixturesMatch}
                initialCategory={publicViewingCategory || publicViewingFixturesMatch.categories?.[0]}
                onSelectMatch={(m) => setPublicViewingFixturesMatch(m)}
                onBackToPublicFeed={() => {
                  setPublicViewingFixturesMatch(null)
                  setPublicViewingCategory(null)
                }}
                onOpenOrganizerLogin={() => {
                  if (authSession) {
                    setAuthOpen(true)
                  } else {
                    setIsAuthModalOpen(true)
                  }
                }}
              />
            </div>
          ) : selectedMatch ? (
            <div className="public-tournament-hub">
              {/* Hub Top Navigation Bar */}
              <div className="pub-hub-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(null)}
                    className="pub-hub-back-btn"
                  >
                    <span className="back-arrow">←</span>
                    <span>Back to Tournaments</span>
                  </button>

                  <div className="pub-hub-breadcrumb">
                    <span className="brand-tag">BADMINTON MAFIA</span>
                    <span className="crumb-sep">/</span>
                    <span className="tourn-tag">{selectedMatch.matchName}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (authSession) {
                        setAuthOpen(true)
                      } else {
                        setIsAuthModalOpen(true)
                      }
                    }}
                    className="public-auth-btn icon-only"
                    title={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
                    aria-label={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Hub Hero Banner Card */}
              <div className="pub-hub-hero-card">
                {selectedMatch.image ? (
                  <div className="pub-hub-hero-img-wrap">
                    <img src={selectedMatch.image} alt={selectedMatch.matchName} className="pub-hub-hero-img" />
                    <div className="pub-hub-hero-gradient" />
                  </div>
                ) : (
                  <div className="pub-hub-hero-placeholder">
                    <span className="hero-shuttle-icon">🏸</span>
                    <div className="pub-hub-hero-gradient" />
                  </div>
                )}

                <div className="pub-hub-hero-content">
                  <div className="pub-hub-badge-row">
                    {(() => {
                      const st = getMatchStatus(selectedMatch)
                      return (
                        <span className={`pub-hub-status-pill status-${st}`}>
                          {st === 'ongoing' && <span className="pro-radar-beacon" />}
                          <span>{st === 'completed' ? '🏆 Tournament Completed' : st === 'ongoing' ? '🟢 Live Ongoing' : '📅 Upcoming Championship'}</span>
                        </span>
                      )
                    })()}
                  </div>

                  <h1 className="pub-hub-title">{selectedMatch.matchName}</h1>

                  <div className="pub-hub-meta-grid">
                    <div className="pub-hub-meta-item">
                      <span className="meta-icon">📅</span>
                      <div className="meta-text">
                        <span className="meta-label">Tournament Dates</span>
                        <span className="meta-value">{formatDisplayDate(selectedMatch.startDate)} - {formatDisplayDate(selectedMatch.endDate)}</span>
                      </div>
                    </div>

                    <div className="pub-hub-meta-item">
                      <span className="meta-icon">📍</span>
                      <div className="meta-text">
                        <span className="meta-label">Championship Venue</span>
                        <span className="meta-value">{selectedMatch.matchAddress || 'Main Stadium'}</span>
                      </div>
                    </div>

                    <div className="pub-hub-meta-item">
                      <span className="meta-icon">🏸</span>
                      <div className="meta-text">
                        <span className="meta-label">Courts</span>
                        <span className="meta-value">{selectedMatch.courtName || 'Official Courts'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hub Primary Action Center (Results & Draw Sheets) */}
              {(() => {
                const pubCats = (selectedMatchCategories || []).filter((c) => publishedStatusMap[`${selectedMatch.id}-${c}`])
                const hasDraws = pubCats.length > 0
                const hasResults = ((selectedMatch.categoryWinners && Object.keys(selectedMatch.categoryWinners).length > 0) || Boolean(selectedMatch.winner))

                return (
                  <div className="pub-hub-action-center">
                    <div className="pub-action-left">
                      <div className="pub-action-status-head">
                        <span className="action-pulse-dot" />
                        <span className="action-status-title">
                          {hasDraws ? 'Official Tournament Draw & Results Active' : 'Tournament Schedule & Categories'}
                        </span>
                      </div>
                      <p className="pub-action-desc">
                        {hasDraws 
                          ? `BWF Knockout Fixtures and Results published for ${pubCats.join(', ')}`
                          : 'Official Draw & Fixture Sheets will be published by organizers before match start.'}
                      </p>
                    </div>

                    <div className="pub-action-buttons-wrap">
                      <button
                        type="button"
                        onClick={() => setResultModalMatch(selectedMatch)}
                        className="pub-hub-action-btn btn-results-gold"
                      >
                        <span className="btn-icon">🏆</span>
                        <div className="btn-text-block">
                          <span className="btn-main-text">Results & Podium</span>
                          <span className="btn-sub-text">Medals & Winners</span>
                        </div>
                      </button>

                      {hasDraws && (
                        <button
                          type="button"
                          onClick={() => {
                            setPublicViewingFixturesMatch(selectedMatch)
                            setPublicViewingCategory(pubCats[0])
                          }}
                          className="pub-hub-action-btn btn-draw-emerald"
                        >
                          <span className="btn-icon">🎯</span>
                          <div className="btn-text-block">
                            <span className="btn-main-text">Official Draw Sheet</span>
                            <span className="btn-sub-text">Live Bracket & Scores</span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Tournament Category & Players Explorer */}
              <div className="pub-hub-categories-section">
                <div className="pub-hub-section-header">
                  <h2 className="pub-hub-section-title">
                    <span>🏸 Tournament Categories & Registered Players</span>
                  </h2>
                  <span className="pub-hub-total-cats-pill">{selectedMatchCategories.length} Categories</span>
                </div>

                {/* Category Selection Tabs */}
                <div className="pub-hub-cat-tabs-row">
                  {selectedMatchCategories.map((category) => {
                    const isPub = publishedStatusMap[`${selectedMatch.id}-${category}`]
                    const pCount = (groupedSelectedParticipants[category] || []).length
                    const isActive = activeCategory === category

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className={`pub-hub-cat-tab-btn ${isActive ? 'active' : ''}`}
                      >
                        <span className="tab-cat-name">{category}</span>
                        <span className="tab-player-count">{pCount}</span>
                        {isPub && <span className="tab-live-badge">LIVE DRAW</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Active Category Details Panel */}
                {activeCategory && (
                  <div className="pub-hub-cat-detail-panel">
                    <div className="pub-cat-panel-header">
                      <div className="pub-cat-title-group">
                        <span className="cat-title-text">{activeCategory}</span>
                        <span className="cat-entries-badge">
                          {(groupedSelectedParticipants[activeCategory] || []).length} Registered Entries
                        </span>
                      </div>

                      {/* If Category Winner Declared, show Winner Showcase */}
                      {selectedMatch.categoryWinners?.[activeCategory] && (
                        <div className="pub-cat-winner-pill">
                          <span className="winner-trophy">🏆</span>
                          <span className="winner-label">Category Champion:</span>
                          <strong className="winner-name">{formatPersonName(selectedMatch.categoryWinners[activeCategory])}</strong>
                        </div>
                      )}
                    </div>

                    {/* Participant Entries Grid */}
                    {(groupedSelectedParticipants[activeCategory] || []).length > 0 ? (
                      <div className="pub-players-grid">
                        {(groupedSelectedParticipants[activeCategory] || []).map((participant, pIdx) => {
                          const displayName = participant.name?.trim() ? participant.name : 'Participant'
                          const isSeed = participant.seed || participant.isSeed

                          return (
                            <div key={participant.id || pIdx} className="pub-player-card">
                              <div className="pub-player-avatar">
                                <span>{pIdx + 1}</span>
                              </div>

                              <div className="pub-player-info">
                                <div className="pub-player-name-row">
                                  <span className="pub-player-name">{formatPersonName(displayName)}</span>
                                  {isSeed && (
                                    <span className="pub-seed-badge">Seed {participant.seed || ''}</span>
                                  )}
                                </div>

                                {Boolean(participant.court || participant.place) && (
                                  <div className="pub-player-meta">
                                    <span className="pub-club-pin">📍</span>
                                    <span>{[participant.court, participant.place].filter(Boolean).join(' • ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="pub-no-players-box">
                        <span className="no-players-icon">👥</span>
                        <p>No players listed under {activeCategory} yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Public Front Page Header */}
              <header className="public-main-header">
                <div className="public-header-brand">
                  <div className="public-brand-logo-container">
                    <span className="public-header-icon" role="img" aria-label="Badminton">🏸</span>
                    <span className="public-brand-aura" />
                  </div>
                  <div className="public-brand-info">
                    <div className="public-brand-title-wrap">
                      <h1 className="public-header-title">
                        BADMINTON <span className="title-highlight">MAFIA</span>
                      </h1>
                      <span className="public-mafia-badge">OFFICIAL</span>
                    </div>
                    <div className="public-header-subtitle">
                      <span className="live-status-pulse" />
                      <span>Official Tournament Portal & Live Draws</span>
                    </div>
                  </div>
                </div>

                <div className="public-header-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (authSession) {
                        setAuthOpen(true)
                      } else {
                        setIsAuthModalOpen(true)
                      }
                    }}
                    className="public-auth-btn icon-only"
                    title={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
                    aria-label={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </button>
                </div>
              </header>

              {/* Professional Status Filter Bar */}
              <div className="public-filter-bar-pro">
                {[
                  { id: 'all', label: 'All Tournaments' },
                  { id: 'ongoing', label: 'Ongoing', live: true },
                  { id: 'upcoming', label: 'Upcoming' },
                  { id: 'completed', label: 'Completed' },
                ].map((tab) => {
                  const isActive = publicFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPublicFilter(tab.id)}
                      className={`public-filter-btn-pro ${isActive ? 'active' : ''}`}
                    >
                      {tab.live && <span className="live-filter-dot" />}
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tournament Feed Grid */}
              <div className="public-feed-pro">
                {filteredPublicMatches.length > 0 ? (
                  filteredPublicMatches.map((match, idx) => {
                    const status = getMatchStatus(match)
                    const publishedCategories = (match.categories || []).filter((cat) => publishedStatusMap[`${match.id}-${cat}`])
                    const hasPublishedDraw = publishedCategories.length > 0

                    return (
                      <article 
                        key={match.id} 
                        className={`pro-tournament-card ${status === 'ongoing' ? 'is-ongoing' : ''}`}
                        style={{ '--card-index': idx, cursor: 'pointer' }}
                        onClick={() => setSelectedMatch(match)}
                      >
                        <div className="pro-card-banner">
                          {match.image ? (
                            <img src={match.image} alt={match.matchName} className="pro-card-img" />
                          ) : (
                            <div className="pro-img-placeholder">
                              <span className="pro-placeholder-icon">🏸</span>
                            </div>
                          )}

                          <div className="pro-banner-gradient" />

                          {/* Status Badge */}
                          <span className={`pro-status-pill status-${status}`}>
                            {status === 'ongoing' && <span className="pro-radar-beacon" />}
                            <span>{status === 'completed' ? '🏆 Completed' : status === 'ongoing' ? 'Live' : 'Upcoming'}</span>
                          </span>

                          {/* Draw Published Ribbon */}
                          {hasPublishedDraw && (
                            <div className="pro-draw-live-ribbon">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 6h4v4H4" />
                                <path d="M4 14h4v4H4" />
                                <path d="M8 8h6v8H8" />
                                <path d="M14 12h6" />
                              </svg>
                              <span>DRAW PUBLISHED</span>
                            </div>
                          )}
                        </div>

                        <div className="pro-card-body">
                          {/* Card Top Row with Title on Left and Date/Duration on Right */}
                          <div className="pro-card-header-row">
                            <div className="pro-title-meta-block">
                              <h2 className="pro-tournament-title">
                                {match.matchName}
                              </h2>
                              <div className="pro-venue-row">
                                <span className="venue-pin-icon">📍</span>
                                <span className="venue-text">{match.matchAddress || match.courtName}</span>
                              </div>
                            </div>

                            <div className="pro-card-right-date">
                              <div className="pro-date-range-badge">
                                <span className="pro-date-icon">📅</span>
                                <span className="pro-date-text">
                                  {match?.startDate ? formatDisplayDate(match.startDate) : ''} - {match?.endDate ? formatDisplayDate(match.endDate) : ''}
                                </span>
                              </div>
                              <div className="pro-days-count-tag">
                                <span className="pro-clock-icon">⏱️</span>
                                <span>{match?.matchDuration ?? calculateMatchDuration(match?.startDate, match?.endDate)} Days Tournament</span>
                              </div>
                            </div>
                          </div>

                          {/* Champion Banner if Winner Declared */}
                          {((match.categoryWinners && Object.keys(match.categoryWinners).length > 0) || match.winner) && (
                            <div className="pro-champion-banner">
                              <span className="pro-trophy-icon">🏆</span>
                              <div className="pro-champion-text">
                                <div className="pro-champion-head">
                                  {getMatchStatus(match) === 'completed' ? 'Tournament Champions' : 'Category Winners'}
                                </div>
                                {match.categoryWinners && Object.keys(match.categoryWinners).length > 0 ? (
                                  <div className="pro-winners-grid">
                                    {Object.entries(match.categoryWinners).map(([cat, wName]) => (
                                      <div key={cat} className="pro-winner-line">
                                        <span className="cat-prefix">{cat}:</span> {formatPersonName(wName)}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="pro-winner-single">{formatPersonName(match.winner)}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Published Categories */}
                          <div className="pro-categories-wrap">
                            {publishedCategories.map((category) => (
                              <span
                                key={`${match.id}-${category}`}
                                className="pro-cat-pill"
                              >
                                <span className="pro-cat-dot" />
                                <span>🏸 {category}</span>
                              </span>
                            ))}
                          </div>

                          {/* Card Action Buttons */}
                          <div className="pro-card-footer">
                            <div className={`pro-btn-grid ${hasPublishedDraw ? 'three-btn' : 'one-btn'}`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedMatch(match)
                                }}
                                className="pro-btn-action btn-details"
                              >
                                <span>📋</span>
                                <span>Details</span>
                              </button>

                              {hasPublishedDraw && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPublicViewingFixturesMatch(match)
                                    setPublicViewingCategory(publishedCategories[0])
                                  }}
                                  className="pro-btn-action btn-fixtures"
                                >
                                  <span>🎯</span>
                                  <span>Fixtures</span>
                                </button>
                              )}

                              {hasPublishedDraw && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setResultModalMatch(match)
                                  }}
                                  className="pro-btn-action btn-result"
                                >
                                  <span>🏆</span>
                                  <span>Result</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })
                ) : (
                  <div className="pro-empty-feed">
                    <div className="pro-empty-icon">🏸</div>
                    <h3 className="pro-empty-title">
                      No {publicFilter === 'all' ? '' : publicFilter.charAt(0).toUpperCase() + publicFilter.slice(1)} Tournaments
                    </h3>
                    <p className="pro-empty-subtitle">
                      There are no tournaments currently listed in this section.
                    </p>
                    {publicFilter !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setPublicFilter('all')}
                        className="pro-empty-reset-btn"
                      >
                        Show All Tournaments
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {authOpen && (
        <div className="auth-page" style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box' }}>
          {/* If logged in as dedicated Court Umpire */}
          {(authSession?.role === 'umpire' || authSession?.scope === 'umpire') ? (
            <UmpireLiveScoringDashboard
              session={authSession}
              publishedMatches={publishedMatches}
              onLogout={() => {
                localStorage.removeItem('badminton-organizer-session')
                setAuthSession(null)
                setAuthOpen(false)
              }}
              onNavigateToPublic={() => setAuthOpen(false)}
            />
          ) : (
            <>
              {/* Top Quick Navigation Bar (Fully Dynamic & Responsive) */}
              <header className="app-top-navbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="top-navbar-brand">
                    <div className="navbar-logo-badge">
                      <span className="navbar-logo-icon">🏸</span>
                    </div>
                    <div className="navbar-brand-info">
                      <div className="navbar-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong className="navbar-brand-title" style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.02em', color: '#f8fafc' }}>
                          BADMINTON <span style={{ color: '#fbbf24', textShadow: '0 0 16px rgba(251, 191, 36, 0.45)' }}>MAFIA</span>
                        </strong>
                        <span
                          style={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.15) 100%)',
                            border: '1px solid rgba(251, 191, 36, 0.45)',
                            color: '#fef08a',
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            letterSpacing: '0.05em',
                          }}
                        >
                          ORGANIZER
                        </span>
                      </div>
                      <span className="navbar-brand-subtitle" style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        Official Tournament Management & Live Draws Control
                      </span>
                    </div>
                  </div>

                  <nav className="top-navbar-links" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {authSession?.role === 'temporary_authenticator' && authSession?.assignedMatchName && (
                      <span
                        style={{
                          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(15, 23, 42, 0.8) 100%)',
                          border: '1.5px solid rgba(234, 179, 8, 0.5)',
                          color: '#fef08a',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>🔒</span>
                        <span>{authSession.assignedMatchName}</span>
                      </span>
                    )}

                    {authSession?.role !== 'temporary_authenticator' && (
                      <button
                        type="button"
                        className={`top-nav-btn ${activePage === 'login' ? 'active-top-nav' : ''}`}
                        onClick={() => setActivePage('login')}
                      >
                        🔐 Logins
                      </button>
                    )}

                    {authSession?.role !== 'temporary_authenticator' && (
                      <button
                        type="button"
                        className={`top-nav-btn ${activePage === 'newMatchUpdate' ? 'active-top-nav' : ''}`}
                        onClick={() => setActivePage('newMatchUpdate')}
                      >
                        ➕ New Match
                      </button>
                    )}

                    <button
                      type="button"
                      className={`top-nav-btn ${activePage === 'matchManagement' ? 'active-top-nav' : ''}`}
                      onClick={() => setActivePage('matchManagement')}
                    >
                      🏆 Match Management
                    </button>

                    <button
                      type="button"
                      className={`top-nav-btn ${activePage === 'fixturesManagement' ? 'active-top-nav' : ''}`}
                      onClick={() => {
                        if (authSession?.assignedMatchId) {
                          const target = publishedMatches.find((m) => String(m.id) === String(authSession.assignedMatchId))
                          setSelectedMatch(target || null)
                        } else {
                          setSelectedMatch(null)
                        }
                        setFixturesCategory(null)
                        setActivePage('fixturesManagement')
                      }}
                    >
                      ⚡ Fixtures
                    </button>

                    <button
                      type="button"
                      onClick={() => setAuthOpen(false)}
                      className="top-nav-btn public-toggle-btn"
                    >
                      👁️ Public Feed
                    </button>
                  </nav>
                </div>

                {/* Sub-bar below: Logout & Live Stream */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid rgba(148, 163, 184, 0.12)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('badminton-organizer-session')
                      setAuthSession(null)
                      setAuthOpen(false)
                    }}
                    className="top-nav-btn"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '12px',
                    }}
                  >
                    🚪 Logout
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleLiveStream}
                    className="top-nav-btn"
                    style={{
                      background: isLiveStreamActive
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(185, 28, 28, 0.35) 100%)'
                        : 'rgba(30, 41, 59, 0.75)',
                      border: isLiveStreamActive
                        ? '1.5px solid #f87171'
                        : '1.5px solid rgba(148, 163, 184, 0.3)',
                      color: isLiveStreamActive ? '#fca5a5' : '#94a3b8',
                      fontWeight: '800',
                      boxShadow: isLiveStreamActive ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      cursor: 'pointer',
                    }}
                    title={isLiveStreamActive ? 'Live Stream is ON and active. Click to view Live Broadcast.' : 'Live Stream is OFF. Click to Start Live Stream.'}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isLiveStreamActive ? '#ef4444' : '#64748b',
                        boxShadow: isLiveStreamActive ? '0 0 8px #ef4444' : 'none',
                        animation: isLiveStreamActive ? 'stadiumPulse 1s infinite alternate' : 'none',
                      }}
                    />
                    <span>{isLiveStreamActive ? '🔴 Live Stream: ON' : '⚪ Live Stream: OFF'}</span>
                  </button>
                </div>
              </header>

              {activePage === 'liveScoreboard' && (
                <UmpireLiveScoringDashboard
                  session={authSession}
                  publishedMatches={publishedMatches}
                  onLogout={() => setActivePage('matchManagement')}
                  onNavigateToPublic={() => setAuthOpen(false)}
                />
              )}

              {activePage === 'login' && authSession?.role !== 'temporary_authenticator' && (
                <BadmintonLoginsPage
                  publishedMatches={publishedMatches}
                  currentSession={authSession}
                  onSessionChange={(session) => {
                    setAuthSession(session)
                    if (session?.assignedMatchId) {
                      const targetMatch = publishedMatches.find((m) => String(m.id) === String(session.assignedMatchId))
                      if (targetMatch) setSelectedMatch(targetMatch)
                    }
                  }}
                  onNavigateToFixtures={(matchId) => {
                    const targetMatch = publishedMatches.find((m) => String(m.id) === String(matchId || authSession?.assignedMatchId))
                    if (targetMatch) setSelectedMatch(targetMatch)
                    else setSelectedMatch(null)
                    setFixturesCategory(null)
                    setActivePage('fixturesManagement')
                  }}
                  onNavigateToNewMatch={() => setActivePage('newMatchUpdate')}
                  onNavigateToMatchManagement={() => setActivePage('matchManagement')}
                  onBackToPublic={() => setAuthOpen(false)}
                />
              )}

          {activePage === 'newMatchUpdate' && authSession?.role !== 'temporary_authenticator' && (
            <form className="auth-card auth-management" onSubmit={handleSubmit}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>{formData.id ? '✏️ Edit & Update Match' : '➕ New Match Update'}</h2>
                {formData.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(getInitialFormData())
                      setImagePreview('')
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel Edit ✕
                  </button>
                )}
              </div>

              <div className="field-grid auth-grid">
                <label>
                  Match Name
                  <input name="matchName" value={formData.matchName} onChange={handleChange} />
                </label>

                <label>
                  Match Address
                  <input name="matchAddress" value={formData.matchAddress} onChange={handleChange} />
                </label>

                <label>
                  Match Court Name
                  <input name="courtName" value={formData.courtName} onChange={handleChange} />
                </label>

                <div className="category-selector" style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '16px', padding: '18px', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ display: 'block', fontWeight: '700', color: '#f8fafc', fontSize: '15px' }}>
                        🏸 Match Categories
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Selected: <strong style={{ color: '#93c5fd' }}>{(formData.categories || []).length}</strong> categories
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(formData.categories || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, categories: [] }))}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid rgba(248, 113, 113, 0.4)',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fca5a5',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Selected Categories Tags */}
                  {(formData.categories || []).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px dashed rgba(96, 165, 250, 0.35)' }}>
                      {(formData.categories || []).map((category) => (
                        <span
                          key={category}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '999px',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)',
                            border: '1px solid rgba(96, 165, 250, 0.6)',
                            color: '#e0f2fe',
                            fontSize: '12px',
                            fontWeight: '700',
                            letterSpacing: '0.02em',
                          }}
                        >
                          🏸 {category}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                categories: (prev.categories || []).filter((item) => item !== category),
                              }))
                            }}
                            style={{
                              border: 'none',
                              background: 'rgba(255, 255, 255, 0.15)',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontSize: '11px',
                              padding: 0,
                              lineHeight: 1,
                              marginLeft: '2px',
                            }}
                            aria-label={`Remove ${category}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px dashed rgba(148, 163, 184, 0.3)', color: '#94a3b8', fontSize: '12px' }}>
                      ℹ️ No categories selected yet. Browse by group or search below to add categories.
                    </div>
                  )}

                  {/* Search Input with Clear Button */}
                  <div style={{ position: 'relative', marginBottom: '14px' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8', pointerEvents: 'none' }}>
                      🔍
                    </span>
                    <input
                      ref={categoryInputRef}
                      type="text"
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          const trimmed = categorySearch.trim()
                          if (trimmed && !(formData.categories || []).includes(trimmed)) {
                            setFormData((prev) => ({
                              ...prev,
                              categories: [...(prev.categories || []), trimmed],
                            }))
                            setCategorySearch('')
                          }
                        }
                      }}
                      placeholder="Search category (e.g. Under 9, Jumbled, 75+, U11, Men Singles)..."
                      style={{
                        width: '100%',
                        padding: '11px 40px 11px 38px',
                        borderRadius: '10px',
                        border: '1px solid rgba(96, 165, 250, 0.4)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: '#f8fafc',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategorySearch('')
                          categoryInputRef.current?.focus()
                        }}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'rgba(148, 163, 184, 0.2)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Add Custom Category Quick Action */}
                  {categorySearch.trim() && !(formData.categories || []).includes(categorySearch.trim()) && (
                    <div style={{ marginBottom: '12px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = categorySearch.trim()
                          if (trimmed) {
                            setFormData((prev) => ({
                              ...prev,
                              categories: [...(prev.categories || []), trimmed],
                            }))
                            setCategorySearch('')
                            categoryInputRef.current?.focus()
                          }
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: '1px solid #22c55e',
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: '#86efac',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        ➕ Add &ldquo;{categorySearch.trim()}&rdquo; as Category
                      </button>
                    </div>
                  )}

                  {/* Quick Category Filter Pills */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: '700' }}>
                      Browse Category Types:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {CATEGORY_FILTER_GROUPS.map((grp) => {
                        const isActive = categoryFilterGroup === grp.id && !categorySearch.trim()
                        return (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => {
                              setCategoryFilterGroup(grp.id)
                              setCategorySearch('')
                              categoryInputRef.current?.focus()
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '999px',
                              border: isActive ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.3)',
                              background: isActive ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)' : 'rgba(15, 23, 42, 0.6)',
                              color: isActive ? '#ffffff' : '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{grp.icon}</span>
                            <span>{grp.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Filtered / Available Categories Header & Quick Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
                      {categorySearch.trim()
                        ? `Search Results (${filteredCategories.length})`
                        : `${CATEGORY_FILTER_GROUPS.find((g) => g.id === categoryFilterGroup)?.label || 'Available'} (${filteredCategories.length})`}
                    </span>

                    {filteredCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => {
                            const selected = prev.categories || []
                            const toAdd = filteredCategories.filter((cat) => !selected.includes(cat))
                            return { ...prev, categories: [...selected, ...toAdd] }
                          })
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#60a5fa',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        + Select All in this list
                      </button>
                    )}
                  </div>

                  {/* Scrollable Categories List */}
                  <div
                    style={{
                      maxHeight: '230px',
                      overflowY: 'auto',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(10, 15, 29, 0.85)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      alignContent: 'flex-start',
                    }}
                  >
                    {filteredCategories.map((category) => {
                      const isSelected = (formData.categories || []).includes(category)

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => {
                              const selected = prev.categories || []
                              const updatedCategories = selected.includes(category)
                                ? selected.filter((item) => item !== category)
                                : [...selected, category]

                              return {
                                ...prev,
                                categories: updatedCategories,
                              }
                            })
                          }}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.3)',
                            background: isSelected ? 'rgba(59, 130, 246, 0.95)' : 'rgba(30, 41, 59, 0.65)',
                            color: isSelected ? '#ffffff' : '#cbd5e1',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            fontWeight: isSelected ? '700' : '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{category}</span>
                        </button>
                      )
                    })}

                    {filteredCategories.length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: '#94a3b8', fontSize: '12px' }}>
                        No matching categories found for &ldquo;{categorySearch}&rdquo;. Click the button above to add it as a custom category!
                      </div>
                    )}
                  </div>
                </div>

                <BadmintonDatePicker
                  startDate={formData.startDate}
                  endDate={formData.endDate}
                  totalDays={formData.totalDays}
                  onChange={({ startDate, endDate, totalDays }) => {
                    setFormData((prev) => ({
                      ...prev,
                      startDate,
                      endDate,
                      totalDays,
                    }))
                  }}
                />

                <label>
                  Organizer Name
                  <input name="organizerName" value={formData.organizerName} onChange={handleChange} />
                </label>

                <label>
                  Organizer Mobile Number
                  <input name="organizerMobile" value={formData.organizerMobile} onChange={handleChange} />
                </label>
              </div>

              <label className="image-upload-wrap">
                Match Image
                <input type="file" accept="image/*" name="image" onChange={handleChange} />
              </label>

              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="preview-image" />
              )}

              <div className="auth-actions auth-row" style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="primary-btn">
                  {formData.id ? '💾 Save & Update Match' : '🚀 Publish Match'}
                </button>
                {formData.id && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setFormData(getInitialFormData())
                      setImagePreview('')
                      setActivePage('matchManagement')
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {activePage === 'fixturesManagement' && (
            <div className="auth-card auth-management" style={{ maxWidth: '1400px', width: '100%', padding: '24px' }}>
              <BadmintonFixturesManager
                publishedMatches={effectivePublishedMatches}
                authenticators={authenticators}
                selectedMatch={selectedMatch || (authSession?.assignedMatchId ? effectivePublishedMatches[0] : null)}
                initialCategory={fixturesCategory}
                onSelectMatch={setSelectedMatch}
                onAddParticipant={(matchId, newParticipant) => {
                  const cleanParticipant = sanitizeParticipant(newParticipant)
                  setAuthenticators((prev) => ({
                    ...prev,
                    [matchId]: [
                      ...(prev[matchId] || []),
                      {
                        id: Date.now(),
                        ...cleanParticipant,
                      }
                    ]
                  }))
                }}
                onUpdateParticipant={(matchId, updatedParticipant) => {
                  const cleanParticipant = sanitizeParticipant(updatedParticipant)
                  setAuthenticators((prev) => {
                    const matchKey = matchId
                    const currentList = prev[matchKey] || prev[String(matchKey)] || []
                    const nextList = currentList.map((p) =>
                      String(p.id) === String(cleanParticipant.id) ? { ...p, ...cleanParticipant } : p
                    )
                    const next = { ...prev, [matchKey]: nextList, [String(matchKey)]: nextList }
                    try {
                      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
                    } catch (e) {}
                    return next
                  })
                  setSuccessToast(`✓ Updated player "${cleanParticipant.name}"!`)
                }}
                onBackToMatchManagement={() => setActivePage('matchManagement')}
              />
            </div>
          )}

          {activePage === 'matchManagement' && (
            <div className="auth-card auth-management">
              {selectedMatch && (
                <div style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMatch(null)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(96, 165, 250, 0.35)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)')}
                  >
                    ← Back to Matches
                  </button>
                </div>
              )}

              <h2>Match Management</h2>

              {!selectedMatch ? (
                <div className="management-list" style={{ overflowX: 'auto' }}>
                  {effectivePublishedMatches.length > 0 ? (
                    <div style={{ display: 'grid', gap: '14px' }}>
                      {effectivePublishedMatches.map((match) => {
                        const status = getMatchStatus(match)
                        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

                        return (
                          <div
                            key={match.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1.2fr) auto',
                              gap: '12px',
                              alignItems: 'center',
                              padding: '16px 18px',
                              borderRadius: '14px',
                              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.7))',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.5)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.2)'}
                          >
                            <div onClick={() => handleSelectMatchForManagement(match)} style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer' }}>
                              {match.image ? (
                                <img src={match.image} alt={match.matchName} style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }} />
                              ) : (
                                <div style={{ width: '52px', height: '52px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100, 116, 139, 0.35)', color: '#cbd5e1', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>IMG</div>
                              )}

                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: '700' }}>Tournament</div>
                                <strong style={{ display: 'block', color: '#f8fafc', fontSize: '15px', fontWeight: '800', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatTournamentName(match.matchName)}
                                </strong>
                              </div>
                            </div>

                            <div onClick={() => handleSelectMatchForManagement(match)} style={{ cursor: 'pointer' }}>
                              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: '700' }}>Court</div>
                              <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '13px' }}>{formatCourtName(match.courtName)}</div>
                            </div>

                            <div onClick={() => handleSelectMatchForManagement(match)} style={{ cursor: 'pointer' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Dates</span>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: status === 'completed' ? 'rgba(168,85,247,0.2)' : status === 'ongoing' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.18)',
                                  color: status === 'completed' ? '#d8b4fe' : status === 'ongoing' ? '#86efac' : '#93c5fd',
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  letterSpacing: '0.04em',
                                }}>{status === 'completed' ? '🏆 Completed' : statusLabel}</span>
                              </div>

                              <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '10.5px', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                                {formatDisplayDate(match.startDate)} - {formatDisplayDate(match.endDate)}
                              </div>

                              {match.categoryWinners && Object.keys(match.categoryWinners).length > 0 ? (
                                <div style={{ fontSize: '11px', color: '#fde047', fontWeight: '700', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {Object.entries(match.categoryWinners).map(([cat, wName]) => (
                                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ color: '#cbd5e1', fontSize: '10.5px' }}>🏸 {cat}:</span>
                                      <span style={{ color: '#fef08a', fontWeight: '800' }}>{wName}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : match.winner ? (
                                <div style={{ fontSize: '11px', color: '#fde047', fontWeight: '800', marginTop: '3px' }}>
                                  🏆 Winner: {match.winner}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                title="Edit Match Details & Categories"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingMatch(match)
                                }}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(248, 113, 113, 0.6)',
                                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.25) 100%)',
                                  color: '#fca5a5',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                ⚙️ Match Manage
                              </button>

                              <button
                                type="button"
                                aria-label={`Delete ${match.matchName}`}
                                title="Delete match"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setDeleteConfirmState({
                                    title: 'Delete Tournament?',
                                    message: 'Are you sure you want to permanently delete this tournament? All match draws, categories, seedings, and registered players will be deleted.',
                                    itemName: match.matchName,
                                    onConfirm: () => handleDeleteMatch(match.id),
                                  })
                                }}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(248, 113, 113, 0.5)',
                                  background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.9), rgba(69, 10, 10, 0.9))',
                                  color: '#fecaca',
                                  cursor: 'pointer',
                                  fontSize: '18px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0,
                                  boxShadow: '0 0 0 1px rgba(248, 113, 113, 0.12)',
                                }}
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="list-item" style={{ padding: '16px', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}><span style={{ color: '#94a3b8' }}>No Matches Published</span><strong style={{ color: '#cbd5e1' }}>Publish a match to view it here.</strong></div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Premium Tournament Hero Banner */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(20, 32, 54, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
                      border: '1px solid rgba(56, 189, 248, 0.28)',
                      borderRadius: '16px',
                      padding: '18px 20px',
                      marginBottom: '20px',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                      {selectedMatch.image ? (
                        <img
                          src={selectedMatch.image}
                          alt={selectedMatch.matchName}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '12px',
                            border: '1.5px solid rgba(56, 189, 248, 0.35)',
                            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%)',
                            border: '1.5px solid rgba(56, 189, 248, 0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '26px',
                            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                            flexShrink: 0,
                          }}
                        >
                          🏸
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#ffffff',
                              letterSpacing: '-0.01em',
                              fontFamily: 'var(--font-heading)',
                            }}
                          >
                            {formatTournamentName(selectedMatch.matchName)}
                          </h3>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '999px',
                              background:
                                getMatchStatus(selectedMatch) === 'completed'
                                  ? 'rgba(168, 85, 247, 0.25)'
                                  : getMatchStatus(selectedMatch) === 'ongoing'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : 'rgba(59, 130, 246, 0.2)',
                              color:
                                getMatchStatus(selectedMatch) === 'completed'
                                  ? '#d8b4fe'
                                  : getMatchStatus(selectedMatch) === 'ongoing'
                                  ? '#86efac'
                                  : '#93c5fd',
                              fontSize: '11px',
                              fontWeight: '800',
                              border:
                                getMatchStatus(selectedMatch) === 'completed'
                                  ? '1px solid rgba(168, 85, 247, 0.4)'
                                  : getMatchStatus(selectedMatch) === 'ongoing'
                                  ? '1px solid rgba(34, 197, 94, 0.4)'
                                  : '1px solid rgba(59, 130, 246, 0.4)',
                            }}
                          >
                            {getMatchStatus(selectedMatch) === 'completed'
                              ? '🏆 Completed'
                              : getMatchStatus(selectedMatch) === 'ongoing'
                              ? '🟢 Ongoing'
                              : '📅 Upcoming'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px', color: '#cbd5e1' }}>
                          {selectedMatch.courtName && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <span>🏟️</span>
                              <strong style={{ color: '#f1f5f9' }}>{formatCourtName(selectedMatch.courtName)}</strong>
                            </span>
                          )}
                          {selectedMatch.matchAddress && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
                              <span>📍</span>
                              <span>{formatAddress(selectedMatch.matchAddress)}</span>
                            </span>
                          )}
                          {(selectedMatch.startDate || selectedMatch.endDate) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontWeight: '700', fontSize: '11.5px' }}>
                              <span>📅</span>
                              <span>{formatDisplayDate(selectedMatch.startDate)} - {formatDisplayDate(selectedMatch.endDate)}</span>
                            </span>
                          )}
                        </div>

                        {selectedMatch.categoryWinners && Object.keys(selectedMatch.categoryWinners).length > 0 ? (
                          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {Object.entries(selectedMatch.categoryWinners).map(([cat, wName]) => (
                              <span
                                key={cat}
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  background: 'rgba(234, 179, 8, 0.15)',
                                  border: '1px solid rgba(234, 179, 8, 0.4)',
                                  color: '#fef08a',
                                  fontSize: '11.5px',
                                  fontWeight: '800',
                                }}
                              >
                                🏆 {cat}: {wName}
                              </span>
                            ))}
                          </div>
                        ) : selectedMatch.winner ? (
                          <div style={{ fontSize: '12px', color: '#fde047', fontWeight: '800', marginTop: '6px' }}>
                            🏆 Tournament Winner: {selectedMatch.winner}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '10px',
                          padding: '8px 14px',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                          Registered Players
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <h4 style={{ color: '#e2e8f0', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏸 Add Players to Match
                      </h4>
                      <span style={{ fontSize: '12px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '4px 10px', borderRadius: '999px', fontWeight: '600' }}>
                        Total Registered: {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length} Players
                      </span>
                    </div>

                    {/* Category Selection Tabs */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Category:</span>
                      <button
                        type="button"
                        onClick={() => setActiveCategory('ALL')}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '999px',
                          background: activeCategory === 'ALL' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(15, 23, 42, 0.75)',
                          border: activeCategory === 'ALL' ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.35)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>🌐 All Categories</span>
                        <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '999px', fontSize: '10px' }}>
                          {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length}
                        </span>
                      </button>

                      {selectedMatchCategories.map((category) => {
                        const count = (authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).filter(
                          (p) => (p.category || selectedMatchCategories[0]) === category
                        ).length
                        const isCatActive = (activeCategory || selectedMatchCategories[0]) === category
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {
                              setActiveCategory(category)
                              setParticipantForm((prev) => {
                                const isNowDoubles = isDoublesCategory(category)
                                if (isNowDoubles) {
                                  const [s1, s2] = splitDoublesNames(prev.name || '')
                                  return {
                                    ...prev,
                                    category,
                                    name1: prev.name1 || s1,
                                    name2: prev.name2 || s2,
                                  }
                                }
                                return {
                                  ...prev,
                                  category,
                                  name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
                                }
                              })
                            }}
                            style={{
                              padding: '7px 14px',
                              borderRadius: '999px',
                              background: isCatActive ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(15, 23, 42, 0.75)',
                              border: isCatActive ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.35)',
                              color: '#fff',
                              cursor: 'pointer',
                              fontWeight: '700',
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>🏸 {category}</span>
                            <span style={{ background: isCatActive ? 'rgba(255,255,255,0.25)' : 'rgba(148, 163, 184, 0.2)', padding: '2px 6px', borderRadius: '999px', fontSize: '10px' }}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Success Toast */}
                    {successToast && (
                      <div
                        style={{
                          padding: '12px 18px',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '700',
                          marginBottom: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>✨</span>
                        <span>{successToast}</span>
                      </div>
                    )}

                    {/* Add / Modify Player Input Row */}
                    {(() => {
                      const effectiveFormCategory = (activeCategory && activeCategory !== 'ALL')
                        ? activeCategory
                        : (participantForm.category || selectedMatchCategories[0] || 'Men Singles')
                      const isFormDoubles = isDoublesCategory(effectiveFormCategory)
                      const isFormValid = isFormDoubles
                        ? Boolean((participantForm.name1?.trim() && participantForm.name2?.trim()) || participantForm.name?.trim())
                        : Boolean(participantForm.name?.trim())

                      return (
                        <div style={{ background: 'rgba(15, 23, 42, 0.45)', padding: '16px', borderRadius: '12px', border: isFormDoubles ? '1.5px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(148, 163, 184, 0.15)', boxShadow: isFormDoubles ? '0 4px 20px rgba(168, 85, 247, 0.08)' : 'none' }}>
                          {/* Banner when editing / doubles mode */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: isFormDoubles ? '#d8b4fe' : '#93c5fd' }}>
                                {editingParticipantId
                                  ? (isFormDoubles ? '✏️ Modify Doubles Pair' : '✏️ Modify Player')
                                  : (isFormDoubles ? '👥 Add New Doubles Pair' : '👤 Add New Player')}
                              </span>
                              {isFormDoubles && (
                                <span style={{ fontSize: '10.5px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid #c084fc', color: '#f3e8ff', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                                  2 Name Inputs Required (Player 1 & Partner)
                                </span>
                              )}
                            </div>
                            {editingParticipantId && (
                              <button
                                type="button"
                                onClick={() => resetParticipantForm()}
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(248, 113, 113, 0.4)',
                                  color: '#fca5a5',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel Edit ✕
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: isFormDoubles ? 'repeat(auto-fit, minmax(170px, 1fr)) auto' : 'repeat(auto-fit, minmax(180px, 1fr)) auto', gap: '12px', alignItems: 'flex-end' }}>
                            {isFormDoubles ? (
                              <>
                                <label style={{ color: '#cbd5e1' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '12.5px', color: '#60a5fa' }}>
                                    👤 Player 1 Name <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                                  </span>
                                  <input 
                                    type="text"
                                    value={participantForm.name1}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setParticipantForm((prev) => ({
                                        ...prev,
                                        name1: val,
                                        name: joinDoublesNames(val, prev.name2),
                                      }))
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddParticipant()
                                      }
                                    }}
                                    placeholder="e.g. Satwiksairaj (Player 1)"
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      marginTop: '6px',
                                      border: !participantForm.name1?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                      color: '#f8fafc',
                                      outline: 'none',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </label>

                                <label style={{ color: '#cbd5e1' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '12.5px', color: '#c084fc' }}>
                                    👥 Player 2 Name (Partner) <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                                  </span>
                                  <input 
                                    type="text"
                                    value={participantForm.name2}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setParticipantForm((prev) => ({
                                        ...prev,
                                        name2: val,
                                        name: joinDoublesNames(prev.name1, val),
                                      }))
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddParticipant()
                                      }
                                    }}
                                    placeholder="e.g. Chirag Shetty (Player 2)"
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      marginTop: '6px',
                                      border: !participantForm.name2?.trim() ? '1px solid rgba(192, 132, 252, 0.3)' : '1.5px solid rgba(168, 85, 247, 0.8)',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                      color: '#f8fafc',
                                      outline: 'none',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                </label>
                              </>
                            ) : (
                              <label style={{ color: '#cbd5e1' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '13px', color: '#f8fafc' }}>
                                  Player Name <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                                </span>
                                <input 
                                  type="text"
                                  value={participantForm.name}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setParticipantForm((prev) => ({
                                      ...prev,
                                      name: val,
                                      name1: val,
                                      name2: '',
                                    }))
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddParticipant()
                                    }
                                  }}
                                  placeholder="Enter player name (Mandatory)"
                                  style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    marginTop: '6px',
                                    border: !participantForm.name?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1px solid rgba(59, 130, 246, 0.8)',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                    color: '#f8fafc',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              </label>
                            )}

                            <label style={{ color: '#94a3b8' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                                Category
                              </span>
                              <select
                                value={(activeCategory && activeCategory !== 'ALL') ? activeCategory : (participantForm.category || selectedMatchCategories[0])}
                                onChange={(e) => {
                                  const newCat = e.target.value
                                  setActiveCategory(newCat)
                                  setParticipantForm((prev) => {
                                    const isNowDoubles = isDoublesCategory(newCat)
                                    if (isNowDoubles) {
                                      const [s1, s2] = splitDoublesNames(prev.name || '')
                                      return {
                                        ...prev,
                                        category: newCat,
                                        name1: prev.name1 || s1,
                                        name2: prev.name2 || s2,
                                      }
                                    }
                                    return {
                                      ...prev,
                                      category: newCat,
                                      name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
                                    }
                                  })
                                }}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  marginTop: '6px',
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                  color: '#f8fafc',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {selectedMatchCategories.map((c) => (
                                  <option key={c} value={c} style={{ background: '#0f172a', color: '#f8fafc' }}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label style={{ color: '#94a3b8' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                                Court Name <span style={{ fontSize: '11px', color: '#64748b' }}>(Optional)</span>
                              </span>
                              <input 
                                type="text"
                                value={participantForm.court}
                                onChange={(e) => setParticipantForm({ ...participantForm, court: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddParticipant()
                                  }
                                }}
                                placeholder="Optional (e.g. Court 1)"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  marginTop: '6px',
                                  border: '1px solid rgba(148, 163, 184, 0.2)',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                  color: '#e2e8f0',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </label>

                            <label style={{ color: '#94a3b8' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                                Place <span style={{ fontSize: '11px', color: '#64748b' }}>(Optional)</span>
                              </span>
                              <input 
                                type="text"
                                value={participantForm.place}
                                onChange={(e) => setParticipantForm({ ...participantForm, place: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleAddParticipant()
                                  }
                                }}
                                placeholder="Optional (e.g. Chennai)"
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  marginTop: '6px',
                                  border: '1px solid rgba(148, 163, 184, 0.2)',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                                  color: '#e2e8f0',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </label>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={handleAddParticipant}
                                disabled={!isFormValid}
                                style={{
                                  padding: '10px 20px',
                                  background: isFormValid
                                    ? (isFormDoubles
                                      ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                                    : 'rgba(100, 116, 139, 0.3)',
                                  color: isFormValid ? '#ffffff' : '#64748b',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: isFormValid ? 'pointer' : 'not-allowed',
                                  fontWeight: '700',
                                  fontSize: '13px',
                                  whiteSpace: 'nowrap',
                                  height: '42px',
                                  boxShadow: isFormValid ? (isFormDoubles ? '0 2px 8px rgba(168, 85, 247, 0.4)' : '0 2px 8px rgba(37, 99, 235, 0.4)') : 'none',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {editingParticipantId
                                  ? (isFormDoubles ? '✓ Save Doubles Pair' : '✓ Save Changes')
                                  : (isFormDoubles ? '+ Add Doubles Pair' : '+ Add Player')}
                              </button>

                              {editingParticipantId && (
                                <button
                                  type="button"
                                  onClick={() => resetParticipantForm()}
                                  style={{
                                    padding: '10px 14px',
                                    background: 'rgba(148, 163, 184, 0.2)',
                                    color: '#cbd5e1',
                                    border: '1px solid rgba(148, 163, 184, 0.3)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '13px',
                                    height: '42px',
                                  }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Players List Table */}
                  <div style={{ marginTop: '28px' }}>
                    {/* Header & Controls Toolbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h4 style={{ color: '#f8fafc', margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>📋</span>
                          <span>Registered Players</span>
                          <span style={{ background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>
                            {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).filter((p) => activeCategory === 'ALL' || (p.category || selectedMatchCategories[0]) === (activeCategory || selectedMatchCategories[0])).length}
                          </span>
                        </h4>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                          Viewing: <strong style={{ color: '#7dd3fc' }}>{activeCategory === 'ALL' ? 'All Tournament Categories' : (activeCategory || selectedMatchCategories[0])}</strong>
                        </div>
                      </div>

                      {/* Instant Search Box */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ position: 'relative', minWidth: '250px' }}>
                          <input
                            type="text"
                            placeholder="🔍 Search name, partner, club..."
                            value={playerFilterSearch}
                            onChange={(e) => setPlayerFilterSearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 30px 8px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              background: 'rgba(15, 23, 42, 0.8)',
                              color: '#fff',
                              fontSize: '12.5px',
                              outline: 'none',
                            }}
                          />
                          {playerFilterSearch && (
                            <button
                              type="button"
                              onClick={() => setPlayerFilterSearch('')}
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: '#e2e8f0',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                padding: 0,
                              }}
                              title="Clear search"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Table of Players */}
                    {(() => {
                      const matchKey = selectedMatch?.id
                      const allList = (matchKey !== undefined && matchKey !== null)
                        ? (
                            (authenticators && (authenticators[matchKey] || authenticators[String(matchKey)] || authenticators[Number(matchKey)])) ||
                            (selectedMatch && (selectedMatch.authenticators || selectedMatch.participants)) ||
                            []
                          )
                        : []
                      const categoryOrderMap = {}
                      selectedMatchCategories.forEach((cat, idx) => {
                        categoryOrderMap[cat] = idx
                      })

                      // Filter & Sort neatly
                      const filtered = allList
                        .filter((participant) => {
                          const cat = (participant.category || selectedMatchCategories[0] || 'Men Singles').trim()
                          const matchesCat = activeCategory === 'ALL' || cat.toLowerCase() === activeCategory.trim().toLowerCase()
                          if (!matchesCat) return false

                          if (!playerFilterSearch.trim()) return true
                          const query = playerFilterSearch.toLowerCase()
                          const nameMatch = (participant.name || '').toLowerCase().includes(query)
                          const placeMatch = (participant.place || '').toLowerCase().includes(query)
                          const courtMatch = (participant.court || '').toLowerCase().includes(query)
                          const catMatch = cat.toLowerCase().includes(query)
                          return nameMatch || placeMatch || courtMatch || catMatch
                        })
                        .sort((a, b) => {
                          const catA = a.category || selectedMatchCategories[0] || ''
                          const catB = b.category || selectedMatchCategories[0] || ''

                          // Group by category first when in ALL mode
                          if (activeCategory === 'ALL' && catA !== catB) {
                            const orderA = categoryOrderMap[catA] ?? 99
                            const orderB = categoryOrderMap[catB] ?? 99
                            if (orderA !== orderB) return orderA - orderB
                            return catA.localeCompare(catB)
                          }

                          // If seeds exist, put seeds first (S1, S2, S3...)
                          if (a.seed && b.seed) return Number(a.seed) - Number(b.seed)
                          if (a.seed) return -1
                          if (b.seed) return 1

                          // Alphabetical sort by player name for clean order
                          return (a.name || '').localeCompare(b.name || '')
                        })

                      if (filtered.length === 0) {
                        return (
                          <div style={{ padding: '36px 20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '14px', color: '#94a3b8', border: '1.5px dashed rgba(148, 163, 184, 0.22)' }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏸</div>
                            <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '15px' }}>
                              {playerFilterSearch ? `No players found matching "${playerFilterSearch}"` : `No players registered in ${activeCategory === 'ALL' ? 'this tournament' : activeCategory} yet`}
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>
                              {playerFilterSearch ? 'Try clearing your search keyword.' : 'Use the form above to add players.'}
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(148, 163, 184, 0.2)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'rgba(13, 22, 39, 0.95)' }}>
                            <thead>
                              <tr style={{ background: 'linear-gradient(180deg, rgba(20, 32, 54, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)', borderBottom: '1.5px solid rgba(56, 189, 248, 0.3)' }}>
                                <th style={{ color: '#94a3b8', textAlign: 'center', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', width: '50px' }}>#</th>
                                <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Player / Team Name</th>
                                <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Category</th>
                                <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Court</th>
                                <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Place / Club</th>
                                <th style={{ color: '#e2e8f0', textAlign: 'right', padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', width: '150px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((participant, pIdx) => {
                                const cat = participant.category || selectedMatchCategories[0] || 'Men Singles'
                                const isDoubles = isDoublesCategory(cat)

                                return (
                                  <tr
                                    key={participant.id || `p-${pIdx}`}
                                    style={{
                                      borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                                      background: pIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'rgba(20, 32, 54, 0.4)',
                                      transition: 'background 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = pIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'rgba(20, 32, 54, 0.4)')}
                                  >
                                    {/* Sequential Index */}
                                    <td style={{ textAlign: 'center', padding: '12px 14px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                                      {pIdx + 1}
                                    </td>

                                    {/* Player / Pair Name */}
                                    <td style={{ color: '#ffffff', padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {Boolean(participant.seed || participant.isSeed) && (
                                          <span
                                            style={{
                                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                              color: '#ffffff',
                                              fontSize: '10.5px',
                                              fontWeight: '900',
                                              padding: '2px 7px',
                                              borderRadius: '6px',
                                              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                                              fontFamily: 'var(--font-mono)',
                                            }}
                                            title={`Seed #${participant.seed}`}
                                          >
                                            S{participant.seed}
                                          </span>
                                        )}

                                        {isDoubles && (
                                          <span
                                            style={{
                                              fontSize: '10.5px',
                                              background: 'rgba(168, 85, 247, 0.2)',
                                              border: '1px solid rgba(168, 85, 247, 0.45)',
                                              color: '#e9d5ff',
                                              padding: '2px 7px',
                                              borderRadius: '6px',
                                              fontWeight: '800',
                                              letterSpacing: '0.02em',
                                            }}
                                            title="Doubles Pair"
                                          >
                                            👥 Doubles
                                          </span>
                                        )}

                                        <strong style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '700' }}>
                                          {formatPersonName(participant.name, 'Player')}
                                        </strong>
                                      </div>
                                    </td>

                                    {/* Category Pill */}
                                    <td style={{ padding: '12px 14px' }}>
                                      <span
                                        style={{
                                          background: isDoubles ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                          border: isDoubles ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
                                          color: isDoubles ? '#d8b4fe' : '#7dd3fc',
                                          padding: '3px 9px',
                                          borderRadius: '8px',
                                          fontWeight: '700',
                                          fontSize: '11.5px',
                                          display: 'inline-block',
                                        }}
                                      >
                                        {formatCategoryName(cat)}
                                      </span>
                                    </td>

                                    {/* Court */}
                                    <td style={{ color: '#cbd5e1', padding: '12px 14px', fontSize: '13px' }}>
                                      {participant.court ? (
                                        <span style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                                          {formatCourtName(participant.court, '')}
                                        </span>
                                      ) : (
                                        <span style={{ color: '#64748b' }}>—</span>
                                      )}
                                    </td>

                                    {/* Place / Club */}
                                    <td style={{ color: '#cbd5e1', padding: '12px 14px', fontSize: '13px' }}>
                                      {participant.place ? formatPlaceOrClub(participant.place, '') : <span style={{ color: '#64748b' }}>—</span>}
                                    </td>

                                    {/* Actions (Modify / Delete) */}
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenModifyModal(participant)}
                                          style={{
                                            padding: '6px 12px',
                                            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.25) 100%)',
                                            color: '#7dd3fc',
                                            border: '1px solid rgba(56, 189, 248, 0.4)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.15s ease',
                                          }}
                                          title="Modify player or doubles pair name & details"
                                        >
                                          ✏️ Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteConfirmState({
                                              title: 'Remove Registered Player?',
                                              message: `Are you sure you want to remove "${participant.name}" from this tournament registration?`,
                                              itemName: participant.name,
                                              onConfirm: () => handleRemoveParticipant(selectedMatch.id, participant.id),
                                            })
                                          }}
                                          style={{
                                            padding: '6px 10px',
                                            background: 'rgba(239, 68, 68, 0.18)',
                                            color: '#fca5a5',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            transition: 'all 0.15s ease',
                                          }}
                                          title="Delete Player"
                                        >
                                          🗑️ Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>

                    {/* Match Management Bottom Right Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '24px',
                        paddingTop: '18px',
                        borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                        flexWrap: 'wrap',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <div style={{ color: '#f8fafc', fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>
                          Tournament Configuration & Details
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                          Modify tournament name, categories, start/end dates, court, venue or organizer details.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingMatch(selectedMatch)}
                        style={{
                          padding: '12px 24px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: '#ffffff',
                          border: '1px solid rgba(252, 165, 165, 0.6)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.45)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        ⚙️ Match Manage
                      </button>
                    </div>
                  </div>
              )}
            </div>
          )}
          </>
        )}
        </div>
      )}

      {/* Global Category & Seeding Fixture Generation Modal */}
      <FixtureSeedingModal
        isOpen={!!seedingModalMatch}
        onClose={() => {
          setSeedingModalMatch(null)
          setSeedingModalCategory(null)
        }}
        match={seedingModalMatch}
        authenticators={authenticators}
        initialCategory={seedingModalCategory}
        onGenerate={handleGenerateAndOpenFixtures}
      />

      {/* Organizer Auth & Login Gatekeeper Modal */}
      <OrganizerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(session) => {
          setIsAuthModalOpen(false)
          setAuthSession(session)
          setAuthOpen(true)
          if (session?.role === 'temporary_authenticator' && session?.assignedMatchId) {
            const target = publishedMatches.find((m) => String(m.id) === String(session.assignedMatchId))
            if (target) setSelectedMatch(target)
            setActivePage('fixturesManagement')
            setSuccessToast(`✓ Temporary Access Active: ${session.assignedMatchName || session.name}`)
          } else {
            setActivePage('login')
            setSuccessToast(`Welcome back, Chief Organizer (${session.username})!`)
          }
          setTimeout(() => setSuccessToast(''), 3000)
        }}
      />

      {/* Match Edit / Management Modal */}
      <MatchEditModal
        isOpen={!!editingMatch}
        onClose={() => setEditingMatch(null)}
        match={editingMatch}
        onSave={handleSaveEditedMatch}
      />



      {/* Dedicated Modify Player / Doubles Pair Modal */}
      {modifyingParticipant && (() => {
        const isDoubles = isDoublesCategory(modifyForm.category)
        const isFormValid = isDoubles
          ? Boolean((modifyForm.name1?.trim() && modifyForm.name2?.trim()) || modifyForm.name?.trim())
          : Boolean(modifyForm.name?.trim() || modifyForm.name1?.trim())

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
            onClick={() => setModifyingParticipant(null)}
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
                      ? 'Update Player 1 and Player 2 (Partner) names. Both names will be saved together.'
                      : 'Update participant name, court, or place.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModifyingParticipant(null)}
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

              {/* Form Fields */}
              <form onSubmit={handleSaveModifiedParticipant}>
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
                          value={modifyForm.name1}
                          onChange={(e) => {
                            const val = e.target.value
                            setModifyForm((prev) => ({
                              ...prev,
                              name1: val,
                              name: joinDoublesNames(val, prev.name2),
                            }))
                          }}
                          placeholder="e.g. Satwiksairaj"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: !modifyForm.name1?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
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
                          value={modifyForm.name2}
                          onChange={(e) => {
                            const val = e.target.value
                            setModifyForm((prev) => ({
                              ...prev,
                              name2: val,
                              name: joinDoublesNames(prev.name1, val),
                            }))
                          }}
                          placeholder="e.g. Chirag Shetty"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: !modifyForm.name2?.trim() ? '1px solid rgba(192, 132, 252, 0.3)' : '1.5px solid rgba(168, 85, 247, 0.8)',
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
                        value={modifyForm.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setModifyForm((prev) => ({
                            ...prev,
                            name: val,
                            name1: val,
                            name2: '',
                          }))
                        }}
                        placeholder="Enter Player Name"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: !modifyForm.name?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
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
                        🏸 Category
                      </span>
                      <select
                        value={modifyForm.category}
                        onChange={(e) => {
                          const newCat = e.target.value
                          const isNowDoubles = isDoublesCategory(newCat)
                          setModifyForm((prev) => {
                            if (isNowDoubles) {
                              const [s1, s2] = splitDoublesNames(prev.name || '')
                              return {
                                ...prev,
                                category: newCat,
                                name1: prev.name1 || s1,
                                name2: prev.name2 || s2,
                              }
                            }
                            return {
                              ...prev,
                              category: newCat,
                              name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
                            }
                          })
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          color: '#f8fafc',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      >
                        {selectedMatchCategories.map((c) => (
                          <option key={c} value={c} style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                        Court Name (Optional)
                      </span>
                      <input
                        type="text"
                        value={modifyForm.court}
                        onChange={(e) => setModifyForm((prev) => ({ ...prev, court: e.target.value }))}
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
                        value={modifyForm.place}
                        onChange={(e) => setModifyForm((prev) => ({ ...prev, place: e.target.value }))}
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

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setModifyingParticipant(null)}
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

      {/* Success Toast */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 999999,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(16, 185, 129, 0.4)',
            fontSize: '14px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <span>{successToast}</span>
        </div>
      )}
      {/* Organizer Auth Modal */}
      <OrganizerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(session) => {
          setIsAuthModalOpen(false)
          setAuthSession(session)
          setAuthOpen(true)
          try {
            localStorage.setItem('badminton-organizer-session', JSON.stringify(session))
          } catch {}
          setSuccessToast(`✓ Welcome back, ${session.username || 'Organizer'}!`)
        }}
      />

      {/* Tournament Results & Podium Modal */}
      <TournamentResultsModal
        isOpen={Boolean(resultModalMatch)}
        tournament={resultModalMatch}
        onClose={() => setResultModalMatch(null)}
        publishedStatusMap={publishedStatusMap}
      />

      {/* Live Stream Setup Prompt Modal */}
      {isLiveStreamSetupModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLiveStreamSetupModalOpen(false)
          }}
        >
          <div
            style={{
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              borderRadius: '20px',
              padding: '24px 28px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.25)',
              color: '#f8fafc',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>📺</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: '900' }}>
                    Live Broadcast Setup
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Configure stadium courts & naming for Live Cast
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLiveStreamSetupModalOpen(false)}
                style={{
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            {/* 1. Court Count Manual Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🏟️ 1. How Many Active Courts are In-Play? (Enter Court Count):
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStreamCourtsCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1.5px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontSize: '18px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  title="Decrease Court Count"
                >
                  −
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={streamCourtsCount}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9]/g, '')
                      setStreamCourtsCount(cleaned)
                    }}
                    placeholder="Enter number of courts (e.g. 4)"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#0f172a',
                      border: '2px solid #38bdf8',
                      color: '#ffffff',
                      fontSize: '16px',
                      fontWeight: '900',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8', fontWeight: '800', pointerEvents: 'none' }}>
                    Courts
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setStreamCourtsCount((prev) => (Number(prev) || 0) + 1)}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    border: '1.5px solid rgba(56, 189, 248, 0.4)',
                    color: '#38bdf8',
                    fontSize: '18px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  title="Increase Court Count"
                >
                  +
                </button>
              </div>
            </div>

            {/* 2. Court Naming Style Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🏷️ 2. Court Naming Style:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '8px' }}>
                {[
                  { id: 'alphabet', label: '🔤 Alphabetical', sub: 'Court A, Court B...' },
                  { id: 'numbers', label: '🔢 Numeric', sub: 'Court 1, Court 2...' },
                  { id: 'roman', label: '🏛️ Roman Numerals', sub: 'Court I, Court II...' },
                  { id: 'custom', label: '✏️ Custom Names', sub: 'Comma-separated names' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setStreamCourtFormat(fmt.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: streamCourtFormat === fmt.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.65)',
                      border: streamCourtFormat === fmt.id ? '2px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                      color: streamCourtFormat === fmt.id ? '#ffffff' : '#94a3b8',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '13px', color: streamCourtFormat === fmt.id ? '#38bdf8' : '#ffffff' }}>
                      {fmt.label}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                      {fmt.sub}
                    </div>
                  </button>
                ))}
              </div>

              {/* Prefix or Custom Names Input */}
              {streamCourtFormat !== 'custom' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15, 23, 42, 0.5)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Prefix label:</span>
                  <input
                    type="text"
                    value={streamCourtPrefix}
                    onChange={(e) => setStreamCourtPrefix(e.target.value)}
                    placeholder="e.g. Court, Table, Arena"
                    style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', padding: '4px 8px', color: '#ffffff', fontSize: '12px', fontWeight: '700' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>(e.g. "{streamCourtPrefix ? `${streamCourtPrefix} ` : ''}{streamCourtFormat === 'alphabet' ? 'A' : streamCourtFormat === 'roman' ? 'I' : '1'}")</span>
                </div>
              ) : (
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', fontWeight: '700', marginBottom: '4px' }}>
                    Enter Custom Court Names (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={streamCourtCustomNames}
                    onChange={(e) => setStreamCourtCustomNames(e.target.value)}
                    placeholder="e.g. Court A, Court B, Center Court, VIP Court"
                    style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '6px', padding: '6px 8px', color: '#ffffff', fontSize: '12px', fontWeight: '700', boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </div>

            {/* Live Courts Preview */}
            <div style={{ marginBottom: '16px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#38bdf8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                👁️ Live Courts Preview:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '75px', overflowY: 'auto' }}>
                {streamPreviewCourts.map((court, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      color: '#e0f2fe',
                      fontSize: '11.5px',
                      fontWeight: '800',
                    }}
                  >
                    {court}
                  </span>
                ))}
              </div>
            </div>

            <div style={{
              padding: '10px 14px',
              background: 'rgba(2, 132, 199, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '10px',
              fontSize: '11.5px',
              color: '#38bdf8',
              lineHeight: '1.45',
            }}>
              💡 <strong>Dual-Screen Tip:</strong> Pop-out TV opens on your external display / projector, while your schedule list automatically reflects these configured courts!
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => setIsLiveStreamSetupModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#94a3b8',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmLiveStreamSetup(streamCourtsCount)}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  fontWeight: '900',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 20px rgba(56, 189, 248, 0.4)',
                }}
              >
                <span>🚀 Launch TV Broadcast</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Fullscreen Stadium TV Live Cast Screen */}
      {isStadiumTvCastOpen && (
        <StadiumTvLiveCast
          tournament={selectedMatch || publishedMatches[0]}
          allTournaments={publishedMatches}
          onClose={() => setIsStadiumTvCastOpen(false)}
          onStopStream={handleStopLiveStream}
        />
      )}

      {/* Universal Delete Confirmation Warning Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmState}
        title={deleteConfirmState?.title}
        message={deleteConfirmState?.message}
        itemName={deleteConfirmState?.itemName}
        confirmText="🗑️ Yes, Delete"
        cancelText="✕ Cancel"
        onConfirm={deleteConfirmState?.onConfirm}
        onClose={() => setDeleteConfirmState(null)}
      />
    </div>
  )
}

export default App
