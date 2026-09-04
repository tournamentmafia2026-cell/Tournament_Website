import { useState, useEffect, useRef } from 'react'
import { BadmintonDatePicker } from './BadmintonDatePicker'
import {
  BADMINTON_CATEGORIES,
  CATEGORY_FILTER_GROUPS,
  matchesCategorySearch,
  isCategoryInGroup,
} from '../utils/badmintonCategories'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatCategoryName,
} from '../utils/textFormatters'

export const MatchEditModal = ({
  isOpen,
  onClose,
  match,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    matchName: '',
    matchAddress: '',
    courtName: '',
    categories: ['Men Singles', 'Women Singles'],
    startDate: '',
    endDate: '',
    totalDays: 1,
    organizerName: '',
    organizerMobile: '',
    image: '',
    winner: '',
    categoryWinners: {},
    status: 'ongoing',
    isCompleted: false,
  })

  const [categorySearch, setCategorySearch] = useState('')
  const [categoryFilterGroup, setCategoryFilterGroup] = useState('popular')
  const [imagePreview, setImagePreview] = useState('')
  const categoryInputRef = useRef(null)

  useEffect(() => {
    if (match) {
      const initialWinner = match.winner || ''
      const cats = Array.isArray(match.categories) && match.categories.length > 0 ? match.categories : ['Men Singles', 'Women Singles']
      const initialCatWinners = { ...(match.categoryWinners || {}) }
      const allDone = cats.length > 0 && cats.every((c) => initialCatWinners[c] && initialCatWinners[c].trim().length > 0)
      const isDone = Boolean(allDone || (match.isCompleted && cats.length <= 1))
      setFormData({
        matchName: match.matchName || '',
        matchAddress: match.matchAddress || '',
        courtName: match.courtName || 'Court 1',
        categories: cats,
        startDate: match.startDate || '',
        endDate: match.endDate || '',
        totalDays: match.totalDays || 1,
        organizerName: match.organizerName || '',
        organizerMobile: match.organizerMobile || '',
        image: match.image || '',
        winner: initialWinner,
        categoryWinners: initialCatWinners,
        status: match.status || (isDone ? 'completed' : 'ongoing'),
        isCompleted: isDone,
      })
      setImagePreview(match.image || '')
      setCategorySearch('')
      setCategoryFilterGroup('popular')
    }
  }, [match, isOpen])

  if (!isOpen || !match) return null

  const handleChange = (e) => {
    const { name, value, type, files } = e.target

    if (type === 'file' && files && files[0]) {
      const file = files[0]
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        setImagePreview(dataUrl)
        setFormData((prev) => ({ ...prev, image: dataUrl }))
      }
      reader.readAsDataURL(file)
      return
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleToggleCategory = (category) => {
    setFormData((prev) => {
      const current = prev.categories || []
      const updated = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category]
      return { ...prev, categories: updated }
    })
  }

  const handleAddCustomCategory = () => {
    const trimmed = categorySearch.trim()
    if (!trimmed) return
    const formattedCat = formatCategoryName(trimmed)
    setFormData((prev) => {
      const current = prev.categories || []
      if (current.includes(formattedCat)) return prev
      return { ...prev, categories: [...current, formattedCat] }
    })
    setCategorySearch('')
    categoryInputRef.current?.focus()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.matchName?.trim()) {
      alert('Please enter a tournament/match name.')
      return
    }

    const cats = formData.categories.length > 0 ? formData.categories.map(formatCategoryName) : ['Men Singles']
    const cleanCatWinners = {}
    Object.entries(formData.categoryWinners || {}).forEach(([c, val]) => {
      if (val && typeof val === 'string' && val.trim().length > 0) {
        cleanCatWinners[formatCategoryName(c)] = formatPersonName(val)
      }
    })

    const completedCount = cats.filter((c) => Boolean(cleanCatWinners[c])).length
    const areAllDone = cats.length > 0 && completedCount === cats.length

    // Tournament is only completed if ALL categories have winners or explicitly marked completed with all winners
    const isDone = areAllDone || (formData.status === 'completed' && cats.length <= 1)

    let winnerSummary = ''
    if (areAllDone) {
      if (cats.length === 1) {
        winnerSummary = cleanCatWinners[cats[0]] || formData.winner?.trim() || ''
      } else {
        winnerSummary = cats.map((c) => `${c}: ${cleanCatWinners[c]}`).join(' | ')
      }
    } else if (cats.length === 1 && formData.winner?.trim()) {
      winnerSummary = formatPersonName(formData.winner)
    }

    const updatedMatch = {
      ...match,
      ...formData,
      matchName: formatTournamentName(formData.matchName),
      matchAddress: formatAddress(formData.matchAddress),
      courtName: formatCourtName(formData.courtName),
      organizerName: formatPersonName(formData.organizerName, ''),
      winner: winnerSummary,
      categoryWinners: cleanCatWinners,
      status: isDone ? 'completed' : 'ongoing',
      isCompleted: isDone,
      categories: cats,
      image: formData.image || '',
    }

    onSave(updatedMatch)
    onClose()
  }

  const filteredCategories = BADMINTON_CATEGORIES.filter((category) => {
    if (categorySearch.trim()) {
      return matchesCategorySearch(category, categorySearch)
    }
    return isCategoryInGroup(category, categoryFilterGroup)
  })

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
        zIndex: 99999,
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
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
          color: '#f8fafc',
          padding: '24px 28px',
          boxSizing: 'border-box',
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
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '11px',
                fontWeight: '800',
                letterSpacing: '0.06em',
                marginBottom: '6px',
              }}
            >
              ⚙️ MATCH MANAGEMENT & MODIFICATION
            </span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#f8fafc' }}>
              Modify Tournament Details
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Update tournament name, court, dates, categories, and contact info. Changes reflect immediately across all draws & fixtures.
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

        <form onSubmit={handleSubmit}>
          {/* Main Info Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <label style={{ gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                🏆 Tournament / Match Name *
              </span>
              <input
                name="matchName"
                value={formData.matchName}
                onChange={handleChange}
                required
                placeholder="e.g. State Open Badminton Championship 2026"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                📍 Venue / Address
              </span>
              <input
                name="matchAddress"
                value={formData.matchAddress}
                onChange={handleChange}
                placeholder="e.g. Nehru Indoor Stadium, Chennai"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                🏸 Court Name / Numbers
              </span>
              <input
                name="courtName"
                value={formData.courtName}
                onChange={handleChange}
                placeholder="e.g. Court 1 & Court 2"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </label>
          </div>

          {/* Date Picker */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              📅 Tournament Dates & Total Days
            </span>
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
          </div>

          {/* Categories Management */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ display: 'block', fontWeight: '700', color: '#f8fafc', fontSize: '14px' }}>
                  🏸 Match Categories
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Selected: <strong style={{ color: '#93c5fd' }}>{(formData.categories || []).length}</strong> categories
                </span>
              </div>

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

            {/* Selected Categories Pill Badges */}
            {(formData.categories || []).length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '14px',
                  padding: '10px 12px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  borderRadius: '10px',
                  border: '1px dashed rgba(96, 165, 250, 0.35)',
                }}
              >
                {(formData.categories || []).map((cat) => (
                  <span
                    key={cat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)',
                      border: '1px solid rgba(96, 165, 250, 0.6)',
                      color: '#e0f2fe',
                      fontSize: '11.5px',
                      fontWeight: '700',
                    }}
                  >
                    🏸 {cat}
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      style={{
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '50%',
                        width: '15px',
                        height: '15px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '10px',
                        padding: 0,
                      }}
                      title={`Remove ${cat}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ padding: '8px 12px', color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>
                ⚠️ Please select at least one category for this tournament.
              </div>
            )}

            {/* Category Search & Filter */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                ref={categoryInputRef}
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="🔍 Search or add custom category (e.g. Under 11 Boys Singles, 40+ Veterans...)"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Add Custom Category Quick Button */}
            {categorySearch.trim() && !(formData.categories || []).includes(categorySearch.trim()) && (
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#86efac',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  ➕ Add &ldquo;{categorySearch.trim()}&rdquo; as Category
                </button>
              </div>
            )}

            {/* Group Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {CATEGORY_FILTER_GROUPS.map((grp) => {
                const isActive = categoryFilterGroup === grp.id && !categorySearch.trim()
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => {
                      setCategoryFilterGroup(grp.id)
                      setCategorySearch('')
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '999px',
                      border: isActive ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.25)',
                      background: isActive ? 'rgba(59, 130, 246, 0.85)' : 'rgba(15, 23, 42, 0.6)',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    {grp.icon} {grp.label}
                  </button>
                )
              })}
            </div>

            {/* Scrollable Category Options */}
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '8px',
                borderRadius: '8px',
                background: 'rgba(10, 15, 29, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
              }}
            >
              {filteredCategories.map((cat) => {
                const isSelected = (formData.categories || []).includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.25)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.9)' : 'rgba(30, 41, 59, 0.6)',
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{isSelected ? '✓' : '+'}</span>
                    <span>{cat}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tournament Status & Winner Section */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              border: '1.5px solid rgba(168, 85, 247, 0.4)',
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '20px',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🏆</span>
                <div>
                  <span style={{ display: 'block', fontWeight: '800', color: '#f8fafc', fontSize: '14.5px' }}>
                    Tournament Status & Category Winners
                  </span>
                  <span style={{ fontSize: '11px', color: '#c084fc' }}>
                    எல்லா Category-களின் Winner-களும் Update ஆன பிறகே Tournament "Completed" ஆகும்
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      status: 'ongoing',
                      isCompleted: false,
                    }))
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: formData.status === 'ongoing' && !formData.isCompleted ? '1.5px solid #4ade80' : '1px solid rgba(148, 163, 184, 0.25)',
                    background: formData.status === 'ongoing' && !formData.isCompleted ? 'rgba(34, 197, 94, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                    color: formData.status === 'ongoing' && !formData.isCompleted ? '#86efac' : '#94a3b8',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  🟢 Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      status: 'completed',
                      isCompleted: true,
                    }))
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: formData.status === 'completed' || formData.isCompleted ? '1.5px solid #c084fc' : '1px solid rgba(148, 163, 184, 0.25)',
                    background: formData.status === 'completed' || formData.isCompleted ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(126, 34, 206, 0.4) 100%)' : 'rgba(15, 23, 42, 0.6)',
                    color: formData.status === 'completed' || formData.isCompleted ? '#f3e8ff' : '#94a3b8',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  🏆 Completed
                </button>
              </div>
            </div>

            {/* Category-wise Winners List */}
            {formData.categories && formData.categories.length > 0 ? (
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#e9d5ff', display: 'block', marginBottom: '8px' }}>
                  🥇 Category Winners (ஒவ்வொரு Category-க்கும் Winner உள்ளிடவும்):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {formData.categories.map((cat) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '140px',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        color: '#c084fc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }} title={cat}>
                        🏸 {cat}:
                      </span>
                      <input
                        value={formData.categoryWinners?.[cat] || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData((prev) => {
                            const nextCatWinners = { ...(prev.categoryWinners || {}), [cat]: val }
                            const allDone = prev.categories.length > 0 && prev.categories.every((c) => nextCatWinners[c] && nextCatWinners[c].trim().length > 0)
                            return {
                              ...prev,
                              categoryWinners: nextCatWinners,
                              status: allDone ? 'completed' : 'ongoing',
                              isCompleted: allDone,
                            }
                          })
                        }}
                        placeholder={`Winner of ${cat}`}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(192, 132, 252, 0.4)',
                          color: '#f8fafc',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <label style={{ display: 'block' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#e9d5ff', display: 'block', marginBottom: '6px' }}>
                  🥇 Tournament Winner / Champion Name
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    name="winner"
                    value={formData.winner || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        winner: val,
                        status: val.trim() ? 'completed' : prev.status,
                        isCompleted: Boolean(val.trim()),
                      }))
                    }}
                    placeholder="Enter Winner / Champion Name"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(192, 132, 252, 0.4)',
                      color: '#f8fafc',
                      fontSize: '13px',
                      fontWeight: '600',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </label>
            )}
          </div>

          {/* Organizer & Image Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                👤 Organizer Name
              </span>
              <input
                name="organizerName"
                value={formData.organizerName}
                onChange={handleChange}
                placeholder="e.g. Sathish Kumar"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                📞 Organizer Mobile Number
              </span>
              <input
                name="organizerMobile"
                value={formData.organizerMobile}
                onChange={handleChange}
                placeholder="e.g. +91 98765 43210"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                🖼️ Tournament Banner Image
              </span>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleChange}
                  style={{
                    color: '#94a3b8',
                    fontSize: '12px',
                  }}
                />
                {imagePreview && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={imagePreview}
                      alt="Banner Preview"
                      style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('')
                        setFormData((prev) => ({ ...prev, image: '' }))
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#fca5a5',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(148, 163, 184, 0.2)', paddingTop: '18px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
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
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: '1px solid rgba(252, 165, 165, 0.6)',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              💾 Save & Update Match
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
