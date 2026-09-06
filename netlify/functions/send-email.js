import nodemailer from 'nodemailer'

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { to, subject, html, text, user, pass } = payload

    const gmailUser = user || 'tournamentmafia2026@gmail.com'
    const gmailPass = (pass || 'ujzf beve smqa ohme').replace(/\s+/g, '')
    const recipient = to || 'tournamentmafia2026@gmail.com'

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const info = await transporter.sendMail({
      from: `"Badminton Tournament Portal" <${gmailUser}>`,
      to: recipient,
      subject: subject || '🔐 Badminton Portal - Verification OTP',
      text: text || '',
      html: html || `<p>${text || ''}</p>`,
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: `Real email delivered directly to ${recipient}`,
      }),
    }
  } catch (err) {
    console.error('Netlify Function Email Error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Failed to dispatch email via SMTP',
      }),
    }
  }
}
