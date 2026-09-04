import React, { useState, useMemo } from 'react'
import {
  format12HourTime,
  scheduleMultiCategoryTournamentDraws,
} from '../utils/badmintonDrawEngine'

export const TournamentMasterScheduleModal = ({
  isOpen,
  onClose,
  tournament,
  allCategoryDraws = {},
  categories = [],
  onSaveMasterSchedule,
}) => {
  if (!isOpen || !tournament) return null

  // Check if any existing draw in this tournament has scheduleConfig active
  const initialIsActive = useMemo(() => {
    return Object.values(allCategoryDraws).some(
      (draw) => draw?.scheduleConfig?.isTimingsActive
    )
  }, [allCategoryDraws])

  const existingConfig = useMemo(() => {
    for (const draw of Object.values(allCategoryDraws)) {
      if (draw?.scheduleConfig?.isTimingsActive) {
        return draw.scheduleConfig
      }
    }
    return null
  }, [allCategoryDraws])

  // Form State
  const [isTimingsActive, setIsTimingsActive] = useState(initialIsActive)
  const [startDate, setStartDate] = useState(tournament.startDate || '')
  const [startTime, setStartTime] = useState(existingConfig?.startTime || '09:00')
  const [matchDuration, setMatchDuration] = useState(existingConfig?.matchDuration || 20)
  const [intervalBuffer, setIntervalBuffer] = useState(existingConfig?.intervalBuffer || 5)
  const [numberOfCourts, setNumberOfCourts] = useState(
    existingConfig?.courts?.length || (tournament.courtCount ? Number(tournament.courtCount) : 2)
  )
  const [selectedCategories, setSelectedCategories] = useState(
    categories.length > 0 ? categories : Object.keys(allCategoryDraws)
  )

  // Custom court names list derived from numberOfCourts
  const courtList = useMemo(() => {
    const list = []
    for (let i = 1; i <= Math.max(1, numberOfCourts); i++) {
      list.push(`Court ${i}`)
    }
    return list
  }, [numberOfCourts])

  // Compute multi-category schedule in real-time
  const computedSchedule = useMemo(() => {
    if (!isTimingsActive) return { updatedDrawsMap: {}, scheduledMatchesList: [] }

    return scheduleMultiCategoryTournamentDraws({
      categoryDrawsMap: allCategoryDraws,
      categoriesOrder: selectedCategories,
      startTime,
      matchDuration,
      intervalBuffer,
      courtList,
      isTimingsActive: true,
    })
  }, [
    isTimingsActive,
    allCategoryDraws,
    selectedCategories,
    startTime,
    matchDuration,
    intervalBuffer,
    courtList,
  ])

  // Stats
  const realMatchesList = computedSchedule.scheduledMatchesList.filter((s) => !s.isBye)
  const totalMatchesCount = realMatchesList.length
  const stepMins = Math.max(5, Number(matchDuration) + Number(intervalBuffer))
  const matchesPerCourt = Math.ceil(totalMatchesCount / Math.max(1, numberOfCourts))
  const totalEstimatedMinutes = matchesPerCourt * stepMins
  const estimatedEndTime = format12HourTime(totalEstimatedMinutes, startTime)

  // Handle Save
  const handleApply = () => {
    if (!isTimingsActive) {
      // Turn off schedule
      const turnedOff = scheduleMultiCategoryTournamentDraws({
        categoryDrawsMap: allCategoryDraws,
        isTimingsActive: false,
      })
      onSaveMasterSchedule({
        isTimingsActive: false,
        updatedDrawsMap: turnedOff.updatedDrawsMap,
      })
      onClose()
      return
    }

    onSaveMasterSchedule({
      isTimingsActive: true,
      config: {
        startTime,
        matchDuration,
        intervalBuffer,
        courts: courtList,
      },
      updatedDrawsMap: computedSchedule.updatedDrawsMap,
    })
    onClose()
  }

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return // keep at least 1
      setSelectedCategories(selectedCategories.filter((c) => c !== cat))
    } else {
      setSelectedCategories([...selectedCategories, cat])
    }
  }

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          borderRadius: '20px',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.25)',
          color: '#f8fafc',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
              }}
            >
              📅
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#f8fafc' }}>
                Master Tournament Time & Court Scheduler
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                {tournament.matchName || 'Tournament'} • Auto-interleave categories across courts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
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

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Master ON / OFF Toggle Hero Card */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '16px',
              background: isTimingsActive
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)'
                : 'rgba(30, 41, 59, 0.5)',
              border: isTimingsActive ? '1.5px solid rgba(34, 197, 94, 0.4)' : '1.5px solid rgba(148, 163, 184, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              transition: 'all 0.25s ease',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: isTimingsActive ? '#22c55e' : '#64748b',
                    boxShadow: isTimingsActive ? '0 0 10px #22c55e' : 'none',
                  }}
                />
                <strong style={{ fontSize: '15px', color: isTimingsActive ? '#86efac' : '#cbd5e1' }}>
                  {isTimingsActive ? 'Match Time Scheduling: ACTIVE (ON)' : 'Match Time Scheduling: DISABLED (OFF)'}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                {isTimingsActive
                  ? 'Matches will be assigned specific start times and courts across all categories.'
                  : 'Fixtures will display in standard tournament bracket format without specific time slots.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsTimingsActive(!isTimingsActive)}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                background: isTimingsActive
                  ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                  : 'rgba(51, 65, 85, 0.8)',
                border: isTimingsActive ? '1px solid #22c55e' : '1px solid rgba(148, 163, 184, 0.3)',
                color: '#ffffff',
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isTimingsActive ? '0 4px 15px rgba(34, 197, 94, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{isTimingsActive ? '✓ ENABLED (ON)' : '⚪ TURN ON'}</span>
            </button>
          </div>

          {/* Configuration Grid when ON */}
          {isTimingsActive && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                {/* Start Time */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
                    ⏰ Tournament Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1.5px solid rgba(56, 189, 248, 0.4)',
                      color: '#f8fafc',
                      fontSize: '14px',
                      fontWeight: '700',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Match Duration */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
                    ⏱️ Match Duration (mins)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[15, 20, 25, 30].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setMatchDuration(dur)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          background: matchDuration === dur ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                          border: matchDuration === dur ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                          color: '#fff',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        {dur}m
                      </button>
                    ))}
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={matchDuration}
                      onChange={(e) => setMatchDuration(Number(e.target.value) || 20)}
                      style={{
                        width: '60px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        color: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: '700',
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Courts Count */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
                    🏟️ Available Courts
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[1, 2, 3, 4].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNumberOfCourts(c)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          background: numberOfCourts === c ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                          border: numberOfCourts === c ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                          color: '#fff',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        {c} {c === 1 ? 'Court' : 'Courts'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Changeover Interval */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#38bdf8', marginBottom: '8px' }}>
                    🔄 Rest / Changeover (mins)
                  </label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[0, 5, 10].map((buf) => (
                      <button
                        key={buf}
                        type="button"
                        onClick={() => setIntervalBuffer(buf)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '6px',
                          background: intervalBuffer === buf ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                          border: intervalBuffer === buf ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                          color: '#fff',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        {buf}m buffer
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category Inclusion Selector */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#38bdf8' }}>
                    🏸 Include Categories in Master Schedule:
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {selectedCategories.length} of {categories.length || Object.keys(allCategoryDraws).length} Categories selected
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(categories.length > 0 ? categories : Object.keys(allCategoryDraws)).map((cat) => {
                    const isSelected = selectedCategories.includes(cat)
                    const draw = allCategoryDraws[cat]
                    const matchCount = draw?.matches?.filter((m) => !m.player1?.isBye && !m.player2?.isBye).length || 0

                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.6)',
                          border: isSelected ? '1.5px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                          color: isSelected ? '#38bdf8' : '#94a3b8',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{isSelected ? '✓' : '+'}</span>
                        <span>{cat}</span>
                        {matchCount > 0 && (
                          <span style={{ fontSize: '10px', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', borderRadius: '4px' }}>
                            {matchCount}m
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Real-time Summary Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(14, 165, 233, 0.05) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '14px',
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Matches</div>
                    <strong style={{ fontSize: '16px', color: '#38bdf8' }}>{totalMatchesCount} Matches</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Courts In Use</div>
                    <strong style={{ fontSize: '16px', color: '#f8fafc' }}>{courtList.join(', ')}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Est. Session Time</div>
                    <strong style={{ fontSize: '16px', color: '#4ade80' }}>
                      {format12HourTime(startTime)} to {estimatedEndTime}
                    </strong>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ⚡ Auto-mixed round-by-round to prevent player clashes
                </div>
              </div>

              {/* Live Timetable Preview Table */}
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: '14px', border: '1px solid rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148, 163, 184, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#f8fafc' }}>
                    📋 Master Timetable Live Preview ({realMatchesList.length} Scheduled Matches)
                  </strong>
                  <span style={{ fontSize: '11px', color: '#38bdf8' }}>
                    Step duration: {stepMins} mins/match
                  </span>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(30, 41, 59, 0.8)', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 12px' }}>Order</th>
                        <th style={{ padding: '8px 12px' }}>Time</th>
                        <th style={{ padding: '8px 12px' }}>Court</th>
                        <th style={{ padding: '8px 12px' }}>Category</th>
                        <th style={{ padding: '8px 12px' }}>Matchup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realMatchesList.slice(0, 30).map((s, idx) => {
                        const m = s.match
                        const p1Name = m.player1?.name || 'TBD'
                        const p2Name = m.player2?.name || 'TBD'

                        return (
                          <tr
                            key={`${s.categoryKey}-${s.matchId}`}
                            style={{
                              borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                              background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', color: '#94a3b8', fontWeight: '700' }}>
                              #{idx + 1}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#38bdf8', fontWeight: '800' }}>
                              ⏰ {s.assignedTime}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#86efac', fontWeight: '800' }}>
                              🏟️ {s.assignedCourt}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#f8fafc', fontWeight: '700' }}>
                              {s.categoryKey} (R{s.round})
                            </td>
                            <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>
                              <span style={{ fontWeight: '700', color: '#ffffff' }}>{p1Name}</span>
                              <span style={{ margin: '0 6px', color: '#64748b' }}>vs</span>
                              <span style={{ fontWeight: '700', color: '#ffffff' }}>{p2Name}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {realMatchesList.length > 30 && (
                    <div style={{ padding: '8px', textAlign: 'center', fontSize: '11px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.5)' }}>
                      + {realMatchesList.length - 30} more matches scheduled across all categories...
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
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
            type="button"
            onClick={handleApply}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              background: isTimingsActive
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: '800',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: isTimingsActive ? '0 4px 18px rgba(2, 132, 199, 0.45)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{isTimingsActive ? '🚀 Apply & Save Master Schedule' : '✓ Save (Schedule OFF)'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
