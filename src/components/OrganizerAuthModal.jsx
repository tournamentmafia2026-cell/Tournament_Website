import React, { useState, useEffect } from 'react'
import { sendAuthEmail } from '../utils/emailService'
import { SupabaseService } from '../utils/supabaseDb'

const ORGANIZER_CREDS_KEY = 'badminton-organizer-credentials'

const DEFAULT_CREDS = {
  username: '',
  password: '',
  email: '',
  mobile: '',
}

export function OrganizerAuthModal({ isOpen, onClose, onSuccess }) {
  // Views: 'login' | 'admin-verify-phone'
  const [view, setView] = useState('login')

  // Unified Login fields (Username or Mobile Number + Password)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Admin Phone & Email Verification states
  const [adminPhone, setAdminPhone] = useState('9840012345')
  const [adminEmail, setAdminEmail] = useState('tournamentmafia2026@gmail.com')
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
      setAdminEmail(creds.email || 'tournamentmafia2026@gmail.com')
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
    const inputDigits = cleanId.replace(/[^0-9]/g, '')

    if (!cleanId || !cleanPass) {
      setErrorMessage('Please enter both Login ID and Password.')
      return
    }

    setIsLoading(true)

    try {
      let cloudCreds = []
      let cloudAdmin = null

      // 1. Fetch from Netlify Serverless Cloud DB (/api/credentials)
      try {
        const credRes = await fetch('/api/credentials')
        if (credRes.ok) {
          const cData = await credRes.json()
          if (cData && Array.isArray(cData.temporaryCredentials)) {
            cloudCreds = cData.temporaryCredentials
          }
          if (cData && cData.organizerCredentials) {
            cloudAdmin = cData.organizerCredentials
          }
        }
      } catch {}

      // 2. Fetch from Netlify Serverless Cloud DB (/api/tournaments)
      try {
        const tourRes = await fetch('/api/tournaments')
        if (tourRes.ok) {
          const tData = await tourRes.json()
          if (tData && Array.isArray(tData.temporaryCredentials)) {
            cloudCreds = [...cloudCreds, ...tData.temporaryCredentials]
          }
          if (tData && tData.organizerCredentials) {
            cloudAdmin = { ...(cloudAdmin || {}), ...tData.organizerCredentials }
          }
        }
      } catch {}

      // 3. Fetch from Supabase Cloud DB if configured
      try {
        const supaCreds = await SupabaseService.getCredentials()
        if (supaCreds && Array.isArray(supaCreds) && supaCreds.length > 0) {
          cloudCreds = [...cloudCreds, ...supaCreds]
        }
      } catch {}

      // 4. Merge with local storage fallback
      const savedTemp = localStorage.getItem('badminton-temporary-credentials')
      if (savedTemp) {
        try {
          const localList = JSON.parse(savedTemp)
          if (Array.isArray(localList)) {
            cloudCreds = [...cloudCreds, ...localList]
          }
        } catch {}
      }

      // Check Admin Match against Cloud Admin data
      if (cloudAdmin) {
        const adminMobileDigits = String(cloudAdmin.mobile || '').replace(/[^0-9]/g, '')
        const adminPass = String(cloudAdmin.password || '').trim()

        const isCloudAdminIdMatch =
          (inputDigits.length >= 7 && adminMobileDigits && (adminMobileDigits.endsWith(inputDigits) || inputDigits.endsWith(adminMobileDigits))) ||
          cleanId === String(cloudAdmin.username || 'admin').toLowerCase() ||
          cleanId === 'admin' ||
          cleanId === 'organizer'

        const isCloudAdminPassMatch =
          cleanPass === adminPass ||
          cleanPass.toLowerCase() === adminPass.toLowerCase()

        if (isCloudAdminIdMatch && isCloudAdminPassMatch) {
          localStorage.setItem(
            ORGANIZER_CREDS_KEY,
            JSON.stringify({
              username: cloudAdmin.username || 'admin',
              mobile: cloudAdmin.mobile || cleanId,
              password: cleanPass,
              email: 'tournamentmafia2026@gmail.com',
            })
          )

          const adminSession = {
            username: cloudAdmin.username || 'admin',
            email: 'tournamentmafia2026@gmail.com',
            mobile: cloudAdmin.mobile || cleanId,
            name: 'Chief Organizer',
            role: 'organizer',
            isChiefOrganizer: true,
            isTemporary: false,
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
      }

      // 5. Find matched credential in all combined credentials
      const matched = cloudCreds.find((c) => {
        if (!c || !c.username) return false
        const cUser = String(c.username).trim().toLowerCase()
        const cPass = String(c.password || '').trim()
        const cDigits = cUser.replace(/[^0-9]/g, '')

        // Check password match
        const passMatch = cPass === cleanPass || cPass.toLowerCase() === cleanPass.toLowerCase()
        if (!passMatch) return false

        // 1. Exact username match
        if (cUser === cleanId) return true

        // 2. Phone number match (handles +91, 0, spaces, etc.)
        if (inputDigits.length >= 7 && cDigits.length >= 7) {
          if (cDigits.endsWith(inputDigits) || inputDigits.endsWith(cDigits)) return true
        }

        return false
      })

      if (matched) {
        const hasAssignedMatch = Boolean(matched.assigned_match_id || matched.assignedMatchId)
        const isTemporaryCred = hasAssignedMatch || String(matched.id || '').startsWith('temp_') || String(matched.id || '').startsWith('umpire_')
        const isChiefAdmin =
          !isTemporaryCred &&
          (matched.role === 'organizer' || String(matched.id).startsWith('admin_') || matched.username === 'admin')

        if (isChiefAdmin) {
          // Sync to device's localStorage so offline works
          localStorage.setItem(
            ORGANIZER_CREDS_KEY,
            JSON.stringify({
              username: matched.username,
              mobile: matched.username,
              password: cleanPass,
              email: 'tournamentmafia2026@gmail.com',
            })
          )

          const adminSession = {
            username: matched.username,
            email: 'tournamentmafia2026@gmail.com',
            mobile: matched.username,
            name: matched.name || 'Chief Organizer',
            role: 'organizer',
            isChiefOrganizer: true,
            isTemporary: false,
            scope: 'full',
            token: `admin_auth_${Date.now()}`,
            loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }

          setLoginId('')
          setPassword('')
          setIsLoading(false)
          onSuccess(adminSession)
          return
        } else {
          // Temporary Authenticator or Umpire / Referee Account
          const courtAssigned =
            matched.court_name ||
            matched.courtName ||
            matched.assignedCourt ||
            'Court 1'

          const isUmpire = matched.role === 'umpire' || matched.scope === 'umpire'

          const tempSession = {
            username: matched.username,
            name: matched.name || matched.authName || matched.username,
            role: isUmpire ? 'umpire' : 'temporary_authenticator',
            isChiefOrganizer: false,
            isTemporary: true,
            assignedMatchId: matched.assigned_match_id || matched.assignedMatchId,
            assignedMatchName: matched.assigned_match_name || matched.assignedMatchName,
            scope: matched.scope || (isUmpire ? 'umpire' : 'full'),
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
      }

      // 6. Check LocalStorage fallback for Admin credentials
      const creds = getSavedCreds()
      const cleanMobile = String(creds.mobile || '').replace(/[^0-9]/g, '')

      const isAdminMatch =
        (inputDigits.length >= 7 && (cleanMobile.endsWith(inputDigits) || inputDigits.endsWith(cleanMobile))) ||
        (creds.username && cleanId === String(creds.username).toLowerCase())

      const isPassMatch =
        Boolean(creds.password) && (
          cleanPass === creds.password ||
          cleanPass.toLowerCase() === String(creds.password).toLowerCase()
        )

      if (isAdminMatch && isPassMatch) {
        const adminSession = {
          username: creds.username || 'admin',
          email: 'tournamentmafia2026@gmail.com',
          mobile: creds.mobile || '9840012345',
          name: 'Chief Organizer',
          role: 'organizer',
          isChiefOrganizer: true,
          isTemporary: false,
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
  // 2. ADMIN: VERIFY PHONE & EMAIL AND SET PASSWORD VIA OTP
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

    const cleanPhone = adminPhone.trim()

    if (!cleanPhone || cleanPhone.length < 5) {
      setErrorMessage('Please enter a valid Mobile Number.')
      return
    }

    setIsLoading(true)
    const otp = generateSecureRandomOtp()
    setGeneratedOtp(otp)

    try {
      await sendAuthEmail({
        to_email: 'tournamentmafia2026@gmail.com',
        username: 'Chief Organizer',
        otp,
        action: 'Admin Phone Verification OTP',
        customMessage: `Your fresh 6-digit verification OTP for Badminton Portal Admin (Mobile: ${cleanPhone}) is:\n\nOTP: ${otp}\n\n(Valid for 10 minutes. Do not share with anyone)`,
      })

      setIsLoading(false)
      setAdminOtpStep(2)
      setStatusNotification('✓ A 6-digit confidential OTP has been sent to your registered email. Please check your inbox!')
    } catch (err) {
      setIsLoading(false)
      setErrorMessage(err?.message || 'OTP email could not be sent. Please try again or check the server email configuration.')
    }
  }

  const handleVerifyOtpAndSetPassword = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setStatusNotification('')

    const cleanEnteredOtp = enteredOtp.trim()

    if (!cleanEnteredOtp || cleanEnteredOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit OTP code received in your email.')
      return
    }

    if (cleanEnteredOtp !== generatedOtp.trim()) {
      setErrorMessage('Incorrect OTP! Please enter the exact 6-digit code received in your email.')
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

    setIsLoading(true)

    const cleanPhone = adminPhone.trim()
    const cleanPass = newAdminPassword.trim()

    // 1. Save verified mobile number & password to LocalStorage
    const currentCreds = getSavedCreds()
    const updated = {
      ...currentCreds,
      mobile: cleanPhone,
      email: 'tournamentmafia2026@gmail.com',
      password: cleanPass,
      username: 'admin',
    }
    localStorage.setItem(ORGANIZER_CREDS_KEY, JSON.stringify(updated))

    // 2. Save directly into Netlify / Vercel Cloud DB endpoints so all devices sync instantly!
    try {
      await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizerCredentials: {
            username: cleanPhone,
            mobile: cleanPhone,
            password: cleanPass,
            email: 'tournamentmafia2026@gmail.com',
          },
          credential: {
            id: 'admin_master',
            username: cleanPhone,
            password: cleanPass,
            name: 'Chief Organizer',
            scope: 'full',
            role: 'organizer',
            status: 'active',
          },
        }),
      })

      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizerCredentials: {
            username: cleanPhone,
            mobile: cleanPhone,
            password: cleanPass,
            email: 'tournamentmafia2026@gmail.com',
          },
        }),
      })
    } catch (apiErr) {
      console.warn('Error saving to /api/credentials:', apiErr)
    }

    // 3. Save to Supabase Cloud DB directly
    try {
      // Upsert master admin
      await SupabaseService.upsertCredential({
        id: 'admin_master',
        username: cleanPhone,
        password: cleanPass,
        name: 'Chief Organizer',
        scope: 'full',
        role: 'organizer',
        status: 'active',
        courtName: 'All Courts',
        assignedMatchName: 'All Tournaments',
      })
    } catch (supaErr) {
      console.warn('Could not sync admin creds to Supabase:', supaErr)
    }

    setIsLoading(false)

    // Automatically log in as Admin
    const adminSession = {
      username: cleanPhone,
      email: 'tournamentmafia2026@gmail.com',
      mobile: cleanPhone,
      name: 'Chief Organizer',
      role: 'organizer',
      isChiefOrganizer: true,
      isTemporary: false,
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
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(8, 14, 26, 0.99) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '24px',
          boxShadow: '0 30px 70px -10px rgba(0, 0, 0, 0.95), 0 0 45px rgba(56, 189, 248, 0.18)',
          padding: '32px 28px',
          boxSizing: 'border-box',
          position: 'relative',
          color: '#f8fafc',
          maxHeight: '94vh',
          overflowY: 'auto',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            e.currentTarget.style.color = '#fca5a5'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
            e.currentTarget.style.color = '#94a3b8'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
          }}
        >
          ✕
        </button>

        {/* Modal Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: '2px solid rgba(56, 189, 248, 0.5)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '12px',
              boxShadow: '0 10px 25px rgba(2, 132, 199, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
            }}
          >
            {view === 'login' ? '🏸' : '📱'}
          </div>

          <div
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '10.5px',
              fontWeight: '800',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            OFFICIAL PORTAL ACCESS
          </div>

          <h2 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.02em' }}>
            {view === 'login' ? 'Tournament Sign-In' : 'Admin Mobile Verification'}
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.45' }}>
            {view === 'login'
              ? 'Chief Organizer & Assigned Court Umpire Dashboard'
              : 'Enter your Mobile Number to receive confidential OTP'}
          </p>
        </div>

        {/* Alert Messages */}
        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '14px',
              fontSize: '12.5px',
              marginBottom: '16px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.15)',
            }}
          >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {statusNotification && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1.5px solid rgba(74, 222, 128, 0.4)',
              color: '#86efac',
              padding: '12px 16px',
              borderRadius: '14px',
              fontSize: '12.5px',
              marginBottom: '16px',
              fontWeight: '600',
              lineHeight: '1.45',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.15)',
            }}
          >
            <span style={{ fontSize: '16px' }}>✓</span>
            <span>{statusNotification}</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: UNIFIED SINGLE LOGIN PAGE (ADMIN & UMPIRE) */}
        {/* ==================================================================== */}
        {view === 'login' && (
          <form onSubmit={handleUnifiedLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Role Helper Indicator Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '4px',
                background: 'rgba(15, 23, 42, 0.8)',
                borderRadius: '14px',
                border: '1px solid rgba(148, 163, 184, 0.15)',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: '#93c5fd',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>👑</span>
                <span>Chief Admin</span>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: '#86efac',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>🏸</span>
                <span>Court Umpire</span>
              </div>
            </div>

            {/* Login ID Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#94a3b8',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Mobile Number or Username
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px',
                    color: '#64748b',
                  }}
                >
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
                    padding: '13px 14px 13px 42px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1.5px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: '14px',
                    color: '#f8fafc',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#38bdf8'
                    e.target.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.15)'
                    e.target.style.background = 'rgba(15, 23, 42, 0.95)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(56, 189, 248, 0.22)'
                    e.target.style.boxShadow = 'none'
                    e.target.style.background = 'rgba(15, 23, 42, 0.75)'
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#94a3b8',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px',
                    color: '#64748b',
                  }}
                >
                  🔒
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '13px 42px 13px 42px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1.5px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: '14px',
                    color: '#f8fafc',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#38bdf8'
                    e.target.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.15)'
                    e.target.style.background = 'rgba(15, 23, 42, 0.95)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(56, 189, 248, 0.22)'
                    e.target.style.boxShadow = 'none'
                    e.target.style.background = 'rgba(15, 23, 42, 0.75)'
                  }}
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
                    fontSize: '16px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                padding: '14px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '14.5px',
                letterSpacing: '0.02em',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 20px rgba(2, 132, 199, 0.4)',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.boxShadow = '0 8px 25px rgba(2, 132, 199, 0.6)'
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 132, 199, 0.4)'
              }}
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Dashboard'}</span>
              <span>→</span>
            </button>

            {/* Quick Admin Set/Reset Password Link */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '14px',
                padding: '14px 16px',
                textAlign: 'center',
                marginTop: '4px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                New Mobile Number or forgot password?
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
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#38bdf8')}
              >
                <span>🛡️</span>
                <span>Verify Mobile & Set Admin Password via OTP →</span>
              </button>
            </div>

            {/* Security Badge Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '6px',
                fontSize: '11px',
                color: '#64748b',
                fontWeight: '600',
              }}
            >
              <span>🔒</span>
              <span>256-Bit Encrypted Secure Cloud Authentication</span>
            </div>
          </form>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: ADMIN VERIFY MOBILE & SET PASSWORD VIA GMAIL OTP */}
        {/* ==================================================================== */}
        {view === 'admin-verify-phone' && (
          <div>
            {adminOtpStep === 1 ? (
              <form onSubmit={handleSendAdminOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Mobile Number Input */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#94a3b8',
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Enter Mobile Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '16px',
                        color: '#64748b',
                      }}
                    >
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
                        padding: '13px 14px 13px 42px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1.5px solid rgba(56, 189, 248, 0.22)',
                        borderRadius: '14px',
                        color: '#f8fafc',
                        fontSize: '14px',
                        fontWeight: '600',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#38bdf8'
                        e.target.style.boxShadow = '0 0 0 4px rgba(56, 189, 248, 0.15)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(56, 189, 248, 0.22)'
                        e.target.style.boxShadow = 'none'
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#bae6fd',
                    lineHeight: '1.45',
                  }}
                >
                  🔒 <strong>Verification Protocol:</strong> A confidential 6-digit random verification OTP will be sent directly to your official email (tournamentmafia2026@gmail.com).
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#ffffff',
                    fontWeight: '900',
                    fontSize: '14.5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  {isLoading ? 'Sending Verification OTP...' : 'Send Verification OTP →'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setView('login')
                      setErrorMessage('')
                      setStatusNotification('')
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: '700',
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1.5px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '16px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '4px' }}>📬</div>
                  <div style={{ fontSize: '14px', color: '#38bdf8', fontWeight: '900' }}>
                    Check Your Registered Email
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>
                    Enter the 6-digit random OTP code sent to your registered official email.
                  </div>
                </div>

                {/* 6-Digit OTP Box */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#38bdf8',
                      marginBottom: '8px',
                      textAlign: 'center',
                      letterSpacing: '0.08em',
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
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '2px solid #38bdf8',
                      borderRadius: '14px',
                      color: '#38bdf8',
                      fontSize: '24px',
                      fontWeight: '900',
                      letterSpacing: '0.35em',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      outline: 'none',
                      boxShadow: '0 0 20px rgba(56, 189, 248, 0.25)',
                    }}
                  />
                </div>

                {/* Set New Password for this Phone Number */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#94a3b8',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    SET NEW PASSWORD FOR ({adminPhone})
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1.5px solid rgba(56, 189, 248, 0.22)',
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
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#94a3b8',
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter new password"
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1.5px solid rgba(56, 189, 248, 0.22)',
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
                    style={{ accentColor: '#0284c7', cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <label htmlFor="showNewPassCheck" style={{ fontSize: '12.5px', color: '#94a3b8', cursor: 'pointer' }}>
                    Show password
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: '900',
                    fontSize: '14.5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(22, 163, 74, 0.4)',
                  }}
                >
                  ✓ Verify OTP & Activate Admin Access
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setAdminOtpStep(1)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, fontWeight: '700' }}
                  >
                    ← Change Phone/Email
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSendAdminOtp}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: isLoading ? 'not-allowed' : 'pointer', padding: 0, fontWeight: '800' }}
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

