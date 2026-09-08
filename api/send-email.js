import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' })
  }

  try {
    let payload = req.body || {}
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch (e) {}
    }

    const { to, subject, html, text, otp } = payload

    const gmailUser = process.env.GMAIL_USER || 'tournamentmafia2026@gmail.com'
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
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

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      recipient,
      message: `Real email delivered directly to ${recipient}`,
    })
  } catch (err) {
    console.error('Vercel SMTP Error:', err)
    return res.status(500).json({
      success: false,
      error: err.message || 'SMTP delivery failed',
    })
  }
}
