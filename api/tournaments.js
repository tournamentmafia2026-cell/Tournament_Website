import initialDb from '../data/badminton_db.json' with { type: 'json' }

let dbState = {
  matches: Array.isArray(initialDb.matches) ? initialDb.matches : [],
  publishedStatus: initialDb.publishedStatus || {},
  authenticators: initialDb.authenticators || {},
  temporaryCredentials: Array.isArray(initialDb.temporaryCredentials) ? initialDb.temporaryCredentials : [],
  tournamentDraws: initialDb.tournamentDraws || {},
  reportedPlayers: initialDb.reportedPlayers || {},
  organizerCredentials: initialDb.organizerCredentials || {
    username: 'admin',
    mobile: '9840012345',
    password: 'password123',
    email: 'tournamentmafia2026@gmail.com',
  },
  courtConfig: initialDb.courtConfig || {},
  systemSettings: initialDb.systemSettings || {
    matchPoints: 30,
    matchSets: 3,
    liveUmpireMode: true,
    liveStreamActive: false,
    stadiumCourtsCount: 4,
  },
}

function sanitizeMatchesData(matches) {
  if (!Array.isArray(matches)) return []
  return matches.filter(
    (m) =>
      m &&
      m.id !== 1 &&
      m.id !== 2 &&
      !String(m.matchName || '').includes('Chennai Badminton Championship') &&
      !String(m.matchName || '').includes('State Open Badminton')
  )
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    return res.status(200).json(dbState)
  }

  if (req.method === 'POST') {
    try {
      let payload = req.body || {}
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {}
      }

      Object.keys(payload).forEach((key) => {
        if (key === 'matches') {
          if (Array.isArray(payload.matches) && payload.matches.length > 0) {
            dbState.matches = sanitizeMatchesData(payload.matches)
          } else if (Array.isArray(payload.matches) && payload.matches.length === 0 && dbState.matches.length === 0) {
            dbState.matches = []
          }
          return
        }

        if (key === 'authenticators') {
          if (payload.authenticators && typeof payload.authenticators === 'object') {
            dbState.authenticators = payload.authenticators
          }
          return
        }

        if (key === 'temporaryCredentials') {
          if (Array.isArray(payload.temporaryCredentials)) {
            dbState.temporaryCredentials = payload.temporaryCredentials
          }
          return
        }

        if (key === 'organizerCredentials') {
          if (payload.organizerCredentials && typeof payload.organizerCredentials === 'object') {
            dbState.organizerCredentials = { ...(dbState.organizerCredentials || {}), ...payload.organizerCredentials }
          }
          return
        }

        if (
          typeof payload[key] === 'object' &&
          payload[key] !== null &&
          !Array.isArray(payload[key]) &&
          typeof dbState[key] === 'object' &&
          dbState[key] !== null &&
          !Array.isArray(dbState[key])
        ) {
          dbState[key] = { ...dbState[key], ...payload[key] }
        } else {
          dbState[key] = payload[key]
        }
      })

      return res.status(200).json(dbState)
    } catch (err) {
      console.error('Error in Vercel tournaments function:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
