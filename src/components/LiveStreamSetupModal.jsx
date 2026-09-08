import React, { useState, useEffect, useMemo } from 'react'
import {
  formatTournamentName,
  formatCategoryName,
  formatCourtName,
  formatAddress,
} from '../utils/textFormatters'
import { generateCourtsList, saveCourtConfig, getSavedCourtConfig } from '../utils/courtConfig'

export function LiveStreamSetupModal({
  isOpen,
  onClose,
  publishedMatches = [],
  selectedMatch = null,
  initialCourtConfig = null,
  onLaunchStream,
}) {
  const [selectedTournamentId, setSelectedTournamentId] = useState(() => {
    return selectedMatch?.id || publishedMatches[0]?.id || ''
  })

  const [courtCount, setCourtCount] = useState(() => {
    const cfg = initialCourtConfig || getSavedCourtConfig()
    return cfg?.count !== undefined && cfg?.count !== null ? cfg.count : 4
  })
  const [namingFormat, setNamingFormat] = useState(() => initialCourtConfig?.format || 'numbers')
  const [courtPrefix, setCourtPrefix] = useState(() => initialCourtConfig?.prefix !== undefined ? initialCourtConfig.prefix : 'Court')
  const [customNamesInput, setCustomNamesInput] = useState(() => initialCourtConfig?.customNames || '')
  const [showAdvancedCourts, setShowAdvancedCourts] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (selectedMatch?.id) {
        setSelectedTournamentId(selectedMatch.id)
      } else if (publishedMatches.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(publishedMatches[0].id)
      }
      const cfg = initialCourtConfig || getSavedCourtConfig()
      if (cfg) {
        setCourtCount(cfg.count !== undefined && cfg.count !== null ? cfg.count : 4)
        setNamingFormat(cfg.format || 'numbers')
        setCourtPrefix(cfg.prefix !== undefined ? cfg.prefix : 'Court')
        setCustomNamesInput(cfg.customNames || '')
      }
    }
  }, [isOpen, selectedMatch?.id, publishedMatches])

  const liveCourtsList = useMemo(() => {
    return generateCourtsList({
      count: courtCount,
      format: namingFormat,
      prefix: courtPrefix,
      customNames: customNamesInput,
    })
  }, [courtCount, namingFormat, courtPrefix, customNamesInput])

  if (!isOpen) return null

  const activeTournament = publishedMatches.find((m) => String(m.id) === String(selectedTournamentId)) || selectedMatch || publishedMatches[0]

  const handleLaunch = () => {
    const finalCount = Math.max(1, parseInt(courtCount, 10) || 1)
    const nextConfig = {
      count: finalCount,
      format: namingFormat || 'numbers',
      prefix: String(courtPrefix || 'Court').trim(),
      customNames: String(customNamesInput || '').trim(),
    }
    saveCourtConfig(nextConfig)
    if (onLaunchStream) {
      onLaunchStream(selectedTournamentId || activeTournament?.id, nextConfig)
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '20px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.2)',
          padding: '24px',
          color: '#ffffff',
          boxSizing: 'border-box',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }}>
              🔴
            </span>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Broadcast Setup
              </span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '21px', fontWeight: '900', color: '#ffffff' }}>
                Start Live Stream Broadcast
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#94a3b8',
              width: '34px',
              height: '34px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Section 1: Choose Tournament / Match */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              🏸 1. Select Match / Tournament to Stream:
            </label>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '700' }}>
              {publishedMatches.length} Tournament{publishedMatches.length === 1 ? '' : 's'} Available
            </span>
          </div>

          {publishedMatches.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px',
                border: '1px dashed rgba(148, 163, 184, 0.3)',
                color: '#94a3b8',
                fontSize: '13px',
              }}
            >
              ⚠️ No published tournaments found. Please create or publish a tournament first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
              {publishedMatches.map((m) => {
                const isSelected = String(m.id) === String(selectedTournamentId)
                const title = formatTournamentName(m.matchName || m.tournamentName || m.name || m.title || 'Badminton Tournament')
                const category = formatCategoryName(m.category || m.categoryName || (Array.isArray(m.categories) ? m.categories.join(', ') : 'Open Tournament'))
                const dateStr = m.startDate && m.endDate ? `${m.startDate} - ${m.endDate}` : (m.startDate || m.date || m.tournamentDate || 'Today')
                const venueStr = formatAddress(m.matchAddress || m.venue || m.location || '')
                const courtStr = formatCourtName(m.courtName || 'Court 1')

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedTournamentId(m.id)}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.25) 100%)'
                        : 'rgba(15, 23, 42, 0.7)',
                      border: isSelected ? '2px solid #ef4444' : '1px solid rgba(148, 163, 184, 0.2)',
                      boxShadow: isSelected ? '0 0 16px rgba(239, 68, 68, 0.35)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: isSelected ? '6px solid #ef4444' : '2px solid #64748b',
                          background: isSelected ? '#ffffff' : 'transparent',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: '900', color: isSelected ? '#ffffff' : '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          🏸 {title}
                        </div>
                        <div style={{ fontSize: '11.5px', color: isSelected ? '#fca5a5' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                          <span>🏆 {category}</span>
                          <span>•</span>
                          <span>📅 {dateStr}</span>
                          {courtStr && (
                            <>
                              <span>•</span>
                              <span>🏟️ {courtStr}</span>
                            </>
                          )}
                          {venueStr && (
                            <>
                              <span>•</span>
                              <span>📍 {venueStr}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '800',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                        }}
                      >
                        ✓ Selected
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Section 2: Court Setup (Collapsible / Clean) */}
        <div style={{ marginBottom: '20px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.2)', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>🏟️</span>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stadium Courts Count:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCourtCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  fontSize: '16px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={courtCount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '')
                  setCourtCount(cleaned)
                }}
                style={{
                  width: '54px',
                  padding: '6px 4px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  border: '1.5px solid #38bdf8',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '900',
                  textAlign: 'center',
                }}
              />
              <button
                type="button"
                onClick={() => setCourtCount((prev) => (Number(prev) || 0) + 1)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38bdf8',
                  fontSize: '16px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Preview of courts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
            {liveCourtsList.map((cName, idx) => (
              <span
                key={`${cName}-${idx}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(2, 132, 199, 0.25)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  fontWeight: '700',
                  fontSize: '11px',
                }}
              >
                🏟️ {cName}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedCourts((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
          >
            <span>{showAdvancedCourts ? '▲ Hide Advanced Court Naming' : '▼ Customize Court Names / Prefixes'}</span>
          </button>

          {showAdvancedCourts && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
                {[
                  { id: 'numbers', title: '🔢 Numbers (Court 1, 2...)' },
                  { id: 'alphabet', title: '🔤 Letters (Court A, B...)' },
                  { id: 'roman', title: '🏛️ Roman (Court I, II...)' },
                  { id: 'custom', title: '✏️ Custom Names' },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setNamingFormat(fmt.id)}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: namingFormat === fmt.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                      border: namingFormat === fmt.id ? '1.5px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                      color: namingFormat === fmt.id ? '#38bdf8' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {fmt.title}
                  </button>
                ))}
              </div>

              {namingFormat === 'custom' ? (
                <input
                  type="text"
                  value={customNamesInput}
                  onChange={(e) => setCustomNamesInput(e.target.value)}
                  placeholder="e.g. Center Court, North Arena, Court A"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={courtPrefix}
                  onChange={(e) => setCourtPrefix(e.target.value)}
                  placeholder="Prefix word (e.g. Court, Table, Arena)"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    color: '#ffffff',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: '12px',
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#94a3b8',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleLaunch}
            disabled={!selectedTournamentId && !activeTournament}
            style={{
              flex: 2.2,
              padding: '13px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '14px',
              cursor: (!selectedTournamentId && !activeTournament) ? 'not-allowed' : 'pointer',
              opacity: (!selectedTournamentId && !activeTournament) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.5)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🔴 Start Live Stream:</span>
            <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeTournament?.matchName || activeTournament?.tournamentName || activeTournament?.name || activeTournament?.title || 'Selected Tournament'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
