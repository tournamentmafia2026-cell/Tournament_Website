/**
 * Badminton Tournament Draw & Fixture Engine
 * Inspired by official Badminton tournament software (BadmintonPoints / BWF Tournament Planner)
 */

export const toRomanNumeral = (num) => {
  const romanMap = [
    [10, 'X'], [9, 'IX'], [8, 'VIII'], [7, 'VII'], [6, 'VI'],
    [5, 'V'], [4, 'IV'], [3, 'III'], [2, 'II'], [1, 'I']
  ]
  let result = ''
  let n = num
  for (const [val, roman] of romanMap) {
    while (n >= val) {
      result += roman
      n -= val
    }
  }
  return result || String(num)
}

export const getRoundName = (roundNumber, totalRounds) => {
  const fromFinal = totalRounds - roundNumber
  switch (fromFinal) {
    case 0:
      return 'Final'
    case 1:
      return 'Semi Finals'
    case 2:
      return 'Quarter Finals'
    case 3:
      return 'Round of 16'
    case 4:
      return 'Round of 32'
    case 5:
      return 'Round of 64'
    case 6:
      return 'Round of 128'
    case 7:
      return 'Round of 256'
    case 8:
      return 'Round of 512'
    default:
      return `Round ${roundNumber}`
  }
}

export const getNextPowerOfTwo = (n) => {
  let power = 2
  while (power < n) {
    power *= 2
  }
  return Math.max(power, 2)
}

/**
 * Standard BWF / Tournament Seed Positions and opponent slots for standard knockout draws.
 * Each seed is placed in its own distinct match in Round 1.
 * Supports any draw size: 4, 8, 16, 32, 64, 128, 256, 512...
 */
export const getBwfSeedPositions = (drawSize) => {
  const size = getNextPowerOfTwo(drawSize)

  let seedLines = []
  if (size === 4) {
    seedLines = [1, 4]
  } else if (size === 8) {
    seedLines = [1, 8, 5, 4]
  } else if (size === 16) {
    seedLines = [1, 16, 9, 8, 5, 12, 13, 4]
  } else if (size === 32) {
    seedLines = [1, 32, 17, 16, 9, 24, 25, 8, 5, 28, 21, 12, 13, 20, 29, 4]
  } else if (size === 64) {
    seedLines = [
      1, 64, 33, 32, 17, 48, 49, 16,
      9, 56, 41, 24, 25, 40, 57, 8,
      5, 60, 37, 28, 21, 44, 53, 12,
      13, 52, 45, 20, 29, 36, 61, 4
    ]
  } else {
    // Dynamic BWF Seeding for 128, 256, 512, etc.
    const seedsCount = Math.min(32, size / 2)
    const base4 = [1, size, Math.floor(size / 2) + 1, Math.floor(size / 2)]
    const base8 = [
      ...base4,
      Math.floor(size / 4) + 1,
      size - Math.floor(size / 4),
      Math.floor(size / 4),
      size - Math.floor(size / 4) + 1
    ]
    if (seedsCount <= 8) {
      seedLines = base8.slice(0, seedsCount)
    } else {
      seedLines = [...base8]
      const step = Math.floor(size / 16)
      for (let i = 1; i <= 8; i++) {
        seedLines.push(i * step * 2 + 1)
        seedLines.push(size - i * step * 2)
      }
      seedLines = Array.from(new Set(seedLines)).slice(0, seedsCount)
    }
  }

  return seedLines.map((line, idx) => {
    const slot = line - 1
    const opponentSlot = slot % 2 === 0 ? slot + 1 : slot - 1
    return {
      seed: idx + 1,
      line,
      slot,
      opponentSlot,
      matchIndex: Math.floor(slot / 2),
    }
  })
}

export const getBwfSeedSlots = (drawSize) => {
  return getBwfSeedPositions(drawSize).map((p) => p.slot)
}

/**
 * Normalizes court, club, or place affiliation strings for accurate comparison
 */
export const normalizeAffiliation = (text) => {
  if (!text) return ''
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/^(the|club|court|academy)\s+/i, '')
    .replace(/\s+(club|court|academy|association|team)$/i, '')
    .replace(/[\s\-_,.]+/g, ' ')
    .trim()
}

/**
 * Checks whether two participants belong to the same home court, club, or place
 */
export const areFromSameCourtOrClub = (p1, p2) => {
  if (!p1 || !p2 || p1.isBye || p2.isBye || p1.isPlaceholder || p2.isPlaceholder) return false

  const c1 = normalizeAffiliation(p1.court)
  const c2 = normalizeAffiliation(p2.court)
  const pl1 = normalizeAffiliation(p1.place)
  const pl2 = normalizeAffiliation(p2.place)

  // 1. Both have non-empty court names
  if (c1 && c2) {
    if (c1 === c2) return true
    return false
  }

  // 2. If one or both lack court name, compare place / club
  if (pl1 && pl2 && pl1 === pl2) return true

  // 3. Cross check if court was typed into place field or vice versa
  if (c1 && pl2 && c1 === pl2) return true
  if (c2 && pl1 && c2 === pl1) return true

  return false
}

/**
 * Generate a complete Knockout Draw with Byes, Match tree progression, and default court/time slots
 * Supports custom totalMembers (e.g. 45, 50, 60), explicit Seeds, and prioritizes Byes for Seeded players.
 * ZERO BYE-vs-BYE MATCHES: Every BYE is strictly paired with an actual player.
 * SAME-COURT AVOIDANCE: Separates players from the same court name so they play opponents from different courts.
 */
export const generateBadmintonDraw = (players = [], options = {}) => {
  const defaultCourt = options.courtName || 'Court 1'
  const defaultVenue = options.venue || 'Venue Arena'
  const startTime = options.startTime || '09:00'
  const matchDurationMinutes = options.matchDurationMinutes || 30

  // Total members / draw size (accepts arbitrary numbers like 45, 50, 60)
  const requestedTotalMembers = Number(options.totalMembers || options.drawSize) || 0
  const explicitSeeds = (options.seeds || []).map((s) => ({
    ...s,
    name: s?.name ? String(s.name).trim().toUpperCase() : '',
  }))

  // Count active players (from explicit seeds + uploaded players or requested total)
  let activePlayerList = (players || []).map((p) => ({
    ...p,
    name: p?.name ? String(p.name).trim().toUpperCase() : '',
  }))

  // Handle seedMap option if explicitSeeds wasn't passed directly
  if (options.seedMap && Object.keys(options.seedMap).length > 0 && explicitSeeds.length === 0) {
    Object.entries(options.seedMap).forEach(([playerId, seedNum]) => {
      const p = activePlayerList.find((pl) => String(pl.id) === String(playerId))
      if (p) {
        explicitSeeds.push({
          seed: Number(seedNum),
          id: p.id,
          name: p.name ? String(p.name).trim().toUpperCase() : '',
          place: p.place || '',
          court: p.court || '',
        })
      }
    })
    explicitSeeds.sort((a, b) => (a.seed || 99) - (b.seed || 99))
  }
  
  // If players array already has seeded players, include them in explicitSeeds
  if (explicitSeeds.length === 0) {
    activePlayerList.forEach((p) => {
      if (p && p.seed) {
        explicitSeeds.push({
          seed: Number(p.seed),
          id: p.id,
          name: p.name ? String(p.name).trim().toUpperCase() : '',
          place: p.place || '',
          court: p.court || '',
        })
      }
    })
    explicitSeeds.sort((a, b) => (a.seed || 99) - (b.seed || 99))
  }

  // Helper to check if a player is already present in a target list by ID or Name
  const isPlayerInList = (player, targetList) => {
    if (!player || !targetList || targetList.length === 0) return false
    const pId = player.id !== undefined && player.id !== null ? String(player.id).trim().toLowerCase() : ''
    const pName = player.name ? String(player.name).trim().toLowerCase() : ''

    return targetList.some((item) => {
      if (!item) return false
      const itemId = item.id !== undefined && item.id !== null ? String(item.id).trim().toLowerCase() : ''
      const itemName = item.name ? String(item.name).trim().toLowerCase() : ''

      if (pId && itemId && pId === itemId) return true
      if (pName && itemName && pName === itemName) return true
      return false
    })
  }

  // If explicit seeds are provided as objects, merge or prioritize them without duplication
  if (explicitSeeds.length > 0) {
    const nonSeedPlayers = activePlayerList.filter((p) => !isPlayerInList(p, explicitSeeds))
    activePlayerList = [...explicitSeeds, ...nonSeedPlayers]
  }

  // Determine target draw size strictly if explicitly requested
  let targetDrawSize
  if (options.drawSize) {
    targetDrawSize = getNextPowerOfTwo(Number(options.drawSize))
  } else if (options.totalMembers) {
    targetDrawSize = getNextPowerOfTwo(Number(options.totalMembers))
  } else {
    targetDrawSize = getNextPowerOfTwo(Math.max(2, activePlayerList.length))
  }
  const drawSize = Math.max(2, targetDrawSize)

  // If activePlayerList exceeds target drawSize (e.g. going from 32 down to 16), truncate to fit
  if (activePlayerList.length > drawSize) {
    const nonSeedPlayers = activePlayerList.filter((p) => !isPlayerInList(p, explicitSeeds))
    const neededNonSeeds = Math.max(0, drawSize - explicitSeeds.length)
    activePlayerList = [...explicitSeeds, ...nonSeedPlayers.slice(0, neededNonSeeds)]
  }

  // Calculate actual participant count within the drawSize
  const rawParticipantCount = activePlayerList.length > 0 
    ? activePlayerList.length 
    : (requestedTotalMembers > 0 ? Math.min(requestedTotalMembers, drawSize) : drawSize)
  
  const totalParticipants = Math.min(drawSize, Math.max(2, rawParticipantCount))
  const totalRounds = Math.max(1, Math.round(Math.log2(drawSize)))
  const totalMatchesInR1 = drawSize / 2

  // Total byes: Draw Size - Total Participants (e.g. 16 - 11 = 5 Byes)
  let totalByes = Math.max(0, drawSize - totalParticipants)
  if (options.byesCount !== undefined && Number(options.byesCount) >= 0) {
    totalByes = Math.min(Number(options.byesCount), totalMatchesInR1)
  }
  totalByes = Math.min(totalByes, totalMatchesInR1)

  // Determine number of seeds to place
  const seedPositions = getBwfSeedPositions(drawSize)
  let seedsCount = options.seedsCount !== undefined ? Number(options.seedsCount) : 0
  if (explicitSeeds.length > 0) {
    seedsCount = Math.max(seedsCount, explicitSeeds.length)
  }
  if (seedsCount === 0 && options.seedsCount === undefined) {
    const autoSeedsCount = drawSize >= 64 ? 8 : drawSize >= 16 ? 4 : drawSize >= 8 ? 2 : 1
    seedsCount = Math.min(autoSeedsCount, Math.floor(drawSize / 2))
  }
  seedsCount = Math.min(seedsCount, seedPositions.length, totalMatchesInR1)

  // 1. Prepare Seeded Players with explicit seed number and isSeed flag
  const seedsToPlace = []
  for (let i = 0; i < seedsCount; i++) {
    const seedNum = i + 1
    const exp = explicitSeeds.find((s) => s && Number(s.seed) === seedNum) || explicitSeeds[i]
    if (exp && exp.name) {
      seedsToPlace.push({
        id: exp.id || `seed-${seedNum}`,
        name: String(exp.name).trim().toUpperCase(),
        place: exp.place || '',
        court: exp.court || '',
        seed: seedNum,
        isSeed: true,
      })
    } else if (activePlayerList[i]) {
      seedsToPlace.push({
        ...activePlayerList[i],
        id: activePlayerList[i].id || `seed-${seedNum}`,
        name: activePlayerList[i].name ? String(activePlayerList[i].name).trim().toUpperCase() : `SEED ${seedNum}`,
        place: activePlayerList[i].place || '',
        court: activePlayerList[i].court || '',
        seed: seedNum,
        isSeed: true,
      })
    } else {
      seedsToPlace.push({
        id: `seed-${seedNum}`,
        name: `SEED ${seedNum}`,
        place: '',
        court: '',
        seed: seedNum,
        isSeed: true,
      })
    }
  }

  // 2. Place Seeded Players into standard BWF seed slots (each seed gets its own match)
  const slots = new Array(drawSize).fill(null)
  const matchHasBye = new Array(totalMatchesInR1).fill(false)
  const seedOpponentSlots = []

  seedsToPlace.forEach((seedPlayer, idx) => {
    const pos = seedPositions[idx]
    if (pos) {
      slots[pos.slot] = {
        ...seedPlayer,
        name: seedPlayer.name ? String(seedPlayer.name).trim().toUpperCase() : `SEED ${seedPlayer.seed}`,
        seed: seedPlayer.seed,
        isSeed: true,
        line: pos.slot + 1,
      }
      seedOpponentSlots.push({
        seed: seedPlayer.seed,
        opponentSlot: pos.opponentSlot,
        matchIndex: pos.matchIndex,
      })
    }
  })

  // 3. PRIORITIZE BYES FOR SEEDED PLAYERS FIRST!
  // The opponents of Seed 1, Seed 2, Seed 3, Seed 4... receive BYEs first.
  let byesAssigned = 0
  for (let i = 0; i < seedOpponentSlots.length; i++) {
    if (byesAssigned >= totalByes) break
    const { opponentSlot, matchIndex } = seedOpponentSlots[i]
    if (slots[opponentSlot] === null && !matchHasBye[matchIndex]) {
      slots[opponentSlot] = {
        id: `bye-${byesAssigned + 1}`,
        name: 'BYE',
        isBye: true,
        line: opponentSlot + 1,
      }
      matchHasBye[matchIndex] = true
      byesAssigned++
    }
  }

  // 4. Distribute any remaining BYEs across unseeded / normal matches.
  // CRITICAL RULE: Exactly ONE BYE per match! Two BYEs can NEVER be in the same match!
  if (byesAssigned < totalByes) {
    for (let m = 0; m < totalMatchesInR1; m++) {
      if (byesAssigned >= totalByes) break
      // Only pick a match that does NOT have any BYE yet
      if (!matchHasBye[m]) {
        const slotA = m * 2
        const slotB = m * 2 + 1

        if (slots[slotB] === null) {
          slots[slotB] = {
            id: `bye-${byesAssigned + 1}`,
            name: 'BYE',
            isBye: true,
            line: slotB + 1,
          }
          matchHasBye[m] = true
          byesAssigned++
        } else if (slots[slotA] === null) {
          slots[slotA] = {
            id: `bye-${byesAssigned + 1}`,
            name: 'BYE',
            isBye: true,
            line: slotA + 1,
          }
          matchHasBye[m] = true
          byesAssigned++
        }
      }
    }
  }

  // 5. Fill remaining open slots with unseeded players with SAME-COURT / SAME-CLUB AVOIDANCE & BALANCED DISTRIBUTION
  // CRITICAL: Filter out ANY player that has already been placed as a seed (by ID or by Name)
  const remainingPlayers = activePlayerList.filter((p) => !isPlayerInList(p, seedsToPlace))

  // Deduplicate remaining unseeded players so no unseeded player appears twice
  const uniqueRemainingPlayers = []
  const seenPlayerNames = new Set()
  const seenPlayerIds = new Set()

  remainingPlayers.forEach((p) => {
    if (!p) return
    const idStr = p.id !== undefined && p.id !== null ? String(p.id).trim().toLowerCase() : ''
    const nameStr = p.name ? String(p.name).trim().toUpperCase() : ''
    
    // Skip if name or ID already seen
    if (nameStr && seenPlayerNames.has(nameStr)) return
    if (idStr && seenPlayerIds.has(idStr)) return

    if (nameStr) seenPlayerNames.add(nameStr)
    if (idStr) seenPlayerIds.add(idStr)
    uniqueRemainingPlayers.push({
      ...p,
      name: nameStr,
    })
  })

  // Group unseeded players by court / club affiliation to prevent clubmates from facing each other
  const affiliationGroups = new Map()
  uniqueRemainingPlayers.forEach((p) => {
    const key = normalizeAffiliation(p.court) || normalizeAffiliation(p.place) || `_independent_${Math.random()}`
    if (!affiliationGroups.has(key)) {
      affiliationGroups.set(key, [])
    }
    affiliationGroups.get(key).push(p)
  })

  // Sort groups by size descending so largest club contingents get separated first
  const sortedGroupArrays = Array.from(affiliationGroups.values()).sort((a, b) => b.length - a.length)

  // Interleave players so same-court players are distributed across different matches
  const distributedUnseededPlayers = []
  let hasMore = true
  let roundIdx = 0
  while (hasMore) {
    hasMore = false
    for (const group of sortedGroupArrays) {
      if (roundIdx < group.length) {
        distributedUnseededPlayers.push(group[roundIdx])
        hasMore = true
      }
    }
    roundIdx++
  }

  // Find all available empty slots
  const openSlotIndices = []
  for (let i = 0; i < drawSize; i++) {
    if (slots[i] === null) {
      openSlotIndices.push(i)
    }
  }

  // Alternate slot assignment across Top Half and Bottom Half to spread court members across the bracket
  const topHalfOpen = openSlotIndices.filter((s) => s < drawSize / 2)
  const bottomHalfOpen = openSlotIndices.filter((s) => s >= drawSize / 2)
  
  const orderedOpenSlots = []
  const maxHalfLen = Math.max(topHalfOpen.length, bottomHalfOpen.length)
  for (let i = 0; i < maxHalfLen; i++) {
    if (i < topHalfOpen.length) orderedOpenSlots.push(topHalfOpen[i])
    if (i < bottomHalfOpen.length) orderedOpenSlots.push(bottomHalfOpen[i])
  }

  // Place unseeded players into slots while strictly avoiding same-court opponent in the same match
  const unplacedPlayers = [...distributedUnseededPlayers]

  for (const player of unplacedPlayers) {
    let bestSlotIndex = -1

    for (let j = 0; j < orderedOpenSlots.length; j++) {
      const slotIdx = orderedOpenSlots[j]
      const oppSlotIdx = slotIdx % 2 === 0 ? slotIdx + 1 : slotIdx - 1
      const opponent = slots[oppSlotIdx]

      // Check if placing player in slotIdx causes a same-court clash
      const causesClash = opponent && areFromSameCourtOrClub(player, opponent)
      if (!causesClash) {
        bestSlotIndex = j
        break
      }
    }

    // If no non-clashing slot found among open slots, take first open slot (will be resolved in swap pass)
    if (bestSlotIndex === -1 && orderedOpenSlots.length > 0) {
      bestSlotIndex = 0
    }

    if (bestSlotIndex !== -1) {
      const assignedSlot = orderedOpenSlots.splice(bestSlotIndex, 1)[0]
      slots[assignedSlot] = {
        id: player.id || `p-${assignedSlot + 1}`,
        name: (player.name ? String(player.name).trim().toUpperCase() : '') || `PLAYER ${assignedSlot + 1}`,
        place: player.place || '',
        court: player.court || '',
        seed: null,
        isSeed: false,
        line: assignedSlot + 1,
      }
    }
  }

  // Fill any remaining unfilled open slots with placeholders
  while (orderedOpenSlots.length > 0) {
    const emptySlot = orderedOpenSlots.shift()
    slots[emptySlot] = {
      id: `p-${emptySlot + 1}`,
      name: `PLAYER ${emptySlot + 1}`,
      place: '',
      court: '',
      seed: null,
      isSeed: false,
      line: emptySlot + 1,
      isPlaceholder: true,
    }
  }

  // Post-Placement Clash Resolver:
  // Iterate through all Round 1 matches and eliminate any same-court pairings by swapping with non-conflicting slots
  for (let pass = 0; pass < 20; pass++) {
    let clashFound = false

    for (let m = 0; m < totalMatchesInR1; m++) {
      const slotA = m * 2
      const slotB = m * 2 + 1
      const pA = slots[slotA]
      const pB = slots[slotB]

      if (pA && pB && areFromSameCourtOrClub(pA, pB)) {
        clashFound = true
        // Swap non-seed player with another non-seed player in a different match
        const slotToSwap = (!pB.isSeed && !pB.isBye) ? slotB : ((!pA.isSeed && !pA.isBye) ? slotA : null)
        if (slotToSwap === null) continue

        const pToSwap = slots[slotToSwap]
        let swapped = false

        for (let otherM = 0; otherM < totalMatchesInR1; otherM++) {
          if (otherM === m) continue

          const otherSlotA = otherM * 2
          const otherSlotB = otherM * 2 + 1

          const candidateSlots = [otherSlotA, otherSlotB]
          for (const candSlot of candidateSlots) {
            const candPlayer = slots[candSlot]
            if (!candPlayer || candPlayer.isSeed || candPlayer.isBye) continue

            const otherOppSlot = candSlot === otherSlotA ? otherSlotB : otherSlotA
            const otherOpponent = slots[otherOppSlot]
            const currOppSlot = slotToSwap === slotA ? slotB : slotA
            const currOpponent = slots[currOppSlot]

            // Check if swap resolves match m clash AND doesn't create clash in otherM
            const candValidInM = !areFromSameCourtOrClub(candPlayer, currOpponent)
            const pToSwapValidInOther = !areFromSameCourtOrClub(pToSwap, otherOpponent)

            if (candValidInM && pToSwapValidInOther) {
              // Perform swap!
              slots[slotToSwap] = { ...candPlayer, line: slotToSwap + 1 }
              slots[candSlot] = { ...pToSwap, line: candSlot + 1 }
              swapped = true
              break
            }
          }
          if (swapped) break
        }
      }
    }

    if (!clashFound) break
  }

  // Final Safety Sanitizer: Ensure NO player name or ID appears more than once across slots!
  const finalSeenNames = new Set()
  const finalSeenIds = new Set()

  // First pass: register all seeded players into the seen sets so their assigned position is protected
  for (let i = 0; i < drawSize; i++) {
    const slot = slots[i]
    if (slot && slot.isSeed && !slot.isBye) {
      if (slot.name) finalSeenNames.add(slot.name.trim().toLowerCase())
      if (slot.id) finalSeenIds.add(String(slot.id).trim().toLowerCase())
    }
  }

  // Second pass: for non-seeded slots, if the player was already placed as a seed or earlier in the draw, replace with placeholder
  for (let i = 0; i < drawSize; i++) {
    const slot = slots[i]
    if (slot && !slot.isSeed && !slot.isBye && !slot.isPlaceholder) {
      const nameKey = slot.name ? slot.name.trim().toLowerCase() : ''
      const idKey = slot.id ? String(slot.id).trim().toLowerCase() : ''

      if ((nameKey && finalSeenNames.has(nameKey)) || (idKey && finalSeenIds.has(idKey))) {
        slots[i] = {
          id: `p-${i + 1}`,
          name: `Player ${i + 1}`,
          place: '',
          court: '',
          seed: null,
          isSeed: false,
          line: i + 1,
          isPlaceholder: true,
        }
      } else {
        if (nameKey) finalSeenNames.add(nameKey)
        if (idKey) finalSeenIds.add(idKey)
      }
    }
  }

  const matches = []
  let matchNumber = 1

  // Create structure for all rounds
  const roundMatches = {}

  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = drawSize / Math.pow(2, round)
    roundMatches[round] = []

    for (let m = 0; m < matchesInRound; m++) {
      const matchId = `R${round}-M${m + 1}`

      const matchObj = {
        id: matchId,
        matchNumber: matchNumber++,
        round,
        roundName: getRoundName(round, totalRounds),
        indexInRound: m,
        player1: null,
        player2: null,
        scoreSet1A: '',
        scoreSet1B: '',
        scoreSet2A: '',
        scoreSet2B: '',
        scoreSet3A: '',
        scoreSet3B: '',
        totalScoreA: '',
        totalScoreB: '',
        winner: null,
        status: 'scheduled', // 'scheduled' | 'live' | 'completed'
        court: defaultCourt,
        time: '',
        venue: defaultVenue,
        nextMatchId: round < totalRounds ? `R${round + 1}-M${Math.floor(m / 2) + 1}` : null,
        nextMatchSlot: m % 2 === 0 ? 'player1' : 'player2',
      }

      roundMatches[round].push(matchObj)
      matches.push(matchObj)
    }
  }

  // Populate Round 1 matches from initial slots
  for (let m = 0; m < roundMatches[1].length; m++) {
    const match = roundMatches[1][m]
    const p1 = slots[m * 2]
    const p2 = slots[m * 2 + 1]

    if (p1) p1.line = m * 2 + 1
    if (p2) p2.line = m * 2 + 2

    match.player1 = p1
    match.player2 = p2
    match.line1 = m * 2 + 1
    match.line2 = m * 2 + 2

    // Auto-advance BYEs immediately
    if (p1 && p1.isBye && p2 && !p2.isBye) {
      match.winner = { ...p2, hasByeWalkover: true }
      match.status = 'completed'
      match.totalScoreA = 'BYE'
      match.totalScoreB = 'W.O.'
    } else if (p2 && p2.isBye && p1 && !p1.isBye) {
      match.winner = { ...p1, hasByeWalkover: true }
      match.status = 'completed'
      match.totalScoreA = 'W.O.'
      match.totalScoreB = 'BYE'
    } else {
      match.winner = null
      match.status = 'scheduled'
      match.totalScoreA = ''
      match.totalScoreB = ''
    }
  }

  // Propagate completed Round 1 BYE winners to subsequent rounds
  propagateWinners(matches)

  return {
    drawSize,
    totalRounds,
    totalByes,
    seedsCount: seedsToPlace.length,
    seeds: seedsToPlace,
    matches,
    config: {
      ...options,
      drawSize,
      seedsCount: seedsToPlace.length,
      seeds: seedsToPlace,
    },
  }
}

/**
 * Sanitize any existing or loaded tournament draw to strictly remove duplicate player names
 */
export const sanitizeBadmintonDraw = (draw) => {
  if (!draw || !Array.isArray(draw.matches)) return draw

  const round1Matches = draw.matches.filter((m) => m.round === 1)
  if (round1Matches.length === 0) return draw

  const seenNames = new Set()
  const seenIds = new Set()
  let hasDuplicates = false

  // Pass 1: Protect all seeded player slots
  round1Matches.forEach((m) => {
    [m.player1, m.player2].forEach((p) => {
      if (p && p.isSeed && !p.isBye) {
        if (p.name) seenNames.add(p.name.trim().toLowerCase())
        if (p.id) seenIds.add(String(p.id).trim().toLowerCase())
      }
    })
  })

  // Pass 2: Detect duplicate non-seed players and replace with clean placeholders
  round1Matches.forEach((m) => {
    ['player1', 'player2'].forEach((slotKey) => {
      const p = m[slotKey]
      if (p && !p.isSeed && !p.isBye && !p.isPlaceholder) {
        const nameKey = p.name ? p.name.trim().toLowerCase() : ''
        const idKey = p.id ? String(p.id).trim().toLowerCase() : ''

        if ((nameKey && seenNames.has(nameKey)) || (idKey && seenIds.has(idKey))) {
          hasDuplicates = true
          m[slotKey] = {
            id: `p-${m.id}-${slotKey}`,
            name: `Player ${slotKey === 'player1' ? (m.line1 || 1) : (m.line2 || 2)}`,
            place: '',
            court: '',
            seed: null,
            isSeed: false,
            isPlaceholder: true,
            line: slotKey === 'player1' ? m.line1 : m.line2,
          }
        } else {
          if (nameKey) seenNames.add(nameKey)
          if (idKey) seenIds.add(idKey)
        }
      }
    })
  })

  // Pass 3: Resolve same-court clashes if present among non-seeded players
  let sameCourtClashesResolved = false
  for (let pass = 0; pass < 10; pass++) {
    let clashFound = false
    for (let i = 0; i < round1Matches.length; i++) {
      const m1 = round1Matches[i]
      if (m1.player1 && m1.player2 && areFromSameCourtOrClub(m1.player1, m1.player2)) {
        clashFound = true
        // Try to swap m1.player2 (if not seed/bye) or m1.player1 with another match's player
        const swapSlotKey = (!m1.player2.isSeed && !m1.player2.isBye) ? 'player2' : ((!m1.player1.isSeed && !m1.player1.isBye) ? 'player1' : null)
        if (!swapSlotKey) continue

        const pToSwap = m1[swapSlotKey]
        const currOpponent = swapSlotKey === 'player2' ? m1.player1 : m1.player2
        let swapped = false

        for (let j = 0; j < round1Matches.length; j++) {
          if (i === j) continue
          const m2 = round1Matches[j]

          for (const candSlotKey of ['player1', 'player2']) {
            const candPlayer = m2[candSlotKey]
            if (!candPlayer || candPlayer.isSeed || candPlayer.isBye) continue

            const otherOpponent = candSlotKey === 'player1' ? m2.player2 : m2.player1

            if (!areFromSameCourtOrClub(candPlayer, currOpponent) && !areFromSameCourtOrClub(pToSwap, otherOpponent)) {
              // Swap players
              m1[swapSlotKey] = { ...candPlayer, line: swapSlotKey === 'player1' ? m1.line1 : m1.line2 }
              m2[candSlotKey] = { ...pToSwap, line: candSlotKey === 'player1' ? m2.line1 : m2.line2 }
              swapped = true
              sameCourtClashesResolved = true
              break
            }
          }
          if (swapped) break
        }
      }
    }
    if (!clashFound) break
  }

  if (hasDuplicates || sameCourtClashesResolved) {
    propagateWinners(draw.matches)
  }

  return draw
}

/**
 * Propagate winners across all rounds in the match graph
 */
export const propagateWinners = (matches) => {
  if (!Array.isArray(matches)) return matches
  const matchMap = new Map(matches.map((m) => [m.id, m]))

  // Helper to resolve player object from winner
  const resolveWinnerPlayer = (winner, m) => {
    if (!winner) return null
    if (typeof winner === 'object') return winner
    if (winner === 'player1') return m.player1
    if (winner === 'player2') return m.player2
    return null
  }

  // Go through matches round by round to push winners forward
  matches.forEach((match) => {
    // Normalize winner string if present
    if (typeof match.winner === 'string') {
      match.winner = resolveWinnerPlayer(match.winner, match)
    }

    if (match.winner && match.nextMatchId) {
      const nextMatch = matchMap.get(match.nextMatchId)
      if (nextMatch) {
        const winnerObj = match.winner.isBye ? { name: 'BYE', isBye: true } : { ...match.winner }
        if (match.nextMatchSlot === 'player1') {
          nextMatch.player1 = winnerObj
        } else {
          nextMatch.player2 = winnerObj
        }

        // Check if next match now has a BYE vs real player
        if (nextMatch.player1 && nextMatch.player2) {
          if (nextMatch.player1.isBye && !nextMatch.player2.isBye && !nextMatch.winner) {
            nextMatch.winner = { ...nextMatch.player2, hasByeWalkover: true }
            nextMatch.status = 'completed'
            nextMatch.totalScoreA = 'BYE'
            nextMatch.totalScoreB = 'W.O.'
          } else if (nextMatch.player2.isBye && !nextMatch.player1.isBye && !nextMatch.winner) {
            nextMatch.winner = { ...nextMatch.player1, hasByeWalkover: true }
            nextMatch.status = 'completed'
            nextMatch.totalScoreA = 'W.O.'
            nextMatch.totalScoreB = 'BYE'
          }
        }
      }
    } else if (!match.winner && match.nextMatchId) {
      // Clear downstream winner slot if winner was revoked
      const nextMatch = matchMap.get(match.nextMatchId)
      if (nextMatch) {
        if (match.nextMatchSlot === 'player1' && nextMatch.player1?.id === match.previousWinnerId) {
          nextMatch.player1 = null
        } else if (match.nextMatchSlot === 'player2' && nextMatch.player2?.id === match.previousWinnerId) {
          nextMatch.player2 = null
        }
      }
    }
  })

  return matches
}

/**
 * Automatically determine match winner from badminton sets
 */
export const calculateBadmintonWinner = (match, player1, player2, maxSets = 3) => {
  if (!player1 || !player2) return null
  if (player1.isBye) return player2
  if (player2.isBye) return player1

  const neededWins = Math.ceil((Number(maxSets) || 3) / 2)
  const totalSetsCount = Number(maxSets) || 3

  let p1SetsWon = 0
  let p2SetsWon = 0

  for (let i = 1; i <= totalSetsCount; i++) {
    const sA = match[`scoreSet${i}A`]
    const sB = match[`scoreSet${i}B`]

    // Both scores must be filled and non-equal to decide the set
    if (sA !== '' && sA !== undefined && sB !== '' && sB !== undefined) {
      const numA = Number(sA) || 0
      const numB = Number(sB) || 0
      if (numA > numB) p1SetsWon++
      else if (numB > numA) p2SetsWon++
    }

    // If a player reaches majority set wins (e.g. 2 sets in 3-set match), they immediately win!
    if (p1SetsWon >= neededWins) return player1
    if (p2SetsWon >= neededWins) return player2
  }

  // If single set played or simple total score used
  if (match.totalScoreA !== undefined && match.totalScoreB !== undefined && match.totalScoreA !== '' && match.totalScoreB !== '') {
    const totA = Number(match.totalScoreA)
    const totB = Number(match.totalScoreB)
    if (!Number.isNaN(totA) && !Number.isNaN(totB)) {
      if (totA > totB) return player1
      if (totB > totA) return player2
    }
  }

  return null
}

/**
 * Format minutes offset from base time string "HH:MM" into clean 12h AM/PM string
 */
export const format12HourTime = (time24OrMinutes, baseStart24 = '09:00') => {
  let totalMinutes = 0
  if (typeof time24OrMinutes === 'number') {
    const [startH, startM] = (baseStart24 || '09:00').split(':').map(Number)
    totalMinutes = (startH * 60 + (startM || 0)) + time24OrMinutes
  } else if (typeof time24OrMinutes === 'string') {
    if (time24OrMinutes.includes('AM') || time24OrMinutes.includes('PM')) {
      return time24OrMinutes
    }
    const [h, m] = time24OrMinutes.split(':').map(Number)
    totalMinutes = (h || 0) * 60 + (m || 0)
  }

  const hours24 = Math.floor(totalMinutes / 60) % 24
  const mins = totalMinutes % 60
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  const formattedMins = String(mins).padStart(2, '0')
  return `${hours12}:${formattedMins} ${ampm}`
}

/**
 * Intelligent Multi-Category Tournament Scheduler
 * Interleaves all categories round-by-round across available courts (Court 1, Court 2, ...)
 * and assigns clean start times and court assignments.
 */
export const scheduleMultiCategoryTournamentDraws = ({
  categoryDrawsMap = {},
  categoriesOrder = [],
  startTime = '09:00',
  matchDuration = 20, // in minutes
  intervalBuffer = 5, // in minutes
  courtList = ['Court 1', 'Court 2'],
  isTimingsActive = true,
}) => {
  if (!isTimingsActive) {
    // Return all draws with times cleared
    const clearedMap = {}
    Object.entries(categoryDrawsMap).forEach(([catKey, draw]) => {
      if (!draw || !Array.isArray(draw?.matches)) {
        clearedMap[catKey] = draw
        return
      }
      clearedMap[catKey] = {
        ...draw,
        matches: draw.matches.map((m) => ({
          ...m,
          time: '',
          scheduledTime: '',
          orderIndex: undefined,
        })),
        scheduleConfig: {
          isTimingsActive: false,
        },
      }
    })
    return { updatedDrawsMap: clearedMap, scheduledMatchesList: [] }
  }

  const stepDuration = Math.max(5, (Number(matchDuration) || 20) + (Number(intervalBuffer) || 0))
  const courts = Array.isArray(courtList) && courtList.length > 0 ? courtList : ['Court 1', 'Court 2']
  const numCourts = courts.length

  // Track next available minute offset for each court
  const courtAvailableMinutes = new Array(numCourts).fill(0)

  // 1. Group matches by Category and then by Round
  const matchesByRoundTier = {}
  let maxRoundInTournament = 1

  const effectiveCats = categoriesOrder.length > 0 ? categoriesOrder : Object.keys(categoryDrawsMap)

  effectiveCats.forEach((catKey) => {
    const draw = categoryDrawsMap[catKey]
    if (!draw || !Array.isArray(draw.matches)) return

    draw.matches.forEach((m) => {
      const r = m.round || 1
      if (r > maxRoundInTournament) maxRoundInTournament = r
      if (!matchesByRoundTier[r]) matchesByRoundTier[r] = []

      matchesByRoundTier[r].push({
        categoryKey: catKey,
        matchId: m.id,
        match: m,
        round: r,
      })
    })
  })

  // 2. Interleave matches: Round 1 (all categories) -> Round 2 (all categories) -> ...
  const scheduledOrder = []
  let globalOrderIndex = 1

  for (let r = 1; r <= maxRoundInTournament; r++) {
    const roundMatches = matchesByRoundTier[r] || []

    roundMatches.forEach((item) => {
      const m = item.match
      // If it's a BYE walkover match, it needs no court time
      const isByeMatch = Boolean(
        (m.player1?.isBye && !m.player2?.isBye) ||
        (m.player2?.isBye && !m.player1?.isBye) ||
        m.winner?.hasByeWalkover
      )

      if (isByeMatch) {
        scheduledOrder.push({
          ...item,
          assignedCourt: 'BYE',
          assignedTime: 'WALKOVER',
          timeMinutes: 0,
          isBye: true,
          orderIndex: globalOrderIndex++,
        })
        return
      }

      // Find the court that is free earliest
      let earliestCourtIdx = 0
      let earliestTime = courtAvailableMinutes[0]
      for (let c = 1; c < numCourts; c++) {
        if (courtAvailableMinutes[c] < earliestTime) {
          earliestTime = courtAvailableMinutes[c]
          earliestCourtIdx = c
        }
      }

      const assignedCourtName = courts[earliestCourtIdx]
      const matchStartMinutes = courtAvailableMinutes[earliestCourtIdx]
      const formattedTimeStr = format12HourTime(matchStartMinutes, startTime)

      scheduledOrder.push({
        ...item,
        assignedCourt: assignedCourtName,
        assignedTime: formattedTimeStr,
        timeMinutes: matchStartMinutes,
        courtIndex: earliestCourtIdx,
        isBye: false,
        orderIndex: globalOrderIndex++,
      })

      // Advance that court's available time by stepDuration
      courtAvailableMinutes[earliestCourtIdx] += stepDuration
    })
  }

  // 3. Update all draws with assigned court and time
  const scheduledMatchLookup = new Map()
  scheduledOrder.forEach((s) => {
    scheduledMatchLookup.set(`${s.categoryKey}-${s.matchId}`, s)
  })

  const updatedDrawsMap = {}
  Object.entries(categoryDrawsMap).forEach(([catKey, draw]) => {
    if (!draw || !Array.isArray(draw.matches)) {
      updatedDrawsMap[catKey] = draw
      return
    }

    const updatedMatches = draw.matches.map((m) => {
      const scheduleInfo = scheduledMatchLookup.get(`${catKey}-${m.id}`)
      if (!scheduleInfo) return m
      return {
        ...m,
        court: scheduleInfo.isBye ? (m.court || courts[0]) : scheduleInfo.assignedCourt,
        time: scheduleInfo.isBye ? '' : scheduleInfo.assignedTime,
        scheduledTime: scheduleInfo.isBye ? '' : scheduleInfo.assignedTime,
        orderIndex: scheduleInfo.orderIndex,
      }
    })

    updatedDrawsMap[catKey] = {
      ...draw,
      matches: updatedMatches,
      scheduleConfig: {
        isTimingsActive: true,
        startTime,
        matchDuration,
        intervalBuffer,
        courts,
      },
    }
  })

  return {
    updatedDrawsMap,
    scheduledMatchesList: scheduledOrder,
  }
}
