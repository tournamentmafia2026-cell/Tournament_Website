import React, { useState, useEffect, useMemo } from 'react'
import {
  formatTournamentName,
  formatCourtName,
  formatPersonName,
  formatCategoryName,
} from '../utils/textFormatters'
import { SupabaseService } from '../utils/supabaseDb'

export function UmpireLiveScoringDashboard({
  session,
  publishedMatches = [],
  onLogout,
  onNavigateToPublic,
}) {
  const [tournamentDraws, setTournamentDraws] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-tournament-draws')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Live Umpire Mode active state from organizer
  const [isLiveUmpireModeActive, setIsLiveUmpireModeActive] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-live-umpire-mode')
      return saved !== null ? JSON.parse(saved) : true
    } catch {
      return true
    }
  })

  // Selected tournament filter (defaults to assigned match or first tournament)
  const [selectedMatchId, setSelectedMatchId] = useState(() => {
    return session?.assignedMatchId || publishedMatches[0]?.id || ''
  })

  const currentMatch = useMemo(() => {
    return publishedMatches.find((m) => String(m.id) === String(selectedMatchId)) || publishedMatches[0]
  }, [publishedMatches, selectedMatchId])

  // Realtime Live Draw and Score Sync from Server & Supabase (Every 1.5s)
  useEffect(() => {
    const syncDraws = () => {
      fetch('/api/tournaments')
        .then((res) => res.json())
        .then((data) => {
          if (data?.liveUmpireMode !== undefined) {
            setIsLiveUmpireModeActive(data.liveUmpireMode)
          }
          if (data?.tournamentDraws && typeof data.tournamentDraws === 'object') {
            setTournamentDraws((prev) => ({ ...prev, ...data.tournamentDraws }))
            try {
              localStorage.setItem('badminton-tournament-draws', JSON.stringify({ ...tournamentDraws, ...data.tournamentDraws }))
            } catch (e) {}
          }
        })
        .catch(() => {})

      if (selectedMatchId) {
        SupabaseService.getTournamentDraws(selectedMatchId)
          .then((rows) => {
            if (rows && Array.isArray(rows) && rows.length > 0) {
              const supaDraws = {}
              rows.forEach((row) => {
                if (row.id && row.draw_data) {
                  supaDraws[row.id] = row.draw_data
                }
              })
              setTournamentDraws((prev) => ({ ...prev, ...supaDraws }))
            }
          })
          .catch(() => {})
      }
    }

    syncDraws()
    const timer = setInterval(syncDraws, 1500)
    return () => clearInterval(timer)
  }, [selectedMatchId])

  // Strict helper to check if a match is assigned to THIS logged-in umpire
  const isMatchForThisUmpire = (m) => {
    if (!m || (m.player1?.isBye && m.player2?.isBye)) return false

    // Master admin can view all matches
    if (session?.username === 'admin' || session?.role === 'admin') return true

    const uName = session?.username?.toLowerCase()?.trim() || ''
    const matchUmpire = (m.assignedUmpireUsername || m.umpireUsername || '')?.toLowerCase()?.trim()

    // 1. If match has an assigned umpire username, strictly check against logged-in umpire username
    if (matchUmpire) {
      return Boolean(uName && matchUmpire === uName)
    }

    // 2. Fallback ONLY if match has NO assigned umpire username: check dedicated court
    const uCourt = (session?.assignedCourt || session?.courtName || '')?.toLowerCase()?.trim()
    const matchCourt = (m.court || m.assignedCourt || '')?.toLowerCase()?.trim()
    if (uCourt && matchCourt && matchCourt === uCourt) {
      return true
    }

    return false
  }

  // Collect Live Matches assigned to THIS umpire
  const liveMatches = useMemo(() => {
    const list = []

    Object.keys(tournamentDraws).forEach((key) => {
      const draw = tournamentDraws[key]
      if (draw && Array.isArray(draw.matches)) {
        const [tId, ...catParts] = key.split('-')
        const cat = catParts.join('-') || draw.category || 'Standard'
        draw.matches.forEach((m) => {
          if (m.status === 'live' && !(m.player1?.isBye && m.player2?.isBye)) {
            if (isMatchForThisUmpire(m)) {
              list.push({
                ...m,
                drawKey: key,
                tournamentId: tId,
                category: cat,
              })
            }
          }
        })
      }
    })

    return list
  }, [tournamentDraws, session])


  // Active match being scored
  const [activeMatchId, setActiveMatchId] = useState(null)

  const activeMatch = useMemo(() => {
    if (liveMatches.length === 0) return null
    if (activeMatchId) {
      const found = liveMatches.find((m) => String(m.id) === String(activeMatchId))
      if (found) return found
    }
    // Priority 1: Match directly assigned to this umpire's username
    if (session?.username) {
      const assigned = liveMatches.find((m) => m.assignedUmpireUsername === session.username)
      if (assigned) return assigned
    }
    // Priority 2: Match assigned to this umpire's court
    if (session?.assignedCourt) {
      const onCourt = liveMatches.find((m) => m.court === session.assignedCourt)
      if (onCourt) return onCourt
    }
    return liveMatches[0]
  }, [activeMatchId, liveMatches, session])

  const drawKey = activeMatch?.drawKey || (currentMatch ? `${currentMatch.id}-${activeMatch?.category || 'Men Singles'}` : '')
  const currentDraw = tournamentDraws[drawKey] || null

  // Dynamic Match Sets & Points Settings (Configured in Schedule List by Organizer)
  const [matchTotalPoints, setMatchTotalPoints] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-match-points')
      return saved ? JSON.parse(saved) : 30
    } catch {
      return 30
    }
  })

  const [matchTotalSets, setMatchTotalSets] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-match-sets')
      return saved ? JSON.parse(saved) : 3
    } catch {
      return 3
    }
  })

  // Real-time synchronization of system settings across tabs, windows & server
  useEffect(() => {
    const syncSettings = () => {
      try {
        const savedPts = localStorage.getItem('badminton-match-points')
        if (savedPts) setMatchTotalPoints(JSON.parse(savedPts))
        const savedSets = localStorage.getItem('badminton-match-sets')
        if (savedSets) setMatchTotalSets(JSON.parse(savedSets))
      } catch (e) {}

      fetch('/api/tournaments')
        .then((res) => res.json())
        .then((data) => {
          if (data?.systemSettings?.matchPoints) {
            setMatchTotalPoints(data.systemSettings.matchPoints)
          }
          if (data?.systemSettings?.matchSets) {
            setMatchTotalSets(data.systemSettings.matchSets)
          }
        })
        .catch(() => {})
    }

    const handleCustomEvent = (e) => {
      if (e.detail?.matchPoints) setMatchTotalPoints(Number(e.detail.matchPoints))
      if (e.detail?.matchSets) setMatchTotalSets(Number(e.detail.matchSets))
    }

    syncSettings()
    window.addEventListener('storage', syncSettings)
    window.addEventListener('badminton-settings-changed', handleCustomEvent)

    let broadcastChannel = null
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        broadcastChannel = new BroadcastChannel('badminton_sync')
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'SETTINGS_UPDATED') {
            if (event.data.matchPoints) setMatchTotalPoints(Number(event.data.matchPoints))
            if (event.data.matchSets) setMatchTotalSets(Number(event.data.matchSets))
          }
        }
      } catch (e) {}
    }

    const timer = setInterval(syncSettings, 3000)
    return () => {
      window.removeEventListener('storage', syncSettings)
      window.removeEventListener('badminton-settings-changed', handleCustomEvent)
      if (broadcastChannel) broadcastChannel.close()
      clearInterval(timer)
    }
  }, [])

  // Derived Match Rules based on configured Points & Sets
  const targetPoints = Number(matchTotalPoints) || 30
  const totalSets = Number(matchTotalSets) || 3
  const setsToWin = totalSets === 1 ? 1 : Math.ceil(totalSets / 2)
  const availableSets = useMemo(() => Array.from({ length: Math.max(1, totalSets) }, (_, i) => i + 1), [totalSets])

  // Cap at 30 for 21 or 30 pts, or standard cap for 15/11 pts
  const maxCap = targetPoints === 21 ? 30 : targetPoints === 30 ? 30 : targetPoints + Math.min(6, Math.max(2, Math.floor(targetPoints * 0.4)))
  const deuceThreshold = Math.max(1, targetPoints - 1)
  const intervalPoint = Math.ceil(targetPoints / 2)

  // Live Scoring States
  const [currentSet, setCurrentSet] = useState(1) // 1..totalSets
  const [setScores, setSetScores] = useState({
    set1: { p1: 0, p2: 0 },
    set2: { p1: 0, p2: 0 },
    set3: { p1: 0, p2: 0 },
    set4: { p1: 0, p2: 0 },
    set5: { p1: 0, p2: 0 },
  })
  const [servingPlayer, setServingPlayer] = useState('p1') // 'p1' | 'p2'
  const [serviceSide, setServiceSide] = useState('right') // 'right' (even) | 'left' (odd)
  const [scoreHistory, setScoreHistory] = useState([])
  const [toastMessage, setToastMessage] = useState(null)
  const [isMatchConcluded, setIsMatchConcluded] = useState(false)
  const [isDirectScoreModalOpen, setIsDirectScoreModalOpen] = useState(false)
  const [directP1, setDirectP1] = useState(0)
  const [directP2, setDirectP2] = useState(0)

  // Sync with active match existing scores when match changes
  useEffect(() => {
    if (activeMatch) {
      const initialScores = {
        set1: { p1: Number(activeMatch.scoreSet1A) || 0, p2: Number(activeMatch.scoreSet1B) || 0 },
        set2: { p1: Number(activeMatch.scoreSet2A) || 0, p2: Number(activeMatch.scoreSet2B) || 0 },
        set3: { p1: Number(activeMatch.scoreSet3A) || 0, p2: Number(activeMatch.scoreSet3B) || 0 },
        set4: { p1: Number(activeMatch.scoreSet4A) || 0, p2: Number(activeMatch.scoreSet4B) || 0 },
        set5: { p1: Number(activeMatch.scoreSet5A) || 0, p2: Number(activeMatch.scoreSet5B) || 0 },
      }
      if (activeMatch.liveScore && typeof activeMatch.liveScore === 'object') {
        setSetScores({
          set1: activeMatch.liveScore.set1 || initialScores.set1,
          set2: activeMatch.liveScore.set2 || initialScores.set2,
          set3: activeMatch.liveScore.set3 || initialScores.set3,
          set4: activeMatch.liveScore.set4 || initialScores.set4,
          set5: activeMatch.liveScore.set5 || initialScores.set5,
        })
        setCurrentSet(Math.min(totalSets, activeMatch.liveScore.currentSet || 1))
        setServingPlayer(activeMatch.liveScore.servingPlayer || 'p1')
      } else {
        setSetScores(initialScores)
        setCurrentSet(1)
        setServingPlayer('p1')
      }
      setIsMatchConcluded(activeMatch.status === 'completed' || Boolean(activeMatch.winner))
      setScoreHistory([])
    }
  }, [activeMatch?.id, totalSets])

  // Server, Supabase & LocalStorage Draw Broadcaster
  const broadcastDrawUpdate = (updatedDraw, targetDrawKey = drawKey) => {
    const key = targetDrawKey || drawKey
    if (!key) return
    const nextDraws = {
      ...tournamentDraws,
      [key]: updatedDraw,
    }
    setTournamentDraws(nextDraws)
    try {
      localStorage.setItem('badminton-tournament-draws', JSON.stringify(nextDraws))
    } catch {}

    // Push to server database for live spectator broadcast
    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentDraws: nextDraws }),
    }).catch(() => {})

    // Push to Supabase Cloud Database for Realtime Sync
    if (activeMatch) {
      SupabaseService.upsertTournamentDraw(key, activeMatch.tournamentId || currentMatch?.id, activeMatch.category || 'Standard', updatedDraw, true).catch(() => {})
      
      // Also update public.live_matches table
      SupabaseService.updateLiveMatch({
        match_id: `${key}-${activeMatch.id}`,
        tournament_id: activeMatch.tournamentId || currentMatch?.id,
        category: activeMatch.category || 'Standard',
        round_name: activeMatch.roundName || (activeMatch.round ? `Round ${activeMatch.round}` : 'Round 1'),
        court_name: activeMatch.court || currentMatch?.courtName || 'Court 1',
        team1_name: activeMatch.player1?.name || 'Player 1',
        team2_name: activeMatch.player2?.name || 'Player 2',
        set1_score: `${setScores.set1.p1}-${setScores.set1.p2}`,
        set2_score: `${setScores.set2.p1}-${setScores.set2.p2}`,
        set3_score: `${setScores.set3.p1}-${setScores.set3.p2}`,
        current_server: servingPlayer === 'p1' ? (activeMatch.player1?.name || 'Player 1') : (activeMatch.player2?.name || 'Player 2'),
        status: isMatchConcluded ? 'completed' : 'ongoing',
        winner_team: activeMatch.winner?.name || ''
      }).catch(() => {})
    }
  }


  // Live Score Calculator
  const currentSetKey = `set${currentSet}`
  const p1Score = setScores[currentSetKey]?.p1 || 0
  const p2Score = setScores[currentSetKey]?.p2 || 0

  const checkSetWon = (pPts, oppPts) => {
    if (targetPoints === 30) return pPts >= 30
    return (pPts >= targetPoints && pPts - oppPts >= 2) || pPts >= maxCap
  }

  // Set Point / Game Point & Deuce Logic
  const isDeuce = targetPoints > 11 && p1Score >= deuceThreshold && p2Score >= deuceThreshold && p1Score === p2Score
  const isSetPoint =
    !checkSetWon(p1Score, p2Score) && !checkSetWon(p2Score, p1Score) &&
    ((p1Score >= deuceThreshold && p1Score - p2Score >= 1) || (p2Score >= deuceThreshold && p2Score - p1Score >= 1))
  const isSetWinnerP1 = checkSetWon(p1Score, p2Score)
  const isSetWinnerP2 = checkSetWon(p2Score, p1Score)

  // Compute sets won so far across available sets
  const setsWonP1 = availableSets.filter((sNum) => {
    const s = setScores[`set${sNum}`]
    return s && checkSetWon(s.p1, s.p2)
  }).length

  const setsWonP2 = availableSets.filter((sNum) => {
    const s = setScores[`set${sNum}`]
    return s && checkSetWon(s.p2, s.p1)
  }).length

  const isMatchPoint =
    !isMatchConcluded &&
    setsWonP1 < setsToWin &&
    setsWonP2 < setsToWin &&
    ((setsWonP1 === setsToWin - 1 && p1Score >= deuceThreshold && p1Score > p2Score) ||
     (setsWonP2 === setsToWin - 1 && p2Score >= deuceThreshold && p2Score > p1Score))

  // Increment Point
  const handleAddPoint = (player) => {
    if (!isLiveUmpireModeActive) {
      setToastMessage('⚠️ Manual Scoring Mode is active by Organizer. Umpire scoring is paused.')
      return
    }

    if (isMatchConcluded) {
      setToastMessage('⚠️ This match is completed.')
      return
    }

    const prevP1 = p1Score
    const prevP2 = p2Score
    const newP1 = player === 'p1' ? Math.min(maxCap, prevP1 + 1) : prevP1
    const newP2 = player === 'p2' ? Math.min(maxCap, prevP2 + 1) : prevP2

    setScoreHistory((prev) => [
      ...prev,
      {
        setScores: JSON.parse(JSON.stringify(setScores)),
        servingPlayer,
        currentSet,
        pointWinner: player,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        p1After: newP1,
        p2After: newP2,
        pointNum: prev.length + 1,
      },
    ])

    const nextScores = { ...setScores }
    if (player === 'p1') {
      nextScores[currentSetKey].p1 = newP1
      setServingPlayer('p1')
      setServiceSide(nextScores[currentSetKey].p1 % 2 === 0 ? 'right' : 'left')
    } else {
      nextScores[currentSetKey].p2 = newP2
      setServingPlayer('p2')
      setServiceSide(nextScores[currentSetKey].p2 % 2 === 0 ? 'right' : 'left')
    }

    setSetScores(nextScores)

    // Broadcast live score to draw
    if (activeMatch && currentDraw) {
      const updatedMatches = currentDraw.matches.map((m) => {
        if (m.id === activeMatch.id) {
          return {
            ...m,
            status: 'live',
            scoreSet1A: nextScores.set1.p1 || (nextScores.set1.p2 ? 0 : ''),
            scoreSet1B: nextScores.set1.p2 || (nextScores.set1.p1 ? 0 : ''),
            scoreSet2A: nextScores.set2.p1 || (nextScores.set2.p2 ? 0 : ''),
            scoreSet2B: nextScores.set2.p2 || (nextScores.set2.p1 ? 0 : ''),
            scoreSet3A: nextScores.set3.p1 || (nextScores.set3.p2 ? 0 : ''),
            scoreSet3B: nextScores.set3.p2 || (nextScores.set3.p1 ? 0 : ''),
            scoreSet4A: nextScores.set4?.p1 || (nextScores.set4?.p2 ? 0 : ''),
            scoreSet4B: nextScores.set4?.p2 || (nextScores.set4?.p1 ? 0 : ''),
            scoreSet5A: nextScores.set5?.p1 || (nextScores.set5?.p2 ? 0 : ''),
            scoreSet5B: nextScores.set5?.p2 || (nextScores.set5?.p1 ? 0 : ''),
            liveScore: {
              ...nextScores,
              currentSet,
              servingPlayer: player,
              matchPoints: targetPoints,
              matchSets: totalSets,
            },
          }
        }
        return m
      })
      broadcastDrawUpdate({ ...currentDraw, matches: updatedMatches })
    }
  }

  // Subtract 1 Point directly for a player
  const handleSubtractPoint = (player) => {
    if (!isLiveUmpireModeActive) {
      setToastMessage('⚠️ Manual Scoring Mode is active by Organizer.')
      return
    }
    if (isMatchConcluded) {
      setToastMessage('⚠️ This match is completed.')
      return
    }

    const currentP1 = p1Score
    const currentP2 = p2Score

    if (player === 'p1' && currentP1 === 0) return
    if (player === 'p2' && currentP2 === 0) return

    const newP1 = player === 'p1' ? Math.max(0, currentP1 - 1) : currentP1
    const newP2 = player === 'p2' ? Math.max(0, currentP2 - 1) : currentP2

    setScoreHistory((prev) => [
      ...prev,
      {
        setScores: JSON.parse(JSON.stringify(setScores)),
        servingPlayer,
        currentSet,
        pointWinner: `-${player}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        p1After: newP1,
        p2After: newP2,
        pointNum: prev.length + 1,
      },
    ])

    const nextScores = { ...setScores }
    nextScores[currentSetKey].p1 = newP1
    nextScores[currentSetKey].p2 = newP2
    setSetScores(nextScores)

    const activeScore = servingPlayer === 'p1' ? newP1 : newP2
    setServiceSide(activeScore % 2 === 0 ? 'right' : 'left')

    if (activeMatch && currentDraw) {
      const updatedMatches = currentDraw.matches.map((m) => {
        if (m.id === activeMatch.id) {
          return {
            ...m,
            status: 'live',
            scoreSet1A: nextScores.set1.p1 || (nextScores.set1.p2 ? 0 : ''),
            scoreSet1B: nextScores.set1.p2 || (nextScores.set1.p1 ? 0 : ''),
            scoreSet2A: nextScores.set2.p1 || (nextScores.set2.p2 ? 0 : ''),
            scoreSet2B: nextScores.set2.p2 || (nextScores.set2.p1 ? 0 : ''),
            scoreSet3A: nextScores.set3.p1 || (nextScores.set3.p2 ? 0 : ''),
            scoreSet3B: nextScores.set3.p2 || (nextScores.set3.p1 ? 0 : ''),
            scoreSet4A: nextScores.set4?.p1 || (nextScores.set4?.p2 ? 0 : ''),
            scoreSet4B: nextScores.set4?.p2 || (nextScores.set4?.p1 ? 0 : ''),
            scoreSet5A: nextScores.set5?.p1 || (nextScores.set5?.p2 ? 0 : ''),
            scoreSet5B: nextScores.set5?.p2 || (nextScores.set5?.p1 ? 0 : ''),
            liveScore: {
              ...nextScores,
              currentSet,
              servingPlayer,
              matchPoints: targetPoints,
              matchSets: totalSets,
            },
          }
        }
        return m
      })
      broadcastDrawUpdate({ ...currentDraw, matches: updatedMatches })
    }
    const pName = player === 'p1' ? (activeMatch?.player1?.name || 'P1') : (activeMatch?.player2?.name || 'P2')
    setToastMessage(`↩️ Subtracted 1 point: ${pName} is now ${newP1}`)
  }

  // Undo Last Point
  const handleUndoPoint = () => {
    if (scoreHistory.length === 0) {
      setToastMessage('ℹ️ No previous points to undo in this session.')
      return
    }
    const lastState = scoreHistory[scoreHistory.length - 1]
    setSetScores(lastState.setScores)
    setServingPlayer(lastState.servingPlayer)
    setCurrentSet(lastState.currentSet)
    setScoreHistory((prev) => prev.slice(0, -1))

    if (activeMatch && currentDraw) {
      const updatedMatches = currentDraw.matches.map((m) => {
        if (m.id === activeMatch.id) {
          return {
            ...m,
            scoreSet1A: lastState.setScores.set1.p1 || '',
            scoreSet1B: lastState.setScores.set1.p2 || '',
            scoreSet2A: lastState.setScores.set2.p1 || '',
            scoreSet2B: lastState.setScores.set2.p2 || '',
            scoreSet3A: lastState.setScores.set3.p1 || '',
            scoreSet3B: lastState.setScores.set3.p2 || '',
            scoreSet4A: lastState.setScores.set4?.p1 || '',
            scoreSet4B: lastState.setScores.set4?.p2 || '',
            scoreSet5A: lastState.setScores.set5?.p1 || '',
            scoreSet5B: lastState.setScores.set5?.p2 || '',
            liveScore: {
              ...lastState.setScores,
              currentSet: lastState.currentSet,
              servingPlayer: lastState.servingPlayer,
              matchPoints: targetPoints,
              matchSets: totalSets,
            },
          }
        }
        return m
      })
      broadcastDrawUpdate({ ...currentDraw, matches: updatedMatches })
    }
    const curKey = `set${lastState.currentSet}`
    const p1 = lastState.setScores[curKey]?.p1 || 0
    const p2 = lastState.setScores[curKey]?.p2 || 0
    setToastMessage(`↩️ Point undone! Restored to: ${p1} - ${p2}`)
  }

  // Direct Score Override / Manual Adjust
  const handleOpenDirectEditScore = () => {
    setDirectP1(p1Score)
    setDirectP2(p2Score)
    setIsDirectScoreModalOpen(true)
  }

  const handleSaveDirectScore = () => {
    const newP1 = Math.max(0, Math.min(maxCap, Number(directP1) || 0))
    const newP2 = Math.max(0, Math.min(maxCap, Number(directP2) || 0))

    setScoreHistory((prev) => [
      ...prev,
      {
        setScores: JSON.parse(JSON.stringify(setScores)),
        servingPlayer,
        currentSet,
        pointWinner: 'manual_edit',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        p1After: newP1,
        p2After: newP2,
        pointNum: prev.length + 1,
      },
    ])

    const nextScores = { ...setScores }
    nextScores[currentSetKey].p1 = newP1
    nextScores[currentSetKey].p2 = newP2
    setSetScores(nextScores)

    const activeScore = servingPlayer === 'p1' ? newP1 : newP2
    setServiceSide(activeScore % 2 === 0 ? 'right' : 'left')

    if (activeMatch && currentDraw) {
      const updatedMatches = currentDraw.matches.map((m) => {
        if (m.id === activeMatch.id) {
          return {
            ...m,
            status: 'live',
            scoreSet1A: nextScores.set1.p1 || (nextScores.set1.p2 ? 0 : ''),
            scoreSet1B: nextScores.set1.p2 || (nextScores.set1.p1 ? 0 : ''),
            scoreSet2A: nextScores.set2.p1 || (nextScores.set2.p2 ? 0 : ''),
            scoreSet2B: nextScores.set2.p2 || (nextScores.set2.p1 ? 0 : ''),
            scoreSet3A: nextScores.set3.p1 || (nextScores.set3.p2 ? 0 : ''),
            scoreSet3B: nextScores.set3.p2 || (nextScores.set3.p1 ? 0 : ''),
            scoreSet4A: nextScores.set4?.p1 || (nextScores.set4?.p2 ? 0 : ''),
            scoreSet4B: nextScores.set4?.p2 || (nextScores.set4?.p1 ? 0 : ''),
            scoreSet5A: nextScores.set5?.p1 || (nextScores.set5?.p2 ? 0 : ''),
            scoreSet5B: nextScores.set5?.p2 || (nextScores.set5?.p1 ? 0 : ''),
            liveScore: {
              ...nextScores,
              currentSet,
              servingPlayer,
              matchPoints: targetPoints,
              matchSets: totalSets,
            },
          }
        }
        return m
      })
      broadcastDrawUpdate({ ...currentDraw, matches: updatedMatches })
    }

    setIsDirectScoreModalOpen(false)
    setToastMessage(`✓ Score directly adjusted to: ${newP1} - ${newP2}`)
  }

  // Complete Set and Advance
  const handleNextSet = () => {
    if (currentSet < totalSets && !isMatchConcluded) {
      setCurrentSet((s) => s + 1)
      setToastMessage(`✓ Advanced to Set ${currentSet + 1}!`)
    }
  }

  // Complete Match & Advance Winner to Next Round in BWF Bracket
  const handleCompleteMatch = (winnerPlayerKey) => {
    if (!activeMatch || !currentDraw) return
    const winnerObj = winnerPlayerKey === 'p1' ? activeMatch.player1 : activeMatch.player2
    if (!winnerObj || winnerObj.isBye) {
      setToastMessage('⚠️ Cannot select BYE as winner.')
      return
    }

    const scoreSummary = availableSets
      .map((sNum) => {
        const s = setScores[`set${sNum}`]
        return (s && (s.p1 || s.p2)) ? `${s.p1}-${s.p2}` : null
      })
      .filter(Boolean)
      .join(', ') || `${setScores.set1.p1}-${setScores.set1.p2}`

    // Advance Winner in Knockout Tree
    const matchRound = activeMatch.round || 1
    const roundMatches = currentDraw.matches.filter((m) => m.round === matchRound)
    const matchIndexInRound = roundMatches.findIndex((m) => m.id === activeMatch.id)

    const nextRoundNumber = matchRound + 1
    const nextMatchIndex = Math.floor(matchIndexInRound / 2)
    const isPlayer1Slot = matchIndexInRound % 2 === 0

    const updatedMatches = currentDraw.matches.map((m) => {
      if (m.id === activeMatch.id) {
        return {
          ...m,
          status: 'completed',
          winner: winnerObj,
          score: scoreSummary,
          scoreSet1A: setScores.set1.p1,
          scoreSet1B: setScores.set1.p2,
          scoreSet2A: setScores.set2?.p1 || '',
          scoreSet2B: setScores.set2?.p2 || '',
          scoreSet3A: setScores.set3?.p1 || '',
          scoreSet3B: setScores.set3?.p2 || '',
          scoreSet4A: setScores.set4?.p1 || '',
          scoreSet4B: setScores.set4?.p2 || '',
          scoreSet5A: setScores.set5?.p1 || '',
          scoreSet5B: setScores.set5?.p2 || '',
          matchSets: totalSets,
          matchPoints: targetPoints,
          liveScore: null,
        }
      }

      if (m.round === nextRoundNumber) {
        const nextRoundMatches = currentDraw.matches.filter((rm) => rm.round === nextRoundNumber)
        if (nextRoundMatches[nextMatchIndex]?.id === m.id) {
          return {
            ...m,
            player1: isPlayer1Slot ? winnerObj : m.player1,
            player2: !isPlayer1Slot ? winnerObj : m.player2,
          }
        }
      }

      return m
    })

    const updatedDraw = {
      ...currentDraw,
      matches: updatedMatches,
    }

    broadcastDrawUpdate(updatedDraw)
    setIsMatchConcluded(true)
    setToastMessage(`🏆 Match Won by ${winnerObj.name}! Score: ${scoreSummary}`)
  }

  // Reset current match score
  const handleResetScore = () => {
    if (!window.confirm('Reset live score for this match back to 0-0?')) return
    setSetScores({
      set1: { p1: 0, p2: 0 },
      set2: { p1: 0, p2: 0 },
      set3: { p1: 0, p2: 0 },
      set4: { p1: 0, p2: 0 },
      set5: { p1: 0, p2: 0 },
    })
    setCurrentSet(1)
    setScoreHistory([])
    setIsMatchConcluded(false)

    if (activeMatch && currentDraw) {
      const updatedMatches = currentDraw.matches.map((m) => {
        if (m.id === activeMatch.id) {
          return {
            ...m,
            scoreSet1A: '',
            scoreSet1B: '',
            scoreSet2A: '',
            scoreSet2B: '',
            scoreSet3A: '',
            scoreSet3B: '',
            scoreSet4A: '',
            scoreSet4B: '',
            scoreSet5A: '',
            scoreSet5B: '',
            liveScore: null,
          }
        }
        return m
      })
      broadcastDrawUpdate({ ...currentDraw, matches: updatedMatches })
    }
  }

  // Mobile view tab state: 'scoring' | 'scoresheet' | 'queue'
  const [mobileTab, setMobileTab] = useState('scoring')
  // Confirm winner modal state: null | 'p1' | 'p2'
  const [confirmWinnerPlayer, setConfirmWinnerPlayer] = useState(null)
  // Interval timer state (60s countdown)
  const [intervalSeconds, setIntervalSeconds] = useState(null)

  // Interval timer effect
  useEffect(() => {
    let timer = null
    if (intervalSeconds !== null && intervalSeconds > 0) {
      timer = setInterval(() => setIntervalSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [intervalSeconds])

  // Select a match to score
  const handleSelectLiveMatch = (mId) => {
    setActiveMatchId(mId)
    setMobileTab('scoring')
  }

  // Launch a match to live scoring
  const handleLaunchMatch = (matchToLaunch) => {
    if (!matchToLaunch) return
    setActiveMatchId(matchToLaunch.id)
    setMobileTab('scoring')
    setToastMessage(`🔴 Match #${matchToLaunch.matchNumber || ''} is now LIVE on Court!`)
  }

  // Safe declare winner action
  const handleTriggerDeclareWinner = (playerKey) => {
    setConfirmWinnerPlayer(playerKey)
  }

  const handleConfirmDeclareWinner = () => {
    if (!confirmWinnerPlayer) return
    handleCompleteMatch(confirmWinnerPlayer)
    setConfirmWinnerPlayer(null)
  }

  return (
    <div className="umpire-mobile-app">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="umpire-toast-banner" onClick={() => setToastMessage(null)}>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. STICKY MOBILE TOP BAR */}
      <header className="umpire-mobile-topbar">
        <div className="topbar-left">
          <div className="umpire-mobile-logo">🏸</div>
          <div className="topbar-text">
            <span className="topbar-app-title">COURT UMPIRE LIVE</span>
            <span className="topbar-court-badge">
              {activeMatch?.court || session?.assignedCourt || 'Court 1'}
              {liveMatches.length > 0 && <span className="topbar-live-dot" />}
            </span>
          </div>
        </div>

        <div className="topbar-right">
          {onNavigateToPublic && (
            <button
              type="button"
              onClick={onNavigateToPublic}
              className="mobile-header-btn public"
              title="Public Fixtures"
            >
              👁️
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="mobile-header-btn exit"
            title="Exit Portal"
          >
            🚪
          </button>
        </div>
      </header>

      {/* 2. MOBILE VIEW NAVIGATION TABS (Segmented Control) */}
      <nav className="umpire-mobile-tabs">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'scoring' ? 'active' : ''}`}
          onClick={() => setMobileTab('scoring')}
        >
          <span>⚡ Live Score</span>
          {activeMatch && <span className="tab-match-chip">#{activeMatch.matchNumber || '1'}</span>}
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'scoresheet' ? 'active' : ''}`}
          onClick={() => setMobileTab('scoresheet')}
        >
          <span>📋 Scoresheet</span>
          <span className="tab-badge">{scoreHistory.length}</span>
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'queue' ? 'active' : ''}`}
          onClick={() => setMobileTab('queue')}
        >
          <span>🎾 Matches ({liveMatches.length})</span>
        </button>
      </nav>

      {/* 3. MAIN CONTENT BODY */}
      <main className="umpire-mobile-body">
        {/* Manual Scoring Mode Alert Banner */}
        {!isLiveUmpireModeActive && (
          <div className="umpire-manual-mode-alert">
            <span className="alert-icon">🔒</span>
            <div className="alert-content">
              <strong>Manual Scoring Mode Active</strong>
              <span>Organizer has paused umpire mobile scoring. Scores are entered manually from console.</span>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: ⚡ LIVE SCORING CONSOLE                                 */}
        {/* ------------------------------------------------------------- */}
        {mobileTab === 'scoring' && (
          <>
            {activeMatch ? (
              <div className="mobile-scoring-view">
                {/* Match Info Summary Card */}
                <div className="mobile-match-info-card">
                  <div className="match-info-top">
                    <span className="match-cat-badge">
                      🏸 {activeMatch.category || 'Category'} • {totalSets === 1 ? '1 Set (Single)' : `Best of ${totalSets}`} ({targetPoints} Pts)
                    </span>
                    <span className="match-round-badge">
                      🏆 {activeMatch.roundName || (activeMatch.round ? `Round ${activeMatch.round}` : 'Live Match')}
                    </span>
                    <span className="match-court-badge">{activeMatch.court || 'Court 1'}</span>
                  </div>

                  {/* Set Selector Tabs */}
                  <div className="mobile-set-tabs">
                    {availableSets.map((sNum) => {
                      const isCur = currentSet === sNum
                      const sP1 = setScores[`set${sNum}`]?.p1 || 0
                      const sP2 = setScores[`set${sNum}`]?.p2 || 0
                      return (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => setCurrentSet(sNum)}
                          className={`mobile-set-btn ${isCur ? 'active' : ''}`}
                        >
                          <span className="set-name">SET {sNum}</span>
                          <span className="set-score-pill">{sP1} - {sP2}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Match Alerts (Game Point / Match Point / Deuce / Concluded) */}
                {(isMatchPoint || isSetPoint || isDeuce || isMatchConcluded || setsWonP1 >= setsToWin || setsWonP2 >= setsToWin) && (
                  <div className={`mobile-in-game-banner ${isMatchConcluded || setsWonP1 >= setsToWin || setsWonP2 >= setsToWin ? 'concluded' : isMatchPoint ? 'match-point' : isSetPoint ? 'set-point' : 'deuce'}`}>
                    {isMatchConcluded
                      ? `🏆 MATCH CONCLUDED — Winner: ${activeMatch.winner?.name || 'Declared'}`
                      : (setsWonP1 >= setsToWin || setsWonP2 >= setsToWin)
                      ? `🏆 MATCH WON — ${setsWonP1 >= setsToWin ? (activeMatch.player1?.name || 'Player 1') : (activeMatch.player2?.name || 'Player 2')} won ${setsToWin} sets!`
                      : isMatchPoint
                      ? '⚡ MATCH POINT'
                      : isSetPoint
                      ? `🔥 GAME POINT (SET ${currentSet})`
                      : '⚖️ DEUCE (Lead by 2 to win)'}
                  </div>
                )}

                {/* 60-Second Mid-Game Interval Alert */}
                {(p1Score === intervalPoint || p2Score === intervalPoint) && targetPoints >= 15 && !isMatchConcluded && (
                  <div className="mobile-interval-card">
                    <div className="interval-info">
                      <span className="interval-bell">🔔</span>
                      <div>
                        <strong>{intervalPoint}-Point Mid-Game Interval</strong>
                        <span>60-Second Official Break & Coaching</span>
                      </div>
                    </div>
                    {intervalSeconds === null ? (
                      <button
                        type="button"
                        className="btn-start-interval"
                        onClick={() => setIntervalSeconds(60)}
                      >
                        ⏱️ Start 60s Timer
                      </button>
                    ) : (
                      <div className="interval-timer-badge">
                        <span>⏳ {intervalSeconds}s</span>
                        {intervalSeconds === 0 && <span className="timer-done">Time Up! 🔔</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* DUAL DIGITAL TOUCH SCORE CARDS (MOBILE OPTIMIZED) */}
                <div className="mobile-score-cards-grid">
                  {/* PLAYER 1 TOUCH CARD */}
                  <div className={`mobile-player-card p1 ${servingPlayer === 'p1' ? 'serving' : ''}`}>
                    {/* Header */}
                    <div className="card-header">
                      <div className="player-title-box">
                        <span className="player-tag">PLAYER 1</span>
                        <h2 className="player-name-text">
                          {activeMatch.player1?.name ? formatPersonName(activeMatch.player1.name) : 'Player 1'}
                        </h2>
                        {activeMatch.player1?.place && (
                          <span className="player-club">{activeMatch.player1.place}</span>
                        )}
                      </div>

                      {/* Serve Indicator Badge */}
                      <button
                        type="button"
                        className={`mobile-serve-btn ${servingPlayer === 'p1' ? 'active' : ''}`}
                        onClick={() => {
                          setServingPlayer('p1')
                          setServiceSide(p1Score % 2 === 0 ? 'right' : 'left')
                        }}
                      >
                        <span>🏸</span>
                        <span>{servingPlayer === 'p1' ? 'SERVING' : 'Serve'}</span>
                      </button>
                    </div>

                    {/* Massive LED Digits */}
                    <div className="mobile-led-box" onClick={handleOpenDirectEditScore} title="Tap to edit score" style={{ cursor: 'pointer' }}>
                      <span className="mobile-led-num">{String(p1Score).padStart(2, '0')}</span>
                      {servingPlayer === 'p1' && (
                        <span className="mobile-serve-side-pill">
                          {serviceSide.toUpperCase()} COURT (EVEN)
                        </span>
                      )}
                      <span className="led-edit-hint">✏️ Edit</span>
                    </div>

                    {/* Sets Won */}
                    <div className="mobile-sets-won-row">
                      <span className="sets-text">Sets:</span>
                      <div className="sets-dots">
                        {Array.from({ length: setsToWin }, (_, idx) => (
                          <span key={idx} className={`dot ${setsWonP1 > idx ? 'won' : ''}`} />
                        ))}
                      </div>
                    </div>

                    {/* MEGA TOUCH TAP & SUBTRACT BUTTONS */}
                    <div className="mobile-point-actions-row">
                      <button
                        type="button"
                        className="mobile-sub-point-btn"
                        disabled={isMatchConcluded || p1Score === 0}
                        onClick={() => handleSubtractPoint('p1')}
                        title="Subtract 1 Point / Go Back"
                      >
                        <span>↩️ -1</span>
                      </button>

                      <button
                        type="button"
                        className="mobile-point-tap-btn p1"
                        disabled={isMatchConcluded}
                        onClick={() => handleAddPoint('p1')}
                      >
                        <span className="btn-plus">+1</span>
                        <span className="btn-label">POINT (P1)</span>
                      </button>
                    </div>
                  </div>

                  {/* PLAYER 2 TOUCH CARD */}
                  <div className={`mobile-player-card p2 ${servingPlayer === 'p2' ? 'serving' : ''}`}>
                    {/* Header */}
                    <div className="card-header">
                      <div className="player-title-box">
                        <span className="player-tag">PLAYER 2</span>
                        <h2 className="player-name-text">
                          {activeMatch.player2?.name ? formatPersonName(activeMatch.player2.name) : 'Player 2'}
                        </h2>
                        {activeMatch.player2?.place && (
                          <span className="player-club">{activeMatch.player2.place}</span>
                        )}
                      </div>

                      {/* Serve Indicator Badge */}
                      <button
                        type="button"
                        className={`mobile-serve-btn ${servingPlayer === 'p2' ? 'active' : ''}`}
                        onClick={() => {
                          setServingPlayer('p2')
                          setServiceSide(p2Score % 2 === 0 ? 'right' : 'left')
                        }}
                      >
                        <span>🏸</span>
                        <span>{servingPlayer === 'p2' ? 'SERVING' : 'Serve'}</span>
                      </button>
                    </div>

                    {/* Massive LED Digits */}
                    <div className="mobile-led-box" onClick={handleOpenDirectEditScore} title="Tap to edit score" style={{ cursor: 'pointer' }}>
                      <span className="mobile-led-num">{String(p2Score).padStart(2, '0')}</span>
                      {servingPlayer === 'p2' && (
                        <span className="mobile-serve-side-pill">
                          {serviceSide.toUpperCase()} COURT (ODD)
                        </span>
                      )}
                      <span className="led-edit-hint">✏️ Edit</span>
                    </div>

                    {/* Sets Won */}
                    <div className="mobile-sets-won-row">
                      <span className="sets-text">Sets:</span>
                      <div className="sets-dots">
                        {Array.from({ length: setsToWin }, (_, idx) => (
                          <span key={idx} className={`dot ${setsWonP2 > idx ? 'won' : ''}`} />
                        ))}
                      </div>
                    </div>

                    {/* MEGA TOUCH TAP & SUBTRACT BUTTONS */}
                    <div className="mobile-point-actions-row">
                      <button
                        type="button"
                        className="mobile-sub-point-btn"
                        disabled={isMatchConcluded || p2Score === 0}
                        onClick={() => handleSubtractPoint('p2')}
                        title="Subtract 1 Point / Go Back"
                      >
                        <span>↩️ -1</span>
                      </button>

                      <button
                        type="button"
                        className="mobile-point-tap-btn p2"
                        disabled={isMatchConcluded}
                        onClick={() => handleAddPoint('p2')}
                      >
                        <span className="btn-plus">+1</span>
                        <span className="btn-label">POINT (P2)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* QUICK UNDO & DIRECT ADJUST STRIP */}
                <div className="mobile-quick-undo-strip">
                  <button
                    type="button"
                    className={`btn-strip-undo ${scoreHistory.length > 0 ? 'has-history' : ''}`}
                    disabled={scoreHistory.length === 0}
                    onClick={handleUndoPoint}
                    title="Undo previous rally point"
                  >
                    <span>↩️ Undo Last Point (பின்செல்)</span>
                    {scoreHistory.length > 0 && <span className="undo-badge">Rally #{scoreHistory.length}</span>}
                  </button>

                  <button
                    type="button"
                    className="btn-strip-direct"
                    onClick={handleOpenDirectEditScore}
                    title="Manually adjust set scores"
                  >
                    <span>✏️ Direct Adjust Score</span>
                  </button>
                </div>

                {/* Next Set Quick Action Banner */}
                {(isSetWinnerP1 || isSetWinnerP2) && currentSet < totalSets && !isMatchConcluded && setsWonP1 < setsToWin && setsWonP2 < setsToWin && (
                  <button
                    type="button"
                    onClick={handleNextSet}
                    className="mobile-next-set-banner"
                  >
                    <span>⏩ Set {currentSet} Concluded! Tap for Set {currentSet + 1}</span>
                  </button>
                )}

                {/* Match Win Action Banner */}
                {(setsWonP1 >= setsToWin || setsWonP2 >= setsToWin) && !isMatchConcluded && (
                  <button
                    type="button"
                    onClick={() => handleTriggerDeclareWinner(setsWonP1 >= setsToWin ? 'p1' : 'p2')}
                    className="mobile-next-set-banner"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.45)',
                      marginTop: '10px',
                    }}
                  >
                    <span>🏆 {setsWonP1 >= setsToWin ? (activeMatch.player1?.name || 'Player 1') : (activeMatch.player2?.name || 'Player 2')} has won {setsToWin} sets! Tap to Declare Winner →</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="mobile-empty-desk">
                <span className="empty-icon">⏳</span>
                <h3>Waiting for Match to Start</h3>
                <p>
                  Schedule list-la organizer ungaluku match assign panni <strong>"🔴 Start Live"</strong> nu launch pannum pothu, antha match automatic-ah inga live scoring ku open aagum.
                </p>

              </div>
            )}
          </>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: 📋 DIGITAL SCORESHEET & RALLY LOG                      */}
        {/* ------------------------------------------------------------- */}
        {mobileTab === 'scoresheet' && (
          <div className="mobile-scoresheet-tab">
            <div className="scoresheet-card">
              <div className="scoresheet-header">
                <h3>📋 Official Digital Scoresheet</h3>
                <span className="sync-badge">🟢 Live Synced</span>
              </div>

              {activeMatch && (
                <div className="scoresheet-match-meta">
                  <span><strong>Match:</strong> {activeMatch.player1?.name || 'P1'} vs {activeMatch.player2?.name || 'P2'}</span>
                  <span><strong>Category:</strong> {activeMatch.category || 'Standard'} • Best of {totalSets} ({targetPoints} Pts) • {activeMatch.court || 'Court 1'}</span>
                </div>
              )}

              {/* Set Matrix Table */}
              <div className="scoresheet-table-wrap">
                <table className="mobile-scoresheet-table">
                  <thead>
                    <tr>
                      <th>PLAYER</th>
                      {availableSets.map((sNum) => (
                        <th key={sNum} className={currentSet === sNum ? 'cur-set' : ''}>S{sNum}</th>
                      ))}
                      <th>SETS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={servingPlayer === 'p1' ? 'serving-row' : ''}>
                      <td className="player-col p1">
                        {servingPlayer === 'p1' && '🏸 '}
                        {activeMatch?.player1?.name || 'Player 1'}
                      </td>
                      {availableSets.map((sNum) => (
                        <td key={sNum} className="score-col">{setScores[`set${sNum}`]?.p1 || 0}</td>
                      ))}
                      <td className="sets-won-col p1">{setsWonP1}</td>
                    </tr>
                    <tr className={servingPlayer === 'p2' ? 'serving-row' : ''}>
                      <td className="player-col p2">
                        {servingPlayer === 'p2' && '🏸 '}
                        {activeMatch?.player2?.name || 'Player 2'}
                      </td>
                      {availableSets.map((sNum) => (
                        <td key={sNum} className="score-col">{setScores[`set${sNum}`]?.p2 || 0}</td>
                      ))}
                      <td className="sets-won-col p2">{setsWonP2}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Point-by-Point Live Timeline */}
              <div className="rally-timeline-box">
                <div className="timeline-header">
                  <span>⚡ Point-by-Point Rally History</span>
                  <span>Total Rallies: {scoreHistory.length}</span>
                </div>

                {scoreHistory.length === 0 ? (
                  <div className="timeline-empty">Rallies will record here in real time as points are scored.</div>
                ) : (
                  <div className="timeline-items-list">
                    {scoreHistory.slice().reverse().map((item, idx) => {
                      const isP1 = item.pointWinner === 'p1'
                      const wName = isP1 ? (activeMatch?.player1?.name || 'Player 1') : (activeMatch?.player2?.name || 'Player 2')
                      return (
                        <div key={idx} className={`timeline-item ${isP1 ? 'p1' : 'p2'}`}>
                          <div className="tl-left">
                            <span className="tl-num">#{item.pointNum}</span>
                            <span className="tl-winner">+1 {wName}</span>
                            <span className="tl-set">(Set {item.currentSet})</span>
                          </div>
                          <div className="tl-right">
                            <strong className="tl-score">{item.p1After} - {item.p2After}</strong>
                            <span className="tl-time">{item.timestamp}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: 🎾 ALL ACTIVE & SCHEDULED COURT MATCHES                 */}
        {/* ------------------------------------------------------------- */}
        {mobileTab === 'queue' && (
          <div className="mobile-queue-tab">
            {/* Live Matches List */}
            <div className="queue-section">
              <h3 className="section-title">🔴 Live on Your Court ({liveMatches.length})</h3>
              {liveMatches.length === 0 ? (
                <div className="queue-empty-text">No matches are currently LIVE on your court.</div>
              ) : (
                <div className="queue-cards-list">
                  {liveMatches.map((m) => {
                    const isSelected = activeMatch?.id === m.id
                    return (
                      <div
                        key={m.id}
                        className={`queue-match-card live ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setActiveMatchId(m.id)
                          setMobileTab('scoring')
                        }}
                      >
                        <div className="q-top">
                          <span className="q-match-num">Match #{m.matchNumber || ''}</span>
                          <span className="q-live-badge">🔴 LIVE</span>
                        </div>
                        <div className="q-players">
                          <span className="p1">{m.player1?.name || 'Player 1'}</span>
                          <span className="vs">vs</span>
                          <span className="p2">{m.player2?.name || 'Player 2'}</span>
                        </div>
                        <div className="q-bottom">
                          <span>{m.category || 'Category'} • {m.court || 'Court 1'}</span>
                          <button type="button" className="btn-score-now">
                            {isSelected ? 'Scoring Desk 🏸' : 'Open Scoresheet →'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>


          </div>
        )}
      </main>

      {/* 4. STICKY BOTTOM THUMB CONTROLS DOCK (MOBILE FIRST) */}
      {activeMatch && mobileTab === 'scoring' && (
        <footer className="umpire-mobile-thumb-dock">
          {/* Undo Button */}
          <button
            type="button"
            className="dock-btn undo"
            onClick={handleUndoPoint}
            disabled={scoreHistory.length === 0}
            title="Undo Last Point"
          >
            <span className="dock-icon">↩️</span>
            <span className="dock-label">Undo</span>
          </button>

          {/* Swap Serve Button */}
          <button
            type="button"
            className="dock-btn serve"
            onClick={() => {
              const next = servingPlayer === 'p1' ? 'p2' : 'p1'
              setServingPlayer(next)
              setServiceSide((next === 'p1' ? p1Score : p2Score) % 2 === 0 ? 'right' : 'left')
              setToastMessage(`🏸 Serve flipped to ${next === 'p1' ? (activeMatch.player1?.name || 'Player 1') : (activeMatch.player2?.name || 'Player 2')}`)
            }}
            title="Swap Server"
          >
            <span className="dock-icon">🏸</span>
            <span className="dock-label">Swap Serve</span>
          </button>

          {/* Declare Winner Player 1 */}
          <button
            type="button"
            className="dock-btn winner p1"
            onClick={() => handleTriggerDeclareWinner('p1')}
            title="Declare Player 1 Winner"
          >
            <span className="dock-icon">🏆</span>
            <span className="dock-label">Win: P1</span>
          </button>

          {/* Declare Winner Player 2 */}
          <button
            type="button"
            className="dock-btn winner p2"
            onClick={() => handleTriggerDeclareWinner('p2')}
            title="Declare Player 2 Winner"
          >
            <span className="dock-icon">🏆</span>
            <span className="dock-label">Win: P2</span>
          </button>

          {/* Reset Score */}
          <button
            type="button"
            className="dock-btn reset"
            onClick={handleResetScore}
            title="Reset Score"
          >
            <span className="dock-icon">↺</span>
            <span className="dock-label">Reset</span>
          </button>
        </footer>
      )}

      {/* 5. SAFE WINNER CONFIRMATION MODAL */}
      {confirmWinnerPlayer && (
        <div className="mobile-modal-overlay" onClick={() => setConfirmWinnerPlayer(null)}>
          <div className="mobile-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-crown">🏆</div>
            <h3>Confirm Match Winner?</h3>
            <p className="modal-winner-name">
              {confirmWinnerPlayer === 'p1' ? activeMatch?.player1?.name || 'Player 1' : activeMatch?.player2?.name || 'Player 2'}
            </p>
            <div className="modal-score-preview">
              Final Score: {availableSets.map((sNum) => {
                const s = setScores[`set${sNum}`]
                return (s && (s.p1 || s.p2)) ? `${s.p1}-${s.p2}` : null
              }).filter(Boolean).join(', ') || `${setScores.set1.p1}-${setScores.set1.p2}`}
            </div>
            <p className="modal-note">
              This will conclude the match, update the schedule result, and advance the winner in the bracket!
            </p>

            <div className="modal-actions-grid">
              <button
                type="button"
                className="btn-confirm-win"
                onClick={handleConfirmDeclareWinner}
              >
                ✓ Yes, Declare Winner
              </button>
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setConfirmWinnerPlayer(null)}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. DIRECT SCORE CORRECTION MODAL */}
      {isDirectScoreModalOpen && (
        <div className="mobile-modal-overlay" onClick={() => setIsDirectScoreModalOpen(false)}>
          <div className="mobile-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon-crown" style={{ fontSize: '28px' }}>✏️</div>
            <h3>Adjust Set {currentSet} Score Directly</h3>
            <p className="modal-note" style={{ margin: '4px 0 16px', color: '#94a3b8' }}>
              Point thavaraaga pottaal, inge seriyaana point-ai enter panni save seiyalaam (Max {maxCap} Pts).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
              {/* P1 Score Box */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1.5px solid rgba(56, 189, 248, 0.4)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeMatch?.player1?.name || 'Player 1'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDirectP1((prev) => Math.max(0, Number(prev) - 1))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={maxCap}
                    value={directP1}
                    onChange={(e) => setDirectP1(e.target.value)}
                    style={{
                      width: '60px',
                      fontSize: '28px',
                      fontWeight: '900',
                      textAlign: 'center',
                      background: '#030712',
                      color: '#38bdf8',
                      border: '1.5px solid #38bdf8',
                      borderRadius: '8px',
                      padding: '4px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setDirectP1((prev) => Math.min(maxCap, Number(prev) + 1))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* P2 Score Box */}
              <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1.5px solid rgba(244, 63, 94, 0.4)', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#f43f5e', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeMatch?.player2?.name || 'Player 2'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDirectP2((prev) => Math.max(0, Number(prev) - 1))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid #f43f5e', color: '#f43f5e', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={maxCap}
                    value={directP2}
                    onChange={(e) => setDirectP2(e.target.value)}
                    style={{
                      width: '60px',
                      fontSize: '28px',
                      fontWeight: '900',
                      textAlign: 'center',
                      background: '#030712',
                      color: '#f43f5e',
                      border: '1.5px solid #f43f5e',
                      borderRadius: '8px',
                      padding: '4px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setDirectP2((prev) => Math.min(maxCap, Number(prev) + 1))}
                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.2)', border: '1px solid #f43f5e', color: '#f43f5e', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions-grid">
              <button
                type="button"
                className="btn-confirm-win"
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
                onClick={handleSaveDirectScore}
              >
                ✓ Save & Update Score
              </button>
              <button
                type="button"
                className="btn-cancel-modal"
                onClick={() => setIsDirectScoreModalOpen(false)}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
