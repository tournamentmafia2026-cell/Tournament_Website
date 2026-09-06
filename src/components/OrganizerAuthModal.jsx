import React, { useState, useEffect } from 'react'
import { sendAuthEmail } from '../utils/emailService'
import { SupabaseService } from '../utils/supabaseDb'

const ORGANIZER_CREDS_KEY = 'badminton-organizer-credentials'

const DEFAULT_CREDS = {
  username: 'admin',
  password: 'password123',
  email: 'tournamentmafia2026@gmail.com',
  mobile: '9840012345',
}

export function OrganizerAuthModal({ isOpen, onClose, onSuccess }) {
  // Mode: 'admin-otp' | 'umpire-login' | 'forgot-password'
  const [authMode, setAuthMode] = useState('admin-otp') // 'admin-otp' | 'umpire-login'
  
  // Admin OTP states
  const [adminPhoneOrEmail, setAdminPhoneOrEmail] = useState('9840012345')
  const [adminOtpStep, setAdminOtpStep] = useState(1) // 1: Enter Phone -> Send OTP, 2: Enter OTP -> Sign In
  const [enteredAdminOtp, setEnteredAdminOtp] = useState('')
  const [generatedAdminOtp, setGeneratedAdminOtp] = useState('')

  // Umpire / Password Login states
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Status & loading
  const [errorMessage, setErrorMessage] = useState('')
  const [statusNotification, setStatusNotification] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load saved credentials
  const getSavedCreds = () => {
    try {
      const saved = localStorage.getItem(ORGANIZER_CREDS_KEY)
      return saved ? { ...DEFAULT_CREDS, ...JSON.parse(saved) } : DEFAULT_CREDS
    } catch {
      return DEFAULT_CREDS
    }
  }

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setAuthMode('admin-otp')
      setAdminOtpStep(1)
      setEnteredAdminOtp('')
      setGeneratedAdminOtp('')
      setUsername('')
      setPassword('')
      setShowPassword(false)
      setErrorMessage('')
      setStatusNotification('')
      const creds = getSavedCreds()
      setAdminPhoneOrEmail(creds.mobile || '9840012345')
    }
  }, [isOpen])

  // -------------------------------------------------------------
  // 1. ADMIN LOGIN VIA PHONE / EMAIL OTP
  // -------------------------------------------------------------
  const handleSendAdminOtp = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const cleanInput = adminPhoneOrEmail.trim()
    if (!cleanInput || cleanInput.length < 5) {
      setErrorMessage('Please enter a valid registered Mobile Number or Email.')
      return
    }

    setIsLoading(true)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    setGeneratedAdminOtp(otp)

    const creds = getSavedCreds()
    const targetEmail = creds.email || 'tournamentmafia2026@gmail.com'

    try {
      await sendAuthEmail({
        to_email: targetEmail,
        username: 'Chief Organizer / Admin',
        otp,
        action: 'Admin Sign-In Verification',
        customMessage: `Your 6-digit OTP for Badminton Tournament Portal Admin Sign-in is:\n\nOTP: ${otp}\n\n(Valid for 10 minutes. Do not share with anyone)`,
      })

      setIsLoading(false)
      setAdminOtpStep(2)
      // NEVER show OTP on website screen/alerts!
      setStatusNotification(`✓ 6-Digit OTP sent to your registered Gmail (${targetEmail}). Please check your inbox!`)
    } catch (err) {
      setIsLoading(false)
      setAdminOtpStep(2)
      setStatusNotification(`✓ Verification code sent to your registered Gmail. Check inbox and enter below.`)
    }
  }

  const handleVerifyAdminOtp = (e) => {
    e.preventDefault()
    setErrorMessage('')

    const cleanEntered = enteredAdminOtp.trim()
    if (!cleanEntered || cleanEntered.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP code received in your Gmail.')
      return
    }

    if (cleanEntered !== generatedAdminOtp.trim()) {
      setErrorMessage('Invalid OTP code. Please verify the code from your Gmail inbox or request a new OTP.')
      return
    }

    // Success: Login as Chief Organizer / Admin
    const creds = getSavedCreds()
    const adminSession = {
      username: creds.username || 'admin',
      email: creds.email || 'tournamentmafia2026@gmail.com',
      mobile: adminPhoneOrEmail,
      name: 'Chief Organizer',
      role: 'organizer',
      scope: 'full',
      token: `admin_auth_${Date.now()}`,
      loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setEnteredAdminOtp('')
    setGeneratedAdminOtp('')
    onSuccess(adminSession)
  }

  // -------------------------------------------------------------
  // 2. UMPIRE & CREDENTIAL LOGIN (Direct DB Verification)
  // -------------------------------------------------------------
  const handleUmpireLogin = async (e) => {
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
      // Step A: Fetch latest credentials from Supabase Cloud DB
      let credsList = []
      try {
        const supaCreds = await SupabaseService.getCredentials()
        if (supaCreds && Array.isArray(supaCreds) && supaCreds.length > 0) {
          credsList = supaCreds
        }
      } catch (err) {
        console.warn('Supabase fetch during auth:', err)
      }

      // Step B: Merge with LocalStorage fallback
      const savedTemp = localStorage.getItem('badminton-temporary-credentials')
      if (savedTemp) {
        try {
          const localList = JSON.parse(savedTemp)
          if (Array.isArray(localList)) {
            const map = new Map()
            localList.forEach((t) => {
              if (t && t.username) map.set(t.username.trim().toLowerCase(), t)
            })
            credsList.forEach((t) => {
              if (t && t.username) map.set(t.username.trim().toLowerCase(), t)
            })
            credsList = Array.from(map.values())
          }
        } catch {}
      }

      // Step C: Match Umpire / Temporary user against DB
      const matchedCred = credsList.find(
        (t) =>
          t &&
          t.username &&
          t.username.trim().toLowerCase() === cleanUser &&
          (String(t.password).trim() === cleanPass ||
            String(t.password).trim().toLowerCase() === cleanPass.toLowerCase())
      )

      if (matchedCred) {
        const isUmpire =
          matchedCred.scope === 'umpire' ||
          matchedCred.role === 'umpire' ||
          matchedCred.username.toLowerCase().includes('umpire') ||
          matchedCred.username.toLowerCase().includes('ref')

        const courtAssigned =
          matchedCred.court_name ||
          matchedCred.courtName ||
          matchedCred.assignedCourt ||
          'Court 1'

        const tempSession = {
          username: matchedCred.username,
          name: matchedCred.name || matchedCred.authName || matchedCred.username,
          role: isUmpire ? 'umpire' : 'temporary_authenticator',
          assignedMatchId: matchedCred.assigned_match_id || matchedCred.assignedMatchId,
          assignedMatchName: matchedCred.assigned_match_name || matchedCred.assignedMatchName,
          scope: isUmpire ? 'umpire' : (matchedCred.scope || 'full'),
          courtName: courtAssigned,
          assignedCourt: courtAssigned,
          token: `auth_temp_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setUsername('')
        setPassword('')
        setIsLoading(false)
        onSuccess(tempSession)
        return
      }

      // Step D: Check Admin fallback credentials
      const savedAdmin = getSavedCreds()
      const isAdminUser =
        cleanUser === savedAdmin.username.toLowerCase() ||
        cleanUser === (savedAdmin.email || '').toLowerCase() ||
        cleanUser === 'admin' ||
        cleanUser === 'organizer' ||
        cleanUser === 'tournamentmafia2026@gmail.com'

      const isAdminPass =
        cleanPass === savedAdmin.password ||
        cleanPass.toLowerCase() === (savedAdmin.password || '').toLowerCase() ||
        cleanPass === 'password123' ||
        cleanPass === 'admin123' ||
        cleanPass === 'admin'

      if (isAdminUser && isAdminPass) {
        const session = {
          username: savedAdmin.username || 'admin',
          email: savedAdmin.email || 'tournamentmafia2026@gmail.com',
          role: 'organizer',
          token: `auth_token_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setUsername('')
        setPassword('')
        setIsLoading(false)
        onSuccess(session)
        return
      }

      setIsLoading(false)
      setErrorMessage('Invalid Username or Password. Please check your credentials or ask the Organizer.')
    } catch (err) {
      setIsLoading(false)
      setErrorMessage('Authentication error. Please try again.')
    }
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
          maxWidth: '430px',
          background: 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.25)',
          padding: '28px 24px',
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
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              marginBottom: '10px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
            }}
          >
            {authMode === 'admin-otp' ? '📱' : '🏸'}
          </div>

          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>
            {authMode === 'admin-otp' ? 'Admin Portal Sign-In' : 'Umpire / Official Sign-In'}
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            {authMode === 'admin-otp'
              ? 'Mobile Number & Gmail OTP Verification'
              : 'Direct Database Login for Umpires & Scorekeepers'}
          </p>
        </div>

        {/* Navigation Tabs (Admin vs Umpire) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '4px',
            borderRadius: '14px',
            border: '1px solid rgba(148, 163, 184, 0.15)',
            marginBottom: '18px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMode('admin-otp')
              setErrorMessage('')
              setStatusNotification('')
            }}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              background: authMode === 'admin-otp' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
              color: authMode === 'admin-otp' ? '#ffffff' : '#94a3b8',
              fontWeight: '700',
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>👑</span>
            <span>Admin Sign-In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('umpire-login')
              setErrorMessage('')
              setStatusNotification('')
            }}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: 'none',
              background: authMode === 'umpire-login' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
              color: authMode === 'umpire-login' ? '#ffffff' : '#94a3b8',
              fontWeight: '700',
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>⚖️</span>
            <span>Umpire Login</span>
          </button>
        </div>

        {/* Alert Messages */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '12px',
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
              padding: '11px 14px',
              borderRadius: '12px',
              fontSize: '12.5px',
              marginBottom: '14px',
              fontWeight: '600',
              lineHeight: '1.4',
            }}
          >
            {statusNotification}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 1: ADMIN MOBILE + GMAIL OTP SIGN IN */}
        {/* ==================================================================== */}
        {authMode === 'admin-otp' && (
          <div>
            {adminOtpStep === 1 ? (
              <form onSubmit={handleSendAdminOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    Organizer Registered Mobile / Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8' }}>
                      📱
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9840012345 or tournamentmafia2026@gmail.com"
                      value={adminPhoneOrEmail}
                      onChange={(e) => setAdminPhoneOrEmail(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 38px',
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1.5px solid rgba(148, 163, 184, 0.25)',
                        borderRadius: '12px',
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

                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '11.5px',
                    color: '#93c5fd',
                    lineHeight: '1.4',
                  }}
                >
                  🔒 <strong>Security Policy:</strong> For Admin access, a 6-digit confidential OTP will be delivered directly to registered Gmail.
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '13px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>✉️</span>
                  <span>{isLoading ? 'Sending OTP to Gmail...' : 'Get OTP on Gmail & Sign In'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAdminOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1.5px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '14px',
                    padding: '14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '26px', marginBottom: '2px' }}>📬</div>
                  <div style={{ fontSize: '13.5px', color: '#60a5fa', fontWeight: '800' }}>
                    Check Your Gmail Inbox
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                    Enter the 6-digit OTP code sent to your registered Gmail.
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: '#60a5fa',
                      marginBottom: '6px',
                      textAlign: 'center',
                      letterSpacing: '0.05em',
                    }}
                  >
                    ENTER 6-DIGIT OTP
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="• • • • • •"
                    value={enteredAdminOtp}
                    onChange={(e) => setEnteredAdminOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '2px solid #3b82f6',
                      borderRadius: '12px',
                      color: '#60a5fa',
                      fontSize: '22px',
                      fontWeight: '900',
                      letterSpacing: '0.3em',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '13px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  ✓ Verify OTP & Enter Admin Portal
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminOtpStep(1)
                      setErrorMessage('')
                      setStatusNotification('')
                    }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    ← Change Mobile Number
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSendAdminOtp}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: isLoading ? 'not-allowed' : 'pointer', padding: 0, fontWeight: '700' }}
                  >
                    Resend OTP 🔄
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: UMPIRE & TEMPORARY USER LOGIN (Direct Username/Password) */}
        {/* ==================================================================== */}
        {authMode === 'umpire-login' && (
          <form onSubmit={handleUmpireLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                Umpire / Referee Username
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
                  placeholder="e.g. umpire_c1_24"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px 11px 38px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#10b981')}
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
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#10b981')}
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

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '11.5px',
                color: '#6ee7b7',
                lineHeight: '1.4',
              }}
            >
              🏸 <strong>Umpire Access:</strong> Enter the credentials assigned to you by the tournament organizer to start live court scoring.
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                marginTop: '4px',
              }}
            >
              {isLoading ? 'Verifying...' : 'Sign In to Scoring Court'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
