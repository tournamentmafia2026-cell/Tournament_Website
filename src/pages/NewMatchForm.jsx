import React, { useState, useRef } from 'react'
import {
  BADMINTON_CATEGORIES,
  CATEGORY_FILTER_GROUPS,
  isCategoryInGroup,
  matchesCategorySearch,
} from '../utils/badmintonCategories'
import {
  BadmintonDatePicker,
  getTodayDateString,
  addDaysToDateString,
} from '../components/BadmintonDatePicker'

export const getInitialFormData = () => {
  const today = getTodayDateString()
  const defaultDays = 3
  return {
    matchName: '',
    matchAddress: '',
    courtName: 'Court 1',
    categories: ['Men Singles', 'Women Singles'],
    startDate: today,
    endDate: addDaysToDateString(today, defaultDays - 1),
    totalDays: defaultDays,
    organizerName: '',
    organizerMobile: '',
    image: '',
  }
}

export function NewMatchForm({
  formData,
  setFormData,
  imagePreview,
  setImagePreview,
  onSubmit,
  onCancel,
}) {
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryFilterGroup, setCategoryFilterGroup] = useState('popular')
  const categoryInputRef = useRef(null)

  const filteredCategories = BADMINTON_CATEGORIES.filter((category) => {
    if (categorySearch.trim()) {
      return matchesCategorySearch(category, categorySearch)
    }
    return isCategoryInGroup(category, categoryFilterGroup)
  })

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target

    if (type === 'file' && files && files[0]) {
      const file = files[0]
      const reader = new FileReader()

      reader.onloadend = () => {
        const fileDataUrl = typeof reader.result === 'string' ? reader.result : ''
        setImagePreview(fileDataUrl)
        setFormData((prev) => ({
          ...prev,
          image: fileDataUrl,
        }))
      }

      reader.readAsDataURL(file)
      return
    }

    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }

      if (name === 'startDate' && updatedData.startDate) {
        const start = new Date(`${updatedData.startDate}T00:00:00`)
        const totalDays = Number(updatedData.totalDays) || 1

        if (!Number.isNaN(start.getTime())) {
          const endDate = new Date(start)
          endDate.setDate(start.getDate() + totalDays - 1)
          updatedData.endDate = endDate.toISOString().slice(0, 10)
        }
      }

      if (name === 'totalDays' && updatedData.startDate) {
        const start = new Date(`${updatedData.startDate}T00:00:00`)
        const totalDays = Number(value) || 1

        if (!Number.isNaN(start.getTime())) {
          const endDate = new Date(start)
          endDate.setDate(start.getDate() + totalDays - 1)
          updatedData.endDate = endDate.toISOString().slice(0, 10)
        }
      }

      return updatedData
    })
  }

  return (
    <form className="auth-card auth-management" onSubmit={onSubmit}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0 }}>{formData.id ? '✏️ Edit & Update Match' : '➕ New Match Update'}</h2>
        {formData.id && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Cancel Edit ✕
          </button>
        )}
      </div>

      <div className="field-grid auth-grid">
        <label>
          Match Name
          <input name="matchName" value={formData.matchName} onChange={handleChange} required />
        </label>

        <label>
          Match Address
          <input name="matchAddress" value={formData.matchAddress} onChange={handleChange} />
        </label>

        <label>
          Match Court Name
          <input name="courtName" value={formData.courtName} onChange={handleChange} />
        </label>

        <div className="category-selector" style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '16px', padding: '18px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ display: 'block', fontWeight: '700', color: '#f8fafc', fontSize: '15px' }}>
                🏸 Match Categories
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Selected: <strong style={{ color: '#93c5fd' }}>{(formData.categories || []).length}</strong> categories
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {(formData.categories || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, categories: [] }))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(248, 113, 113, 0.4)',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Selected Categories Tags */}
          {(formData.categories || []).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.75)', borderRadius: '12px', border: '1px dashed rgba(96, 165, 250, 0.35)' }}>
              {(formData.categories || []).map((category) => (
                <span
                  key={category}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)',
                    border: '1px solid rgba(96, 165, 250, 0.6)',
                    color: '#e0f2fe',
                    fontSize: '12px',
                    fontWeight: '700',
                    letterSpacing: '0.02em',
                  }}
                >
                  🏸 {category}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        categories: (prev.categories || []).filter((item) => item !== category),
                      }))
                    }}
                    style={{
                      border: 'none',
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      padding: 0,
                      lineHeight: 1,
                      marginLeft: '2px',
                    }}
                    aria-label={`Remove ${category}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.5)', border: '1px dashed rgba(148, 163, 184, 0.3)', color: '#94a3b8', fontSize: '12px' }}>
              ℹ️ No categories selected yet. Browse by group or search below to add categories.
            </div>
          )}

          {/* Search Input with Clear Button */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: '#94a3b8', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              ref={categoryInputRef}
              type="text"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const trimmed = categorySearch.trim()
                  if (trimmed && !(formData.categories || []).includes(trimmed)) {
                    setFormData((prev) => ({
                      ...prev,
                      categories: [...(prev.categories || []), trimmed],
                    }))
                    setCategorySearch('')
                  }
                }
              }}
              placeholder="Search category (e.g. Under 9, Jumbled, 75+, U11, Men Singles)..."
              style={{
                width: '100%',
                padding: '11px 40px 11px 38px',
                borderRadius: '10px',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                background: 'rgba(15, 23, 42, 0.95)',
                color: '#f8fafc',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {categorySearch && (
              <button
                type="button"
                onClick={() => {
                  setCategorySearch('')
                  categoryInputRef.current?.focus()
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(148, 163, 184, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Add Custom Category Quick Action */}
          {categorySearch.trim() && !(formData.categories || []).includes(categorySearch.trim()) && (
            <div style={{ marginBottom: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  const trimmed = categorySearch.trim()
                  if (trimmed) {
                    setFormData((prev) => ({
                      ...prev,
                      categories: [...(prev.categories || []), trimmed],
                    }))
                    setCategorySearch('')
                    categoryInputRef.current?.focus()
                  }
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #22c55e',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#86efac',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ➕ Add &ldquo;{categorySearch.trim()}&rdquo; as Category
              </button>
            </div>
          )}

          {/* Quick Category Filter Pills */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: '700' }}>
              Browse Category Types:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORY_FILTER_GROUPS.map((grp) => {
                const isActive = categoryFilterGroup === grp.id && !categorySearch.trim()
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilterGroup(grp.id)
                      setCategorySearch('')
                      categoryInputRef.current?.focus()
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '999px',
                      border: isActive ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.3)',
                      background: isActive ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(37, 99, 235, 0.9) 100%)' : 'rgba(15, 23, 42, 0.6)',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{grp.icon}</span>
                    <span>{grp.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filtered / Available Categories Header & Quick Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
              {categorySearch.trim()
                ? `Search Results (${filteredCategories.length})`
                : `${CATEGORY_FILTER_GROUPS.find((g) => g.id === categoryFilterGroup)?.label || 'Available'} (${filteredCategories.length})`}
            </span>

            {filteredCategories.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => {
                    const selected = prev.categories || []
                    const toAdd = filteredCategories.filter((cat) => !selected.includes(cat))
                    return { ...prev, categories: [...selected, ...toAdd] }
                  })
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#60a5fa',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                + Select All in this list
              </button>
            )}
          </div>

          {/* Scrollable Categories List */}
          <div
            style={{
              maxHeight: '230px',
              overflowY: 'auto',
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(10, 15, 29, 0.85)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignContent: 'flex-start',
            }}
          >
            {filteredCategories.map((category) => {
              const isSelected = (formData.categories || []).includes(category)

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setFormData((prev) => {
                      const selected = prev.categories || []
                      const updatedCategories = selected.includes(category)
                        ? selected.filter((item) => item !== category)
                        : [...selected, category]

                      return {
                        ...prev,
                        categories: updatedCategories,
                      }
                    })
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.3)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.95)' : 'rgba(30, 41, 59, 0.65)',
                    color: isSelected ? '#ffffff' : '#cbd5e1',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: isSelected ? '700' : '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{category}</span>
                </button>
              )
            })}

            {filteredCategories.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: '#94a3b8', fontSize: '12px' }}>
                No matching categories found for &ldquo;{categorySearch}&rdquo;. Click the button above to add it as a custom category!
              </div>
            )}
          </div>
        </div>

        <BadmintonDatePicker
          startDate={formData.startDate}
          endDate={formData.endDate}
          totalDays={formData.totalDays}
          onChange={({ startDate, endDate, totalDays }) => {
            setFormData((prev) => ({
              ...prev,
              startDate,
              endDate,
              totalDays,
            }))
          }}
        />

        <label>
          Organizer Name
          <input name="organizerName" value={formData.organizerName} onChange={handleChange} />
        </label>

        <label>
          Organizer Mobile Number
          <input name="organizerMobile" value={formData.organizerMobile} onChange={handleChange} />
        </label>
      </div>

      <label className="image-upload-wrap">
        Match Image
        <input type="file" accept="image/*" name="image" onChange={handleChange} />
      </label>

      {imagePreview && (
        <img src={imagePreview} alt="Preview" className="preview-image" />
      )}

      <div className="auth-actions auth-row" style={{ display: 'flex', gap: '10px' }}>
        <button type="submit" className="primary-btn">
          {formData.id ? '💾 Save & Update Match' : '🚀 Publish Match'}
        </button>
        {formData.id && (
          <button
            type="button"
            className="secondary-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
