import fs from 'fs'
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import nodemailer from 'nodemailer'

const DEFAULT_GMAIL_USER = 'tournamentmafia2026@gmail.com'
const DEFAULT_GMAIL_PASS = 'ujzfbevesmqaohme'

const DB_PATH = path.resolve(process.cwd(), 'data/badminton_db.json')

function sanitizeMatchesData(matches) {
  if (!Array.isArray(matches)) return []
  return matches.filter((m) => m && m.id !== 1 && m.id !== 2 && !String(m.matchName || '').includes('Chennai Badminton Championship') && !String(m.matchName || '').includes('State Open Badminton'))
}

function getDbData() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8')
      const parsed = JSON.parse(raw || '{}')
      if (parsed.matches) {
        parsed.matches = sanitizeMatchesData(parsed.matches)
      }
      return parsed
    }
  } catch (e) {
    console.error('Error reading DB:', e)
  }
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

function saveDbData(data) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = getDbData()
    const merged = { ...current }

    // Apply all incoming payload fields accurately to persist additions, edits, and deletions
    Object.keys(data).forEach((key) => {
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
    fs.writeFileSync(DB_PATH, JSON.stringify(merged, null, 2), 'utf-8')
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
        server.middlewares.use('/api/tournaments', (req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          if (req.method === 'HEAD' || req.method === 'GET') {
            const data = getDbData()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(data || {}))
            return
          }

          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}')
                const saved = saveDbData(parsed)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, data: saved }))
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

              const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
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
