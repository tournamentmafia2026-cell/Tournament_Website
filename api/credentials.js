import initialDb from '../data/badminton_db.json' with { type: 'json' }

let credentialsStore = Array.isArray(initialDb.temporaryCredentials)
  ? [...initialDb.temporaryCredentials]
  : []

let adminCredsStore = initialDb.organizerCredentials || {
  username: 'admin',
  mobile: '9840012345',
  password: 'password123',
  email: 'tournamentmafia2026@gmail.com',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      temporaryCredentials: credentialsStore,
      organizerCredentials: adminCredsStore,
    })
  }

  if (req.method === 'POST') {
    try {
      let payload = req.body || {}
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {}
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

      return res.status(200).json({
        success: true,
        temporaryCredentials: credentialsStore,
        organizerCredentials: adminCredsStore,
      })
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' })
}
