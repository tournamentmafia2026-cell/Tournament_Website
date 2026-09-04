import { useState } from 'react'
import { useTournament } from '../../contexts/TournamentContext'
import { calculateStandings } from '../../utils/bracketUtils'

export const RoundRobinFormat = ({ tournament }) => {
  const { updateMatch } = useTournament()
  const [sortBy, setSortBy] = useState('points')

  const matches = tournament.matches || []
  const players = tournament.players || []

  const standings = calculateStandings(players, matches)

  return (
    <div className="w-full bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">{tournament.name} - Round Robin</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Standings */}
        <div className="lg:col-span-1">
          <h3 className="text-xl font-bold mb-4">Standings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border p-2 text-left">Rank</th>
                  <th className="border p-2 text-left">Player</th>
                  <th className="border p-2 text-center">P</th>
                  <th className="border p-2 text-center">W</th>
                  <th className="border p-2 text-center">L</th>
                  <th className="border p-2 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((player, idx) => (
                  <tr
                    key={player.id}
                    className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    <td className="border p-2 font-bold text-lg">{idx + 1}</td>
                    <td className="border p-2">
                      <div className="font-semibold">{player.name}</div>
                      <div className="text-xs text-gray-600">{player.academy}</div>
                    </td>
                    <td className="border p-2 text-center font-semibold">{player.played}</td>
                    <td className="border p-2 text-center text-green-600 font-bold">
                      {player.won}
                    </td>
                    <td className="border p-2 text-center text-red-600 font-bold">
                      {player.lost}
                    </td>
                    <td className="border p-2 text-center bg-blue-100 font-bold text-lg">
                      {player.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matches */}
        <div className="lg:col-span-2">
          <h3 className="text-xl font-bold mb-4">Matches</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {matches.map(match => (
              <div
                key={match.id}
                className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Player 1 */}
                  <div className="flex-1">
                    <div className="font-semibold">{match.player1?.name || 'TBD'}</div>
                    <div className="text-sm opacity-90">{match.player1?.academy}</div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-2">
                    <div className="bg-white text-blue-900 px-3 py-1 rounded font-bold text-lg">
                      {match.score1 ?? '-'}
                    </div>
                    <div className="text-white font-bold">-</div>
                    <div className="bg-white text-blue-900 px-3 py-1 rounded font-bold text-lg">
                      {match.score2 ?? '-'}
                    </div>
                  </div>

                  {/* Player 2 */}
                  <div className="flex-1 text-right">
                    <div className="font-semibold">{match.player2?.name || 'TBD'}</div>
                    <div className="text-sm opacity-90">{match.player2?.academy}</div>
                  </div>

                  {/* Status */}
                  {match.status === 'completed' && (
                    <div className="text-sm font-bold text-green-300 ml-2">✓ Done</div>
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
