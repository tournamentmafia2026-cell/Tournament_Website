import React, { useState } from 'react'
import {
  formatTournamentName,
  formatCourtName,
  formatPersonName,
  formatAddress,
  formatPlaceOrClub,
  formatCategoryName,
  getMatchStatus,
  splitDoublesNames,
  joinDoublesNames,
} from '../utils/textFormatters'
import {
  getMatchCategories,
  isDoublesCategory,
} from '../utils/badmintonCategories'
import { isChiefOrganizerSession } from '../hooks/useOrganizerAuth'

const formatDisplayDate = (dateString) => {
  if (!dateString) return 'Date'
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function MatchManagementView({
  effectivePublishedMatches = [],
  selectedMatch,
  setSelectedMatch,
  authenticators = {},
  activeCategory,
  setActiveCategory,
  participantForm,
  setParticipantForm,
  editingParticipantId,
  setEditingParticipantId,
  onAddParticipant,
  onResetParticipantForm,
  onOpenModifyModal,
  onRemoveParticipant,
  onOpenEditMatchModal,
  onDeleteMatch,
  onStartLiveStream,
  authSession,
  successToast,
}) {
  const [playerFilterSearch, setPlayerFilterSearch] = useState('')
  const isChief = isChiefOrganizerSession(authSession)
  const selectedMatchCategories = selectedMatch ? getMatchCategories(selectedMatch) : []

  const handleSelectMatch = (match) => {
    if (!isChief && authSession?.assignedMatchId) {
      if (match && String(match.id) !== String(authSession.assignedMatchId)) return
    }
    setSelectedMatch(match)
    if (match) {
      const cats = getMatchCategories(match)
      const initialCat = cats[0] || 'Men Singles'
      setActiveCategory(initialCat)
      setParticipantForm({ name: '', name1: '', name2: '', court: '', place: '', category: initialCat })
    }
    setEditingParticipantId(null)
  }

  return (
    <div className="auth-card auth-management">
      {selectedMatch && (
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setSelectedMatch(null)
              setEditingParticipantId(null)
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(96, 165, 250, 0.35)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)')}
          >
            ← Back to Matches
          </button>
        </div>
      )}

      <h2>Match Management</h2>

      {!selectedMatch ? (
        <div className="management-list" style={{ overflowX: 'auto' }}>
          {effectivePublishedMatches.length > 0 ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              {effectivePublishedMatches.map((match) => {
                const status = getMatchStatus(match)
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)

                return (
                  <div
                    key={match.id}
                    className="flex flex-col md:grid md:grid-cols-[1.6fr_1fr_1.2fr_auto] gap-3.5 p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-sky-400/50 transition shadow-lg"
                  >
                    <div onClick={() => handleSelectMatch(match)} style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, cursor: 'pointer' }}>
                      {match.image ? (
                        <img src={match.image} alt={match.matchName} style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }} />
                      ) : (
                        <div style={{ width: '52px', height: '52px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(100, 116, 139, 0.35)', color: '#cbd5e1', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>IMG</div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: '700' }}>Tournament</div>
                        <strong style={{ display: 'block', color: '#f8fafc', fontSize: '15px', fontWeight: '800', letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {formatTournamentName(match.matchName)}
                        </strong>
                      </div>
                    </div>

                    <div onClick={() => handleSelectMatch(match)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontWeight: '700' }}>Court</div>
                      <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '13px' }}>{formatCourtName(match.courtName)}</div>
                    </div>

                    <div onClick={() => handleSelectMatch(match)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Dates</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: status === 'completed' ? 'rgba(168,85,247,0.2)' : status === 'ongoing' ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.18)',
                          color: status === 'completed' ? '#d8b4fe' : status === 'ongoing' ? '#86efac' : '#93c5fd',
                          fontSize: '9.5px',
                          fontWeight: '800',
                          letterSpacing: '0.04em',
                        }}>{status === 'completed' ? '🏆 Completed' : statusLabel}</span>
                      </div>

                      <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '10.5px', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                        {formatDisplayDate(match.startDate)} - {formatDisplayDate(match.endDate)}
                      </div>

                      {match.categoryWinners && Object.keys(match.categoryWinners).length > 0 ? (
                        <div style={{ fontSize: '11px', color: '#fde047', fontWeight: '700', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {Object.entries(match.categoryWinners).map(([cat, wName]) => (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#cbd5e1', fontSize: '10.5px' }}>🏸 {cat}:</span>
                              <span style={{ color: '#fef08a', fontWeight: '800' }}>{wName}</span>
                            </div>
                          ))}
                        </div>
                      ) : match.winner ? (
                        <div style={{ fontSize: '11px', color: '#fde047', fontWeight: '800', marginTop: '3px' }}>
                          🏆 Winner: {match.winner}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        title="Start TV Live Stream Broadcast for this tournament"
                        onClick={(event) => {
                          event.stopPropagation()
                          onStartLiveStream?.(match)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(239, 68, 68, 0.6)',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.4) 100%)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 0 10px rgba(239, 68, 68, 0.25)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        🔴 Live Stream
                      </button>

                      <button
                        type="button"
                        title="Edit Match Details & Categories"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpenEditMatchModal(match)
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1px solid rgba(248, 113, 113, 0.6)',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.25) 100%)',
                          color: '#fca5a5',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        ⚙️ Match Manage
                      </button>

                      {isChief && (
                        <button
                          type="button"
                          aria-label={`Delete ${match.matchName}`}
                          title="Delete match"
                          onClick={(event) => {
                            event.stopPropagation()
                            onDeleteMatch(match)
                          }}
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            border: '1px solid rgba(248, 113, 113, 0.5)',
                            background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.9), rgba(69, 10, 10, 0.9))',
                            color: '#fecaca',
                            cursor: 'pointer',
                            fontSize: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            boxShadow: '0 0 0 1px rgba(248, 113, 113, 0.12)',
                          }}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="list-item" style={{ padding: '16px', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <span style={{ color: '#94a3b8' }}>No Matches Published</span>
              <strong style={{ color: '#cbd5e1' }}>Publish a match to view it here.</strong>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Tournament Hero Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(20, 32, 54, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '20px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              {selectedMatch.image ? (
                <img
                  src={selectedMatch.image}
                  alt={selectedMatch.matchName}
                  style={{
                    width: '60px',
                    height: '60px',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(56, 189, 248, 0.35)',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%)',
                    border: '1.5px solid rgba(56, 189, 248, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  🏸
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: '900',
                      color: '#ffffff',
                      letterSpacing: '-0.01em',
                      fontFamily: 'var(--font-heading)',
                    }}
                  >
                    {formatTournamentName(selectedMatch.matchName)}
                  </h3>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background:
                        getMatchStatus(selectedMatch) === 'completed'
                          ? 'rgba(168, 85, 247, 0.25)'
                          : getMatchStatus(selectedMatch) === 'ongoing'
                          ? 'rgba(34, 197, 94, 0.2)'
                          : 'rgba(59, 130, 246, 0.2)',
                      color:
                        getMatchStatus(selectedMatch) === 'completed'
                          ? '#d8b4fe'
                          : getMatchStatus(selectedMatch) === 'ongoing'
                          ? '#86efac'
                          : '#93c5fd',
                      fontSize: '11px',
                      fontWeight: '800',
                      border:
                        getMatchStatus(selectedMatch) === 'completed'
                          ? '1px solid rgba(168, 85, 247, 0.4)'
                          : getMatchStatus(selectedMatch) === 'ongoing'
                          ? '1px solid rgba(34, 197, 94, 0.4)'
                          : '1px solid rgba(59, 130, 246, 0.4)',
                    }}
                  >
                    {getMatchStatus(selectedMatch) === 'completed'
                      ? '🏆 Completed'
                      : getMatchStatus(selectedMatch) === 'ongoing'
                      ? '🟢 Ongoing'
                      : '📅 Upcoming'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12.5px', color: '#cbd5e1' }}>
                  {selectedMatch.courtName && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span>🏟️</span>
                      <strong style={{ color: '#f1f5f9' }}>{formatCourtName(selectedMatch.courtName)}</strong>
                    </span>
                  )}
                  {selectedMatch.matchAddress && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#94a3b8' }}>
                      <span>📍</span>
                      <span>{formatAddress(selectedMatch.matchAddress)}</span>
                    </span>
                  )}
                  {(selectedMatch.startDate || selectedMatch.endDate) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#38bdf8', fontWeight: '700', fontSize: '11.5px' }}>
                      <span>📅</span>
                      <span>{formatDisplayDate(selectedMatch.startDate)} - {formatDisplayDate(selectedMatch.endDate)}</span>
                    </span>
                  )}
                </div>

                {selectedMatch.categoryWinners && Object.keys(selectedMatch.categoryWinners).length > 0 ? (
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.entries(selectedMatch.categoryWinners).map(([cat, wName]) => (
                      <span
                        key={cat}
                        style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          border: '1px solid rgba(234, 179, 8, 0.4)',
                          color: '#fef08a',
                          fontSize: '11.5px',
                          fontWeight: '800',
                        }}
                      >
                        🏆 {cat}: {wName}
                      </span>
                    ))}
                  </div>
                ) : selectedMatch.winner ? (
                  <div style={{ fontSize: '12px', color: '#fde047', fontWeight: '800', marginTop: '6px' }}>
                    🏆 Tournament Winner: {selectedMatch.winner}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                title="Start Stadium TV Live Stream for this tournament"
                onClick={() => onStartLiveStream?.(selectedMatch)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #ef4444',
                  background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                🔴 Live Stream
              </button>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                  Registered Players
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <h4 style={{ color: '#e2e8f0', margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏸 Add Players to Match
              </h4>
              <span style={{ fontSize: '12px', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '4px 10px', borderRadius: '999px', fontWeight: '600' }}>
                Total Registered: {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length} Players
              </span>
            </div>

            {/* Category Selection Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Category:</span>
              <button
                type="button"
                onClick={() => setActiveCategory('ALL')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  background: activeCategory === 'ALL' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(15, 23, 42, 0.75)',
                  border: activeCategory === 'ALL' ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.35)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🌐 All Categories</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '999px', fontSize: '10px' }}>
                  {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).length}
                </span>
              </button>

              {selectedMatchCategories.map((category) => {
                const count = (authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).filter(
                  (p) => (p.category || selectedMatchCategories[0]) === category
                ).length
                const isCatActive = (activeCategory || selectedMatchCategories[0]) === category
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setActiveCategory(category)
                      setParticipantForm((prev) => {
                        const isNowDoubles = isDoublesCategory(category)
                        if (isNowDoubles) {
                          const [s1, s2] = splitDoublesNames(prev.name || '')
                          return {
                            ...prev,
                            category,
                            name1: prev.name1 || s1,
                            name2: prev.name2 || s2,
                          }
                        }
                        return {
                          ...prev,
                          category,
                          name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
                        }
                      })
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '999px',
                      background: isCatActive ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(15, 23, 42, 0.75)',
                      border: isCatActive ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.35)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>🏸 {category}</span>
                    <span style={{ background: isCatActive ? 'rgba(255,255,255,0.25)' : 'rgba(148, 163, 184, 0.2)', padding: '2px 6px', borderRadius: '999px', fontSize: '10px' }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Success Toast */}
            {successToast && (
              <div
                style={{
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✨</span>
                <span>{successToast}</span>
              </div>
            )}

            {/* Add / Modify Player Input Row */}
            {(() => {
              const effectiveFormCategory = (activeCategory && activeCategory !== 'ALL')
                ? activeCategory
                : (participantForm?.category || selectedMatchCategories[0] || 'Men Singles')
              const isFormDoubles = isDoublesCategory(effectiveFormCategory)
              const isFormValid = isFormDoubles
                ? Boolean((String(participantForm?.name1 || '').trim() && String(participantForm?.name2 || '').trim()) || String(participantForm?.name || '').trim())
                : Boolean(String(participantForm?.name || '').trim() || String(participantForm?.name1 || '').trim())

              return (
                <div style={{ background: 'rgba(15, 23, 42, 0.45)', padding: '16px', borderRadius: '12px', border: isFormDoubles ? '1.5px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(148, 163, 184, 0.15)', boxShadow: isFormDoubles ? '0 4px 20px rgba(168, 85, 247, 0.08)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: isFormDoubles ? '#d8b4fe' : '#93c5fd' }}>
                        {editingParticipantId
                          ? (isFormDoubles ? '✏️ Modify Doubles Pair' : '✏️ Modify Player')
                          : (isFormDoubles ? '👥 Add New Doubles Pair' : '👤 Add New Player')}
                      </span>
                      {isFormDoubles && (
                        <span style={{ fontSize: '10.5px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid #c084fc', color: '#f3e8ff', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' }}>
                          2 Name Inputs Required (Player 1 & Partner)
                        </span>
                      )}
                    </div>
                    {editingParticipantId && (
                      <button
                        type="button"
                        onClick={onResetParticipantForm}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#fca5a5',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontWeight: '700',
                        }}
                      >
                        ✕ Cancel Editing
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isFormDoubles ? '1fr 1fr 120px 140px auto' : '1.5fr 120px 140px auto', gap: '10px', alignItems: 'flex-end' }}>
                    {isFormDoubles ? (
                      <>
                        <label style={{ color: '#cbd5e1' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '12.5px', color: '#60a5fa' }}>
                            👤 Player 1 Name <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                          </span>
                          <input 
                            type="text"
                            value={participantForm?.name1 || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setParticipantForm((prev) => ({
                                ...prev,
                                name1: val,
                                name: joinDoublesNames(val, prev?.name2),
                              }))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                onAddParticipant()
                              }
                            }}
                            placeholder="e.g. Satwiksairaj (Player 1)"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              marginTop: '6px',
                              border: !String(participantForm?.name1 || '').trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(15, 23, 42, 0.85)',
                              color: '#f8fafc',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </label>

                        <label style={{ color: '#cbd5e1' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '12.5px', color: '#c084fc' }}>
                            👥 Player 2 Name (Partner) <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                          </span>
                          <input 
                            type="text"
                            value={participantForm?.name2 || ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setParticipantForm((prev) => ({
                                ...prev,
                                name2: val,
                                name: joinDoublesNames(prev?.name1, val),
                              }))
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                onAddParticipant()
                              }
                            }}
                            placeholder="e.g. Chirag Shetty (Player 2)"
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              marginTop: '6px',
                              border: !String(participantForm?.name2 || '').trim() ? '1px solid rgba(192, 132, 252, 0.3)' : '1.5px solid rgba(168, 85, 247, 0.8)',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(15, 23, 42, 0.85)',
                              color: '#f8fafc',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </label>
                      </>
                    ) : (
                      <label style={{ color: '#cbd5e1' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', fontSize: '13px', color: '#f8fafc' }}>
                          Player Name <span style={{ color: '#f87171', fontSize: '14px' }} title="Mandatory">*</span>
                        </span>
                        <input 
                          type="text"
                          value={participantForm?.name || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setParticipantForm((prev) => ({
                              ...prev,
                              name: val,
                              name1: val,
                              name2: '',
                            }))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              onAddParticipant()
                            }
                          }}
                          placeholder="Enter player name (Mandatory)"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            marginTop: '6px',
                            border: !String(participantForm?.name || '').trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1px solid rgba(59, 130, 246, 0.8)',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)',
                            color: '#f8fafc',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </label>
                    )}

                    <label style={{ color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                        Category
                      </span>
                      <select
                        value={(activeCategory && activeCategory !== 'ALL') ? activeCategory : (participantForm.category || selectedMatchCategories[0])}
                        onChange={(e) => {
                          const newCat = e.target.value
                          setActiveCategory(newCat)
                          setParticipantForm((prev) => {
                            const isNowDoubles = isDoublesCategory(newCat)
                            if (isNowDoubles) {
                              const [s1, s2] = splitDoublesNames(prev.name || '')
                              return {
                                ...prev,
                                category: newCat,
                                name1: prev.name1 || s1,
                                name2: prev.name2 || s2,
                              }
                            }
                            return {
                              ...prev,
                              category: newCat,
                              name: prev.name1 ? (prev.name2 ? `${prev.name1} / ${prev.name2}` : prev.name1) : prev.name,
                            }
                          })
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          marginTop: '6px',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          color: '#f8fafc',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        {selectedMatchCategories.map((c) => (
                          <option key={c} value={c} style={{ background: '#0f172a', color: '#f8fafc' }}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                        Court Name <span style={{ fontSize: '11px', color: '#64748b' }}>(Optional)</span>
                      </span>
                      <input 
                        type="text"
                        value={participantForm.court}
                        onChange={(e) => setParticipantForm({ ...participantForm, court: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            onAddParticipant()
                          }
                        }}
                        placeholder="Optional (e.g. Court 1)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          marginTop: '6px',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          color: '#e2e8f0',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>

                    <label style={{ color: '#94a3b8' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12.5px', fontWeight: '500' }}>
                        Place <span style={{ fontSize: '11px', color: '#64748b' }}>(Optional)</span>
                      </span>
                      <input 
                        type="text"
                        value={participantForm.place}
                        onChange={(e) => setParticipantForm({ ...participantForm, place: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            onAddParticipant()
                          }
                        }}
                        placeholder="Optional (e.g. Chennai)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          marginTop: '6px',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          color: '#e2e8f0',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </label>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={onAddParticipant}
                        disabled={!isFormValid}
                        style={{
                          padding: '10px 20px',
                          background: isFormValid
                            ? (isFormDoubles
                              ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                            : 'rgba(100, 116, 139, 0.3)',
                          color: isFormValid ? '#ffffff' : '#64748b',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: isFormValid ? 'pointer' : 'not-allowed',
                          fontWeight: '700',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          height: '42px',
                          boxShadow: isFormValid ? (isFormDoubles ? '0 2px 8px rgba(168, 85, 247, 0.4)' : '0 2px 8px rgba(37, 99, 235, 0.4)') : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {editingParticipantId
                          ? (isFormDoubles ? '✓ Save Doubles Pair' : '✓ Save Changes')
                          : (isFormDoubles ? '+ Add Doubles Pair' : '+ Add Player')}
                      </button>

                      {editingParticipantId && (
                        <button
                          type="button"
                          onClick={onResetParticipantForm}
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(148, 163, 184, 0.2)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            height: '42px',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Players List Table */}
          <div style={{ marginTop: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ color: '#f8fafc', margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋</span>
                  <span>Registered Players</span>
                  <span style={{ background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '800' }}>
                    {(authenticators[selectedMatch?.id] || authenticators[String(selectedMatch?.id)] || selectedMatch?.authenticators || selectedMatch?.participants || []).filter((p) => activeCategory === 'ALL' || (p.category || selectedMatchCategories[0]) === (activeCategory || selectedMatchCategories[0])).length}
                  </span>
                </h4>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                  Viewing: <strong style={{ color: '#7dd3fc' }}>{activeCategory === 'ALL' ? 'All Tournament Categories' : (activeCategory || selectedMatchCategories[0])}</strong>
                </div>
              </div>

              {/* Instant Search Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative', minWidth: '250px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Search name, partner, club..."
                    value={playerFilterSearch}
                    onChange={(e) => setPlayerFilterSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 30px 8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                  {playerFilterSearch && (
                    <button
                      type="button"
                      onClick={() => setPlayerFilterSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#334155',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: 0,
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table of Players */}
            {(() => {
              const matchKey = selectedMatch?.id
              const allList = (matchKey !== undefined && matchKey !== null)
                ? (
                    (authenticators && (authenticators[matchKey] || authenticators[String(matchKey)] || authenticators[Number(matchKey)])) ||
                    (selectedMatch && (selectedMatch.authenticators || selectedMatch.participants)) ||
                    []
                  )
                : []
              const categoryOrderMap = {}
              selectedMatchCategories.forEach((cat, idx) => {
                categoryOrderMap[cat] = idx
              })

              const filtered = allList
                .filter((participant) => {
                  const cat = String(participant?.category || selectedMatchCategories[0] || 'Men Singles').trim()
                  const activeCatStr = typeof activeCategory === 'string' ? activeCategory.trim() : (activeCategory || 'ALL')
                  const matchesCat = !activeCatStr || activeCatStr === 'ALL' || cat.toLowerCase() === activeCatStr.toLowerCase()
                  if (!matchesCat) return false

                  const searchStr = typeof playerFilterSearch === 'string' ? playerFilterSearch.trim() : ''
                  if (!searchStr) return true
                  const query = searchStr.toLowerCase()
                  const nameMatch = (participant?.name || '').toLowerCase().includes(query)
                  const placeMatch = (participant?.place || '').toLowerCase().includes(query)
                  const courtMatch = (participant?.court || '').toLowerCase().includes(query)
                  const catMatch = cat.toLowerCase().includes(query)
                  return nameMatch || placeMatch || courtMatch || catMatch
                })
                .sort((a, b) => {
                  const catA = a.category || selectedMatchCategories[0] || ''
                  const catB = b.category || selectedMatchCategories[0] || ''

                  if (activeCategory === 'ALL' && catA !== catB) {
                    const orderA = categoryOrderMap[catA] ?? 99
                    const orderB = categoryOrderMap[catB] ?? 99
                    if (orderA !== orderB) return orderA - orderB
                    return catA.localeCompare(catB)
                  }

                  if (a.seed && b.seed) return Number(a.seed) - Number(b.seed)
                  if (a.seed) return -1
                  if (b.seed) return 1

                  return (a.name || '').localeCompare(b.name || '')
                })

              if (filtered.length === 0) {
                return (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '14px', color: '#94a3b8', border: '1.5px dashed rgba(148, 163, 184, 0.22)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏸</div>
                    <div style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '15px' }}>
                      {playerFilterSearch ? `No players found matching "${playerFilterSearch}"` : `No players registered in ${activeCategory === 'ALL' ? 'this tournament' : activeCategory} yet`}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px' }}>
                      {playerFilterSearch ? 'Try clearing your search keyword.' : 'Use the form above to add players.'}
                    </div>
                  </div>
                )
              }

              return (
                <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1px solid rgba(148, 163, 184, 0.2)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'rgba(13, 22, 39, 0.95)' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(180deg, rgba(20, 32, 54, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)', borderBottom: '1.5px solid rgba(56, 189, 248, 0.3)' }}>
                        <th style={{ color: '#94a3b8', textAlign: 'center', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', width: '50px' }}>#</th>
                        <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Player / Team Name</th>
                        <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Category</th>
                        <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Court</th>
                        <th style={{ color: '#e2e8f0', textAlign: 'left', padding: '12px 14px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Place / Club</th>
                        <th style={{ color: '#e2e8f0', textAlign: 'right', padding: '12px 16px', fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', width: '150px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((participant, pIdx) => {
                        const cat = participant.category || selectedMatchCategories[0] || 'Men Singles'
                        const isDoubles = isDoublesCategory(cat)

                        return (
                          <tr
                            key={participant.id || `p-${pIdx}`}
                            style={{
                              borderTop: '1px solid rgba(148, 163, 184, 0.12)',
                              background: pIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'rgba(20, 32, 54, 0.4)',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = pIdx % 2 === 0 ? 'rgba(15, 23, 42, 0.6)' : 'rgba(20, 32, 54, 0.4)')}
                          >
                            <td style={{ textAlign: 'center', padding: '12px 14px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                              {pIdx + 1}
                            </td>

                            <td style={{ color: '#ffffff', padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {Boolean(participant.seed || participant.isSeed) && (
                                  <span
                                    style={{
                                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                      color: '#ffffff',
                                      fontSize: '10.5px',
                                      fontWeight: '900',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                    title={`Seed #${participant.seed}`}
                                  >
                                    S{participant.seed}
                                  </span>
                                )}

                                {isDoubles && (
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      background: 'rgba(168, 85, 247, 0.2)',
                                      border: '1px solid rgba(168, 85, 247, 0.45)',
                                      color: '#e9d5ff',
                                      padding: '2px 7px',
                                      borderRadius: '6px',
                                      fontWeight: '800',
                                      letterSpacing: '0.02em',
                                    }}
                                    title="Doubles Pair"
                                  >
                                    👥 Doubles
                                  </span>
                                )}

                                <strong style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '700' }}>
                                  {formatPersonName(participant.name, 'Player')}
                                </strong>
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  background: isDoubles ? 'rgba(168, 85, 247, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                  border: isDoubles ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
                                  color: isDoubles ? '#d8b4fe' : '#7dd3fc',
                                  padding: '3px 9px',
                                  borderRadius: '8px',
                                  fontWeight: '700',
                                  fontSize: '11.5px',
                                  display: 'inline-block',
                                }}
                              >
                                {formatCategoryName(cat)}
                              </span>
                            </td>

                            <td style={{ color: '#cbd5e1', padding: '12px 14px', fontSize: '13px' }}>
                              {participant.court ? (
                                <span style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                                  {formatCourtName(participant.court, '')}
                                </span>
                              ) : (
                                <span style={{ color: '#64748b' }}>—</span>
                              )}
                            </td>

                            <td style={{ color: '#cbd5e1', padding: '12px 14px', fontSize: '13px' }}>
                              {participant.place ? formatPlaceOrClub(participant.place, '') : <span style={{ color: '#64748b' }}>—</span>}
                            </td>

                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => onOpenModifyModal(participant)}
                                  style={{
                                    padding: '6px 12px',
                                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.25) 100%)',
                                    color: '#7dd3fc',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Modify player or doubles pair name & details"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRemoveParticipant(selectedMatch.id, participant.id, participant.name)}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#fca5a5',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Delete Player"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>

          {/* Match Management Bottom Right Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '24px',
              paddingTop: '18px',
              borderTop: '1px solid rgba(148, 163, 184, 0.2)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ color: '#f8fafc', fontWeight: '700', fontSize: '14px', marginBottom: '2px' }}>
                Tournament Configuration & Details
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                Modify tournament name, categories, start/end dates, court, venue or organizer details.
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenEditMatchModal(selectedMatch)}
              style={{
                padding: '12px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                border: '1px solid rgba(252, 165, 165, 0.6)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.45)',
                transition: 'all 0.2s ease',
              }}
            >
              ⚙️ Match Manage
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
