import React, { useState, useEffect } from 'react'
import {
  formatTournamentName,
  formatCourtName,
  formatPersonName,
} from '../utils/textFormatters'
import { SupabaseService } from '../utils/supabaseDb'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

const TEMP_CREDS_STORAGE_KEY = 'badminton-temporary-credentials'
const ORGANIZER_SESSION_KEY = 'badminton-organizer-session'

export function BadmintonLoginsPage({
  publishedMatches = [],
  currentSession,
  onSessionChange,
  onNavigateToFixtures,
  onNavigateToNewMatch,
  onNavigateToMatchManagement,
  onBackToPublic,
}) {
  // Saved temporary credentials list
  const [tempCredsList, setTempCredsList] = useState(() => {
    try {
      const saved = localStorage.getItem(TEMP_CREDS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Form states for creating a new temporary login
  const [selectedMatchId, setSelectedMatchId] = useState(() => publishedMatches[0]?.id || '')
  const [authName, setAuthName] = useState('')
  const [customUsername, setCustomUsername] = useState('')
  const [customPassword, setCustomPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accessScope, setAccessScope] = useState('full') // 'full' | 'scorekeeper'
  const [expiryOption, setExpiryOption] = useState('24 Hours')
  const [toastMessage, setToastMessage] = useState(null)
  const [deleteCredConfirm, setDeleteCredConfirm] = useState(null)

  // Fetch from Supabase and server DB on mount
  useEffect(() => {
    const loadCreds = async () => {
      try {
        const supaCreds = await SupabaseService.getCredentials()
        if (supaCreds && Array.isArray(supaCreds) && supaCreds.length > 0) {
          const mapped = supaCreds.map((c) => ({
            id: c.id,
            username: c.username,
            password: c.password,
            name: c.name,
            assignedMatchId: c.assigned_match_id,
            assignedMatchName: c.assigned_match_name,
            courtName: c.court_name,
            assignedCourt: c.court_name,
            scope: c.scope || 'umpire',
            expiry: c.expiry || '24 Hours',
            role: c.role || 'umpire',
            status: c.status || 'active',
          }))
          setTempCredsList(mapped)
          try {
            localStorage.setItem(TEMP_CREDS_STORAGE_KEY, JSON.stringify(mapped))
          } catch (e) {}
          return
        }
      } catch (err) {}

      fetch('/api/tournaments')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.temporaryCredentials)) {
            setTempCredsList(data.temporaryCredentials)
            localStorage.setItem(TEMP_CREDS_STORAGE_KEY, JSON.stringify(data.temporaryCredentials))
          }
        })
        .catch(() => {})
    }
    loadCreds()
  }, [])

  // Save to localStorage, server DB, and Supabase when list changes
  const saveTempCreds = (newList) => {
    setTempCredsList(newList)
    try {
      localStorage.setItem(TEMP_CREDS_STORAGE_KEY, JSON.stringify(newList))
    } catch (e) {}

    fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temporaryCredentials: newList }),
    }).catch(() => {})

    // Upsert active credentials to Supabase
    if (Array.isArray(newList)) {
      newList.forEach((cred) => {
        SupabaseService.upsertCredential(cred).catch(() => {})
      })
    }
  }

  // Auto-generate random username and password
  const handleAutoGenerate = () => {
    const targetMatch = publishedMatches.find((m) => String(m.id) === String(selectedMatchId))
    const prefix = targetMatch
      ? targetMatch.matchName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)
      : 'court'
    const randomNum = Math.floor(100 + Math.random() * 900)
    const genUser = `${prefix}_ref${randomNum}`
    const genPass = `bwf${Math.floor(1000 + Math.random() * 9000)}`

    setCustomUsername(genUser)
    setCustomPassword(genPass)
    if (!authName) {
      setAuthName(`Match Official #${randomNum}`)
    }
  }

  // Quick Preset: Auto-Generate Court Specific Umpire
  const handleGenerateCourtUmpire = (courtNumber = 1) => {
    setAccessScope('umpire')
    setAuthName(`Court ${courtNumber} Live Umpire`)
    setCustomUsername(`umpire_c${courtNumber}_${Math.floor(10 + Math.random() * 90)}`)
    setCustomPassword(`pass${courtNumber}${Math.floor(100 + Math.random() * 900)}`)
    setToastMessage(`⚡ Court ${courtNumber} Umpire credentials ready!`)
  }

  // Create Temporary Credential
  const handleCreateTempLogin = (e) => {
    e.preventDefault()

    if (!selectedMatchId) {
      setToastMessage('⚠️ Please select a tournament / match for this login.')
      return
    }

    const targetMatch = publishedMatches.find((m) => String(m.id) === String(selectedMatchId))
    if (!targetMatch) {
      setToastMessage('⚠️ Selected match not found.')
      return
    }

    const uName = customUsername.trim().toLowerCase() || `ref_${Math.floor(1000 + Math.random() * 9000)}`
    const pWord = customPassword.trim() || `pass_${Math.floor(1000 + Math.random() * 9000)}`
    const displayName = formatPersonName(authName.trim() || `Official (${formatTournamentName(targetMatch.matchName).slice(0, 14)})`)

    // Check duplicate username
    if (tempCredsList.some((c) => c.username.toLowerCase() === uName.toLowerCase())) {
      setToastMessage('⚠️ This Username already exists. Please pick another.')
      return
    }

    const newCred = {
      id: `temp_${Date.now()}`,
      username: uName,
      password: pWord,
      name: displayName,
      assignedMatchId: targetMatch.id,
      assignedMatchName: formatTournamentName(targetMatch.matchName),
      courtName: formatCourtName(targetMatch.courtName || 'Court 1'),
      scope: accessScope,
      expiry: expiryOption,
      role: accessScope === 'umpire' ? 'umpire' : 'temporary_authenticator',
      createdAt: new Date().toLocaleDateString('en-GB'),
      status: 'active',
    }

    const updated = [newCred, ...tempCredsList]
    saveTempCreds(updated)

    // Reset form
    setAuthName('')
    setCustomUsername('')
    setCustomPassword('')
    setToastMessage(`✓ Temporary Login created for "${formatTournamentName(targetMatch.matchName)}"!`)
  }

  // Delete / Revoke Credential
  const handleDeleteCred = (id) => {
    const toDelete = tempCredsList.find((c) => c.id === id)
    const updated = tempCredsList.filter((c) => c.id !== id)
    saveTempCreds(updated)
    if (toDelete) {
      SupabaseService.deleteCredential(toDelete.id || toDelete.username).catch(() => {})
    }
    setToastMessage('Temporary login revoked.')
  }

  // Copy Login Details to clipboard
  const handleCopyDetails = (cred) => {
    const text = `🏸 BADMINTON MAFIA - MATCH LOGIN CREDENTIALS
Tournament: ${cred.assignedMatchName}
Role / Official: ${cred.name}
Username: ${cred.username}
Password: ${cred.password}
Access Scope: ${cred.scope === 'full' ? 'Full Match & Fixtures Management' : 'Scorekeeper Only'}
Expires In: ${cred.expiry}
Login Portal: ${window.location.origin}/`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setToastMessage(`📋 Credentials copied for ${cred.username}!`)
    } else {
      setToastMessage(`Username: ${cred.username} | Password: ${cred.password}`)
    }
  }

  // Instant Test Login as this Authenticator / Umpire
  const handleTestLoginAs = (cred) => {
    const isUmpire = cred.scope === 'umpire' || cred.role === 'umpire'
    const session = {
      username: cred.username,
      name: cred.name,
      role: isUmpire ? 'umpire' : 'temporary_authenticator',
      assignedMatchId: cred.assignedMatchId,
      assignedMatchName: cred.assignedMatchName,
      scope: cred.scope,
      loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    localStorage.setItem(ORGANIZER_SESSION_KEY, JSON.stringify(session))
    if (onSessionChange) onSessionChange(session)
    setToastMessage(`✓ Switched to ${isUmpire ? '🏸 Court Umpire Live Scorer' : 'Temporary Session'} for "${cred.assignedMatchName}"`)

    if (!isUmpire && onNavigateToFixtures) {
      setTimeout(() => onNavigateToFixtures(cred.assignedMatchId), 300)
    }
  }

  // Clear toast after 3.5s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  return (
    <div style={{ width: '100%', maxWidth: '1140px', margin: '0 auto', padding: '16px 12px 48px', boxSizing: 'border-box' }}>
      {/* Toast message */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid #38bdf8',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.35)',
            color: '#e0f2fe',
            padding: '12px 22px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '800',
            zIndex: 99999,
            animation: 'fadeIn 0.2s ease',
            backdropFilter: 'blur(10px)',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Header Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
          border: '1.5px solid rgba(251, 191, 36, 0.28)',
          borderRadius: '20px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 24px rgba(245, 158, 11, 0.08)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.15) 100%)',
                border: '1.5px solid rgba(251, 191, 36, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
              }}
            >
              🔑
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Temporary Match Logins & Authenticator Manager
                </h1>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
                  }}
                >
                  Match-Scoped Access
                </span>
              </div>
              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px', lineHeight: 1.4 }}>
                Create temporary delegate credentials for tournament umpires, scorekeepers, and coordinators with time-limited access.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToPublic}
          style={{
            padding: '9px 18px',
            borderRadius: '12px',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#cbd5e1',
            fontSize: '12.5px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#60a5fa'
            e.currentTarget.style.color = '#ffffff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)'
            e.currentTarget.style.color = '#cbd5e1'
          }}
        >
          <span>👁️</span>
          <span>Back to Public Feed</span>
        </button>
      </div>

      {/* Active Session Warning / Info Banner */}
      {currentSession && currentSession.role === 'temporary_authenticator' && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.18) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1.5px solid rgba(234, 179, 8, 0.5)',
            borderRadius: '16px',
            padding: '14px 22px',
            marginBottom: '22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(234, 179, 8, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🔒</span>
            <div>
              <strong style={{ color: '#facc15', fontSize: '13.5px', display: 'block' }}>
                Active Temporary Session: {currentSession.name} ({currentSession.username})
              </strong>
              <span style={{ color: '#cbd5e1', fontSize: '12px' }}>
                Restricted strictly to: <strong style={{ color: '#60a5fa' }}>{currentSession.assignedMatchName}</strong>.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const adminSession = {
                username: 'admin',
                role: 'organizer',
                loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              }
              localStorage.setItem(ORGANIZER_SESSION_KEY, JSON.stringify(adminSession))
              if (onSessionChange) onSessionChange(adminSession)
              setToastMessage('Switched back to Full Admin Mode.')
            }}
            style={{
              padding: '7px 16px',
              borderRadius: '999px',
              border: '1px solid rgba(234, 179, 8, 0.6)',
              background: 'rgba(234, 179, 8, 0.25)',
              color: '#fef08a',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            👑 Switch to Full Admin
          </button>
        </div>
      )}

      {/* Main Grid: Generator Form + Active Credentials List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
        {/* Left Column: Create Temporary Login Form */}
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1.5px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>➕</span> Create Temporary Login
            </h3>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleGenerateCourtUmpire(1)}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  borderRadius: '999px',
                  color: '#6ee7b7',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Create Court 1 Umpire Live Scorer login"
              >
                <span>🏸</span> C1 Umpire
              </button>
              <button
                type="button"
                onClick={() => handleGenerateCourtUmpire(2)}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  borderRadius: '999px',
                  color: '#6ee7b7',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Create Court 2 Umpire Live Scorer login"
              >
                <span>🏸</span> C2 Umpire
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(96, 165, 250, 0.45)',
                  borderRadius: '999px',
                  color: '#93c5fd',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>⚡</span> Random ID
              </button>
            </div>
          </div>

          <form onSubmit={handleCreateTempLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Step 1: Select Match to Grant Access */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                1. Select Tournament / Match
              </label>
              <select
                required
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1.5px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  fontWeight: '700',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              >
                {publishedMatches.length === 0 && <option value="">No published tournaments found</option>}
                {publishedMatches.map((m) => (
                  <option key={m.id} value={m.id}>
                    🏸 {formatTournamentName(m.matchName)} ({formatCourtName(m.courtName || 'Court 1')})
                  </option>
                ))}
              </select>
            </div>

            {/* Authenticator Name / Role */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                2. Official Name / Role Label
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Court 1 Live Umpire or Table Referee"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Username & Password Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Temporary Username
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="e.g. umpire_court1"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 12px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Password / PIN
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="••••••••"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 36px 11px 12px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(148, 163, 184, 0.25)',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
            </div>

            {/* Access Scope & Expiry */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Access Scope
                </label>
                <select
                  value={accessScope}
                  onChange={(e) => setAccessScope(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="umpire">🏸 Court Umpire & Live Scorer (Mobile Scoreboard)</option>
                  <option value="full">👑 Full Match & Tournament Manager</option>
                  <option value="scorekeeper">📝 Desk Coordinator & Scorekeeper</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Valid Duration
                </label>
                <select
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  <option value="12 Hours">12 Hours</option>
                  <option value="24 Hours">24 Hours (1 Day)</option>
                  <option value="3 Days">3 Days</option>
                  <option value="Until Finished">Until Tournament Ends</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary-gradient"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: '800',
                marginTop: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
              }}
            >
              ✓ Generate & Save Temporary Login
            </button>
          </form>
        </div>

        {/* Right Column: Active Temporary Credentials List */}
        <div
          style={{
            background: 'linear-gradient(160deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1.5px solid rgba(148, 163, 184, 0.25)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 10px 32px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📋</span> Active Temporary Logins ({tempCredsList.length})
            </h3>
            <span
              style={{
                fontSize: '11px',
                color: '#38bdf8',
                fontWeight: '800',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              Scoped Delegations
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '460px', overflowY: 'auto', paddingRight: '4px' }}>
            {tempCredsList.length > 0 ? (
              tempCredsList.map((cred) => (
                <div
                  key={cred.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1.5px solid rgba(59, 130, 246, 0.28)',
                    borderRadius: '14px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '13.5px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatPersonName(cred.name)}
                        </strong>
                        {(cred.scope === 'umpire' || cred.role === 'umpire') && (
                          <span
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              fontSize: '9.5px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: '1px solid rgba(239, 68, 68, 0.4)',
                              letterSpacing: '0.04em',
                            }}
                          >
                            🔴 LIVE UMPIRE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#60a5fa', fontWeight: '700', display: 'block', marginTop: '2px' }}>
                        🏸 {formatTournamentName(cred.assignedMatchName)}
                      </span>
                    </div>

                    <span
                      style={{
                        background: 'rgba(34, 197, 94, 0.18)',
                        color: '#4ade80',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(34, 197, 94, 0.35)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ✓ {cred.expiry}
                    </span>
                  </div>

                  {/* Credentials Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(15, 23, 42, 0.95)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px dashed rgba(148, 163, 184, 0.3)',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ color: '#94a3b8' }}>User: </span>
                      <strong style={{ color: '#e0f2fe' }}>{cred.username}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Pass: </span>
                      <strong style={{ color: '#facc15' }}>{cred.password}</strong>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyDetails(cred)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#93c5fd',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      📋 Copy
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTestLoginAs(cred)}
                      style={{
                        flex: 1.3,
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: cred.scope === 'umpire' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(34, 197, 94, 0.4)',
                        background: cred.scope === 'umpire' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                        color: cred.scope === 'umpire' ? '#fca5a5' : '#86efac',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {cred.scope === 'umpire' ? '🏸 Live Scoreboard' : '🚀 Login As'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteCredConfirm(cred)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#fca5a5',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                      title="Revoke access"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <span style={{ fontSize: '30px', display: 'block', marginBottom: '8px' }}>🏸</span>
                No temporary logins created yet. Use the form on the left to create one.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete / Revoke Credential Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteCredConfirm}
        title="Revoke Official Login?"
        message={`Are you sure you want to revoke and delete login credentials for "${deleteCredConfirm?.name || deleteCredConfirm?.username}"? This official will no longer be able to log in.`}
        itemName={deleteCredConfirm?.username}
        confirmText="🗑️ Yes, Revoke Login"
        cancelText="✕ Cancel"
        onConfirm={() => {
          if (deleteCredConfirm) {
            handleDeleteCred(deleteCredConfirm.id)
            setDeleteCredConfirm(null)
          }
        }}
        onClose={() => setDeleteCredConfirm(null)}
      />
    </div>
  )
}
