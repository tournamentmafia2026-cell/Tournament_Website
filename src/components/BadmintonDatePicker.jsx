import React, { useState, useEffect, useRef } from 'react'

export const getTodayDateString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const addDaysToDateString = (dateStr, daysToAdd) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + Number(daysToAdd))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const calculateDaysDifference = (fromStr, toStr) => {
  if (!fromStr || !toStr) return 0
  const [y1, m1, d1] = fromStr.split('-').map(Number)
  const [y2, m2, d2] = toStr.split('-').map(Number)
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0
  const dt1 = new Date(y1, m1 - 1, d1)
  const dt2 = new Date(y2, m2 - 1, d2)
  return Math.round((dt2 - dt1) / (1000 * 60 * 60 * 24))
}

export const formatDisplayDateFull = (dateStr) => {
  if (!dateStr) return 'Select Date'
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const DURATION_PRESETS = [
  { days: 1, label: '1 Day' },
  { days: 2, label: '2 Days' },
  { days: 3, label: '3 Days' },
  { days: 5, label: '5 Days' },
  { days: 7, label: '1 Week' },
  { days: 14, label: '2 Weeks' },
  { days: 30, label: '1 Month' },
  { days: 60, label: '2 Months' },
]

export const BadmintonDatePicker = ({
  startDate,
  endDate,
  totalDays,
  onChange,
}) => {
  const todayStr = getTodayDateString()

  // Ensure fallback defaults if empty
  const activeStart = startDate || todayStr
  const activeDays = Math.max(1, Number(totalDays) || 1)
  const activeEnd = endDate || addDaysToDateString(activeStart, activeDays - 1)

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [calendarTarget, setCalendarTarget] = useState('start') // 'start' | 'end'

  // Calendar month/year navigation state
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = activeStart.split('-').map(Number)
    return {
      year: y || new Date().getFullYear(),
      month: typeof m === 'number' ? m - 1 : new Date().getMonth(),
    }
  })

  const containerRef = useRef(null)

  // Close calendar popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsCalendarOpen(false)
      }
    }
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isCalendarOpen])

  // Sync calendar view month when startDate changes or calendar opens
  useEffect(() => {
    if (activeStart) {
      const [y, m] = activeStart.split('-').map(Number)
      if (y && typeof m === 'number') {
        setViewDate({ year: y, month: m - 1 })
      }
    }
  }, [activeStart, isCalendarOpen])

  // Handlers
  const handleStartDateChange = (newStart) => {
    if (!newStart) return
    const newEnd = addDaysToDateString(newStart, activeDays - 1)
    onChange({
      startDate: newStart,
      endDate: newEnd,
      totalDays: activeDays,
    })
  }

  const handleTotalDaysChange = (newDays) => {
    const safeDays = Math.max(1, Math.min(365, Number(newDays) || 1))
    const newEnd = addDaysToDateString(activeStart, safeDays - 1)
    onChange({
      startDate: activeStart,
      endDate: newEnd,
      totalDays: safeDays,
    })
  }

  const handleEndDateChange = (newEnd) => {
    if (!newEnd) return
    const diff = calculateDaysDifference(activeStart, newEnd)
    if (diff < 0) {
      // If selected end date is before start date, set start date = end date
      onChange({
        startDate: newEnd,
        endDate: newEnd,
        totalDays: 1,
      })
    } else {
      const computedDays = diff + 1
      onChange({
        startDate: activeStart,
        endDate: newEnd,
        totalDays: computedDays,
      })
    }
  }

  const handleDayCellClick = (cellDateStr) => {
    if (calendarTarget === 'start') {
      handleStartDateChange(cellDateStr)
    } else {
      handleEndDateChange(cellDateStr)
    }
  }

  // Quick preset shortcuts for start date
  const setQuickDate = (type) => {
    const now = new Date()
    let target = new Date()

    if (type === 'today') {
      target = now
    } else if (type === 'tomorrow') {
      target.setDate(now.getDate() + 1)
    } else if (type === 'weekend') {
      // Next Saturday
      const day = now.getDay()
      const diff = (6 - day + 7) % 7 || 7
      target.setDate(now.getDate() + diff)
    } else if (type === 'nextMonday') {
      // Next Monday
      const day = now.getDay()
      const diff = (1 - day + 7) % 7 || 7
      target.setDate(now.getDate() + diff)
    } else if (type === 'nextWeek') {
      target.setDate(now.getDate() + 7)
    } else if (type === 'nextMonth') {
      target.setDate(now.getDate() + 30)
    } else if (type === 'in60Days') {
      target.setDate(now.getDate() + 60)
    } else if (type === 'in90Days') {
      target.setDate(now.getDate() + 90)
    }

    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    handleStartDateChange(dateStr)
    setViewDate({ year: y, month: target.getMonth() })
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 }
      }
      return { ...prev, month: prev.month - 1 }
    })
  }

  const handleNextMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 }
      }
      return { ...prev, month: prev.month + 1 }
    })
  }

  const handleJumpToToday = () => {
    const d = new Date()
    setViewDate({ year: d.getFullYear(), month: d.getMonth() })
    handleStartDateChange(todayStr)
  }

  // Build days grid
  const { year, month } = viewDate
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calendarDays = []

  // Trailing days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const prevMonthIdx = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
    })
  }

  // Days of current month
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
    })
  }

  // Leading days of next month to complete standard 35 or 42 grid
  const totalSlots = calendarDays.length > 35 ? 42 : 35
  const remainingSlots = totalSlots - calendarDays.length
  for (let d = 1; d <= remainingSlots; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarDays.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
    })
  }

  // Relative distance calculation from today
  const diffFromToday = calculateDaysDifference(todayStr, activeStart)
  const isStartingToday = diffFromToday === 0
  const isStartingFuture = diffFromToday > 0
  const isStartingPast = diffFromToday < 0

  return (
    <div
      ref={containerRef}
      style={{
        gridColumn: '1 / -1',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.75) 100%)',
        border: '1px solid rgba(96, 165, 250, 0.28)',
        borderRadius: '16px',
        padding: '20px',
        boxSizing: 'border-box',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
          paddingBottom: '14px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)',
            }}
          >
            📅
          </div>
          <div>
            <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Match Date & Schedule
              {isStartingToday && (
                <span
                  style={{
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#4ade80',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Starts Today
                </span>
              )}
              {isStartingFuture && (
                <span
                  style={{
                    background: 'rgba(96, 165, 250, 0.18)',
                    color: '#93c5fd',
                    border: '1px solid rgba(96, 165, 250, 0.35)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                >
                  Starts in {diffFromToday} {diffFromToday === 1 ? 'day' : 'days'}
                </span>
              )}
              {isStartingPast && (
                <span
                  style={{
                    background: 'rgba(251, 191, 36, 0.18)',
                    color: '#fde047',
                    border: '1px solid rgba(251, 191, 36, 0.35)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                >
                  {Math.abs(diffFromToday)} days ago
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Click calendar below to pick dates and specify the number of days
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setQuickDate('today')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: activeStart === todayStr ? '1px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.25)',
              background: activeStart === todayStr ? 'rgba(59, 130, 246, 0.25)' : 'rgba(15, 23, 42, 0.6)',
              color: activeStart === todayStr ? '#93c5fd' : '#cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ⚡ Today
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('tomorrow')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Tomorrow
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('weekend')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            This Weekend
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('nextWeek')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            +7 Days (Next Week)
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('nextMonth')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            +30 Days (Next Month)
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('in60Days')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#a78bfa',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            +60 Days
          </button>
          <button
            type="button"
            onClick={() => setQuickDate('in90Days')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#c084fc',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            +90 Days (3 Months)
          </button>
        </div>
      </div>

      {/* Main Interactive Controls Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* 1. Start Date Interactive Field */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', fontWeight: '600', marginBottom: '6px' }}>
            📅 Start Date
          </label>
          <div
            onClick={() => {
              setCalendarTarget('start')
              setIsCalendarOpen(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: isCalendarOpen && calendarTarget === 'start' ? '1px solid #60a5fa' : '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: isCalendarOpen && calendarTarget === 'start' ? '0 0 0 2px rgba(96, 165, 250, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>🏸</span>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: '700', fontSize: '14px' }}>
                  {formatDisplayDateFull(activeStart)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {activeStart === todayStr ? 'Today (Default)' : activeStart}
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
                fontSize: '11px',
                fontWeight: '700',
              }}
            >
              Pick Date ▾
            </div>
          </div>
        </div>

        {/* 2. Number of Days (Duration) Control */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600', margin: 0 }}>
              ⏱ Number of Days
            </label>
            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '600' }}>
              {activeDays} {activeDays === 1 ? 'Day Event' : 'Days Tournament'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '10px',
              padding: '6px 8px',
            }}
          >
            <button
              type="button"
              title="Decrease 1 Day"
              disabled={activeDays <= 1}
              onClick={() => handleTotalDaysChange(activeDays - 1)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: activeDays <= 1 ? 'rgba(100, 116, 139, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                color: activeDays <= 1 ? '#64748b' : '#f8fafc',
                fontSize: '18px',
                fontWeight: '700',
                cursor: activeDays <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              −
            </button>

            <div style={{ flex: 1, textAlign: 'center' }}>
              <input
                type="number"
                min="1"
                max="60"
                value={activeDays}
                onChange={(e) => handleTotalDaysChange(e.target.value)}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '18px',
                  fontWeight: '800',
                  outline: 'none',
                  padding: 0,
                  margin: 0,
                }}
              />
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {activeDays === 1 ? 'Day' : 'Days'}
              </span>
            </div>

            <button
              type="button"
              title="Increase 1 Day"
              onClick={() => handleTotalDaysChange(activeDays + 1)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(30, 41, 59, 0.8)',
                color: '#f8fafc',
                fontSize: '18px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* 3. End Date Display (Auto-calculated) */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', fontWeight: '600', marginBottom: '6px' }}>
            🏁 End Date
          </label>
          <div
            onClick={() => {
              setCalendarTarget('end')
              setIsCalendarOpen(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: isCalendarOpen && calendarTarget === 'end' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <div>
                <div style={{ color: '#f8fafc', fontWeight: '700', fontSize: '14px' }}>
                  {formatDisplayDateFull(activeEnd)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Calculated automatically (+{activeDays - 1} days)
                </div>
              </div>
            </div>
            <div
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(148, 163, 184, 0.15)',
                color: '#cbd5e1',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              Adjust ▾
            </div>
          </div>
        </div>
      </div>

      {/* Quick Duration Chips */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '4px' }}>
          Quick Duration:
        </span>
        {DURATION_PRESETS.map((preset) => {
          const isSelected = activeDays === preset.days
          return (
            <button
              key={preset.days}
              type="button"
              onClick={() => handleTotalDaysChange(preset.days)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.25)',
                background: isSelected ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.6)',
                color: isSelected ? '#38bdf8' : '#94a3b8',
                fontSize: '11.5px',
                fontWeight: isSelected ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {/* Schedule Summary Banner */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'linear-gradient(90deg, rgba(30, 58, 138, 0.3) 0%, rgba(15, 23, 42, 0.6) 100%)',
          border: '1px solid rgba(96, 165, 250, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: '#93c5fd', fontWeight: '700' }}>{formatDisplayDateFull(activeStart)}</span>
          <span style={{ color: '#64748b' }}>➔</span>
          <span style={{ color: '#38bdf8', fontWeight: '700' }}>{formatDisplayDateFull(activeEnd)}</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              background: 'rgba(96, 165, 250, 0.18)',
              color: '#bfdbfe',
              fontSize: '11px',
              fontWeight: '700',
            }}
          >
            {activeDays} {activeDays === 1 ? 'Day' : 'Days Total'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsCalendarOpen((prev) => !prev)}
          style={{
            background: isCalendarOpen ? 'rgba(96, 165, 250, 0.25)' : 'rgba(255, 255, 255, 0.08)',
            border: isCalendarOpen ? '1px solid rgba(96, 165, 250, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
            color: isCalendarOpen ? '#93c5fd' : '#e2e8f0',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isCalendarOpen ? '▲ Hide Calendar' : '▼ Open Interactive Calendar'}
        </button>
      </div>

      {/* POPUP / ACCORDION CALENDAR MODAL */}
      {isCalendarOpen && (
        <div
          style={{
            marginTop: '16px',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 29, 0.98) 100%)',
            border: '1px solid rgba(96, 165, 250, 0.35)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Calendar Controls & Month/Year Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {/* Target Selector Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(15, 23, 42, 0.8)', padding: '3px', borderRadius: '10px', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
              <button
                type="button"
                onClick={() => setCalendarTarget('start')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: calendarTarget === 'start' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                  color: calendarTarget === 'start' ? '#ffffff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Selecting Start Date
              </button>
              <button
                type="button"
                onClick={() => setCalendarTarget('end')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: calendarTarget === 'end' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                  color: calendarTarget === 'end' ? '#ffffff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Selecting End Date
              </button>
            </div>

            {/* Month & Year Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                aria-label="Previous Month"
                onClick={handlePrevMonth}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(30, 41, 59, 0.7)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ◀
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <select
                  value={viewDate.month}
                  onChange={(e) => setViewDate((prev) => ({ ...prev, month: Number(e.target.value) }))}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#f8fafc',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx} style={{ background: '#0f172a' }}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={viewDate.year}
                  onChange={(e) => setViewDate((prev) => ({ ...prev, year: Number(e.target.value) }))}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#f8fafc',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    padding: '4px 8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((yr) => (
                    <option key={yr} value={yr} style={{ background: '#0f172a' }}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                aria-label="Next Month"
                onClick={handleNextMonth}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(30, 41, 59, 0.7)',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ▶
              </button>

              <button
                type="button"
                onClick={handleJumpToToday}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '700',
                  marginLeft: '4px',
                }}
              >
                Today
              </button>
            </div>
          </div>

          {/* Weekday Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              gap: '4px',
              marginBottom: '8px',
            }}
          >
            {DAYS_OF_WEEK.map((dw, i) => (
              <div
                key={dw}
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: i === 0 || i === 6 ? '#93c5fd' : '#94a3b8',
                  padding: '6px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {dw}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '4px',
            }}
          >
            {calendarDays.map((cell, idx) => {
              const isStartDate = cell.dateStr === activeStart
              const isEndDate = cell.dateStr === activeEnd
              const isInRange = cell.dateStr > activeStart && cell.dateStr < activeEnd
              const isToday = cell.dateStr === todayStr

              let cellBg = 'transparent'
              let cellColor = cell.isCurrentMonth ? '#e2e8f0' : '#475569'
              let cellBorder = '1px solid transparent'
              let fontWeight = '500'

              if (isStartDate) {
                cellBg = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                cellColor = '#ffffff'
                cellBorder = '1px solid #60a5fa'
                fontWeight = '800'
              } else if (isEndDate) {
                cellBg = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                cellColor = '#ffffff'
                cellBorder = '1px solid #38bdf8'
                fontWeight = '800'
              } else if (isInRange) {
                cellBg = 'rgba(59, 130, 246, 0.18)'
                cellColor = '#93c5fd'
                cellBorder = '1px dashed rgba(96, 165, 250, 0.35)'
                fontWeight = '600'
              } else if (isToday) {
                cellBorder = '1px solid #4ade80'
                cellColor = '#4ade80'
                fontWeight = '700'
              }

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => handleDayCellClick(cell.dateStr)}
                  title={`${cell.dateStr}${isToday ? ' (Today)' : ''}${isStartDate ? ' (Start Date)' : ''}${isEndDate ? ' (End Date)' : ''}`}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    border: cellBorder,
                    background: cellBg,
                    color: cellColor,
                    fontSize: '13px',
                    fontWeight,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isStartDate && !isEndDate && !isInRange) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isStartDate && !isEndDate && !isInRange) {
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  <span>{cell.dayNum}</span>
                  {isToday && (
                    <span
                      style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#4ade80',
                        marginTop: '2px',
                      }}
                    />
                  )}
                  {isStartDate && (
                    <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>
                      Start
                    </span>
                  )}
                  {isEndDate && !isStartDate && (
                    <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>
                      End
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Calendar Footer Info & Done Button */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(148, 163, 184, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: '#94a3b8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6', display: 'inline-block' }} />
                <span>Start Date</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#0284c7', display: 'inline-block' }} />
                <span>End Date</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.25)', border: '1px dashed #60a5fa', display: 'inline-block' }} />
                <span>Tournament Range ({activeDays} Days)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                <span>Today</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#cbd5e1', fontSize: '11px' }}>Direct Picker:</span>
                <input
                  type="date"
                  value={calendarTarget === 'start' ? activeStart : activeEnd}
                  onChange={(e) => {
                    if (e.target.value) {
                      if (calendarTarget === 'start') handleStartDateChange(e.target.value)
                      else handleEndDateChange(e.target.value)
                    }
                  }}
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#f8fafc',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '6px',
                    padding: '3px 6px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              style={{
                padding: '7px 18px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              ✓ Done Selecting
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
