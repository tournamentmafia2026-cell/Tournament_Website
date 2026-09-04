import { useState } from 'react'
import { useTournament } from '../../contexts/TournamentContext'
import {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  generateRoundRobinFixture,
  generateLeagueFixture,
} from '../../utils/bracketUtils'
import {
  formatTournamentName,
  formatPersonName,
  formatPlaceOrClub,
  formatCategoryName,
} from '../utils/textFormatters'

export const TournamentManager = () => {
  const { tournaments, createTournament, deleteTournament, updateTournament } =
    useTournament()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: 'Men Singles',
    format: 'single-elimination',
    players: [],
    playerInput: '',
  })

  const handleAddPlayer = () => {
    if (formData.playerInput.trim()) {
      const newPlayer = {
        id: Date.now(),
        ...parsePlayerInput(formData.playerInput),
      }
      setFormData({
        ...formData,
        players: [...formData.players, newPlayer],
        playerInput: '',
      })
    }
  }

  const parsePlayerInput = (input) => {
    const parts = input.split('|')
    return {
      name: formatPersonName(parts[0]?.trim() || ''),
      academy: formatPlaceOrClub(parts[1]?.trim() || ''),
      seed: parts[2] ? parseInt(parts[2].trim()) : null,
    }
  }

  const handleRemovePlayer = (id) => {
    setFormData({
      ...formData,
      players: formData.players.filter(p => p.id !== id),
    })
  }

  const handleCreateTournament = () => {
    if (!formData.name || formData.players.length < 2) {
      alert('Please enter tournament name and at least 2 players')
      return
    }

    let matches = []
    switch (formData.format) {
      case 'single-elimination':
        matches = generateSingleEliminationBracket(formData.players)
        break
      case 'double-elimination':
        matches = generateDoubleEliminationBracket(formData.players)
        break
      case 'round-robin':
        matches = generateRoundRobinFixture(formData.players)
        break
      case 'league':
        matches = generateLeagueFixture(formData.players, 3)
        break
      default:
        matches = generateSingleEliminationBracket(formData.players)
    }

    const tournament = {
      name: formatTournamentName(formData.name),
      category: formatCategoryName(formData.category),
      format: formData.format,
      players: formData.players,
      matches,
    }

    createTournament(tournament)

    setFormData({
      name: '',
      category: 'Men Singles',
      format: 'single-elimination',
      players: [],
      playerInput: '',
    })
    setShowForm(false)
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Tournament Manager</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            {showForm ? 'Cancel' : '+ New Tournament'}
          </button>
        </div>

        {/* Create Tournament Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6">Create New Tournament</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., State Championship 2024"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
                >
                  <option>Men Singles</option>
                  <option>Women Singles</option>
                  <option>Men Doubles</option>
                  <option>Women Doubles</option>
                  <option>Mixed Doubles</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Tournament Format</label>
                <select
                  value={formData.format}
                  onChange={e => setFormData({ ...formData, format: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
                >
                  <option value="single-elimination">Single Elimination</option>
                  <option value="double-elimination">Double Elimination</option>
                  <option value="round-robin">Round Robin</option>
                  <option value="league">League Format</option>
                </select>
              </div>
            </div>

            {/* Players Section */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">
                Add Players (Format: Name | Academy | Seed)
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={formData.playerInput}
                  onChange={e => setFormData({ ...formData, playerInput: e.target.value })}
                  onKeyPress={e => e.key === 'Enter' && handleAddPlayer()}
                  placeholder="e.g., Vibheesh M | Feathers Academy | 1"
                  className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:outline-none"
                />
                <button
                  onClick={handleAddPlayer}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  Add
                </button>
              </div>

              {/* Players List */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-semibold mb-3">
                  Players Added: {formData.players.length}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {formData.players.map(player => (
                    <div
                      key={player.id}
                      className="bg-white p-3 rounded-lg flex justify-between items-center border-l-4 border-blue-600"
                    >
                      <div>
                        <div className="font-semibold">{player.name}</div>
                        <div className="text-sm text-gray-600">{player.academy}</div>
                        {player.seed && (
                          <div className="text-xs text-blue-600 font-bold">Seed #{player.seed}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemovePlayer(player.id)}
                        className="text-red-600 hover:text-red-900 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateTournament}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition text-lg"
            >
              Create Tournament
            </button>
          </div>
        )}

        {/* Tournaments List */}
        <div className="grid gap-6">
          {tournaments.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-gray-600 text-lg">No tournaments created yet</div>
              <p className="text-gray-500 mt-2">Create your first tournament to get started!</p>
            </div>
          ) : (
            tournaments.map(tournament => (
              <div key={tournament.id} className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{tournament.name}</h3>
                    <p className="text-gray-600 mt-1">
                      {tournament.category} • {tournament.format.replace('-', ' ')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTournament(tournament.id)}
                    className="text-red-600 hover:text-red-900 font-bold text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4 text-center">
                  <div className="bg-blue-50 rounded p-3">
                    <div className="text-2xl font-bold text-blue-600">
                      {tournament.players?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Players</div>
                  </div>
                  <div className="bg-green-50 rounded p-3">
                    <div className="text-2xl font-bold text-green-600">
                      {tournament.matches?.filter(m => m.status === 'completed').length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="bg-yellow-50 rounded p-3">
                    <div className="text-2xl font-bold text-yellow-600">
                      {tournament.matches?.filter(m => m.status === 'pending').length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                  <div className="bg-purple-50 rounded p-3">
                    <div className="text-2xl font-bold text-purple-600">
                      {tournament.matches?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Matches</div>
                  </div>
                </div>

                <a
                  href={`/tournament/${tournament.id}`}
                  className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  View Bracket →
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
