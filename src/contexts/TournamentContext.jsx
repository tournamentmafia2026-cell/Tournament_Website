import { createContext, useContext, useState, useEffect } from 'react'

const TournamentContext = createContext()

const TOURNAMENTS_STORAGE_KEY = 'badminton-tournaments'

export const TournamentProvider = ({ children }) => {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)

  // Load tournaments from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOURNAMENTS_STORAGE_KEY)
      if (stored) {
        setTournaments(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Error loading tournaments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save tournaments to localStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem(TOURNAMENTS_STORAGE_KEY, JSON.stringify(tournaments))
    }
  }, [tournaments, loading])

  const createTournament = (tournamentData) => {
    const newTournament = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      status: 'draft',
      ...tournamentData,
    }
    setTournaments([...tournaments, newTournament])
    return newTournament
  }

  const updateTournament = (id, updates) => {
    setTournaments(
      tournaments.map(t => (t.id === id ? { ...t, ...updates } : t))
    )
  }

  const deleteTournament = (id) => {
    setTournaments(tournaments.filter(t => t.id !== id))
  }

  const getTournament = (id) => {
    return tournaments.find(t => t.id === id)
  }

  const updateMatch = (tournamentId, matchId, matchUpdates) => {
    setTournaments(
      tournaments.map(t => {
        if (t.id === tournamentId) {
          return {
            ...t,
            matches: t.matches.map(m =>
              m.id === matchId ? { ...m, ...matchUpdates } : m
            ),
          }
        }
        return t
      })
    )
  }

  const value = {
    tournaments,
    createTournament,
    updateTournament,
    deleteTournament,
    getTournament,
    updateMatch,
    loading,
  }

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

export const useTournament = () => {
  const context = useContext(TournamentContext)
  if (!context) {
    throw new Error('useTournament must be used within TournamentProvider')
  }
  return context
}
