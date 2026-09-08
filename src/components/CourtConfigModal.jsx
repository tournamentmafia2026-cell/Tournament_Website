import React, { useState, useEffect, useMemo } from 'react'
import { generateCourtsList, saveCourtConfig, getSavedCourtConfig } from '../utils/courtConfig'

export function CourtConfigModal({
  isOpen,
  initialConfig,
  onClose,
  onSave,
}) {
  const [courtCount, setCourtCount] = useState(() => {
    const cfg = initialConfig || getSavedCourtConfig()
    return cfg?.count !== undefined && cfg?.count !== null ? cfg.count : 4
  })
  const [namingFormat, setNamingFormat] = useState(() => initialConfig?.format || 'numbers') // 'numbers' | 'alphabet' | 'roman' | 'custom'
  const [courtPrefix, setCourtPrefix] = useState(() => initialConfig?.prefix !== undefined ? initialConfig.prefix : 'Court')
  const [customNamesInput, setCustomNamesInput] = useState(() => initialConfig?.customNames || '')

  useEffect(() => {
    if (isOpen) {
      const cfg = initialConfig || getSavedCourtConfig()
      if (cfg) {
        setCourtCount(cfg.count !== undefined && cfg.count !== null ? cfg.count : 4)
        setNamingFormat(cfg.format || 'numbers')
        setCourtPrefix(cfg.prefix !== undefined ? cfg.prefix : 'Court')
        setCustomNamesInput(cfg.customNames || '')
      }
    }
  }, [isOpen])

  // Compute live preview of courts based on current selection
  const liveCourtsList = useMemo(() => {
    return generateCourtsList({
      count: courtCount,
      format: namingFormat,
      prefix: courtPrefix,
      customNames: customNamesInput,
    })
  }, [courtCount, namingFormat, courtPrefix, customNamesInput])

  if (!isOpen) return null

  const handleApply = () => {
    const finalCount = Math.max(1, parseInt(courtCount, 10) || 1)
    const nextConfig = {
      count: finalCount,
      format: namingFormat || 'numbers',
      prefix: String(courtPrefix || 'Court').trim(),
      customNames: String(customNamesInput || '').trim(),
    }
    saveCourtConfig(nextConfig)
    onSave?.(nextConfig, generateCourtsList(nextConfig))
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '560px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.25)',
          padding: '24px',
          color: '#ffffff',
          boxSizing: 'border-box',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              🏟️ Tournament Setup
            </span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
              Configure Stadium Courts
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '10px',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 1. Number of Active Courts (Manual Input) */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏸 1. Number of Active Courts: (Enter Count Manually)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={() => setCourtCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: '20px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Decrease Courts"
            >
              −
            </button>

            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={courtCount}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '')
                  setCourtCount(cleaned)
                }}
                placeholder="Enter court count (e.g. 4)"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#0f172a',
                  border: '2px solid #38bdf8',
                  color: '#ffffff',
                  fontSize: '17px',
                  fontWeight: '900',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                }}
              />
              <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94a3b8', fontWeight: '800', pointerEvents: 'none' }}>
                Courts
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCourtCount((prev) => (Number(prev) || 0) + 1)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: '20px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Increase Courts"
            >
              +
            </button>
          </div>
        </div>

        {/* 2. Court Naming Style / Format */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            🏷️ 2. Court Naming Style / Format:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {[
              { id: 'numbers', title: '🔢 Numbers', desc: 'Court 1, Court 2, Court 3...' },
              { id: 'alphabet', title: '🔤 Alphabetical', desc: 'Court A, Court B, Court C...' },
              { id: 'roman', title: '🏛️ Roman Numerals', desc: 'Court I, Court II, Court III...' },
              { id: 'custom', title: '✏️ Custom Names', desc: 'Custom comma-separated list' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setNamingFormat(fmt.id)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: namingFormat === fmt.id ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.65)',
                  border: namingFormat === fmt.id ? '2px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.25)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: namingFormat === fmt.id ? '0 0 14px rgba(56, 189, 248, 0.3)' : 'none',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: namingFormat === fmt.id ? '#38bdf8' : '#e2e8f0', marginBottom: '3px' }}>
                  {fmt.title}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{fmt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Prefix or Custom Names Input */}
        {namingFormat !== 'custom' ? (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px' }}>
              Prefix Word (Optional):
            </label>
            <input
              type="text"
              value={courtPrefix}
              onChange={(e) => setCourtPrefix(e.target.value)}
              placeholder="e.g. Court, Arena, Table, Mat"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#ffffff',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px' }}>
              Custom Court Names (Comma-separated):
            </label>
            <input
              type="text"
              value={customNamesInput}
              onChange={(e) => setCustomNamesInput(e.target.value)}
              placeholder="e.g. Center Court, North Arena, Court A, Court B"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#ffffff',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* 4. Live Interactive Preview */}
        <div style={{ marginBottom: '22px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            👁️ Live Generated Courts Preview ({liveCourtsList.length} Courts):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {liveCourtsList.map((cName, idx) => (
              <span
                key={`${cName}-${idx}`}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(3, 105, 161, 0.4) 100%)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '12px',
                }}
              >
                🏟️ {cName}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
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
            onClick={handleApply}
            style={{
              flex: 2,
              padding: '12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 18px rgba(2, 132, 199, 0.45)',
            }}
          >
            <span>✓ Save & Apply Courts ({liveCourtsList.length})</span>
          </button>
        </div>
      </div>
    </div>
  )
}
