import { useState } from 'react'
import { useTournament } from '../../contexts/TournamentContext'

export const DoubleEliminationBracket = ({ tournament }) => {
  const { updateMatch } = useTournament()
  const [editingMatch, setEditingMatch] = useState(null)

  const matches = tournament.matches || []
  const winnersMatches = matches.filter(m => m.bracket === 'winners')
  const losersMatches = matches.filter(m => m.bracket === 'losers')
  const grandFinal = matches.filter(m => m.bracket === 'grand-final')[0]

  const winnersRounds = Math.max(...winnersMatches.map(m => m.round), 1)
  const losersRounds = Math.max(...losersMatches.map(m => m.round), 1)

  const getMatchesByRound = (bracketMatches) => {
    const byRound = {}
    bracketMatches.forEach(match => {
      if (!byRound[match.round]) {
        byRound[match.round] = []
      }
      byRound[match.round].push(match)
    })
    return byRound
  }

  const MatchCard = ({ match }) => (
    <div className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-lg p-3 w-52 shadow-lg hover:shadow-xl transition-shadow">
      {/* Player 1 */}
      <div className="bg-white text-blue-900 p-2 rounded mb-1 font-semibold hover:bg-blue-50">
        <div className="flex justify-between items-center gap-2">
          <div>
            <div className="text-xs font-bold">{match.player1?.academy || 'TBD'}</div>
            <div className="text-sm font-bold">{match.player1?.name || 'TBD'}</div>
          </div>
          <div className="text-xl font-bold text-yellow-500 cursor-pointer hover:text-yellow-600">
            {match.score1 ?? '-'}
          </div>
        </div>
      </div>

      <div className="bg-gray-300 h-px mb-1"></div>

      {/* Player 2 */}
      <div className="bg-white text-blue-900 p-2 rounded font-semibold hover:bg-blue-50">
        <div className="flex justify-between items-center gap-2">
          <div>
            <div className="text-xs font-bold">{match.player2?.academy || 'TBD'}</div>
            <div className="text-sm font-bold">{match.player2?.name || 'TBD'}</div>
          </div>
          <div className="text-xl font-bold text-yellow-500 cursor-pointer hover:text-yellow-600">
            {match.score2 ?? '-'}
          </div>
        </div>
      </div>

      {match.winner && (
        <div className="mt-1 text-center bg-green-500 text-white py-1 rounded text-xs font-bold">
          ✓ Winner
        </div>
      )}
    </div>
  )

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{tournament.name} - Double Elimination</h2>

      {/* Winners Bracket */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 text-green-700">Winners Bracket</h3>
        <div className="flex gap-6 min-w-max overflow-x-auto pb-4">
          {Array.from({ length: winnersRounds }, (_, i) => i + 1).map(round => {
            const roundMatches = getMatchesByRound(winnersMatches)[round] || []
            return (
              <div key={round} className="flex flex-col gap-4 min-w-max">
                <h4 className="font-bold text-center text-sm">Round {round}</h4>
                <div className="flex flex-col justify-around gap-2" style={{ minHeight: '300px' }}>
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Losers Bracket */}
      <div className="mb-8">
        <h3 className="text-xl font-bold mb-4 text-red-700">Losers Bracket</h3>
        <div className="flex gap-6 min-w-max overflow-x-auto pb-4">
          {Array.from({ length: losersRounds }, (_, i) => i + 1).map(round => {
            const roundMatches = getMatchesByRound(losersMatches)[round] || []
            return (
              <div key={round} className="flex flex-col gap-4 min-w-max">
                <h4 className="font-bold text-center text-sm">Round {round}</h4>
                <div className="flex flex-col justify-around gap-2" style={{ minHeight: '300px' }}>
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grand Final */}
      {grandFinal && (
        <div className="border-4 border-yellow-400 bg-yellow-50 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-center">Grand Final</h3>
          <div className="flex justify-center">
            <MatchCard match={grandFinal} />
          </div>
        </div>
      )}
    </div>
  )
}
