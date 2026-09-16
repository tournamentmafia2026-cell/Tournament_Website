
import { promises as fsPromises } from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import nodemailer from 'nodemailer'

const DEFAULT_GMAIL_USER = process.env.GMAIL_USER || 'tournamentmafia2026@gmail.com'
const DEFAULT_GMAIL_PASS = (process.env.GMAIL_APP_PASSWORD || 'ujzfbevesmqaohme').replace(/\s+/g, '')

const DB_PATH = path.resolve(process.cwd(), 'data/badminton_db.json')

function sanitizeMatchesData(matches) {
  if (!Array.isArray(matches)) return []
  return matches.filter((m) => m && m.id !== 1 && m.id !== 2 && !String(m.matchName || '').includes('Chennai Badminton Championship') && !String(m.matchName || '').includes('State Open Badminton'))
}

async function getDbData() {
  try {
    // Check if DB file exists
    const exists = await fsPromises.access(DB_PATH).then(() => true).catch(() => false)
    if (exists) {
      const raw = await fsPromises.readFile(DB_PATH, 'utf-8')
      let parsed = {}
if (raw && raw.trim()) {
  parsed = JSON.parse(raw)
}
      if (parsed.matches) {
        parsed.matches = sanitizeMatchesData(parsed.matches)
      }
      return parsed
    }
  } catch (e) {
    console.error('Error reading DB:', e)
  }
  // Return default empty DB structure
  return {
    matches: [],
    publishedStatus: {},
    authenticators: {},
    temporaryCredentials: [],
    tournamentDraws: {},
    reportedPlayers: {},
    organizerCredentials: {},
    systemSettings: {
      matchPoints: 30,
      matchSets: 3,
      liveUmpireMode: true,
      liveStreamActive: false,
      stadiumCourtsCount: 4,
    },
  }
}

async function saveDbData(data) {
  try {
    const dir = path.dirname(DB_PATH)
    await fsPromises.mkdir(dir, { recursive: true })
    const current = await getDbData()
    const merged = { ...current }

    // Apply all incoming payload fields safely, filtering prototype‑polluting keys
const safeKeys = Object.keys(data).filter(k => k !== '__proto__' && k !== 'constructor')
safeKeys.forEach((key) => {
      if (key === 'matches') {
        if (Array.isArray(data.matches)) {
          merged.matches = sanitizeMatchesData(data.matches)
        }
        return
      }

      if (key === 'authenticators') {
        if (data.authenticators && typeof data.authenticators === 'object') {
          merged.authenticators = data.authenticators
        }
        return
      }

      if (key === 'reportedPlayers') {
        if (data.reportedPlayers && typeof data.reportedPlayers === 'object') {
          merged.reportedPlayers = { ...(merged.reportedPlayers || {}), ...data.reportedPlayers }
        }
        return
      }

      if (key === 'temporaryCredentials') {
        if (Array.isArray(data.temporaryCredentials)) {
          merged.temporaryCredentials = data.temporaryCredentials
        }
        return
      }

      if (key === 'credential') {
        const cred = data.credential
        if (cred) {
          const list = Array.isArray(merged.temporaryCredentials) ? [...merged.temporaryCredentials] : []
          const index = list.findIndex((c) => c && (c.id === cred.id || c.username === cred.username))
          if (index >= 0) {
            list[index] = cred
          } else {
            list.push(cred)
          }
          merged.temporaryCredentials = list
        }
        return
      }

      if (key === 'publishedStatus' || key === 'publishedStatusMap') {
        if (data[key] && typeof data[key] === 'object') {
          merged.publishedStatus = data[key]
        }
        return
      }

      if (key === 'tournamentDraws') {
        if (data.tournamentDraws && typeof data.tournamentDraws === 'object') {
          merged.tournamentDraws = data.tournamentDraws
        }
        return
      }

      if (key === 'courtConfig') {
        if (data.courtConfig && typeof data.courtConfig === 'object') {
          merged.courtConfig = data.courtConfig
        }
        return
      }

      if (key === 'organizerCredentials') {
        if (data.organizerCredentials && typeof data.organizerCredentials === 'object') {
          merged.organizerCredentials = { ...(current.organizerCredentials || {}), ...data.organizerCredentials }
        }
        return
      }

      merged[key] = data[key]
    })

    if (merged.matches) {
      merged.matches = sanitizeMatchesData(merged.matches)
    }
    if (merged.publishedStatus) {
      delete merged.publishedStatus['1-Men Singles']
      delete merged.publishedStatus['1-Women Singles']
      delete merged.publishedStatus['2-Men Singles']
      delete merged.publishedStatus['2-Under 19 Boys Singles']
    }
    await fsPromises.writeFile(DB_PATH, JSON.stringify(merged, null, 2), 'utf-8')
    return merged
  } catch (e) {
    console.error('Error saving DB:', e)
    return null
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'badminton-db-middleware',
      configureServer(server) {
        // Sync Tournaments & Draws across all connected devices (Mobile, Tablet, PC)
        server.middlewares.use('/api/tournaments', async (req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          // Inside GET/HEAD handler
if (req.method === 'HEAD' || req.method === 'GET') {
  try {
    const data = await getDbData()
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data || {}))
  } catch (err) {
    res.statusCode = 500
    res.end(JSON.stringify({ success: false, error: err.message }))
  }
  return
}

          // Inside POST handler for tournaments endpoint
// Inside POST handler for tournaments endpoint
if (req.method === 'POST') {
  let body = ''
  const MAX_SIZE = 1e6 // 1 MB
  req.on('data', (chunk) => {
    body += chunk
    if (body.length > MAX_SIZE) {
      res.statusCode = 413
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: 'Payload too large' }))
      req.destroy()
    }
  })
  req.on('end', async () => {
    try {
      const parsed = JSON.parse(body || '{}')
      const saved = await saveDbData(parsed)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: true, data: saved }))
    } catch (e) {
      // Differentiate JSON parse errors from save errors
      if (e instanceof SyntaxError) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
      } else {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: false, error: e.message }))
      }
    }
  })
  return
}



          next()
        })

        server.middlewares.use('/api/credentials', (req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          // Inside GET handler for credentials endpoint
if (req.method === 'GET') {
  getDbData().then((data) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      temporaryCredentials: data.temporaryCredentials || [],
      organizerCredentials: data.organizerCredentials || {},
    }))
  }).catch((err) => {
    res.statusCode = 500
    res.end(JSON.stringify({ success: false, error: err.message }))
  })
  return
}

          // Inside POST handler for credentials endpoint
if (req.method === 'POST') {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}')
      saveDbData(payload).then((saved) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          success: true,
          temporaryCredentials: saved?.temporaryCredentials || [],
          organizerCredentials: saved?.organizerCredentials || {},
        }))
      })
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: false, error: err.message }))
    }
  })
  return
}

          next()
        })
      },
    },
    {
      name: 'gmail-smtp-middleware',
      configureServer(server) {
        server.middlewares.use('/api/send-email', (req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end()
            return
          }

          if (req.method !== 'POST') return next()

          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })

          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}')
              const { to, subject, html, text, user, pass } = data

              const gmailUser = user || DEFAULT_GMAIL_USER
              const gmailPass = (pass || DEFAULT_GMAIL_PASS).replace(/\s+/g, '')

              if (!gmailPass) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'GMAIL_APP_PASSWORD is not configured on the server.' }))
                return
              }

              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: gmailUser,
                  pass: gmailPass,
                },
              })

              const info = await transporter.sendMail({
                from: `"Badminton Tournament Portal" <${gmailUser}>`,
                to: to || gmailUser,
                subject: subject || 'Badminton Portal Notification',
                text: text || '',
                html: html || `<p>${text || ''}</p>`,
              })

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, messageId: info.messageId }))
            } catch (err) {
              console.error('Email send error:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
        })
      },
    },
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase'
          }
        },
      },
    },
  },
  server: {
    port: 5174,
    host: true,
  },
})
