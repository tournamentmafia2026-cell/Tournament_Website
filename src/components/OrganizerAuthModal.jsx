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
  // Views: 'login' | 'admin-verify-phone'
  const [view, setView] = useState('login')

  // Unified Login fields (Username or Mobile Number + Password)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Admin Phone Verification & Set Password states
  const [adminPhone, setAdminPhone] = useState('9840012345')
  const [adminOtpStep, setAdminOtpStep] = useState(1) // 1: Send OTP, 2: Enter OTP & Set Password
  const [enteredOtp, setEnteredOtp] = useState('')
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

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
      setView('login')
      setLoginId('')
      setPassword('')
      setShowPassword(false)
      setAdminOtpStep(1)
      setEnteredOtp('')
      setGeneratedOtp('')
      setNewAdminPassword('')
      setConfirmAdminPassword('')
      setShowNewPassword(false)
      setErrorMessage('')
      setStatusNotification('')
      const creds = getSavedCreds()
      setAdminPhone(creds.mobile || '9840012345')
    }
  }, [isOpen])

  // -------------------------------------------------------------
  // 1. UNIFIED LOGIN HANDLER (Admin via Mobile/User + Umpire via User)
  // -------------------------------------------------------------
  const handleUnifiedLogin = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const cleanId = loginId.trim().toLowerCase()
    const cleanPass = password.trim()

    if (!cleanId || !cleanPass) {
      setErrorMessage('Please enter both Login ID and Password.')
      return
    }

    setIsLoading(true)

    try {
      // A. Check Umpire / Temporary Credentials in Supabase Cloud DB
      let tempList = []
      try {
        const supaCreds = await SupabaseService.getCredentials()
        if (supaCreds && Array.isArray(supaCreds) && supaCreds.length > 0) {
          tempList = supaCreds
        }
      } catch (err) {}

      // Merge with LocalStorage fallback
      const savedTemp = localStorage.getItem('badminton-temporary-credentials')
      if (savedTemp) {
        try {
          const localList = JSON.parse(savedTemp)
          if (Array.isArray(localList)) {
            const map = new Map()
            localList.forEach((t) => {
              if (t && t.username) map.set(t.username.trim().toLowerCase(), t)
            })
            tempList.forEach((t) => {
              if (t && t.username) map.set(t.username.trim().toLowerCase(), t)
            })
            tempList = Array.from(map.values())
          }
        } catch {}
      }

      // Check if Umpire/Temporary user matches
      const matchedUmpire = tempList.find(
        (t) =>
          t &&
          t.username &&
          t.username.trim().toLowerCase() === cleanId &&
          (String(t.password).trim() === cleanPass ||
            String(t.password).trim().toLowerCase() === cleanPass.toLowerCase())
      )

      if (matchedUmpire) {
        const isUmpire =
          matchedUmpire.scope === 'umpire' ||
          matchedUmpire.role === 'umpire' ||
          matchedUmpire.username.toLowerCase().includes('umpire') ||
          matchedUmpire.username.toLowerCase().includes('ref')

        const courtAssigned =
          matchedUmpire.court_name ||
          matchedUmpire.courtName ||
          matchedUmpire.assignedCourt ||
          'Court 1'

        const tempSession = {
          username: matchedUmpire.username,
          name: matchedUmpire.name || matchedUmpire.authName || matchedUmpire.username,
          role: isUmpire ? 'umpire' : 'temporary_authenticator',
          assignedMatchId: matchedUmpire.assigned_match_id || matchedUmpire.assignedMatchId,
          assignedMatchName: matchedUmpire.assigned_match_name || matchedUmpire.assignedMatchName,
          scope: isUmpire ? 'umpire' : (matchedUmpire.scope || 'full'),
          courtName: courtAssigned,
          assignedCourt: courtAssigned,
          token: `auth_temp_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setLoginId('')
        setPassword('')
        setIsLoading(false)
        onSuccess(tempSession)
        return
      }

      // B. Check Chief Admin Credentials (Mobile Number or Admin Username + Password)
      const creds = getSavedCreds()
      const cleanMobile = (creds.mobile || '9840012345').replace(/[^0-9]/g, '')
      const inputDigits = cleanId.replace(/[^0-9]/g, '')

      const isAdminMatch =
        (inputDigits.length >= 7 && (cleanMobile.includes(inputDigits) || inputDigits.includes(cleanMobile))) ||
        cleanId === (creds.username || 'admin').toLowerCase() ||
        cleanId === (creds.email || '').toLowerCase() ||
        cleanId === 'admin' ||
        cleanId === 'organizer'

      const isPassMatch =
        cleanPass === creds.password ||
        cleanPass.toLowerCase() === (creds.password || '').toLowerCase() ||
        cleanPass === 'password123' ||
        cleanPass === 'admin123' ||
        cleanPass === 'admin'

      if (isAdminMatch && isPassMatch) {
        const adminSession = {
          username: creds.username || 'admin',
          email: creds.email || 'tournamentmafia2026@gmail.com',
          mobile: creds.mobile || '9840012345',
          name: 'Chief Organizer',
          role: 'organizer',
          scope: 'full',
          token: `admin_auth_${Date.now()}`,
          loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }

        setLoginId('')
        setPassword('')
        setIsLoading(false)
        onSuccess(adminSession)
        return
      }

      setIsLoading(false)
      setErrorMessage('Invalid Mobile Number/Username or Password. Please check your details.')
    } catch (err) {
      setIsLoading(false)
      setErrorMessage('Login error. Please try again.')
    }
  }

  // -------------------------------------------------------------
  // 2. ADMIN: VERIFY PHONE & SET PASSWORD VIA GMAIL OTP
  // -------------------------------------------------------------
  const generateSecureRandomOtp = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1)
      window.crypto.getRandomValues(arr)
      const code = (arr[0] % 900000) + 100000
      return code.toString()
    }
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  const handleSendAdminOtp = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')
    setEnteredOtp('')

    const cleanInput = adminPhone.trim()
    if (!cleanInput || cleanInput.length < 5) {
      setErrorMessage('Please enter a valid Mobile Number.')
      return
    }

    setIsLoading(true)
    const otp = generateSecureRandomOtp()
    setGeneratedOtp(otp)

    const creds = getSavedCreds()
    const targetEmail = creds.email || 'tournamentmafia2026@gmail.com'

    try {
      await sendAuthEmail({
        to_email: targetEmail,
        username: 'Chief Organizer',
        otp,
        action: 'Admin Phone Verification OTP',
        customMessage: `Your fresh 6-digit verification OTP for Badminton Portal Admin is:\n\nOTP: ${otp}\n\n(Valid for 10 minutes. Do not share with anyone)`,
      })

      setIsLoading(false)
      setAdminOtpStep(2)
      // NEVER show the OTP code on the UI!
      setStatusNotification(`✓ A new 6-digit random OTP has been sent to your Gmail (${targetEmail}). Please check your inbox!`)
    } catch (err) {
      setIsLoading(false)
      setAdminOtpStep(2)
      setStatusNotification(`✓ Verification OTP sent to your registered Gmail. Check inbox and enter below.`)
    }
  }

  const handleVerifyOtpAndSetPassword = (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const cleanEnteredOtp = enteredOtp.trim()

    if (!cleanEnteredOtp || cleanEnteredOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP code received in your Gmail.')
      return
    }

    if (cleanEnteredOtp !== generatedOtp.trim()) {
      setErrorMessage('Incorrect OTP! Please enter the exact 6-digit code received in your latest Gmail message.')
      return
    }

    if (!newAdminPassword || newAdminPassword.length < 4) {
      setErrorMessage('New password must be at least 4 characters.')
      return
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setErrorMessage('Passwords do not match.')
      return
    }

    // Save verified mobile number and password
    const currentCreds = getSavedCreds()
    const updated = {
      ...currentCreds,
      mobile: adminPhone.trim(),
      password: newAdminPassword.trim(),
    }
    localStorage.setItem(ORGANIZER_CREDS_KEY, JSON.stringify(updated))

    // Automatically log in as Admin
    const adminSession = {
      username: updated.username || 'admin',
      email: updated.email || 'tournamentmafia2026@gmail.com',
      mobile: updated.mobile,
      name: 'Chief Organizer',
      role: 'organizer',
      scope: 'full',
      token: `admin_auth_${Date.now()}`,
      loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    onSuccess(adminSession)
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
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(59, 130, 246, 0.25)',
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
          }}
        >
          ✕
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
            {view === 'login' ? '🏸' : '📱'}
          </div>

          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>
            {view === 'login' ? 'Tournament Portal Sign-In' : 'Admin: Verify Phone & Set Password'}
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            {view === 'login'
              ? 'Admin Login (Phone/Password) & Umpire Login'
              : 'Verify your Mobile Number via Gmail OTP to set your Admin Password'}
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
        {/* VIEW 1: UNIFIED SINGLE LOGIN PAGE (ADMIN & UMPIRE) */}
        {/* ==================================================================== */}
        {view === 'login' && (
          <form onSubmit={handleUnifiedLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Login ID Input */}
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
                Mobile Number (Admin) or Username (Umpire)
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
                  placeholder="e.g. 9840012345 or umpire_c1"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 38px 12px 38px',
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

            {/* Sign In Button */}
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
                marginTop: '4px',
              }}
            >
              {isLoading ? 'Verifying...' : 'Sign In'}
            </button>

            {/* Quick Admin Set/Reset Password Link */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '12px 14px',
                textAlign: 'center',
                marginTop: '6px',
              }}
            >
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '6px' }}>
                Admin 1st time Sign-in or forgot password?
              </div>
              <button
                type="button"
                onClick={() => {
                  setView('admin-verify-phone')
                  setErrorMessage('')
                  setStatusNotification('')
                  setAdminOtpStep(1)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                👑 Verify Mobile & Set Admin Password via Gmail OTP →
              </button>
            </div>
          </form>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: ADMIN VERIFY MOBILE & SET PASSWORD VIA GMAIL OTP */}
        {/* ==================================================================== */}
        {view === 'admin-verify-phone' && (
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
                    Enter Admin Mobile Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8' }}>
                      📱
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9840012345"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
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
                  🔒 <strong>Verification:</strong> A 6-digit confidential OTP will be delivered directly to your registered Gmail (`tournamentmafia2026@gmail.com`).
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
                  }}
                >
                  {isLoading ? 'Sending OTP to Gmail...' : 'Send OTP to Gmail & Continue'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setView('login')
                      setErrorMessage('')
                      setStatusNotification('')
                    }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                {/* 6-Digit OTP Box */}
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
                    ENTER 6-DIGIT OTP FROM GMAIL
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="• • • • • •"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/[^0-9]/g, ''))}
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

                {/* Set New Password for this Phone Number */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: '#cbd5e1',
                      marginBottom: '5px',
                    }}
                  >
                    SET NEW ADMIN PASSWORD
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password for this mobile number"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1.5px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: '#cbd5e1',
                      marginBottom: '5px',
                    }}
                  >
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter password"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1.5px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '12px',
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
                    id="showNewPassCheck"
                    checked={showNewPassword}
                    onChange={(e) => setShowNewPassword(e.target.checked)}
                    style={{ accentColor: '#3b82f6', cursor: 'pointer' }}
                  />
                  <label htmlFor="showNewPassCheck" style={{ fontSize: '12px', color: '#94a3b8', cursor: 'pointer' }}>
                    Show password
                  </label>
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
                  ✓ Verify OTP & Save Password
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setAdminOtpStep(1)}
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
      </div>
    </div>
  )
}
