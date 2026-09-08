/**
 * Production-Grade Ultra-Fast Order-Agnostic Deep Equality Comparator
 * Prevents redundant React re-renders and eliminates background sync flickering permanently.
 */
export function fastDeepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b
  }

  // Handle Date
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }

  // Handle RegExp
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString()
  }

  // Array comparison
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const len = a.length
    if (len !== b.length) return false
    for (let i = 0; i < len; i++) {
      if (!fastDeepEqual(a[i], b[i])) return false
    }
    return true
  }

  // Object comparison (independent of key order)
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!fastDeepEqual(a[key], b[key])) return false
  }

  return true
}

export default fastDeepEqual
