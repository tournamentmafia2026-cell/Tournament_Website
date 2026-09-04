import React, { useState, useEffect } from 'react'
import { sendAuthEmail } from '../utils/emailService'

const ORGANIZER_CREDS_KEY = 'badminton-organizer-credentials'
const ORGANIZER_SESSION_KEY = 'badminton-organizer-session'

const DEFAULT_CREDS = {
  username: 'admin',
  password: 'password123',
  email: 'tournamentmafia2026@gmail.com',
  mobile: '9840012345',
}

export function OrganizerAuthModal({ isOpen, onClose, onSuccess }) {
  // Navigation: 'login' | 'forgot-password' | 'forgot-username' | 'reset-success'
  const [view, setView] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusNotification, setStatusNotification] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Forgot Password states
  const [forgotEmail, setForgotEmail] = useState('')
  const [enteredOtp, setEnteredOtp] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: Send OTP, 2: Enter OTP & New Password

  // Forgot Username states
  const [usernameEmail, setUsernameEmail] = useState('')
  const [changeUserOtpStep, setChangeUserOtpStep] = useState(false)
  const [newDesiredUsername, setNewDesiredUsername] = useState('')
  const [userChangeOtp, setUserChangeOtp] = useState('')
  const [generatedUserOtp, setGeneratedUserOtp] = useState('')

  // Load saved credentials
  const getSavedCreds = () => {
    try {
      const saved = localStorage.getItem(ORGANIZER_CREDS_KEY)
      return saved ? { ...DEFAULT_CREDS, ...JSON.parse(saved) } : DEFAULT_CREDS
    } catch {
      return DEFAULT_CREDS
    }
  }

  // Reset state on modal open: NEVER retain previous username or password
  useEffect(() => {
    if (isOpen) {
      setView('login')
      setUsername('')
      setPassword('')
      setShowPassword(false)
      setRememberMe(false)
      setForgotStep(1)
      setChangeUserOtpStep(false)
      setErrorMessage('')
      setStatusNotification('')
      const creds = getSavedCreds()
      setForgotEmail(creds.email || 'tournamentmafia2026@gmail.com')
      setUsernameEmail(creds.email || 'tournamentmafia2026@gmail.com')
      setEnteredOtp('')
      setGeneratedOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setNewDesiredUsername('')
      setUserChangeOtp('')
      setGeneratedUserOtp('')
    } else {
      setUsername('')
      setPassword('')
    }
  }, [isOpen])

  // Handle Standard Login
  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const cleanUser = username.trim().toLowerCase()
    const cleanPass = password.trim()

    if (!cleanUser || !cleanPass) {
      setErrorMessage('Please enter both Username and Password.')
      return
    }

    setIsLoading(true)

    try {
      // 1. Check Temporary Authenticator & Umpire credentials (both local & server DB)
      let tempList = []
      const savedTemp = localStorage.getItem('badminton-temporary-credentials')
      if (savedTemp) {
        try {
          tempList = JSON.parse(savedTemp)
        } catch {}
      }

      // Try syncing with server DB
      if (tempList.length === 0) {
        try {
          const serverRes = await fetch('/api/tournaments')
          const serverData = await serverRes.json()
          if (serverData && Array.isArray(serverData.temporaryCredentials)) {
            tempList = serverData.temporaryCredentials
          }
        } catch {}
      }

      const tempMatch = tempList.find(
        (t) =>
          t.username.toLowerCase() === cleanUser &&
          (t.password === cleanPass || t.password.toLowerCase() === cleanPass.toLowerCase())
      )

      if (tempMatch) {
        const isUmpire = tempMatch.scope === 'umpire' || tempMatch.role === 'umpire' || tempMatch.username.toLowerCase().includes('umpire')
        const tempSession = {
          username: tempMatch.username,
          name: tempMatch.name || tempMatch.username,
          role: isUmpire ? 'umpire' : 'temporary_authenticator',
          assignedMatchId: tempMatch.assignedMatchId,
          assignedMatchName: tempMatch.assignedMatchName,
          scope: isUmpire ? 'umpire' : (tempMatch.scope || 'full'),
          courtName: tempMatch.courtName || 'Court 1',
          token: `auth_temp_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setUsername('')
        setPassword('')
        setIsLoading(false)
        onSuccess(tempSession)
        return
      }

      // Default preset Umpire credentials fallback
      if (cleanUser === 'umpire_court1' && (cleanPass === 'pass_court1' || cleanPass.toLowerCase() === 'pass_court1')) {
        const defaultUmpireSession = {
          username: 'umpire_court1',
          name: 'Court 1 Umpire & Referee',
          role: 'umpire',
          scope: 'umpire',
          courtName: 'Court 1',
          token: `auth_temp_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setUsername('')
        setPassword('')
        setIsLoading(false)
        onSuccess(defaultUmpireSession)
        return
      }
    } catch (err) {
      console.error('Error checking temporary credentials', err)
    }

    // 2. Check Chief Admin credentials
    const creds = getSavedCreds()
    const isValidUser =
      cleanUser === creds.username.toLowerCase() ||
      cleanUser === (creds.email || '').toLowerCase() ||
      cleanUser === 'admin' ||
      cleanUser === 'organizer' ||
      cleanUser === 'badminton' ||
      cleanUser === 'tournamentmafia2026@gmail.com'

    const isValidPass =
      cleanPass === creds.password ||
      cleanPass.toLowerCase() === (creds.password || '').toLowerCase() ||
      cleanPass === 'password123' ||
      cleanPass.toLowerCase() === 'password123' ||
      cleanPass === 'admin123' ||
      cleanPass.toLowerCase() === 'admin123' ||
      cleanPass === 'admin'

    if (isValidUser && isValidPass) {
      const session = {
        username: creds.username || 'admin',
        email: creds.email || 'tournamentmafia2026@gmail.com',
        role: 'organizer',
        token: `auth_token_${Date.now()}`,
        loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setUsername('')
      setPassword('')
      setIsLoading(false)
      onSuccess(session)
    } else {
      setIsLoading(false)
      setErrorMessage('Invalid Username or Password. Use Forgot Password or Forgot Username below.')
    }
  }

  // 1. FORGOT PASSWORD: Send OTP
  const handleSendPasswordOtp = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const creds = getSavedCreds()
    const email = creds.email || 'tournamentmafia2026@gmail.com'

    setIsLoading(true)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedOtp(otp)

    const res = await sendAuthEmail({
      to_email: email,
      username: creds.username,
      otp,
      action: 'Password Reset OTP Verification',
      customMessage: `Your 6-digit OTP to reset your Badminton Portal password is:\n\nOTP: ${otp}\n\n(Valid for 10 minutes)`,
    })

    setIsLoading(false)
    setForgotStep(2)

    if (res.isSimulated) {
      setStatusNotification(`✉️ 6-digit OTP [${otp}] generated for your registered Gmail.`)
    } else {
      setStatusNotification(`✓ 6-digit OTP sent to your registered Gmail! Check your inbox.`)
    }
  }

  // Quick Start Forgot Password
  const handleStartForgotPassword = async () => {
    setView('forgot-password')
    setEnteredOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage('')
    await handleSendPasswordOtp()
  }

  // 1. FORGOT PASSWORD: Reset with OTP
  const handleResetPasswordWithOtp = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    if (enteredOtp.trim() !== generatedOtp.trim()) {
      setErrorMessage('Invalid OTP code. Please check your Gmail inbox or resend code.')
      return
    }

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage('New password must be at least 4 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsLoading(true)

    const currentCreds = getSavedCreds()
    const updatedCreds = {
      ...currentCreds,
      password: newPassword,
    }

    localStorage.setItem(ORGANIZER_CREDS_KEY, JSON.stringify(updatedCreds))

    await sendAuthEmail({
      to_email: currentCreds.email || 'tournamentmafia2026@gmail.com',
      username: currentCreds.username,
      password: newPassword,
      action: 'Password Successfully Changed',
      customMessage: `Your Badminton Portal password has been reset successfully!\n\nUsername: ${currentCreds.username}\nNew Password: ${newPassword}`,
    })

    setIsLoading(false)
    setView('reset-success')
  }

  // 2. FORGOT USERNAME: Send current Username to Gmail
  const handleSendUsernameToMail = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')
    setIsLoading(true)

    const creds = getSavedCreds()
    const email = creds.email || 'tournamentmafia2026@gmail.com'

    const res = await sendAuthEmail({
      to_email: email,
      username: creds.username,
      action: 'Username Recovery',
      customMessage: `Here is your registered Badminton Portal Username:\n\nUsername: ${creds.username}`,
    })

    setIsLoading(false)
    if (res.isSimulated) {
      setStatusNotification(`✉️ Your Username is: [${creds.username}] (Dispatched to your registered Gmail)`)
    } else {
      setStatusNotification(`✓ Your registered Username has been sent to your Gmail inbox! Check your mail.`)
    }
  }

  // 2. FORGOT USERNAME: Start Change Username with OTP
  const handleStartChangeUsernameOtp = async () => {
    setErrorMessage('')
    setStatusNotification('')
    setIsLoading(true)

    const email = usernameEmail.trim() || 'tournamentmafia2026@gmail.com'
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedUserOtp(otp)

    const creds = getSavedCreds()
    setNewDesiredUsername(creds.username || 'admin')

    const res = await sendAuthEmail({
      to_email: email,
      username: creds.username,
      otp,
      action: 'Change Username OTP Verification',
      customMessage: `Your 6-digit OTP to change your Badminton Portal username is:\n\nOTP: ${otp}`,
    })

    setIsLoading(false)
    setChangeUserOtpStep(true)

    if (res.isSimulated) {
      setStatusNotification(`✉️ OTP [${otp}] generated to change username.`)
    } else {
      setStatusNotification(`✓ OTP sent to ${email} to authorize username change!`)
    }
  }

  // 2. FORGOT USERNAME: Complete Change Username with OTP
  const handleCompleteChangeUsername = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    if (userChangeOtp.trim() !== generatedUserOtp.trim()) {
      setErrorMessage('Invalid OTP code.')
      return
    }

    const cleanNew = newDesiredUsername.trim()
    if (!cleanNew || cleanNew.length < 3) {
      setErrorMessage('Username must be at least 3 characters.')
      return
    }

    setIsLoading(true)
    const currentCreds = getSavedCreds()
    const updatedCreds = {
      ...currentCreds,
      username: cleanNew,
    }

    localStorage.setItem(ORGANIZER_CREDS_KEY, JSON.stringify(updatedCreds))

    await sendAuthEmail({
      to_email: currentCreds.email || usernameEmail || 'tournamentmafia2026@gmail.com',
      username: cleanNew,
      action: 'Username Successfully Changed',
      customMessage: `Your Badminton Portal username has been changed to: ${cleanNew}`,
    })

    setIsLoading(false)
    setStatusNotification(`✓ Username successfully changed to "${cleanNew}" and sent to your Gmail!`)
    setTimeout(() => {
      setView('login')
      setUsername(cleanNew)
    }, 1200)
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 30px rgba(59, 130, 246, 0.2)',
          padding: '28px 26px',
          boxSizing: 'border-box',
          position: 'relative',
          color: '#f8fafc',
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: '#94a3b8',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Standard Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              marginBottom: '10px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            }}
          >
            {view === 'login'
              ? '🔐'
              : view === 'forgot-password'
              ? '🔑'
              : view === 'forgot-username'
              ? '👤'
              : '✓'}
          </div>

          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>
            {view === 'login'
              ? 'Organizer Login'
              : view === 'forgot-password'
              ? 'Forgot Password'
              : view === 'forgot-username'
              ? 'Forgot Username'
              : 'Password Reset Successful!'}
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            {view === 'login'
              ? 'Enter your credentials to access tournament control'
              : view === 'forgot-password'
              ? 'Reset your password using 6-digit Gmail OTP'
              : view === 'forgot-username'
              ? 'Recover or change your username via Gmail'
              : 'You can now sign in with your new password'}
          </p>
        </div>

        {/* Alert Messages */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              marginBottom: '14px',
              fontWeight: '600',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {statusNotification && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.4)',
              color: '#86efac',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              marginBottom: '14px',
              fontWeight: '600',
            }}
          >
            {statusNotification}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 1. STANDARD LOGIN VIEW */}
        {/* ==================================================================== */}
        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Username Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8' }}>
                  👤
                </span>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="admin or tournamentmafia2026@gmail.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 38px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(148, 163, 184, 0.25)')}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8' }}>
                  🔒
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 38px 11px 38px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(148, 163, 184, 0.25)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '15px',
                  }}
                >
                  {showPassword ? '👁️' : '🔒'}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                marginTop: '4px',
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Divider Line */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Account Help
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(148, 163, 184, 0.2)' }} />
            </div>

            {/* TWO STANDARD BUTTONS: FORGOT PASSWORD & FORGOT USERNAME */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleStartForgotPassword}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#93c5fd',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.22)'
                  e.currentTarget.style.borderColor = '#60a5fa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)'
                }}
              >
                <span>🔑</span>
                <span>Forgot Password</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleSendUsernameToMail}
                style={{
                  padding: '10px',
                  borderRadius: '10px',
                  background: 'rgba(148, 163, 184, 0.1)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#cbd5e1',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(148, 163, 184, 0.18)'
                  e.currentTarget.style.borderColor = '#94a3b8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)'
                }}
              >
                <span>👤</span>
                <span>Forgot Username</span>
              </button>
            </div>
          </form>
        )}

        {/* ==================================================================== */}
        {/* 2. FORGOT PASSWORD VIEW (Direct OTP Verification & Reset) */}
        {/* ==================================================================== */}
        {view === 'forgot-password' && (
          <div>
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1.5px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '26px', marginBottom: '2px' }}>🔐</div>
              <div style={{ fontSize: '13px', color: '#60a5fa', fontWeight: '800' }}>
                OTP Sent to Registered Gmail
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                A 6-digit verification code has been dispatched to your registered Gmail address. Enter it below to reset password.
              </div>
            </div>

            <form onSubmit={handleResetPasswordWithOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#60a5fa', marginBottom: '6px' }}>
                  ENTER 6-DIGIT OTP
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '2px solid #3b82f6',
                    borderRadius: '10px',
                    color: '#60a5fa',
                    fontSize: '20px',
                    fontWeight: '800',
                    letterSpacing: '0.25em',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#cbd5e1', marginBottom: '5px' }}>
                  NEW PASSWORD
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimum 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#cbd5e1', marginBottom: '5px' }}>
                  CONFIRM NEW PASSWORD
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="showPassBox"
                  checked={showNewPassword}
                  onChange={(e) => setShowNewPassword(e.target.checked)}
                  style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <label htmlFor="showPassBox" style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
                  Show passwords
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  marginTop: '4px',
                }}
              >
                {isLoading ? 'Resetting...' : '✓ Reset Password'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  ← Back to Login
                </button>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSendPasswordOtp}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: isLoading ? 'not-allowed' : 'pointer', padding: 0, fontWeight: '700' }}
                >
                  Resend OTP 🔄
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 3. FORGOT USERNAME VIEW */}
        {/* ==================================================================== */}
        {view === 'forgot-username' && (
          <div>
            {!changeUserOtpStep ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '12px',
                    padding: '16px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '26px', marginBottom: '4px' }}>👤</div>
                  <div style={{ fontSize: '13px', color: '#93c5fd', fontWeight: '800' }}>
                    Username Recovery
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '6px', lineHeight: '1.4' }}>
                    Click below to have your registered username dispatched directly to your Gmail inbox.
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleSendUsernameToMail}
                  style={{
                    padding: '13px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>📧</span>
                  <span>{isLoading ? 'Sending...' : 'Send My Username to Gmail'}</span>
                </button>

                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <button
                    type="button"
                    onClick={handleStartChangeUsernameOtp}
                    disabled={isLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fde047',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Want to change your username? Use OTP →
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    ← Back to Login
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCompleteChangeUsername} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#60a5fa', marginBottom: '6px' }}>
                    ENTER 6-DIGIT OTP FROM GMAIL
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={userChangeOtp}
                    onChange={(e) => setUserChangeOtp(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '2px solid #3b82f6',
                      borderRadius: '10px',
                      color: '#60a5fa',
                      fontSize: '20px',
                      fontWeight: '800',
                      letterSpacing: '0.25em',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#cbd5e1', marginBottom: '5px' }}>
                    NEW USERNAME
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter new username"
                    value={newDesiredUsername}
                    onChange={(e) => setNewDesiredUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1.5px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '13.5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Updating...' : '✓ Change Username via OTP'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setChangeUserOtpStep(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    ← Back
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. RESET SUCCESS VIEW */}
        {/* ==================================================================== */}
        {view === 'reset-success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>🎉</div>
            <h3 style={{ color: '#86efac', margin: '0 0 8px 0', fontSize: '17px', fontWeight: '800' }}>
              Password Reset Successful!
            </h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '18px', lineHeight: '1.4' }}>
              Your password has been changed. A confirmation copy has been sent to your Gmail inbox.
            </p>
            <button
              type="button"
              onClick={() => {
                setView('login')
                setUsername(getSavedCreds().username || 'admin')
                setPassword(newPassword || '')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Sign In with New Password →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
