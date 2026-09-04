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
  return { matches: [], publishedStatus: {}, authenticators: {}, temporaryCredentials: [], tournamentDraws: {} }
}

function saveDbData(data) {
  try {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const current = getDbData()
    const merged = { ...current, ...data }
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
          if (req.method === 'GET') {
            const data = getDbData()
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
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
                res.setHeader('Access-Control-Allow-Origin', '*')
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
  server: {
    port: 5174,
    host: true,
  },
})
