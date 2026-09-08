import React from 'react'
import { isDoublesCategory } from '../utils/badmintonCategories'
import { joinDoublesNames } from '../utils/textFormatters'

export function ModifyParticipantModal({
  modifyingParticipant,
  onClose,
  modifyForm,
  setModifyForm,
  onSave,
  categories = [],
}) {
  if (!modifyingParticipant) return null

  const isDoubles = isDoublesCategory(modifyForm?.category)
  const isFormValid = isDoubles
    ? Boolean((String(modifyForm?.name1 || '').trim() && String(modifyForm?.name2 || '').trim()) || String(modifyForm?.name || '').trim())
    : Boolean(String(modifyForm?.name || '').trim() || String(modifyForm?.name1 || '').trim())

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 29, 0.98) 100%)',
          border: isDoubles ? '1.5px solid rgba(168, 85, 247, 0.5)' : '1.5px solid rgba(59, 130, 246, 0.5)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: isDoubles
            ? '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 85, 247, 0.2)'
            : '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 130, 246, 0.2)',
          color: '#f8fafc',
          padding: '24px 28px',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: '6px',
                background: isDoubles ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                border: isDoubles ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(59, 130, 246, 0.5)',
                color: isDoubles ? '#d8b4fe' : '#93c5fd',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              {isDoubles ? '👥 DOUBLES PAIR MODIFICATION' : '👤 PLAYER MODIFICATION'}
            </span>
            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#f8fafc' }}>
              {isDoubles ? 'Modify Doubles Pair' : 'Modify Player Details'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              {isDoubles
                ? 'Update Player 1 and Player 2 (Partner) names. Both names will be saved together.'
                : 'Update participant name, court, or place.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              color: '#cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: '700',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={onSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '22px' }}>
            {isDoubles ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <label>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#60a5fa', marginBottom: '6px' }}>
                    👤 Player 1 Name *
                  </span>
                  <input
                    type="text"
                    required
                    value={modifyForm.name1}
                    onChange={(e) => {
                      const val = e.target.value
                      setModifyForm((prev) => ({
                        ...prev,
                        name1: val,
                        name: joinDoublesNames(val, prev.name2),
                      }))
                    }}
                    placeholder="e.g. Satwiksairaj"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: !modifyForm.name1?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </label>

                <label>
                  <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#c084fc', marginBottom: '6px' }}>
                    👥 Player 2 Name (Partner) *
                  </span>
                  <input
                    type="text"
                    required
                    value={modifyForm.name2}
                    onChange={(e) => {
                      const val = e.target.value
                      setModifyForm((prev) => ({
                        ...prev,
                        name2: val,
                        name: joinDoublesNames(prev.name1, val),
                      }))
                    }}
                    placeholder="e.g. Chirag Shetty"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: !modifyForm.name2?.trim() ? '1px solid rgba(192, 132, 252, 0.3)' : '1.5px solid rgba(168, 85, 247, 0.8)',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </label>
              </div>
            ) : (
              <label>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#cbd5e1', marginBottom: '6px' }}>
                  👤 Player Name *
                </span>
                <input
                  type="text"
                  required
                  value={modifyForm.name}
                  onChange={(e) => {
                    const val = e.target.value
                    setModifyForm((prev) => ({
                      ...prev,
                      name: val,
                      name1: val,
                      name2: '',
                    }))
                  }}
                  placeholder="Enter Player Name"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: !modifyForm.name?.trim() ? '1px solid rgba(96, 165, 250, 0.3)' : '1.5px solid rgba(59, 130, 246, 0.8)',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </label>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <label>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                  🏸 Category
                </span>
                <select
                  value={modifyForm.category}
                  onChange={(e) => {
                    const newCat = e.target.value
                    setModifyForm((prev) => ({
                      ...prev,
                      category: newCat,
                    }))
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c} style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                  Court Name (Optional)
                </span>
                <input
                  type="text"
                  value={modifyForm.court}
                  onChange={(e) => setModifyForm((prev) => ({ ...prev, court: e.target.value }))}
                  placeholder="e.g. Court 1"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </label>

              <label>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>
                  Place / Club (Optional)
                </span>
                <input
                  type="text"
                  value={modifyForm.place}
                  onChange={(e) => setModifyForm((prev) => ({ ...prev, place: e.target.value }))}
                  placeholder="e.g. Chennai"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    color: '#f8fafc',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: 'rgba(148, 163, 184, 0.15)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                color: '#cbd5e1',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              ✕ Cancel
            </button>

            <button
              type="submit"
              disabled={!isFormValid}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                background: isFormValid
                  ? (isDoubles
                    ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                  : 'rgba(100, 116, 139, 0.3)',
                border: 'none',
                color: isFormValid ? '#ffffff' : '#64748b',
                fontWeight: '800',
                fontSize: '13.5px',
                cursor: isFormValid ? 'pointer' : 'not-allowed',
                boxShadow: isFormValid
                  ? (isDoubles ? '0 4px 14px rgba(168, 85, 247, 0.4)' : '0 4px 14px rgba(37, 99, 235, 0.4)')
                  : 'none',
              }}
            >
              {isDoubles ? '✓ Save Doubles Pair' : '✓ Save Player Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
