import { useState } from 'react'
import { useTournament } from '../../contexts/TournamentContext'
import { calculateStandings } from '../../utils/bracketUtils'

export const LeagueFormat = ({ tournament }) => {
  const { updateMatch } = useTournament()
  const [selectedRound, setSelectedRound] = useState(1)

  const matches = tournament.matches || []
  const players = tournament.players || []

  const standings = calculateStandings(players, matches)
  const rounds = Math.max(...matches.map(m => m.round || 1), 1)
  const matchesByRound = {}

  matches.forEach(match => {
    const round = match.round || 1
    if (!matchesByRound[round]) {
      matchesByRound[round] = []
    }
    matchesByRound[round].push(match)
  })

  return (
    <div className="w-full bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{tournament.name} - League Format</h2>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Standings */}
        <div className="lg:col-span-1">
          <h3 className="text-xl font-bold mb-4">League Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <th className="border p-2 text-left">#</th>
                  <th className="border p-2 text-left">Player</th>
                  <th className="border p-2 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((player, idx) => (
                  <tr
                    key={player.id}
                    className={`${
                      idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                    } hover:bg-blue-50 transition`}
                  >
                    <td className="border p-2 font-bold text-lg">{idx + 1}</td>
                    <td className="border p-2 text-left">
                      <div className="font-semibold text-sm">{player.name}</div>
                      <div className="text-xs text-gray-600">{player.academy}</div>
                    </td>
                    <td className="border p-2 text-center bg-gradient-to-r from-blue-100 to-blue-50 font-bold">
                      {player.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matches by Round */}
        <div className="lg:col-span-3">
          <div className="mb-4">
            <h3 className="text-xl font-bold mb-3">Matches</h3>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
                <button
                  key={round}
                  onClick={() => setSelectedRound(round)}
                  className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                    selectedRound === round
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Round {round}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(matchesByRound[selectedRound] || []).map(match => (
              <div
                key={match.id}
                className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Player 1 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {match.player1?.name || 'TBD'}
                    </div>
                    <div className="text-xs opacity-90 truncate">
                      {match.player1?.academy}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="bg-white text-blue-900 px-3 py-1 rounded font-bold">
                      {match.score1 ?? '-'}
                    </div>
                    <div className="text-white font-bold">vs</div>
                    <div className="bg-white text-blue-900 px-3 py-1 rounded font-bold">
                      {match.score2 ?? '-'}
                    </div>
                  </div>

                  {/* Player 2 */}
                  <div className="flex-1 text-right min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {match.player2?.name || 'TBD'}
                    </div>
                    <div className="text-xs opacity-90 truncate">
                      {match.player2?.academy}
                    </div>
                  </div>

                  {/* Status */}
                  {match.status === 'completed' && (
                    <span className="text-xs font-bold text-green-300 ml-2 flex-shrink-0">
                      ✓
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
