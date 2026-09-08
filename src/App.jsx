import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useOrganizerAuth } from './hooks/useOrganizerAuth'
import { useTournamentData, STORAGE_KEY, AUTH_STORAGE_KEY } from './hooks/useTournamentData'
import { PublicPortal } from './pages/PublicPortal'
import { OrganizerPortalHeader } from './pages/OrganizerPortal'
import { NewMatchForm, getInitialFormData } from './pages/NewMatchForm'
import { MatchManagementView } from './pages/MatchManagementView'

import { BadmintonFixturesManager } from './components/BadmintonFixturesManager'
import { BadmintonLoginsPage } from './components/BadmintonLoginsPage'
import { UmpireLiveScoringDashboard } from './components/UmpireLiveScoringDashboard'
import { OrganizerAuthModal } from './components/OrganizerAuthModal'
import { MatchEditModal } from './components/MatchEditModal'
import { TournamentResultsModal } from './components/TournamentResultsModal'
import { ModifyParticipantModal } from './components/ModifyParticipantModal'
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal'
import { CourtConfigModal } from './components/CourtConfigModal'
import { LiveStreamSetupModal } from './components/LiveStreamSetupModal'
import { StadiumTvLiveCast } from './components/StadiumTvLiveCast'
import { PublicSponsorShowcase } from './components/PublicSponsorShowcase'
import { FixtureSeedingModal } from './components/FixtureSeedingModal'

import { generateBadmintonDraw, getNextPowerOfTwo } from './utils/badmintonDrawEngine'
import { getSavedCourtConfig, saveCourtConfig, generateCourtsList } from './utils/courtConfig'
import { SupabaseService } from './utils/supabaseDb'
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
import {
  getMatchCategories,
  isDoublesCategory,
  sortBadmintonCategories,
} from './utils/badmintonCategories'

export default function App() {
  // Authentication & Session Hook
  const {
    authSession,
    setAuthSession,
    authOpen,
    setAuthOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isChiefOrganizer,
    assignedMatchId,
    assignedMatchName,
    logout,
  } = useOrganizerAuth()

  // Tournament & Cloud Database Sync Hook
  const {
    publishedMatches,
    setPublishedMatches,
    authenticators,
    setAuthenticators,
    publishedStatusMap,
    setPublishedStatusMap,
    isLiveStreamActive,
    setIsLiveStreamActive,
    syncServerData,
    handleDeleteMatch,
  } = useTournamentData()

  // Page Navigation State
  const [activePage, setActivePage] = useState('fixturesManagement')
  const [fixturesCategory, setFixturesCategory] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [publicFilter, setPublicFilter] = useState('all')

  // Form State for Creating / Editing Tournaments
  const [formData, setFormData] = useState(getInitialFormData)
  const [imagePreview, setImagePreview] = useState('')

  // Participant Entry & Editing State
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

  // Modal Dialog States
  const [editingMatch, setEditingMatch] = useState(null)
  const [resultModalMatch, setResultModalMatch] = useState(null)
  const [winnerCategoryMap, setWinnerCategoryMap] = useState({})
  const [seedingModalMatch, setSeedingModalMatch] = useState(null)
  const [seedingModalCategory, setSeedingModalCategory] = useState(null)
  const [deleteConfirmState, setDeleteConfirmState] = useState(null)
  const [publicViewingFixturesMatch, setPublicViewingFixturesMatch] = useState(null)
  const [publicViewingCategory, setPublicViewingCategory] = useState(null)
  const [successToast, setSuccessToast] = useState('')

  // Stadium TV Cast & Live Stream Settings State
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

  // Toast auto-clear
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(''), 4000)
      return () => clearTimeout(t)
    }
  }, [successToast])

  // Effective Published Matches (Strict Scoping for Temporary logins)
  const effectivePublishedMatches = useMemo(() => {
    let list = publishedMatches
    if (!isChiefOrganizer) {
      if (assignedMatchId) {
        list = publishedMatches.filter((m) => String(m.id) === String(assignedMatchId))
      } else {
        list = []
      }
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
  }, [publishedMatches, isChiefOrganizer, assignedMatchId])

  // Temporary login auto-redirect and match binding
  useEffect(() => {
    if (!isChiefOrganizer) {
      if (assignedMatchId) {
        const target = publishedMatches.find((m) => String(m.id) === String(assignedMatchId))
        if (target) {
          setSelectedMatch(target)
        }
      }
      if (activePage === 'login' || activePage === 'newMatchUpdate') {
        setActivePage('fixturesManagement')
      }
    }
  }, [isChiefOrganizer, assignedMatchId, publishedMatches, activePage])

  // Set category winners when modal opens
  useEffect(() => {
    if (resultModalMatch) {
      const cats = getMatchCategories(resultModalMatch)
      const initialMap = {}
      cats.forEach((cat) => {
        initialMap[cat] = resultModalMatch.categoryWinners?.[cat] || ''
      })
      if (cats.length === 1 && !initialMap[cats[0]] && resultModalMatch.winner) {
        initialMap[cats[0]] = resultModalMatch.winner
      }
      setWinnerCategoryMap(initialMap)
    }
  }, [resultModalMatch])

  // Live Stream Broadcast Handlers
  const handleToggleLiveStream = () => {
    setIsLiveStreamSetupModalOpen(true)
  }

  const handleStopLiveStream = () => {
    setIsStadiumTvCastOpen(false)
    setIsLiveStreamActive(false)
    try {
      localStorage.setItem('badminton-live-stream-active', 'false')
      localStorage.removeItem('badminton-live-stream-match-id')
      syncServerData({ liveStreamActive: false, liveStreamMatchId: '' })
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setSuccessToast('⚪ Live Stream Broadcast is now stopped.')
  }

  const handlePopoutLiveTv = (tournamentId) => {
    const tid = tournamentId || selectedMatch?.id || publishedMatches[0]?.id || ''
    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const win = window.open(url, '_blank')
    if (win) win.focus()
    setIsLiveStreamActive(true)
    try {
      localStorage.setItem('badminton-live-stream-active', 'true')
      localStorage.setItem('badminton-live-stream-match-id', String(tid))
      syncServerData({ liveStreamActive: true, liveStreamMatchId: String(tid) })
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}
    setSuccessToast('📺 TV Live Stream opened in a new tab!')
  }

  const handleLaunchPopoutBroadcast = (selectedTournamentId, courtCfg) => {
    if (courtCfg) {
      setStreamCourtConfig(courtCfg)
      setStreamCourtsCount(courtCfg.count)
    }
    const matched = publishedMatches.find((m) => String(m.id) === String(selectedTournamentId))
    if (matched) {
      setSelectedMatch(matched)
    }
    const tid = selectedTournamentId || matched?.id || selectedMatch?.id || publishedMatches[0]?.id || ''
    setIsLiveStreamActive(true)
    setIsLiveStreamSetupModalOpen(false)
    try {
      localStorage.setItem('badminton-live-stream-active', 'true')
      localStorage.setItem('badminton-live-stream-match-id', String(tid))
      if (courtCfg?.count) {
        localStorage.setItem('badminton-stadium-courts-count', String(courtCfg.count))
      }
      syncServerData({ liveStreamActive: true, liveStreamMatchId: String(tid) })
      window.dispatchEvent(new Event('storage'))
    } catch (e) {}

    const url = `${window.location.origin}${window.location.pathname}?livecast=true${tid ? `&tid=${encodeURIComponent(tid)}` : ''}`
    const win = window.open(url, '_blank')
    if (win) win.focus()
    const tName = matched?.tournamentName || matched?.name || matched?.title || 'Tournament'
    setSuccessToast(`📺 TV Live Broadcast opened for "${tName}"!`)
  }

  const handleConfirmLiveStreamSetup = (countOverride) => {
    const nextCfg = {
      count: typeof countOverride === 'number' ? countOverride : streamCourtsCount,
      format: streamCourtFormat || 'numbers',
      prefix: String(streamCourtPrefix || 'Court').trim(),
      customNames: String(streamCourtCustomNames || '').trim(),
    }
    saveCourtConfig(nextCfg)
    setStreamCourtConfig(nextCfg)
    handleLaunchPopoutBroadcast(nextCfg.count)
  }

  // Tournament Create & Update Handler
  const handleSubmitNewMatch = (e) => {
    e.preventDefault()

    const sanitizedName = formatTournamentName(formData.matchName)
    const sanitizedAddress = formatAddress(formData.matchAddress)
    const sanitizedCourt = formatCourtName(formData.courtName)
    const sanitizedOrganizer = formatPersonName(formData.organizerName, '')

    const rawMatch = {
      id: formData.id || Date.now(),
      ...formData,
      matchName: sanitizedName,
      matchAddress: sanitizedAddress,
      courtName: sanitizedCourt,
      organizerName: sanitizedOrganizer,
      categories: Array.isArray(formData.categories) && formData.categories.length > 0
        ? sortBadmintonCategories(formData.categories.map(formatCategoryName))
        : ['Men Singles', 'Women Singles'],
      matchDuration: Number(formData.totalDays) || 3,
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
    } catch (e) {}
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

    setActivePage('matchManagement')
    setSuccessToast(
      isExisting
        ? `✓ Tournament "${cleanMatch.matchName}" updated successfully!`
        : `🎉 New Tournament "${cleanMatch.matchName}" created & published successfully!`
    )
  }

  // Save Tournament Edit from MatchEditModal
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
    }
    setEditingMatch(null)
    setSuccessToast(`✓ Tournament "${cleanMatch.matchName}" updated successfully!`)
  }

  // Save Category Winners from TournamentResultsModal
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
    let updatedMatchesForSync = null
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
      updatedMatchesForSync = updated
      return updated
    })

    if (updatedTargetMatch && updatedMatchesForSync) {
      SupabaseService.upsertTournament(updatedTargetMatch).catch(() => {})
      syncServerData({ matches: updatedMatchesForSync })
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
    setResultModalMatch(null)
    setSuccessToast(
      areAllDone
        ? `🏆 All ${totalCount} category winners updated! Tournament moved to Completed.`
        : `✓ Category winners updated.`
    )
  }

  // Add Participant Handler
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
      if (!p1 && !p2 && !participantForm.name?.trim()) return
      finalName = p1 && p2 ? joinDoublesNames(p1, p2) : formatPersonName(p1 || p2 || participantForm.name)
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
      setSuccessToast(`✓ Updated player "${formatPersonName(finalName)}" in ${targetCategory}!`)
      setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: targetCategory })
      setEditingParticipantId(null)
      return
    }

    const names = isDoubles ? [finalName] : finalName.split(/[\n,]+/).map((n) => formatPersonName(n)).filter(Boolean)
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
      const next = { ...prev, [matchKey]: updatedPlayersList, [matchKeyStr]: updatedPlayersList }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (err) {}
      syncServerData({ authenticators: next })
      return next
    })

    const updatedMatchObj = {
      ...selectedMatch,
      authenticators: updatedPlayersList,
      participants: updatedPlayersList,
    }

    setSelectedMatch(updatedMatchObj)
    setPublishedMatches((prev) =>
      prev.map((m) => (String(m.id) === matchKeyStr ? updatedMatchObj : m))
    )
    SupabaseService.upsertTournament(updatedMatchObj).catch(() => {})

    setSuccessToast(`✓ Successfully added to ${targetCategory}!`)
    setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: targetCategory })
  }

  // Remove Participant Handler
  const handleRemoveParticipant = (matchId, participantId) => {
    const matchIdStr = String(matchId)
    const targetMatch = publishedMatches.find((m) => String(m.id) === matchIdStr) || selectedMatch
    const currentList = authenticators[matchId] || authenticators[matchIdStr] || targetMatch?.participants || []
    const filteredList = currentList.filter((p) => p && String(p.id) !== String(participantId))

    setAuthenticators((prev) => {
      const next = { ...prev, [matchId]: filteredList, [matchIdStr]: filteredList }
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      syncServerData({ authenticators: next })
      return next
    })

    const updatedMatchObj = {
      ...(targetMatch || selectedMatch),
      authenticators: filteredList,
      participants: filteredList,
    }

    if (selectedMatch && String(selectedMatch.id) === matchIdStr) {
      setSelectedMatch(updatedMatchObj)
    }

    setPublishedMatches((prev) =>
      prev.map((m) => (String(m.id) === matchIdStr ? updatedMatchObj : m))
    )
    SupabaseService.upsertTournament(updatedMatchObj).catch(() => {})
    setSuccessToast(`✓ Player removed from tournament.`)
  }

  // Modify Participant from Modal
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
      finalName = p1 && p2 ? joinDoublesNames(p1, p2) : formatPersonName(p1 || p2 || modifyForm.name)
    } else {
      finalName = formatPersonName(modifyForm.name || modifyForm.name1)
    }

    if (!finalName) return
    const courtVal = formatCourtName(modifyForm.court, '')
    const placeVal = formatPlaceOrClub(modifyForm.place, '')
    const targetCategory = modifyForm.category
    const participantId = modifyingParticipant.id

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

    const matchKeyStr = String(selectedMatch.id)
    setPublishedMatches((prev) => {
      const next = prev.map((m) => {
        if (String(m.id) === matchKeyStr) {
          const parts = (m.participants || m.authenticators || []).map((p) =>
            String(p.id) === String(participantId)
              ? { ...p, name: finalName, court: courtVal, place: placeVal, category: targetCategory }
              : p
          )
          const updatedM = { ...m, participants: parts, authenticators: parts }
          if (selectedMatch && String(selectedMatch.id) === matchKeyStr) {
            setSelectedMatch(updatedM)
          }
          SupabaseService.upsertTournament(updatedM).catch(() => {})
          return updatedM
        }
        return m
      })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      return next
    })

    setModifyingParticipant(null)
    setSuccessToast(`✓ Successfully modified "${finalName}"!`)
  }

  // Generate Fixtures from Seeding Modal
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
    } catch (e) {}

    setSeedingModalMatch(null)
    setSeedingModalCategory(null)
    setSelectedMatch(match)
    setFixturesCategory(category)
    setActivePage('fixturesManagement')
  }

  // DEDICATED STANDALONE LIVE STREAM TV BROADCAST PAGE (Zero-Flicker Isolated Route)
  const isDedicatedLiveCast = typeof window !== 'undefined' && (
    window.location.search.includes('livecast=true') ||
    window.location.search.includes('stadium=true') ||
    window.location.search.includes('tv=true')
  )

  if (isDedicatedLiveCast) {
    const urlParams = new URLSearchParams(window.location.search)
    const urlTid = urlParams.get('tid')
    const targetMatch = publishedMatches.find((m) => String(m.id) === String(urlTid)) || selectedMatch || publishedMatches[0]
    return (
      <StadiumTvLiveCast
        isOpen={true}
        tournament={targetMatch}
        allTournaments={publishedMatches}
        onClose={() => {
          window.location.href = window.location.pathname
        }}
        onStopStream={handleStopLiveStream}
        isPublicView={false}
      />
    )
  }

  return (
    <div className="app-container">
      {/* 1. PUBLIC TOURNAMENT PORTAL VIEW */}
      {!authOpen && (
        <div className="public-portal-page" style={{ width: '100%', minHeight: '100vh' }}>
          {publicViewingFixturesMatch ? (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px' }}>
              <BadmintonFixturesManager
                publishedMatches={publishedMatches}
                authenticators={authenticators}
                selectedMatch={publicViewingFixturesMatch}
                initialCategory={publicViewingCategory}
                isPublicView={true}
                onBackToPublicFeed={() => {
                  setPublicViewingFixturesMatch(null)
                  setPublicViewingCategory(null)
                }}
                onOpenOrganizerLogin={() => setIsAuthModalOpen(true)}
              />
            </div>
          ) : (
            <PublicPortal
              publishedMatches={publishedMatches}
              publishedStatusMap={publishedStatusMap}
              authenticators={authenticators}
              selectedMatch={selectedMatch}
              setSelectedMatch={setSelectedMatch}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              publicFilter={publicFilter}
              setPublicFilter={setPublicFilter}
              authSession={authSession}
              onOpenAuth={() => {
                if (authSession) setAuthOpen(true)
                else setIsAuthModalOpen(true)
              }}
              onOpenFixtures={(match, cat) => {
                setPublicViewingFixturesMatch(match)
                setPublicViewingCategory(cat)
              }}
              onOpenResultModal={(match) => setResultModalMatch(match)}
            />
          )}
        </div>
      )}

      {/* 2. AUTHENTICATED ORGANIZER & UMPIRE PORTAL */}
      {authOpen && (
        <div className="auth-page" style={{ width: '100%', minHeight: '100vh', boxSizing: 'border-box' }}>
          {(authSession?.role === 'umpire' || authSession?.scope === 'umpire') ? (
            <UmpireLiveScoringDashboard
              session={authSession}
              publishedMatches={effectivePublishedMatches}
              onLogout={() => {
                logout()
              }}
              onNavigateToPublic={() => setAuthOpen(false)}
            />
          ) : (
            <>
              {/* Top Navigation Bar */}
              <OrganizerPortalHeader
                authSession={authSession}
                activePage={activePage}
                setActivePage={setActivePage}
                onLogout={logout}
                onBackToPublic={() => setAuthOpen(false)}
                onSelectMatch={setSelectedMatch}
                publishedMatches={publishedMatches}
                isLiveStreamActive={isLiveStreamActive}
                onToggleLiveStream={handleToggleLiveStream}
                onStopLiveStream={handleStopLiveStream}
              />

              {/* Live Scoreboard Tab */}
              {activePage === 'liveScoreboard' && (
                <UmpireLiveScoringDashboard
                  session={authSession}
                  publishedMatches={effectivePublishedMatches}
                  onLogout={() => setActivePage('matchManagement')}
                  onNavigateToPublic={() => setAuthOpen(false)}
                />
              )}

              {/* Logins Tab (Chief Organizer Only) */}
              {activePage === 'login' && isChiefOrganizer && (
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
                    const targetMatch = publishedMatches.find((m) => String(m.id) === String(matchId || assignedMatchId))
                    setSelectedMatch(targetMatch || null)
                    setFixturesCategory(null)
                    setActivePage('fixturesManagement')
                  }}
                  onNavigateToNewMatch={() => setActivePage('newMatchUpdate')}
                  onNavigateToMatchManagement={() => setActivePage('matchManagement')}
                  onBackToPublic={() => setAuthOpen(false)}
                />
              )}

              {/* New Match Tab (Chief Organizer Only) */}
              {activePage === 'newMatchUpdate' && isChiefOrganizer && (
                <NewMatchForm
                  formData={formData}
                  setFormData={setFormData}
                  imagePreview={imagePreview}
                  setImagePreview={setImagePreview}
                  onSubmit={handleSubmitNewMatch}
                  onCancel={() => {
                    setFormData(getInitialFormData())
                    setImagePreview('')
                    setActivePage('matchManagement')
                  }}
                />
              )}

              {/* Fixtures Management Tab */}
              {activePage === 'fixturesManagement' && (
                <div className="auth-card auth-management" style={{ maxWidth: '1400px', width: '100%', padding: '24px' }}>
                  <BadmintonFixturesManager
                    publishedMatches={effectivePublishedMatches}
                    authenticators={authenticators}
                    selectedMatch={
                      !isChiefOrganizer && assignedMatchId
                        ? (effectivePublishedMatches.find((m) => String(m.id) === String(assignedMatchId)) || null)
                        : selectedMatch
                    }
                    initialCategory={fixturesCategory}
                    onSelectMatch={(match) => {
                      if (!isChiefOrganizer && assignedMatchId) {
                        if (match && String(match.id) !== String(assignedMatchId)) return
                      }
                      setSelectedMatch(match)
                    }}
                    onAddParticipant={(matchId, newParticipant) => {
                      const cleanParticipant = sanitizeParticipant(newParticipant)
                      const matchKeyStr = String(matchId)
                      const newId = cleanParticipant.id || Date.now()
                      const fullPlayer = { id: newId, ...cleanParticipant }

                      setAuthenticators((prev) => {
                        const current = prev[matchId] || prev[matchKeyStr] || []
                        const nextList = [...current, fullPlayer]
                        const next = { ...prev, [matchId]: nextList, [matchKeyStr]: nextList }
                        try {
                          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
                        } catch (e) {}
                        syncServerData({ authenticators: next })
                        return next
                      })
                    }}
                    onUpdateParticipant={(matchId, updatedParticipant) => {
                      const matchKeyStr = String(matchId)
                      setAuthenticators((prev) => {
                        const current = prev[matchId] || prev[matchKeyStr] || []
                        const nextList = current.map((p) =>
                          String(p.id) === String(updatedParticipant.id) ? { ...p, ...updatedParticipant } : p
                        )
                        const next = { ...prev, [matchId]: nextList, [matchKeyStr]: nextList }
                        try {
                          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
                        } catch (e) {}
                        syncServerData({ authenticators: next })
                        return next
                      })
                    }}
                    onDeleteParticipant={(matchId, participantId) => {
                      handleRemoveParticipant(matchId, participantId)
                    }}
                    onBackToMatchManagement={() => setActivePage('matchManagement')}
                    onStartLiveStream={(match) => handleLaunchPopoutBroadcast(match?.id)}
                    onStopLiveStream={handleStopLiveStream}
                    isLiveStreamActive={isLiveStreamActive}
                  />
                </div>
              )}

              {/* Match Management Tab */}
              {activePage === 'matchManagement' && (
                <MatchManagementView
                  effectivePublishedMatches={effectivePublishedMatches}
                  selectedMatch={selectedMatch}
                  setSelectedMatch={setSelectedMatch}
                  authenticators={authenticators}
                  activeCategory={activeCategory}
                  setActiveCategory={setActiveCategory}
                  participantForm={participantForm}
                  setParticipantForm={setParticipantForm}
                  editingParticipantId={editingParticipantId}
                  setEditingParticipantId={setEditingParticipantId}
                  onAddParticipant={handleAddParticipant}
                  onResetParticipantForm={() => {
                    setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: activeCategory || 'Men Singles' })
                    setEditingParticipantId(null)
                  }}
                  onOpenModifyModal={handleOpenModifyModal}
                  onRemoveParticipant={(matchId, pId, pName) => {
                    setDeleteConfirmState({
                      title: 'Remove Registered Player?',
                      message: `Are you sure you want to remove "${pName}" from this tournament registration?`,
                      itemName: pName,
                      onConfirm: () => handleRemoveParticipant(matchId, pId),
                    })
                  }}
                  onOpenEditMatchModal={(match) => setEditingMatch(match)}
                  onDeleteMatch={(match) => {
                    setDeleteConfirmState({
                      title: 'Delete Tournament?',
                      message: 'Are you sure you want to permanently delete this tournament? All match draws, categories, seedings, and registered players will be deleted.',
                      itemName: match.matchName,
                      onConfirm: () => handleDeleteMatch(match.id),
                    })
                  }}
                  onStartLiveStream={(match) => handleLaunchPopoutBroadcast(match?.id)}
                  onStopLiveStream={handleStopLiveStream}
                  isLiveStreamActive={isLiveStreamActive}
                  authSession={authSession}
                  successToast={successToast}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* 3. GLOBAL MODALS & OVERLAYS */}

      {/* Organizer Auth Modal */}
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
        }}
      />

      {/* Match Details & Configuration Modal */}
      <MatchEditModal
        isOpen={!!editingMatch}
        onClose={() => setEditingMatch(null)}
        match={editingMatch}
        onSave={handleSaveEditedMatch}
      />

      {/* Results & Winners Modal */}
      <TournamentResultsModal
        isOpen={!!resultModalMatch}
        onClose={() => setResultModalMatch(null)}
        match={resultModalMatch}
        winnerCategoryMap={winnerCategoryMap}
        setWinnerCategoryMap={setWinnerCategoryMap}
        onSave={(map) => handleSaveCategoryWinners(resultModalMatch?.id, map)}
        isOrganizer={Boolean(authSession)}
      />

      {/* Modify Participant Modal */}
      <ModifyParticipantModal
        modifyingParticipant={modifyingParticipant}
        onClose={() => setModifyingParticipant(null)}
        modifyForm={modifyForm}
        setModifyForm={setModifyForm}
        onSave={handleSaveModifiedParticipant}
        categories={selectedMatch ? getMatchCategories(selectedMatch) : []}
      />

      {/* Seeding & Draw Generator Modal */}
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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmState}
        onClose={() => setDeleteConfirmState(null)}
        onConfirm={() => {
          if (deleteConfirmState?.onConfirm) deleteConfirmState.onConfirm()
          setDeleteConfirmState(null)
        }}
        title={deleteConfirmState?.title}
        message={deleteConfirmState?.message}
        itemName={deleteConfirmState?.itemName}
      />

      {/* Live Stream Setup Modal with Tournament & Court Selector */}
      <LiveStreamSetupModal
        isOpen={isLiveStreamSetupModalOpen}
        onClose={() => setIsLiveStreamSetupModalOpen(false)}
        publishedMatches={publishedMatches}
        selectedMatch={selectedMatch}
        initialCourtConfig={streamCourtConfig}
        onLaunchStream={handleLaunchPopoutBroadcast}
      />
    </div>
  )
}
