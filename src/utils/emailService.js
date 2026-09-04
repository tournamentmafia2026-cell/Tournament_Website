const EMAIL_CONFIG_KEY = 'badminton-email-config'

export const DEFAULT_EMAIL_CONFIG = {
  serviceId: '',
  templateId: '',
  publicKey: '',
  gmailUser: 'tournamentmafia2026@gmail.com',
  gmailAppPassword: 'ujzf beve smqa ohme',
  registeredEmail: 'tournamentmafia2026@gmail.com',
}

/**
 * Get saved email configuration from localStorage
 */
export const getEmailConfig = () => {
  try {
    const raw = localStorage.getItem(EMAIL_CONFIG_KEY)
    if (raw) {
      return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(raw) }
    }
  } catch (e) {
    console.error('Failed to load email config', e)
  }
  return DEFAULT_EMAIL_CONFIG
}

/**
 * Save email configuration to localStorage
 */
export const saveEmailConfig = (config) => {
  try {
    const updated = { ...getEmailConfig(), ...config }
    localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(updated))
    return updated
  } catch (e) {
    console.error('Failed to save email config', e)
    return config
  }
}

/**
 * Checks whether active Email credentials are configured
 */
export const isEmailConfigured = () => {
  const config = getEmailConfig()
  return Boolean(config.gmailAppPassword || (config.publicKey && config.serviceId))
}

/**
 * Sends real email via Gmail SMTP endpoint or EmailJS with fallback
 */
export const sendAuthEmail = async ({ to_email, username, password, otp, action, customMessage }) => {
  const config = getEmailConfig()
  const targetEmail = to_email || config.registeredEmail || 'tournamentmafia2026@gmail.com'

  const subject = otp
    ? `🔐 Badminton Portal - Verification OTP: ${otp}`
    : `🏸 Badminton Portal - ${action || 'Account Update'}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1.5px solid #0f172a; border-radius: 12px; overflow: hidden;">
      <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 22px;">🏸 Badminton Tournament Portal</h2>
        <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">Official Administration Notification</p>
      </div>
      <div style="padding: 24px; background: #ffffff; color: #1e293b;">
        <h3 style="margin-top: 0; color: #0f172a;">${action || 'Account Notification'}</h3>
        <p>Hello <strong>${username || 'Organizer'}</strong>,</p>
        <p>${customMessage || 'Here are your requested credentials for the Badminton Tournament Portal:'}</p>
        
        ${
          otp
            ? `
          <div style="background: #f8fafc; border: 2px dashed #3b82f6; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Your 6-Digit Verification OTP</div>
            <div style="font-size: 32px; font-weight: 900; color: #2563eb; letter-spacing: 0.2em; margin-top: 6px;">${otp}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Valid for 10 minutes. Do not share with anyone.</div>
          </div>
        `
            : ''
        }

        ${
          password
            ? `
          <div style="background: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin: 18px 0; font-family: monospace;">
            <div><strong>Username:</strong> ${username}</div>
            <div style="margin-top: 6px;"><strong>Password:</strong> ${password}</div>
          </div>
        `
            : ''
        }

        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          Sent at: ${new Date().toLocaleString()}<br />
          If you did not request this, please secure your account immediately.
        </p>
      </div>
    </div>
  `

  // 1. Send via local /api/send-email (Gmail SMTP with App Password)
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: targetEmail,
        subject,
        html,
        text: customMessage || `Username: ${username}\nPassword: ${password}\nOTP: ${otp}`,
        user: config.gmailUser || 'tournamentmafia2026@gmail.com',
        pass: config.gmailAppPassword || 'ujzfbevesmqaohme',
      }),
    })

    if (res.ok) {
      const json = await res.json()
      if (json.success) {
        return {
          success: true,
          isSimulated: false,
          message: `✓ Real email delivered directly to ${targetEmail}!`,
        }
      }
    }
  } catch (err) {
    console.warn('Local SMTP endpoint call failed, attempting fallback:', err)
  }

  // 2. Fallback / Simulator if offline
  return {
    success: true,
    isSimulated: true,
    message: `✉️ Email prepared for ${targetEmail}!`,
    otp,
    username,
    password,
  }
}
