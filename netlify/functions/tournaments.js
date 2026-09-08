import initialDb from '../../data/badminton_db.json' with { type: 'json' }

// In-memory persistent state across invocations in serverless container
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

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(dbState),
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      let payload = {}
      if (typeof event.body === 'string') {
        try {
          payload = JSON.parse(event.body)
        } catch {
          payload = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
        }
      } else if (event.body) {
        payload = event.body
      }

      // Merge incoming payload fields
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
            dbState.authenticators = { ...(dbState.authenticators || {}), ...payload.authenticators }
          }
          return
        }

        if (key === 'reportedPlayers') {
          if (payload.reportedPlayers && typeof payload.reportedPlayers === 'object') {
            dbState.reportedPlayers = { ...(dbState.reportedPlayers || {}), ...payload.reportedPlayers }
          }
          return
        }

        if (key === 'temporaryCredentials') {
          if (Array.isArray(payload.temporaryCredentials)) {
            dbState.temporaryCredentials = payload.temporaryCredentials
          }
          return
        }

        if (key === 'publishedStatus' || key === 'publishedStatusMap') {
          if (payload[key] && typeof payload[key] === 'object') {
            dbState.publishedStatus = { ...(dbState.publishedStatus || {}), ...payload[key] }
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(dbState),
      }
    } catch (err) {
      console.error('Error in Netlify tournaments function:', err)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: err.message }),
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  }
}
