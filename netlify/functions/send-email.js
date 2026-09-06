import nodemailer from 'nodemailer'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    }
  }

  try {
    const payload = JSON.parse(event.body || '{}')
    const { to, subject, html, text, otp } = payload

    const gmailUser = 'tournamentmafia2026@gmail.com'
    const gmailPass = 'ujzfbevesmqaohme'
    const recipient = (to || gmailUser).trim()

    // Configure resilient SMTP Transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    })

    const mailOptions = {
      from: `"Badminton Tournament Portal" <${gmailUser}>`,
      to: recipient,
      subject: subject || (otp ? `🔐 Badminton Portal OTP: ${otp}` : '🔐 Badminton Portal Verification'),
      text: text || (otp ? `Your 6-Digit OTP: ${otp}` : ''),
      html: html || (otp ? `<h2>Your OTP: <b>${otp}</b></h2>` : `<p>${text || ''}</p>`),
    }

    const info = await transporter.sendMail(mailOptions)

    console.log(`[Netlify Function] Email successfully dispatched to ${recipient}, MessageId: ${info.messageId}`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        recipient: recipient,
        message: `Email successfully delivered to ${recipient}`,
      }),
    }
  } catch (err) {
    console.error('[Netlify Function] Email dispatch error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'SMTP Connection Error',
      }),
    }
  }
}
