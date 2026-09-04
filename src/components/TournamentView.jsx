import { useParams, useNavigate } from 'react-router-dom'
import { useTournament } from '../../contexts/TournamentContext'
import { SingleEliminationBracket } from './brackets/SingleEliminationBracket'
import { DoubleEliminationBracket } from './brackets/DoubleEliminationBracket'
import { RoundRobinFormat } from './brackets/RoundRobinFormat'
import { LeagueFormat } from './brackets/LeagueFormat'

export const TournamentView = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTournament } = useTournament()

  const tournament = getTournament(id)

  if (!tournament) {
    return (
      <div className="w-full bg-gray-50 min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tournament Not Found</h1>
          <p className="text-gray-600 mb-6">The tournament you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const renderBracket = () => {
    switch (tournament.format) {
      case 'single-elimination':
        return <SingleEliminationBracket tournament={tournament} />
      case 'double-elimination':
        return <DoubleEliminationBracket tournament={tournament} />
      case 'round-robin':
        return <RoundRobinFormat tournament={tournament} />
      case 'league':
        return <LeagueFormat tournament={tournament} />
      default:
        return <SingleEliminationBracket tournament={tournament} />
    }
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="mb-6 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-2"
        >
          ← Back to Tournaments
        </button>

        {renderBracket()}
      </div>
    </div>
  )
}
