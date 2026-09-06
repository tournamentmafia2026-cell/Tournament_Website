import initialDb from '../../data/badminton_db.json' with { type: 'json' }

let credentialsStore = Array.isArray(initialDb.temporaryCredentials)
  ? [...initialDb.temporaryCredentials]
  : []

let adminCredsStore = initialDb.organizerCredentials || {
  username: 'admin',
  mobile: '9840012345',
  password: 'password123',
  email: 'tournamentmafia2026@gmail.com',
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
      body: JSON.stringify({
        temporaryCredentials: credentialsStore,
        organizerCredentials: adminCredsStore,
      }),
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

      if (payload.organizerCredentials) {
        adminCredsStore = { ...adminCredsStore, ...payload.organizerCredentials }
      }

      if (Array.isArray(payload.temporaryCredentials)) {
        credentialsStore = payload.temporaryCredentials
      } else if (payload.credential) {
        const cred = payload.credential
        const index = credentialsStore.findIndex(
          (c) => c && (c.id === cred.id || c.username === cred.username)
        )
        if (index >= 0) {
          credentialsStore[index] = cred
        } else {
          credentialsStore.push(cred)
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          temporaryCredentials: credentialsStore,
          organizerCredentials: adminCredsStore,
        }),
      }
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: err.message }),
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method Not Allowed' }),
  }
}
