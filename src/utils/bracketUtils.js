// Single Elimination Bracket
export const generateSingleEliminationBracket = (players) => {
  const sortedPlayers = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999))
  const matches = []
  let matchId = 1

  // First round
  for (let i = 0; i < sortedPlayers.length; i += 2) {
    matches.push({
      id: `match-${matchId}`,
      round: 1,
      player1: sortedPlayers[i] || null,
      player2: sortedPlayers[i + 1] || null,
      score1: null,
      score2: null,
      winner: null,
      status: 'pending',
    })
    matchId++
  }

  // Subsequent rounds
  let currentRound = 1
  let matchesInRound = matches.filter(m => m.round === currentRound).length

  while (matchesInRound > 1) {
    currentRound++
    for (let i = 0; i < matchesInRound; i += 2) {
      matches.push({
        id: `match-${matchId}`,
        round: currentRound,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: 'pending',
        dependsOn: [`match-${i + 1}`, `match-${i + 2}`],
      })
      matchId++
    }
    matchesInRound = matchesInRound / 2
  }

  return matches
}

// Double Elimination Bracket
export const generateDoubleEliminationBracket = (players) => {
  const sortedPlayers = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999))
  const matches = []
  let matchId = 1

  // Winner's Bracket - First Round
  for (let i = 0; i < sortedPlayers.length; i += 2) {
    matches.push({
      id: `match-${matchId}`,
      bracket: 'winners',
      round: 1,
      player1: sortedPlayers[i] || null,
      player2: sortedPlayers[i + 1] || null,
      score1: null,
      score2: null,
      winner: null,
      status: 'pending',
    })
    matchId++
  }

  // Winner's Bracket - Remaining rounds
  let winnersMatchesInRound = Math.floor(sortedPlayers.length / 2)
  let currentRound = 1

  while (winnersMatchesInRound > 1) {
    currentRound++
    for (let i = 0; i < winnersMatchesInRound; i += 2) {
      matches.push({
        id: `match-${matchId}`,
        bracket: 'winners',
        round: currentRound,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: 'pending',
      })
      matchId++
    }
    winnersMatchesInRound = Math.floor(winnersMatchesInRound / 2)
  }

  // Loser's Bracket - First Round (losers from winners' bracket round 1)
  const losersFirstRound = Math.floor(sortedPlayers.length / 2)
  for (let i = 0; i < losersFirstRound; i += 2) {
    matches.push({
      id: `match-${matchId}`,
      bracket: 'losers',
      round: 1,
      player1: null,
      player2: null,
      score1: null,
      score2: null,
      winner: null,
      status: 'pending',
    })
    matchId++
  }

  // Loser's Bracket - Additional rounds
  let losersRound = 1
  let losersInRound = Math.floor(losersFirstRound / 2)

  while (losersInRound > 0) {
    losersRound++
    for (let i = 0; i < losersInRound; i += 2) {
      matches.push({
        id: `match-${matchId}`,
        bracket: 'losers',
        round: losersRound,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        status: 'pending',
      })
      matchId++
    }
    losersInRound = Math.floor(losersInRound / 2)
  }

  // Grand Final
  matches.push({
    id: `match-${matchId}`,
    bracket: 'grand-final',
    round: 1,
    player1: null,
    player2: null,
    score1: null,
    score2: null,
    winner: null,
    status: 'pending',
    type: 'grand-final',
  })

  return matches
}

// Round Robin
export const generateRoundRobinFixture = (players) => {
  const matches = []
  let matchId = 1

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      matches.push({
        id: `match-${matchId}`,
        player1: players[i],
        player2: players[j],
        score1: null,
        score2: null,
        winner: null,
        status: 'pending',
      })
      matchId++
    }
  }

  return matches
}

// League Format
export const generateLeagueFixture = (players, matchesPerPlayer = 3) => {
  const matches = []
  let matchId = 1
  const used = new Set()

  for (let i = 0; i < players.length; i++) {
    let matchCount = 0
    for (let j = 0; j < players.length && matchCount < matchesPerPlayer; j++) {
      if (i !== j) {
        const key = [i, j].sort().join('-')
        if (!used.has(key)) {
          matches.push({
            id: `match-${matchId}`,
            player1: players[i],
            player2: players[j],
            score1: null,
            score2: null,
            winner: null,
            status: 'pending',
            round: Math.floor(matchId / (players.length / 2)) + 1,
          })
          used.add(key)
          matchId++
          matchCount++
        }
      }
    }
  }

  return matches
}

// Calculate standings/points
export const calculateStandings = (players, matches) => {
  const standings = players.map(p => ({
    ...p,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
  }))

  matches
    .filter(m => m.status === 'completed' && m.winner)
    .forEach(match => {
      const p1 = standings.find(p => p.id === match.player1?.id)
      const p2 = standings.find(p => p.id === match.player2?.id)

      if (p1 && p2) {
        p1.played++
        p2.played++

        if (match.winner?.id === p1.id) {
          p1.won++
          p1.points += 2
          p2.lost++
        } else {
          p2.won++
          p2.points += 2
          p1.lost++
        }
      }
    })

  return standings.sort((a, b) => b.points - a.points || b.won - a.won)
}
