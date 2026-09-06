import React from 'react'

export const ConfirmDeleteModal = ({
  isOpen,
  title = 'Delete Confirmation',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName = '',
  confirmText = '🗑️ Yes, Delete',
  cancelText = '✕ Cancel',
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)',
          border: '1.5px solid rgba(239, 68, 68, 0.5)',
          borderRadius: '20px',
          maxWidth: '480px',
          width: '100%',
          padding: '26px',
          boxShadow: '0 25px 60px -15px rgba(239, 68, 68, 0.4), 0 0 40px rgba(0, 0, 0, 0.9)',
          color: '#f8fafc',
          position: 'relative',
          textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            color: '#f87171',
            fontSize: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)',
          }}
        >
          ⚠️
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '21px',
            fontWeight: '900',
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h3>

        {/* Highlighted Item Name (if provided) */}
        {itemName && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '8px 14px',
              margin: '0 auto 12px auto',
              display: 'inline-block',
              maxWidth: '90%',
              fontSize: '14px',
              fontWeight: '800',
              color: '#fca5a5',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            &ldquo;{itemName}&rdquo;
          </div>
        )}

        {/* Warning Message */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '13.5px',
            color: '#94a3b8',
            lineHeight: '1.55',
          }}
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(148, 163, 184, 0.12)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#cbd5e1',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm()
              if (onClose) onClose()
            }}
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #991b1b 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 6px 20px rgba(239, 68, 68, 0.45)',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
