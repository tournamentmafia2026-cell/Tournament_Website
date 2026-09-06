import nodemailer from 'nodemailer'

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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
    }
  }

  try {
    let payload = {}
    if (typeof event.body === 'string') {
      try {
        payload = JSON.parse(event.body)
      } catch (e) {
        payload = JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
      }
    } else if (event.body) {
      payload = event.body
    }

    const { to, subject, html, text, otp } = payload

    const gmailUser = 'tournamentmafia2026@gmail.com'
    const gmailPass = 'ujzfbevesmqaohme' // 16-character Google App Password (no spaces)
    const recipient = to || gmailUser

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const mailOptions = {
      from: `"Badminton Tournament Portal" <${gmailUser}>`,
      to: recipient,
      subject: subject || (otp ? `🔐 Badminton Portal Verification OTP: ${otp}` : 'Badminton Portal Verification'),
      text: text || (otp ? `Your 6-Digit Verification OTP is: ${otp}\n\nValid for 10 minutes.` : ''),
      html: html || (otp ? `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1.5px solid #0f172a; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">🏸 Badminton Tournament Portal</h2>
          <p>Here is your 6-digit verification OTP:</p>
          <div style="background: #f8fafc; border: 2px dashed #3b82f6; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
            <div style="font-size: 34px; font-weight: 900; color: #2563eb; letter-spacing: 0.25em;">${otp}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Valid for 10 minutes. Do not share.</div>
          </div>
        </div>
      ` : `<p>${text || ''}</p>`),
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Email sent successfully to', recipient, 'MessageId:', info.messageId)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        recipient,
        message: `Real email delivered directly to ${recipient}`,
      }),
    }
  } catch (err) {
    console.error('Netlify SMTP Error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'SMTP delivery failed',
      }),
    }
  }
}
