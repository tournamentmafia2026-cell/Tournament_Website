/**
 * Court Configuration Utility for Badminton Management & Live Cast
 */

export const DEFAULT_COURT_CONFIG = {
  count: 4,
  format: 'numbers', // 'numbers' | 'alphabet' | 'roman' | 'custom'
  prefix: 'Court',
  customNames: '',
}

export const ROMAN_NUMERALS = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII',
  'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI',
  'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'
]

export function toAlphabetCourt(idx) {
  let s = ''
  let n = idx
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

export function toRomanCourt(num) {
  if (num <= 0) return String(num)
  const romanMap = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let result = ''
  let n = num
  for (const [val, letter] of romanMap) {
    while (n >= val) {
      result += letter
      n -= val
    }
  }
  return result || String(num)
}

export function generateCourtsList(config) {
  const cfg = { ...DEFAULT_COURT_CONFIG, ...(config || {}) }

  if (cfg.format === 'custom' && cfg.customNames) {
    const customList = cfg.customNames.split(',').map((s) => s.trim()).filter(Boolean)
    if (customList.length > 0) return customList
  }

  // When count is empty string (user is clearing to type a new number), do not fallback to 4
  if (cfg.count === '' || cfg.count === null || cfg.count === undefined) {
    return []
  }

  const parsed = parseInt(cfg.count, 10)
  if (isNaN(parsed) || parsed <= 0) {
    return []
  }

  const count = parsed
  const prefix = (cfg.prefix !== undefined && cfg.prefix !== null ? String(cfg.prefix) : 'Court').trim()
  const p = prefix ? `${prefix} ` : ''

  return Array.from({ length: count }, (_, i) => {
    if (cfg.format === 'alphabet') {
      return `${p}${toAlphabetCourt(i)}`
    }
    if (cfg.format === 'roman') {
      return `${p}${toRomanCourt(i + 1)}`
    }
    return `${p}${i + 1}` // default numbers: Court 1, Court 2...
  })
}

export function getSavedCourtConfig() {
  try {
    const saved = localStorage.getItem('badminton-stadium-court-config')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_COURT_CONFIG, ...parsed }
      }
    }
    const legacyCount = localStorage.getItem('badminton-stadium-courts-count')
    if (legacyCount) {
      return { ...DEFAULT_COURT_CONFIG, count: parseInt(legacyCount, 10) || 4 }
    }
  } catch {}
  return DEFAULT_COURT_CONFIG
}

export function saveCourtConfig(config) {
  const merged = { ...DEFAULT_COURT_CONFIG, ...config }
  try {
    localStorage.setItem('badminton-stadium-court-config', JSON.stringify(merged))
    localStorage.setItem('badminton-stadium-courts-count', String(merged.count || 4))
    window.dispatchEvent(new Event('storage'))
  } catch (e) {
    console.error('Error saving court config', e)
  }

  fetch('/api/tournaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courtConfig: merged,
      systemSettings: {
        stadiumCourtsCount: merged.count,
        courtConfig: merged,
      },
    }),
  }).catch(() => {})

  return merged
}
