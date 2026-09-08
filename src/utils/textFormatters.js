// Professional Text & String Formatting Utilities for Badminton Web App
// Ensures all tournament names, addresses, organizer details, player names, and categories
// are presented in a clean, consistent, professional Title Case regardless of how users type them.

import { sortBadmintonCategories } from './badmintonCategories'

// Known sports, organization, and country acronyms that should remain UPPERCASE
const ACRONYMS = new Set([
  'BWF', 'BAI', 'TNBA', 'KBA', 'MBA', 'APBA', 'TSBA', 'USA', 'UK', 'UAE', 'SDAT',
  'YMCA', 'IT', 'AI', 'BBA', 'VIP', 'VVIP', 'PBL', 'IPL', 'TNC', 'GST', 'ID', 'VS',
  'QF', 'SF', 'R1', 'R2', 'R3', 'R4', 'R16', 'R32', 'R64', 'R128', 'R256', 'BYE',
  'TN', 'KA', 'KL', 'AP', 'TS', 'MH', 'DL', 'WB', 'UP', 'MP', 'HR', 'PB', 'GJ', 'RJ'
])

// Roman numerals that should remain UPPERCASE
const ROMAN_NUMERALS = new Set([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'
])

// Minor connector words that should remain lowercase in titles (unless first or last word)
const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'near',
  'nor', 'of', 'off', 'on', 'onto', 'or', 'per', 'the', 'to', 'via', 'with', 'vs', 'v'
])

/**
 * Capitalizes a single word properly taking acronyms, roman numerals, and hyphenations into account
 */
export const formatWord = (word, isFirstOrLast = false) => {
  if (!word) return ''
  const trimmed = word.trim()
  if (!trimmed) return ''

  // Preserve parentheses if attached: e.g. "(U-19)" or "(Season"
  const leadingPunct = trimmed.match(/^[^a-zA-Z0-9]+/)?.[0] || ''
  const trailingPunct = trimmed.match(/[^a-zA-Z0-9+]+$/)?.[0] || ''
  const core = trimmed.slice(leadingPunct.length, trimmed.length - trailingPunct.length)

  if (!core) return trimmed

  const coreUpper = core.toUpperCase()
  const coreLower = core.toLowerCase()

  // 1. Check if it's an age group like U13, U-15, U17, U19, 30+, 40+, etc.
  if (/^U-?\d{1,2}$/i.test(core)) {
    const ageMatch = core.match(/^U-?(\d{1,2})$/i)
    return `${leadingPunct}U-${ageMatch[1]}${trailingPunct}`
  }
  if (/^\d{1,2}\+$/i.test(core)) {
    return `${leadingPunct}${core}${trailingPunct}`
  }

  // 2. Check Seed notation like S1, S2, S16
  if (/^S\d{1,2}$/i.test(core)) {
    return `${leadingPunct}${coreUpper}${trailingPunct}`
  }

  // 3. Check Known Acronyms & Roman Numerals
  if (ACRONYMS.has(coreUpper) || ROMAN_NUMERALS.has(coreUpper)) {
    return `${leadingPunct}${coreUpper}${trailingPunct}`
  }

  // 4. Check Ordinals like 1st, 2nd, 3rd, 4th, 21st
  if (/^\d+(st|nd|rd|th)$/i.test(core)) {
    return `${leadingPunct}${coreLower}${trailingPunct}`
  }

  // 5. Check if it's a number/year (e.g. 2026)
  if (/^\d+$/.test(core)) {
    return `${leadingPunct}${core}${trailingPunct}`
  }

  // 6. Handle Hyphenated words (e.g. "All-India", "Sub-Junior", "Non-Medallist")
  if (core.includes('-')) {
    const subParts = core.split('-')
    const formattedSub = subParts.map((part) => formatWord(part, true)).join('-')
    return `${leadingPunct}${formattedSub}${trailingPunct}`
  }

  // 7. Check Minor Words in Titles (e.g. "of", "and", "in")
  if (!isFirstOrLast && MINOR_WORDS.has(coreLower)) {
    return `${leadingPunct}${coreLower}${trailingPunct}`
  }

  // 8. Default Capitalization: First letter uppercase, rest lowercase
  const formatted = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase()
  return `${leadingPunct}${formatted}${trailingPunct}`
}

/**
 * Formats any title/name into professional Title Case
 * Examples:
 *  "chennai open 2026" -> "Chennai Open 2026"
 *  "STATE OPEN BADMINTON TOURNAMENT (U-19)" -> "State Open Badminton Tournament (U-19)"
 *  "all-india open championship 2026" -> "All-India Open Championship 2026"
 */
export const formatTitleCase = (text) => {
  if (!text || typeof text !== 'string') return ''

  // Normalize spaces and trim
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return ''

  // Split into tokens preserving words
  const words = clean.split(' ')
  const formattedWords = words.map((w, index) => {
    const isFirstOrLast = index === 0 || index === words.length - 1
    return formatWord(w, isFirstOrLast)
  })

  return formattedWords.join(' ')
}

/**
 * Formats tournament/match names specifically
 */
export const formatTournamentName = (text, fallback = 'Badminton Tournament') => {
  if (!text || typeof text !== 'string' || !text.trim()) return fallback
  return formatTitleCase(text)
}

/**
 * Formats person / player / organizer / umpire names
 * Handles initials (e.g., "r.karthik" -> "R. Karthik", "s. kumar" -> "S. Kumar")
 * Handles doubles pairs (e.g., "rahul d / karthik s" -> "Rahul D / Karthik S", "a & b" -> "A & B")
 */
export const formatPersonName = (text, fallback = 'Player') => {
  if (!text || typeof text !== 'string') return fallback
  const raw = text.trim()
  if (!raw) return fallback

  // Check if it's a Bye
  if (/^(\(?bye\)?|\-)$/i.test(raw)) {
    return 'BYE'
  }

  // Handle doubles pair separators: '/', '&', '+', ' / '
  if (raw.includes('/') || raw.includes(' & ') || raw.includes(' + ')) {
    let separator = '/'
    if (raw.includes(' & ')) separator = ' & '
    else if (raw.includes(' + ')) separator = ' + '
    else if (raw.includes('/')) separator = ' / '

    const splitDelim = separator.trim() === '/' ? '/' : separator
    const players = raw.split(splitDelim)
    return players
      .map((p) => formatSinglePlayerName(p.trim()))
      .filter(Boolean)
      .join(` ${splitDelim.trim()} `)
  }

  return formatSinglePlayerName(raw)
}

/**
 * Formats single player name with initials normalization
 */
const formatSinglePlayerName = (name) => {
  if (!name) return ''

  // Clean initials: e.g. "r.karthik" -> "R. Karthik", "v.s.raghav" -> "V. S. Raghav"
  let formatted = name.replace(/([a-zA-Z])\.([a-zA-Z])/g, '$1. $2')

  // Clean spaces
  formatted = formatted.trim().replace(/\s+/g, ' ')

  const words = formatted.split(' ')
  const cleanWords = words.map((w, index) => {
    // Single letter with dot e.g. "R." or "S."
    if (/^[a-zA-Z]\.$/.test(w)) {
      return w.toUpperCase()
    }
    // Single letter without dot e.g. "R"
    if (/^[a-zA-Z]$/.test(w)) {
      return w.toUpperCase()
    }
    // Multi-dot initials e.g. "V.S."
    if (/^([a-zA-Z]\.)+$/.test(w)) {
      return w.toUpperCase()
    }
    return formatWord(w, true)
  })

  return cleanWords.join(' ')
}

/**
 * Formats addresses and venue descriptions cleanly
 * Example:
 *  "nehru indoor stadium,chennai - 600003" -> "Nehru Indoor Stadium, Chennai - 600003"
 */
export const formatAddress = (text, fallback = '') => {
  if (!text || typeof text !== 'string') return fallback
  const raw = text.trim()
  if (!raw) return fallback

  // Split by comma to format each address segment (e.g. Venue, Area, City)
  const segments = raw.split(',')
  const formattedSegments = segments.map((seg) => {
    const trimmedSeg = seg.trim().replace(/\s+/g, ' ')
    if (!trimmedSeg) return ''

    const words = trimmedSeg.split(' ')
    const cleanWords = words.map((w, idx) => {
      const isFirstOrLast = idx === 0 || idx === words.length - 1
      // Check Pin Codes: 6 digits e.g. "600003"
      if (/^\d{6}$/.test(w)) {
        return w
      }
      // Check Pin Code with prefix: e.g. "-600003" or "PIN-600003"
      if (/^[-:]?\d{6}$/.test(w)) {
        return w
      }
      // State codes e.g. "TN", "KA", "KL", "AP", "DL"
      if (ACRONYMS.has(w.toUpperCase())) {
        return w.toUpperCase()
      }
      // Standard Address words (No., Plot No., St., Rd., Ave., etc.)
      if (/^(no|st|rd|ave|dr|bldg|opp|nr)\.?$/i.test(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      }
      return formatWord(w, isFirstOrLast)
    })

    return cleanWords.join(' ')
  })

  return formattedSegments.filter(Boolean).join(', ')
}

/**
 * Formats court names
 * Examples:
 *  "court 1" -> "Court 1"
 *  "court 1 & court 2" -> "Court 1 & Court 2"
 *  "synthetic court a" -> "Synthetic Court A"
 */
export const formatCourtName = (text, fallback = 'Court 1') => {
  if (!text || typeof text !== 'string' || !text.trim()) return fallback
  return formatTitleCase(text)
}

/**
 * Formats place / club / city names
 */
export const formatPlaceOrClub = (text, fallback = '') => {
  if (!text || typeof text !== 'string' || !text.trim()) return fallback
  return formatTitleCase(text)
}

/**
 * Formats category names consistently
 * Example:
 *  "men singles" -> "Men Singles"
 *  "under 15 boys singles" -> "Under 15 Boys Singles"
 */
export const formatCategoryName = (category, fallback = 'Men Singles') => {
  if (!category || typeof category !== 'string' || !category.trim()) return fallback
  return formatTitleCase(category)
}

/**
 * Sanitizes and formats complete tournament data object
 */
export const sanitizeTournament = (tournament) => {
  if (!tournament || typeof tournament !== 'object') return tournament

  const cleanCategoryWinners = {}
  if (tournament.categoryWinners && typeof tournament.categoryWinners === 'object') {
    Object.entries(tournament.categoryWinners).forEach(([cat, wName]) => {
      if (wName && typeof wName === 'string' && wName.trim().length > 0) {
        cleanCategoryWinners[formatCategoryName(cat)] = formatPersonName(wName)
      }
    })
  }

  return {
    ...tournament,
    matchName: formatTournamentName(tournament.matchName),
    matchAddress: formatAddress(tournament.matchAddress),
    courtName: formatCourtName(tournament.courtName),
    organizerName: formatPersonName(tournament.organizerName, ''),
    winner: tournament.winner ? formatPersonName(tournament.winner) : (tournament.winner || ''),
    categoryWinners: cleanCategoryWinners,
    categories: Array.isArray(tournament.categories)
      ? sortBadmintonCategories(tournament.categories.map((c) => formatCategoryName(c)))
      : ['Men Singles', 'Women Singles'],
    completedAt: tournament.completedAt || null,
  }
}

/**
 * Sanitizes participant/player object
 */
export const sanitizeParticipant = (participant) => {
  if (!participant || typeof participant !== 'object') return participant

  return {
    ...participant,
    name: formatPersonName(participant.name),
    court: formatCourtName(participant.court, ''),
    place: formatPlaceOrClub(participant.place, ''),
    category: formatCategoryName(participant.category),
  }
}

/**
 * Computes tournament / match status:
 * - 'completed': ONLY when ALL categories have crowned champions / winners concluded!
 * - 'ongoing': if some categories are finished but others remain, or matches in progress, or today is within dates
 * - 'upcoming': if start date is in future and no matches started
 */
export const getMatchStatus = (match) => {
  if (!match) return 'upcoming'

  const categories = Array.isArray(match.categories) && match.categories.length > 0
    ? match.categories
    : (match.category ? [match.category] : ['Men Singles'])

  let draws = null
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('badminton-tournament-draws') : null
    if (raw) draws = JSON.parse(raw)
  } catch (e) {}

  const catWinners = match.categoryWinners || {}

  // Check which categories have concluded with a crowned champion
  const completedCategories = categories.filter((cat) => {
    // 1. Explicit winner updated in match.categoryWinners
    if (catWinners[cat] && typeof catWinners[cat] === 'string' && catWinners[cat].trim().length > 0) {
      return true
    }
    // 2. Winner in final match of draw
    if (draws) {
      const draw = draws[`${match.id}-${cat}`]
      if (draw?.matches?.length > 0 && draw.totalRounds) {
        const finalMatch = draw.matches.find((m) => m.round === draw.totalRounds)
        if (finalMatch?.winner && !finalMatch.winner.isBye && finalMatch.winner.name) {
          return true
        }
      }
    }
    return false
  })

  // RULE 2: ONLY AFTER ALL CATEGORIES' WINNERS ARE UPDATED CAN IT BE COMPLETED!
  const areAllCategoriesCompleted = categories.length > 0 && completedCategories.length === categories.length
  if (areAllCategoriesCompleted) {
    return 'completed'
  }

  // RULE 1: UPCOMING LA DATE IRUKUM, ANTHA DATE VANTHA MATTUM THA ONGOING KU PONUM, ILLANA UPCOMING LA THA IRUKANUM!
  if (!match.startDate) return 'upcoming'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`

  // Normalize match.startDate to YYYY-MM-DD for accurate comparison
  let startStr = String(match.startDate).trim()
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(startStr)) {
    const sep = startStr.includes('/') ? '/' : '-'
    const [day, mon, yr] = startStr.split(sep).map(Number)
    startStr = `${yr}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // If today has not arrived at the start date yet -> STRICTLY UPCOMING!
  if (todayStr < startStr) {
    return 'upcoming'
  }

  // If today >= startDate, the match has started and enters 'ongoing'.
  // It MUST REMAIN 'ongoing' until ALL category winners are updated!
  return 'ongoing'
}

/**
 * Splits a doubles player string into two distinct player names.
 * Supports delimiters like ' / ', '/', ' & ', '&', ' + ', '+', or ' and '.
 */
export const splitDoublesNames = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return ['', '']
  const trimmed = rawName.trim()
  if (!trimmed) return ['', '']

  let parts = []
  if (trimmed.includes(' / ')) {
    parts = trimmed.split(' / ')
  } else if (trimmed.includes('/')) {
    parts = trimmed.split('/')
  } else if (trimmed.includes(' & ')) {
    parts = trimmed.split(' & ')
  } else if (trimmed.includes(' + ')) {
    parts = trimmed.split(' + ')
  } else if (trimmed.toLowerCase().includes(' and ')) {
    parts = trimmed.split(/ and /i)
  } else if (trimmed.includes('&')) {
    parts = trimmed.split('&')
  } else if (trimmed.includes('+')) {
    parts = trimmed.split('+')
  } else {
    parts = [trimmed]
  }

  const p1 = (parts[0] || '').trim()
  const p2 = (parts.slice(1).join(' / ') || '').trim()
  return [p1, p2]
}

/**
 * Combines two doubles player names with standard slash separator
 */
export const joinDoublesNames = (name1, name2) => {
  const p1 = formatPersonName(name1 || '', '').trim()
  const p2 = formatPersonName(name2 || '', '').trim()
  if (p1 && p2) return `${p1} / ${p2}`
  return p1 || p2 || ''
}

/**
 * Safely parses any date string into a timestamp for chronological comparison.
 * Handles YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, and optional time strings (HH:mm).
 */
export const getMatchStartTimestamp = (match) => {
  if (!match) return 9999999999999
  const dateStr = match.startDate || match.date || ''
  if (!dateStr || typeof dateStr !== 'string') return 9999999999999

  const trimmed = dateStr.trim()
  const timeStr = (match.startTime || match.time || '00:00').trim()
  let [h, m] = [0, 0]
  if (/^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(':').map(Number)
    h = parts[0] || 0
    m = parts[1] || 0
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, mon, d] = trimmed.split('-').map(Number)
    return new Date(y, mon - 1, d, h, m).getTime()
  }

  // DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) {
    const sep = trimmed.includes('/') ? '/' : '-'
    const [d, mon, y] = trimmed.split(sep).map(Number)
    return new Date(y, mon - 1, d, h, m).getTime()
  }

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? 9999999999999 : parsed
}

/**
 * Compares two tournaments so that the earliest starting match appears first.
 */
export const compareTournamentsChronological = (a, b) => {
  const startA = getMatchStartTimestamp(a)
  const startB = getMatchStartTimestamp(b)
  if (startA !== startB) return startA - startB

  const endA = getMatchStartTimestamp({ ...a, startDate: a.endDate || a.startDate })
  const endB = getMatchStartTimestamp({ ...b, startDate: b.endDate || b.startDate })
  if (endA !== endB) return endA - endB

  return (a.matchName || '').localeCompare(b.matchName || '')
}

/**
 * Safely parses the end date of a tournament into a timestamp.
 */
export const getMatchEndTimestamp = (match) => {
  if (!match) return 0
  const dateStr = match.endDate || match.startDate || match.date || ''
  if (!dateStr || typeof dateStr !== 'string') return 0

  const trimmed = dateStr.trim()
  const timeStr = (match.endTime || match.time || '23:59').trim()
  let [h, m] = [23, 59]
  if (/^\d{1,2}:\d{2}/.test(timeStr)) {
    const parts = timeStr.split(':').map(Number)
    h = parts[0] || 0
    m = parts[1] || 0
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, mon, d] = trimmed.split('-').map(Number)
    return new Date(y, mon - 1, d, h, m).getTime()
  }

  // DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(trimmed)) {
    const sep = trimmed.includes('/') ? '/' : '-'
    const [d, mon, y] = trimmed.split(sep).map(Number)
    return new Date(y, mon - 1, d, h, m).getTime()
  }

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Compares two completed tournaments so that the MOST RECENTLY completed tournament appears first.
 * Considers completion timestamp (completedAt), end date, and start date.
 */
export const compareTournamentsRecentCompleted = (a, b) => {
  // 1. If explicit completedAt timestamps exist
  const compTimeA = Number(a?.completedAt) || 0
  const compTimeB = Number(b?.completedAt) || 0
  if (compTimeA > 0 && compTimeB > 0 && compTimeA !== compTimeB) {
    return compTimeB - compTimeA // higher timestamp = more recent
  }

  // 2. End date comparison (descending: recent date first)
  const endA = getMatchEndTimestamp(a)
  const endB = getMatchEndTimestamp(b)
  if (endA !== endB) {
    return endB - endA // more recent end date first
  }

  // 3. Start date fallback (descending)
  const startA = getMatchStartTimestamp(a)
  const startB = getMatchStartTimestamp(b)
  if (startA !== startB) {
    return startB - startA
  }

  return (b.matchName || '').localeCompare(a.matchName || '')
}



