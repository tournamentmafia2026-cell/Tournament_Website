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
    const { to, subject, html, text } = payload

    const gmailUser = 'tournamentmafia2026@gmail.com'
    const gmailPass = 'ujzfbevesmqaohme'
    const recipient = to || gmailUser

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
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

    console.log('Email sent successfully:', info.messageId)

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
