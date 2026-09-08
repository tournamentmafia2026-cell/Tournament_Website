import { useState, useEffect, useRef } from 'react'
import { SupabaseService } from '../utils/supabaseDb'
import { fastDeepEqual } from '../utils/fastDeepEqual'
import {
  sanitizeTournament,
  sanitizeParticipant,
  formatPersonName,
  formatCourtName,
  formatPlaceOrClub,
  joinDoublesNames,
  splitDoublesNames,
} from '../utils/textFormatters'
import {
  isDoublesCategory,
  sortBadmintonCategories,
} from '../utils/badmintonCategories'

export const STORAGE_KEY = 'badminton-published-matches'
export const AUTH_STORAGE_KEY = 'badminton-authenticators'

export const areTournamentsEqual = (a, b) => {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i]
    const itemB = b[i]
    if (!itemA || !itemB) return false
    if (String(itemA.id) !== String(itemB.id)) return false
    if (String(itemA.matchName || '').trim() !== String(itemB.matchName || '').trim()) return false
    if (String(itemA.courtName || '').trim() !== String(itemB.courtName || '').trim()) return false
    if (String(itemA.startDate || '') !== String(itemB.startDate || '')) return false
    if (String(itemA.endDate || '') !== String(itemB.endDate || '')) return false
    if (String(itemA.winner || '') !== String(itemB.winner || '')) return false
    if (String(itemA.completedAt || '') !== String(itemB.completedAt || '')) return false
    if (JSON.stringify(itemA.categories || []) !== JSON.stringify(itemB.categories || [])) return false
    if (JSON.stringify(itemA.categoryWinners || {}) !== JSON.stringify(itemB.categoryWinners || {})) return false
    const countA = (itemA.participants || itemA.authenticators || []).length
    const countB = (itemB.participants || itemB.authenticators || []).length
    if (countA !== countB) return false
  }
  return true
}

export const areAuthEqual = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    const listA = Array.isArray(a[k]) ? a[k] : []
    const listB = Array.isArray(b[k]) ? b[k] : []
    if (listA.length !== listB.length) return false
  }
  return true
}

export function useTournamentData() {
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
    return []
  })

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
    return {}
  })

  const [publishedStatusMap, setPublishedStatusMap] = useState(() => {
    try {
      const saved = localStorage.getItem('badminton-published-status')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && Object.keys(parsed).length > 0) return parsed
      }
    } catch {}
    return {}
  })

  const [isLiveStreamActive, setIsLiveStreamActive] = useState(() => {
    try {
      return localStorage.getItem('badminton-live-stream-active') === 'true'
    } catch {
      return false
    }
  })

  // Sync state back to server whenever updates occur
  const syncServerData = (payload) => {
    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  // Fetch and sync with Supabase + Shared Server DB in realtime
  useEffect(() => {
    let isMounted = true
    let isSyncing = false

    const syncAllData = async () => {
      if (isSyncing || !isMounted) return
      isSyncing = true

      let hasSupaData = false
      try {
        const supaTournaments = await SupabaseService.getTournaments()
        if (!isMounted) return
        if (supaTournaments && Array.isArray(supaTournaments)) {
          hasSupaData = true
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
            if (areTournamentsEqual(prev, mapped)) return prev
            return mapped
          })
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
          } catch (e) {}

          const authMap = {}
          supaTournaments.forEach((t) => {
            const tId = String(t.id)
            const pList = Array.isArray(t.authenticators)
              ? t.authenticators
              : (Array.isArray(t.participants) ? t.participants : [])
            authMap[tId] = pList
            authMap[t.id] = pList
          })

          setAuthenticators((prev) => {
            if (areAuthEqual(prev, authMap)) return prev
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authMap))
              localStorage.setItem('badminton-match-authenticators', JSON.stringify(authMap))
            } catch (e) {}
            return authMap
          })
        }

        // Sync Tournament Draws from Supabase
        const supaDraws = await SupabaseService.getAllTournamentDraws()
        if (supaDraws && Array.isArray(supaDraws) && supaDraws.length > 0) {
          try {
            let localDraws = {}
            try {
              localDraws = JSON.parse(localStorage.getItem('badminton-tournament-draws') || '{}')
            } catch (e) {}

            const nextDraws = { ...localDraws }
            let changed = false
            supaDraws.forEach((row) => {
              if (row.id && row.draw_data) {
                if (!localDraws[row.id] || JSON.stringify(localDraws[row.id]) !== JSON.stringify(row.draw_data)) {
                  if (!localDraws[row.id]) {
                    nextDraws[row.id] = row.draw_data
                    changed = true
                  }
                }
              }
            })
            if (changed) {
              localStorage.setItem('badminton-tournament-draws', JSON.stringify(nextDraws))
            }
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Supabase sync status:', err)
      }

      // Supplementary serverless fallback sync
      try {
        const res = await fetch('/api/tournaments')
        const contentType = res.headers.get('content-type') || ''
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json()
          if (!isMounted) return

          if (!hasSupaData) {
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
                if (fastDeepEqual(prev, merged)) return prev
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
                } catch (e) {}
                return merged
              })
            }

            if (data.authenticators && typeof data.authenticators === 'object') {
              setAuthenticators((prev) => {
                const merged = { ...prev, ...data.authenticators }
                if (fastDeepEqual(prev, merged)) return prev
                try {
                  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(merged))
                } catch (e) {}
                return merged
              })
            }
          }

          if (data.publishedStatus && typeof data.publishedStatus === 'object') {
            setPublishedStatusMap((prev) => {
              const merged = { ...prev, ...data.publishedStatus }
              if (fastDeepEqual(prev, merged)) return prev
              try {
                localStorage.setItem('badminton-published-status', JSON.stringify(merged))
              } catch (e) {}
              return merged
            })
          }
        }
      } catch (err) {
      } finally {
        isSyncing = false
      }
    }

    syncAllData()
    const pollTimer = setInterval(syncAllData, 6000)

    let debounceTimer = null
    const debouncedSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (isMounted) syncAllData()
      }, 1500)
    }

    const tourSub = SupabaseService.subscribeToTournaments(() => {
      debouncedSync()
    })
    const drawSub = SupabaseService.subscribeToTournamentDraws(() => {
      debouncedSync()
    })

    return () => {
      isMounted = false
      clearInterval(pollTimer)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (tourSub?.unsubscribe) tourSub.unsubscribe()
      if (drawSub?.unsubscribe) drawSub.unsubscribe()
    }
  }, [])

  // Auto-sync published status across storage events
  useEffect(() => {
    const refreshPubStatus = () => {
      try {
        const saved = localStorage.getItem('badminton-published-status')
        if (saved) {
          const parsed = JSON.parse(saved)
          setPublishedStatusMap((prev) => {
            if (fastDeepEqual(prev, parsed)) return prev
            return parsed
          })
        }
        const savedMatches = localStorage.getItem(STORAGE_KEY)
        if (savedMatches) {
          const parsed = JSON.parse(savedMatches)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = parsed.map(sanitizeTournament)
            setPublishedMatches((prev) => {
              if (areTournamentsEqual(prev, sanitized)) return prev
              return sanitized
            })
          }
        }
      } catch (e) {}
    }

    refreshPubStatus()
    window.addEventListener('storage', refreshPubStatus)
    return () => window.removeEventListener('storage', refreshPubStatus)
  }, [])

  // Delete Tournament Action
  const handleDeleteMatch = (matchId) => {
    const matchIdStr = String(matchId)
    const updated = publishedMatches.filter((m) => String(m.id) !== matchIdStr)
    setPublishedMatches(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {}

    setAuthenticators((prev) => {
      const next = { ...prev }
      delete next[matchId]
      delete next[matchIdStr]
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      syncServerData({ authenticators: next })
      return next
    })

    syncServerData({ matches: updated })
    SupabaseService.deleteTournament(matchId).catch(() => {})
  }

  return {
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
  }
}
