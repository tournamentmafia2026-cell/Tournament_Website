import { useState, useEffect } from 'react'

export const ORGANIZER_SESSION_KEY = 'badminton-organizer-session'

export const isChiefOrganizerSession = (session) => {
  if (!session) return false
  if (session.isChiefOrganizer === true) return true
  if (session.isTemporary || session.assignedMatchId) return false
  return session.role === 'organizer' && (session.username === 'admin' || session.scope === 'full')
}

export function useOrganizerAuth() {
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = localStorage.getItem(ORGANIZER_SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [authOpen, setAuthOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)

  const isChief = isChiefOrganizerSession(authSession)
  const isTemporary = Boolean(!isChief && authSession?.isTemporary)
  const assignedMatchId = authSession?.assignedMatchId || null
  const assignedMatchName = authSession?.assignedMatchName || null

  const login = (session) => {
    setAuthSession(session)
    try {
      localStorage.setItem(ORGANIZER_SESSION_KEY, JSON.stringify(session))
    } catch (e) {
      console.warn('Could not save session to localStorage:', e)
    }
    setAuthOpen(true)
    setIsAuthModalOpen(false)
  }

  const logout = () => {
    try {
      localStorage.removeItem(ORGANIZER_SESSION_KEY)
    } catch (e) {
      console.warn('Could not remove session:', e)
    }
    setAuthSession(null)
    setAuthOpen(false)
  }

  // Auto-listen to storage event in case another tab logs out or changes session
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === ORGANIZER_SESSION_KEY) {
        try {
          setAuthSession(e.newValue ? JSON.parse(e.newValue) : null)
        } catch {
          setAuthSession(null)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return {
    authSession,
    setAuthSession,
    authOpen,
    setAuthOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isChiefOrganizer: isChief,
    isTemporary,
    assignedMatchId,
    assignedMatchName,
    login,
    logout,
  }
}
