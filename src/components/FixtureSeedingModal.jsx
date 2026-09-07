import { useState, useEffect, useRef } from 'react'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatPlaceOrClub,
  formatCategoryName,
} from '../utils/textFormatters'

const DEFAULT_SEEDING_CATEGORIES = ['Men Singles', 'Women Singles', 'Men Doubles']

export const FixtureSeedingModal = ({
  isOpen = false,
  onClose = () => {},
  match = null,
  authenticators = {},
  initialCategory = null,
  existingDraw = null,
  availablePlayers = [],
  onGenerate = () => {},
}) => {
  const categories = match?.categories || DEFAULT_SEEDING_CATEGORIES
  const [selectedCategory, setSelectedCategory] = useState(() => initialCategory || categories[0] || 'Men Singles')
  
  // Total Members / Draw Size (4, 8, 16, 32, 64)
  const [totalMembers, setTotalMembers] = useState(16)
  const [activePlayersCount, setActivePlayersCount] = useState(16)
  const [seedsCount, setSeedsCount] = useState(4)
  
  // Seed Player details: { [seedNum]: { name: string, id?: string|number, place?: string } }
  const [seedDetails, setSeedDetails] = useState({})

  // Match Timings & Schedule Settings
  const [showTimingsOnPublic, setShowTimingsOnPublic] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [matchDuration, setMatchDuration] = useState(30)
  const [numberOfCourts, setNumberOfCourts] = useState(4)
  const [courtName, setCourtName] = useState('Court')

  const [activeSeedDropdown, setActiveSeedDropdown] = useState(null)
  const [seedSearchQuery, setSeedSearchQuery] = useState('')

  const dropdownModalRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownModalRef.current && !dropdownModalRef.current.contains(e.target)) {
        setActiveSeedDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const rawUploadedPlayers = match ? (authenticators[match.id] || []).filter(
    (p) => (p.category || 'Men Singles') === selectedCategory
  ) : []

  const uploadedCategoryPlayers = availablePlayers && availablePlayers.length > 0
    ? availablePlayers
    : rawUploadedPlayers

  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current && match) {
      const initialCat = (initialCategory && categories.includes(initialCategory)) 
        ? initialCategory 
        : (categories[0] || 'Men Singles')
      
      setSelectedCategory(initialCat)
      
      const players = (availablePlayers && availablePlayers.length > 0)
        ? availablePlayers
        : (authenticators[match.id] || []).filter((p) => (p.category || 'Men Singles') === initialCat)
      
      const count = players.length
      if (existingDraw && existingDraw.drawSize) {
        setTotalMembers(existingDraw.drawSize)
        setActivePlayersCount(existingDraw.totalPlayers || count || existingDraw.drawSize)
        setSeedsCount(existingDraw.seedsCount || existingDraw.seeds?.length || 4)
        if (existingDraw.showTimings !== undefined) {
          setShowTimingsOnPublic(Boolean(existingDraw.showTimings))
        } else if (existingDraw.config?.showTimings !== undefined) {
          setShowTimingsOnPublic(Boolean(existingDraw.config.showTimings))
        } else {
          setShowTimingsOnPublic(true)
        }
        if (existingDraw.startTime || existingDraw.config?.startTime) setStartTime(existingDraw.startTime || existingDraw.config.startTime)
        if (existingDraw.matchDuration || existingDraw.config?.matchDuration) setMatchDuration(existingDraw.matchDuration || existingDraw.config.matchDuration)
        if (existingDraw.numberOfCourts || existingDraw.config?.numberOfCourts) setNumberOfCourts(existingDraw.numberOfCourts || existingDraw.config.numberOfCourts)
        if (existingDraw.courtName || existingDraw.config?.courtName) setCourtName(existingDraw.courtName || existingDraw.config.courtName)
      } else if (count > 0) {
        setActivePlayersCount(count)
        if (count <= 4) setTotalMembers(4)
        else if (count <= 8) setTotalMembers(8)
        else if (count <= 16) setTotalMembers(16)
        else if (count <= 32) setTotalMembers(32)
        else setTotalMembers(64)
      } else {
        setActivePlayersCount(16)
        setTotalMembers(16)
      }

      // Pre-populate existing seeds from current draw if available
      const initialSeeds = {}
      if (existingDraw?.seeds && existingDraw.seeds.length > 0) {
        existingDraw.seeds.forEach((s) => {
          if (s.seed) {
            initialSeeds[s.seed] = {
              id: s.id,
              name: s.name,
              place: s.place || '',
              court: s.court || '',
            }
          }
        })
      } else if (players.length > 0) {
        // Pre-seed first few players
        for (let i = 1; i <= 4; i++) {
          if (players[i - 1]) {
            initialSeeds[i] = {
              id: players[i - 1].id,
              name: players[i - 1].name,
              place: players[i - 1].place || '',
              court: players[i - 1].court || '',
            }
          }
        }
      }
      setSeedDetails(initialSeeds)
    }
    wasOpenRef.current = Boolean(isOpen)
  }, [isOpen])

  if (!isOpen || !match) return null

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat)
    const players = (authenticators[match.id] || []).filter(
      (p) => (p.category || 'Men Singles') === cat
    )
    const count = players.length
    if (count > 0) {
      setActivePlayersCount(count)
      if (count <= 4) setTotalMembers(4)
      else if (count <= 8) setTotalMembers(8)
      else if (count <= 16) setTotalMembers(16)
      else if (count <= 32) setTotalMembers(32)
      else setTotalMembers(64)
    }
  }

  const handleSeedChange = (seedNum, field, value) => {
    const formattedValue = field === 'name' ? (value ? String(value).toUpperCase() : '') : value
    setSeedDetails((prev) => ({
      ...prev,
      [seedNum]: {
        ...(prev[seedNum] || {}),
        [field]: formattedValue,
      },
    }))
  }

  const handleSelectUploadedPlayerForSeed = (seedNum, player) => {
    if (!player) {
      setSeedDetails((prev) => ({
        ...prev,
        [seedNum]: { name: '', place: '', id: null },
      }))
      return
    }
    setSeedDetails((prev) => ({
      ...prev,
      [seedNum]: {
        id: player.id,
        name: player.name ? String(player.name).toUpperCase() : '',
        place: player.place || '',
        court: player.court || '',
      },
    }))
    setActiveSeedDropdown(null)
  }

  // Calculated Byes count
  const calculatedByes = Math.max(0, totalMembers - activePlayersCount)

  const getSeedPositionLabel = (seedNum, total) => {
    if (seedNum === 1) return `Line 1 • Top of Draw`
    if (seedNum === 2) return `Line ${total} • Bottom of Draw`
    if (seedNum === 3) return `Line ${Math.floor(total / 2)} • Upper Half`
    if (seedNum === 4) return `Line ${Math.floor(total / 2) + 1} • Lower Half`
    return `Quarter Seed`
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()

    // Build explicit seeds array
    const seedsArray = []
    for (let i = 1; i <= seedsCount; i++) {
      const s = seedDetails[i]
      const chosenName = s?.name
        ? String(s.name).trim().toUpperCase()
        : (uploadedCategoryPlayers[i - 1]?.name ? String(uploadedCategoryPlayers[i - 1].name).trim().toUpperCase() : `SEED ${i}`)
      const matchedPlayer = uploadedCategoryPlayers.find(
        (p) => p && p.name && chosenName && p.name.trim().toLowerCase() === chosenName.toLowerCase()
      )
      const defaultPlace = matchedPlayer?.place || uploadedCategoryPlayers[i - 1]?.place || ''
      const defaultId = matchedPlayer?.id || s?.id || uploadedCategoryPlayers[i - 1]?.id || `seed-${i}`

      seedsArray.push({
        seed: i,
        id: defaultId,
        name: chosenName,
        place: s?.place !== undefined && s?.place !== '' ? s.place : defaultPlace,
        isSeed: true,
      })
    }

    onGenerate(selectedCategory, {
      totalMembers: Number(totalMembers) || 16,
      drawSize: Number(totalMembers) || 16,
      totalPlayers: Number(activePlayersCount) || (totalMembers - calculatedByes),
      byesCount: calculatedByes,
      seedsCount: Number(seedsCount) || 0,
      seeds: seedsArray,
      venue: match.matchAddress || 'Badminton Arena',
      showTimings: Boolean(showTimingsOnPublic),
      startTime: startTime || '09:00',
      matchDuration: Number(matchDuration) || 30,
      numberOfCourts: Number(numberOfCourts) || 4,
      courtName: courtName || 'Court',
    })

    onClose()
  }

  return (
    <div className="seeding-modal-backdrop" onClick={onClose}>
      <div className="seeding-modal-card" onClick={(e) => e.stopPropagation()} ref={dropdownModalRef}>
        {/* Modal Header */}
        <div className="seeding-modal-header">
          <div>
            <span className="seeding-modal-badge">BADMINTON POINTS • DRAW & FIXTURE ENGINE</span>
            <h3>Auto-Generate Fixtures & Configure Seeding</h3>
            <p className="seeding-modal-subtitle">{formatTournamentName(match.matchName)} • {formatAddress(match.matchAddress)}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="seeding-modal-body">
          {/* 1. Category Selection */}
          <div className="modal-section">
            <label className="modal-section-title">
              1. Select Category ({categories.length} Categories)
            </label>
            <div className="category-selection-grid">
              {categories.map((cat) => {
                const count = (authenticators[match.id] || []).filter(
                  (p) => (p.category || 'Men Singles') === cat
                ).length
                const isSelected = selectedCategory === cat

                return (
                  <button
                    key={cat}
                    type="button"
                    className={`category-select-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handleCategorySelect(cat)}
                  >
                    <span className="cat-name">{cat}</span>
                    <span className="cat-count">
                      {count > 0 ? `${count} Registered Players` : '0 Uploaded (Auto-Fill)'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Total Members & Draw Size */}
          <div className="modal-section">
            <label className="modal-section-title">
              2. Total Draw Members & Participants
            </label>
            <div className="draw-size-selector-row" style={{ flexWrap: 'wrap', gap: '6px' }}>
              {[4, 8, 16, 32, 64, 128, 256].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`seed-chip ${totalMembers === size ? 'active' : ''}`}
                  onClick={() => {
                    setTotalMembers(size)
                    if (activePlayersCount > size) setActivePlayersCount(size)
                  }}
                >
                  {size} Draw ({size === 4 ? 'SF' : size === 8 ? 'QF' : size === 16 ? 'R16' : size === 32 ? 'R32' : size === 64 ? 'R64' : size === 128 ? 'R128' : 'R256'})
                </button>
              ))}
            </div>

            <div className="modal-inputs-row" style={{ marginTop: '8px' }}>
              <label className="sub-field">
                Total Draw (Manual / Any Size)
                <input
                  type="number"
                  min="2"
                  max="1024"
                  value={totalMembers}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) {
                      setTotalMembers(val)
                    } else {
                      setTotalMembers('')
                    }
                  }}
                  onBlur={() => {
                    const num = Math.max(2, Math.min(1024, Number(totalMembers) || 16))
                    setTotalMembers(num)
                  }}
                  placeholder="256"
                />
              </label>

              <label className="sub-field">
                Total Seeds
                <input
                  type="number"
                  min="0"
                  max={totalMembers}
                  value={seedsCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    if (!isNaN(val)) {
                      setSeedsCount(Math.min(totalMembers, Math.max(0, val)))
                    } else {
                      setSeedsCount('')
                    }
                  }}
                  onBlur={() => {
                    const val = Math.min(totalMembers, Math.max(0, Number(seedsCount) || 0))
                    setSeedsCount(val)
                  }}
                  placeholder="4"
                />
              </label>
            </div>

            {/* Smart Green-Bordered Suggestion Card (Visible until all seeds are filled) */}
            {(() => {
              const areAllSeedsSelected = seedsCount > 0 && Array.from({ length: seedsCount }, (_, i) => i + 1).every((sNum) => {
                const s = seedDetails[sNum]
                return Boolean(s && (s.id || s.name))
              })

              if (areAllSeedsSelected) {
                return (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '7px 12px',
                      background: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid #22c55e',
                      borderRadius: '8px',
                      color: '#4ade80',
                      fontSize: '11px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    ✓ All {seedsCount} Seeds Selected Successfully ({totalMembers} Draw Ready)
                  </div>
                )
              }

              const pCount = uploadedCategoryPlayers.length
              const recDraw = pCount <= 4 ? 4 : pCount <= 8 ? 8 : pCount <= 16 ? 16 : pCount <= 32 ? 32 : 64
              const recSeeds = recDraw <= 4 ? 2 : recDraw <= 16 ? 4 : 8
              const byes = Math.max(0, recDraw - (pCount > 0 ? pCount : recDraw))

              return (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '9px 14px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1.5px solid #22c55e',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>💡</span>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#4ade80' }}>
                        Suggestion ({pCount} Players Registered):
                      </span>
                      <div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '1px' }}>
                        Recommended <strong>{recDraw} Draw</strong> with <strong>{recSeeds} Seeds</strong> • ({pCount > 0 ? pCount : recDraw} Players + {byes} BYEs = {recDraw} Draw with Seed 1 & 2 BYE Priority)
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTotalMembers(recDraw)
                      setSeedsCount(recSeeds)
                    }}
                    style={{
                      background: '#22c55e',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Apply Suggestion
                  </button>
                </div>
              )
            })()}
          </div>

          {/* 3. Number of Seeds Selector */}
          <div className="modal-section">
            <label className="modal-section-title">
              3. Number of Seedings ({selectedCategory})
            </label>
            <div className="seeds-selector-chips">
              {[0, 1, 2, 4, 8, 16].map((sCount) => {
                const isDisabled = sCount > totalMembers / 2 && sCount !== totalMembers
                return (
                  <button
                    key={sCount}
                    type="button"
                    disabled={isDisabled}
                    className={`seed-chip ${seedsCount === sCount ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => setSeedsCount(sCount)}
                  >
                    {sCount === 0 ? 'No Seeds' : `${sCount} Seed${sCount > 1 ? 's' : ''}`}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Match Scheduling & Public Timings */}
          <div className="modal-section" style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: showTimingsOnPublic ? '12px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>⏰</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc' }}>
                  Public Fixtures Match Timings
                </span>
              </div>

              {/* Segmented ON / OFF Toggle Buttons */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(30, 41, 59, 0.9)',
                  padding: '3px',
                  borderRadius: '999px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  gap: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowTimingsOnPublic(true)}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    background: showTimingsOnPublic
                      ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                      : 'transparent',
                    color: showTimingsOnPublic ? '#ffffff' : '#94a3b8',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: showTimingsOnPublic ? '0 0 10px rgba(22, 163, 74, 0.5)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>🟢</span>
                  <span>ON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTimingsOnPublic(false)}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '999px',
                    border: 'none',
                    background: !showTimingsOnPublic
                      ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                      : 'transparent',
                    color: !showTimingsOnPublic ? '#ffffff' : '#94a3b8',
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: !showTimingsOnPublic ? '0 0 10px rgba(220, 38, 38, 0.5)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span>🔴</span>
                  <span>OFF</span>
                </button>
              </div>
            </div>

            {showTimingsOnPublic ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px' }}>
                      ⏰ Start Time
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px' }}>
                      ⏳ Match Duration
                    </label>
                    <select
                      value={matchDuration}
                      onChange={(e) => setMatchDuration(Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        color: '#38bdf8',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value={15}>15 Mins</option>
                      <option value={20}>20 Mins</option>
                      <option value={30}>30 Mins (Std)</option>
                      <option value={45}>45 Mins</option>
                      <option value={60}>60 Mins (1 Hr)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px' }}>
                      🏸 Courts Count
                    </label>
                    <select
                      value={numberOfCourts}
                      onChange={(e) => setNumberOfCourts(Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        color: '#4ade80',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value={1}>1 Court</option>
                      <option value={2}>2 Courts</option>
                      <option value={3}>3 Courts</option>
                      <option value={4}>4 Courts</option>
                      <option value={6}>6 Courts</option>
                      <option value={8}>8 Courts</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#cbd5e1', marginBottom: '4px' }}>
                      🏷️ Court Prefix
                    </label>
                    <input
                      type="text"
                      value={courtName}
                      onChange={(e) => setCourtName(e.target.value)}
                      placeholder="Court"
                      style={{
                        width: '100%',
                        background: '#0f172a',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '8px',
                        padding: '7px 10px',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '8px', fontSize: '11px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚡</span>
                  <span>Matches will be automatically scheduled across {numberOfCourts} courts starting at {startTime} with {matchDuration}m intervals.</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                🔒 Match timings are OFF. Clean draw sheet without timestamps will be generated.
              </div>
            )}
          </div>

          {/* 4. Prioritized Byes for Seeded Players Banner */}
          {calculatedByes > 0 && (
            <div className="seeding-priority-badge-box">
              <div className="badge-icon">🛡️</div>
              <div>
                <strong>BYE Priority & Pairing Rules Active:</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#bae6fd' }}>
                  {seedsCount > 0 ? (
                    <>BYEs are awarded to <strong>Seeded Players First (Seed 1, 2, 3, 4...)</strong>, then remaining {Math.max(0, calculatedByes - seedsCount)} BYE(s) to unseeded players. <strong>Zero BYE-vs-BYE matches:</strong> Every BYE is strictly paired with an actual player for a direct Walkover advance.</>
                  ) : (
                    <>Each of the {calculatedByes} BYE(s) is paired with an actual player. <strong>Zero BYE-vs-BYE matches.</strong></>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* 4. Seed Names / Interactive Player Picker Cards */}
          {seedsCount > 0 && (
            <div className="modal-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label className="modal-section-title" style={{ margin: 0 }}>
                  4. Select Players for Each Seed Slot (Unique Player Required)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const autoMap = {}
                      for (let i = 1; i <= seedsCount; i++) {
                        const p = uploadedCategoryPlayers[i - 1]
                        if (p) {
                          autoMap[i] = { id: p.id, name: p.name || '', place: p.place || '' }
                        }
                      }
                      setSeedDetails(autoMap)
                    }}
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      color: '#bae6fd',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Auto-Assign Registered Seeds
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeedDetails({})}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      color: '#fca5a5',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Clear All
                  </button>
                </div>
              </div>
              <div className="seed-selector-cards-grid">
                {Array.from({ length: seedsCount }, (_, i) => i + 1).map((seedNum) => {
                  const s = seedDetails[seedNum] || {}
                  const selectedPlayer = s.id ? uploadedCategoryPlayers.find((p) => String(p.id) === String(s.id)) : null
                  const displayName = selectedPlayer ? selectedPlayer.name : (s.name || '')
                  const isDropdownOpen = activeSeedDropdown === seedNum

                  return (
                    <div key={seedNum} className={`seed-picker-card ${seedNum === 1 ? 'active-seed-1' : seedNum === 2 ? 'active-seed-2' : ''}`}>
                      <div className="seed-card-badge-header">
                        <span className={`seed-number-tag ${seedNum === 1 ? 'seed-1' : seedNum === 2 ? 'seed-2' : seedNum === 3 ? 'seed-3' : 'seed-other'}`}>
                          {seedNum === 1 ? '🥇 Seed #1' : seedNum === 2 ? '🥈 Seed #2' : seedNum === 3 ? '🥉 Seed #3' : `⭐ Seed #${seedNum}`}
                        </span>
                        <span className="seed-line-pos-text">
                          {getSeedPositionLabel(seedNum, totalMembers)}
                        </span>
                      </div>

                      <div className="seed-picker-input-container">
                        <div
                          className="seed-picker-touch-box"
                          onClick={() => setActiveSeedDropdown(isDropdownOpen ? null : seedNum)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: displayName ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.8)',
                            border: displayName ? '1.5px solid #38bdf8' : '1.5px dashed rgba(148, 163, 184, 0.4)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            minHeight: '38px',
                          }}
                        >
                          {displayName ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#ffffff', fontWeight: '800', fontSize: '13px' }}>
                                ✓ {displayName}
                              </span>
                              {selectedPlayer?.place && (
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>({selectedPlayer.place})</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                              👉 Click to Select Seed #{seedNum} Player...
                            </span>
                          )}

                          {displayName ? (
                            <button
                              type="button"
                              className="seed-clear-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectUploadedPlayerForSeed(seedNum, null)
                              }}
                              title="Clear Seed"
                            >
                              ✕
                            </button>
                          ) : (
                            <span style={{ color: '#38bdf8', fontSize: '12px' }}>▼</span>
                          )}
                        </div>

                        {/* Floating Dropdown Popover */}
                        {isDropdownOpen && (
                          <div className="seed-dropdown-popover">
                            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(148, 163, 184, 0.15)', background: 'rgba(15, 23, 42, 0.95)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                                Pick Player for Seed #{seedNum} ({uploadedCategoryPlayers.length})
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveSeedDropdown(null)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                              >
                                ✕
                              </button>
                            </div>

                            {uploadedCategoryPlayers.length > 0 ? (
                              uploadedCategoryPlayers.map((player) => {
                                const isAssignedHere = String(s.id) === String(player.id)
                                const isAssignedElsewhere = Object.entries(seedDetails).find(
                                  ([k, v]) => Number(k) !== seedNum && String(v?.id) === String(player.id)
                                )

                                return (
                                  <div
                                    key={player.id}
                                    className={`seed-dropdown-item ${isAssignedHere ? 'is-selected' : ''} ${isAssignedElsewhere ? 'is-blocked' : ''}`}
                                    style={{
                                      opacity: isAssignedElsewhere ? 0.45 : 1,
                                      cursor: isAssignedElsewhere ? 'not-allowed' : 'pointer',
                                      background: isAssignedElsewhere ? 'rgba(239, 68, 68, 0.05)' : undefined,
                                    }}
                                    onClick={() => {
                                      if (isAssignedElsewhere) return // BLOCKED!
                                      handleSelectUploadedPlayerForSeed(seedNum, player)
                                    }}
                                  >
                                    <div>
                                      <div className="seed-player-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{player.name}</span>
                                        {isAssignedHere && <span style={{ color: '#fbbf24', fontSize: '11px' }}>✓ Current Seed #{seedNum}</span>}
                                      </div>
                                      <div className="seed-player-meta">
                                        {[player.place, player.court].filter(Boolean).join(' • ')}
                                      </div>
                                    </div>

                                    {isAssignedElsewhere && (
                                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '800', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                        🔒 Assigned to Seed #{isAssignedElsewhere[0]} (Blocked)
                                      </span>
                                    )}
                                  </div>
                                )
                              })
                            ) : (
                              <div style={{ padding: '12px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                No players uploaded for {selectedCategory} yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="seeding-modal-footer">
            <button type="button" className="btn-secondary-glow" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary-gradient"
            >
              🚀 Auto-Generate Draw ({totalMembers} Draw • {calculatedByes} Byes)
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
