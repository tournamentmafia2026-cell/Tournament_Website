import { useState } from 'react'
import { useTournament } from '../../contexts/TournamentContext'

export const SingleEliminationBracket = ({ tournament }) => {
  const { updateMatch } = useTournament()
  const [editingMatch, setEditingMatch] = useState(null)

  const matches = tournament.matches || []
  const rounds = Math.max(...matches.map(m => m.round), 1)
  const matchesByRound = {}

  matches.forEach(match => {
    if (!matchesByRound[match.round]) {
      matchesByRound[match.round] = []
    }
    matchesByRound[match.round].push(match)
  })

  const handleScoreUpdate = (matchId, score1, score2) => {
    const match = matches.find(m => m.id === matchId)
    const winner = score1 > score2 ? match.player1 : match.player2

    updateMatch(tournament.id, matchId, {
      score1: parseInt(score1),
      score2: parseInt(score2),
      winner,
      status: 'completed',
    })

    setEditingMatch(null)
  }

  const roundLabels = {
    1: 'Round 1',
    2: 'Quarterfinals',
    3: 'Semifinals',
    4: 'Finals',
  }

  return (
    <div className="w-full overflow-x-auto bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{tournament.name} - Single Elimination</h2>

      <div className="flex gap-8 min-w-max">
        {Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
          <div key={round} className="flex flex-col gap-4 min-w-max">
            <h3 className="font-bold text-center text-lg mb-4">
              {roundLabels[round] || `Round ${round}`}
            </h3>

            <div className="flex flex-col justify-around gap-2" style={{ minHeight: '400px' }}>
              {(matchesByRound[round] || []).map((match, idx) => (
                <div
                  key={match.id}
                  className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-lg p-4 w-56 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {/* Player 1 */}
                  <div className="bg-white text-blue-900 p-3 rounded mb-1 font-semibold hover:bg-blue-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold">{match.player1?.academy || 'TBD'}</div>
                        <div className="text-lg font-bold">{match.player1?.name || 'TBD'}</div>
                      </div>
                      {editingMatch === match.id ? (
                        <input
                          type="number"
                          min="0"
                          max="30"
                          className="w-12 text-center font-bold border-2 border-yellow-400 rounded"
                          autoFocus
                          onBlur={() => setEditingMatch(null)}
                        />
                      ) : (
                        <div
                          className="text-2xl font-bold text-yellow-500 cursor-pointer hover:text-yellow-600"
                          onClick={() => setEditingMatch(match.id)}
                        >
                          {match.score1 ?? '-'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-300 h-px mb-1"></div>

                  {/* Player 2 */}
                  <div className="bg-white text-blue-900 p-3 rounded font-semibold hover:bg-blue-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold">{match.player2?.academy || 'TBD'}</div>
                        <div className="text-lg font-bold">{match.player2?.name || 'TBD'}</div>
                      </div>
                      <div className="text-2xl font-bold text-yellow-500 cursor-pointer hover:text-yellow-600">
                        {match.score2 ?? '-'}
                      </div>
                    </div>
                  </div>

                  {/* Winner Badge */}
                  {match.winner && (
                    <div className="mt-2 text-center bg-green-500 text-white py-1 rounded text-sm font-bold">
                      ✓ Winner
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
