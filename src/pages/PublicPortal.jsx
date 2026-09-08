import React, { useMemo } from 'react'
import {
  formatTournamentName,
  formatPersonName,
  formatCourtName,
  getMatchStatus,
  compareTournamentsChronological,
  compareTournamentsRecentCompleted,
} from '../utils/textFormatters'
import {
  getMatchCategories,
  sortBadmintonCategories,
} from '../utils/badmintonCategories'

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

const calculateMatchDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const diffInDays = Math.round((end - start) / (1000 * 60 * 60 * 24))
  return diffInDays >= 0 ? diffInDays + 1 : 0
}

const PublicTournamentCard = React.memo(function PublicTournamentCard({
  match,
  idx,
  publishedStatusMap,
  onSelectMatch,
  onOpenFixtures,
  onOpenResultModal,
}) {
  const status = getMatchStatus(match)
  const publishedCategories = (match.categories || []).filter((cat) => publishedStatusMap[`${match.id}-${cat}`])
  const hasPublishedDraw = publishedCategories.length > 0

  return (
    <article 
      className={`pro-tournament-card ${status === 'ongoing' ? 'is-ongoing' : ''}`}
      style={{ '--card-index': idx, cursor: 'pointer' }}
      onClick={() => onSelectMatch(match)}
    >
      <div className="pro-card-banner">
        {match.image ? (
          <img src={match.image} alt={match.matchName} className="pro-card-img" />
        ) : (
          <div className="pro-img-placeholder">
            <span className="pro-placeholder-icon">🏸</span>
          </div>
        )}

        <div className="pro-banner-gradient" />

        <span className={`pro-status-pill status-${status}`}>
          {status === 'ongoing' && <span className="pro-radar-beacon" />}
          <span>{status === 'completed' ? '🏆 Completed' : status === 'ongoing' ? 'Live' : 'Upcoming'}</span>
        </span>

        {hasPublishedDraw && (
          <div className="pro-draw-live-ribbon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h4v4H4" />
              <path d="M4 14h4v4H4" />
              <path d="M8 8h6v8H8" />
              <path d="M14 12h6" />
            </svg>
            <span>DRAW PUBLISHED</span>
          </div>
        )}
      </div>

      <div className="pro-card-body">
        <div className="pro-card-header-row">
          <div className="pro-title-meta-block">
            <h2 className="pro-tournament-title">
              {match.matchName}
            </h2>
            <div className="pro-venue-row">
              <span className="venue-pin-icon">📍</span>
              <span className="venue-text">{match.matchAddress || match.courtName}</span>
            </div>
          </div>

          <div className="pro-card-right-date">
            <div className="pro-date-range-badge">
              <span className="pro-date-icon">📅</span>
              <span className="pro-date-text">
                {match?.startDate ? formatDisplayDate(match.startDate) : ''} - {match?.endDate ? formatDisplayDate(match.endDate) : ''}
              </span>
            </div>
            <div className="pro-days-count-tag">
              <span className="pro-clock-icon">⏱️</span>
              <span>{match?.matchDuration ?? calculateMatchDuration(match?.startDate, match?.endDate)} Days Tournament</span>
            </div>
          </div>
        </div>

        {((match.categoryWinners && Object.keys(match.categoryWinners).length > 0) || match.winner) && (
          <div className="pro-champion-banner">
            <span className="pro-trophy-icon">🏆</span>
            <div className="pro-champion-text">
              <div className="pro-champion-head">
                {getMatchStatus(match) === 'completed' ? 'Tournament Champions' : 'Category Winners'}
              </div>
              {match.categoryWinners && Object.keys(match.categoryWinners).length > 0 ? (
                <div className="pro-winners-grid">
                  {Object.entries(match.categoryWinners).map(([cat, wName]) => (
                    <div key={cat} className="pro-winner-line">
                      <span className="cat-prefix">{cat}:</span> {formatPersonName(wName)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pro-winner-single">{formatPersonName(match.winner)}</div>
              )}
            </div>
          </div>
        )}

        <div className="pro-categories-wrap">
          {publishedCategories.map((category) => (
            <span
              key={`${match.id}-${category}`}
              className="pro-cat-pill"
            >
              <span className="pro-cat-dot" />
              <span>🏸 {category}</span>
            </span>
          ))}
        </div>

        <div className="pro-card-footer mt-2">
          <div className={`pro-btn-grid grid ${hasPublishedDraw ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'} gap-2.5 w-full`}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectMatch(match)
              }}
              className="pro-btn-action btn-details flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl text-sm font-bold transition active:scale-95"
            >
              <span>📋</span>
              <span>Details</span>
            </button>

            {hasPublishedDraw && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenFixtures(match, publishedCategories[0])
                }}
                className="pro-btn-action btn-fixtures flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl text-sm font-bold transition active:scale-95"
              >
                <span>🎯</span>
                <span>Fixtures</span>
              </button>
            )}

            {hasPublishedDraw && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenResultModal(match)
                }}
                className="pro-btn-action btn-result flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl text-sm font-bold transition active:scale-95"
              >
                <span>🏆</span>
                <span>Result</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})

export function PublicPortal({
  publishedMatches = [],
  publishedStatusMap = {},
  authenticators = {},
  selectedMatch,
  setSelectedMatch,
  activeCategory,
  setActiveCategory,
  publicFilter,
  setPublicFilter,
  authSession,
  onOpenAuth,
  onOpenFixtures,
  onOpenResultModal,
}) {
  const sortedMatches = useMemo(() => {
    return [...publishedMatches].sort((a, b) => {
      const statusA = getMatchStatus(a)
      const statusB = getMatchStatus(b)
      if (statusA === 'ongoing' && statusB !== 'ongoing') return -1
      if (statusB === 'ongoing' && statusA !== 'ongoing') return 1
      if (statusA === 'completed' && statusB === 'completed') {
        return compareTournamentsRecentCompleted(a, b)
      }
      if (statusA === 'upcoming' && statusB === 'completed') return -1
      if (statusB === 'upcoming' && statusA === 'completed') return 1
      return compareTournamentsChronological(a, b)
    })
  }, [publishedMatches])

  const filteredPublicMatches = useMemo(() => {
    const list = [...sortedMatches].filter((match) => {
      if (publicFilter === 'all') return true
      return getMatchStatus(match) === publicFilter
    })
    if (publicFilter === 'completed') {
      return list.sort(compareTournamentsRecentCompleted)
    }
    return list.sort(compareTournamentsChronological)
  }, [sortedMatches, publicFilter])

  const selectedMatchCategories = selectedMatch ? getMatchCategories(selectedMatch) : []
  const groupedSelectedParticipants = selectedMatch
    ? selectedMatchCategories.reduce((entries, category) => {
        entries[category] = (authenticators[selectedMatch.id] || []).filter(
          (participant) => (participant.category || 'Men Singles') === category
        )
        return entries
      }, {})
    : {}

  return (
    <div className="public-tournament-hub w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8 space-y-6">
      {selectedMatch ? (
        <div className="pub-hub-match-detail-view space-y-6">
          {/* Top Bar with Back Button */}
          <div className="pub-hub-top-nav flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedMatch(null)}
              className="pub-hub-back-btn inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              <span className="back-arrow">←</span>
              <span>All Tournaments</span>
            </button>
            <div className="pub-hub-nav-badges">
              <span className={`pub-status-badge status-${getMatchStatus(selectedMatch)} inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold`}>
                {getMatchStatus(selectedMatch) === 'completed' ? '🏆 Completed' : getMatchStatus(selectedMatch) === 'ongoing' ? '🔴 Live Ongoing' : '📅 Upcoming'}
              </span>
            </div>
          </div>

          {/* Tournament Showcase Banner */}
          <div className="pub-hub-hero-card">
            <div className="pub-hub-hero-media">
              {selectedMatch.image ? (
                <img src={selectedMatch.image} alt={selectedMatch.matchName} className="pub-hub-hero-img" />
              ) : (
                <div className="pub-hub-hero-placeholder">
                  <span>🏸</span>
                </div>
              )}
              <div className="pub-hub-media-overlay" />
            </div>

            <div className="pub-hub-hero-content">
              <h1 className="pub-hub-hero-title">{formatTournamentName(selectedMatch.matchName)}</h1>
              <div className="pub-hub-meta-chips">
                <span className="pub-meta-chip">
                  <span className="chip-icon">📍</span>
                  <span>{selectedMatch.matchAddress || selectedMatch.courtName}</span>
                </span>
                <span className="pub-meta-chip">
                  <span className="chip-icon">📅</span>
                  <span>{formatDisplayDate(selectedMatch.startDate)} - {formatDisplayDate(selectedMatch.endDate)}</span>
                </span>
                <span className="pub-meta-chip">
                  <span className="chip-icon">⏱️</span>
                  <span>{selectedMatch.matchDuration ?? calculateMatchDuration(selectedMatch.startDate, selectedMatch.endDate)} Days Event</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Bar */}
          {(() => {
            const pubCats = selectedMatchCategories.filter(
              (cat) => publishedStatusMap[`${selectedMatch.id}-${cat}`]
            )
            const hasDraws = pubCats.length > 0

            return (
              <div className="pub-hub-action-strip">
                <div className="pub-hub-actions-grid">
                  <button
                    type="button"
                    onClick={() => onOpenResultModal(selectedMatch)}
                    className="pub-hub-action-btn btn-primary-gradient"
                  >
                    <span className="btn-icon">🏆</span>
                    <div className="btn-text-block">
                      <span className="btn-main-text">Results & Winners</span>
                      <span className="btn-sub-text">Podium & Champion List</span>
                    </div>
                  </button>

                  {hasDraws && (
                    <button
                      type="button"
                      onClick={() => onOpenFixtures(selectedMatch, pubCats[0])}
                      className="pub-hub-action-btn btn-draw-emerald"
                    >
                      <span className="btn-icon">🎯</span>
                      <div className="btn-text-block">
                        <span className="btn-main-text">Official Draw Sheet</span>
                        <span className="btn-sub-text">Live Bracket & Scores</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Tournament Category & Players Explorer */}
          <div className="pub-hub-categories-section">
            <div className="pub-hub-section-header">
              <h2 className="pub-hub-section-title">
                <span>🏸 Tournament Categories & Registered Players</span>
              </h2>
              <span className="pub-hub-total-cats-pill">{selectedMatchCategories.length} Categories</span>
            </div>

            {/* Category Selection Tabs */}
            <div className="pub-hub-cat-tabs-row">
              {selectedMatchCategories.map((category) => {
                const isPub = publishedStatusMap[`${selectedMatch.id}-${category}`]
                const pCount = (groupedSelectedParticipants[category] || []).length
                const isActive = activeCategory === category

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`pub-hub-cat-tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <span className="tab-cat-name">{category}</span>
                    <span className="tab-player-count">{pCount}</span>
                    {isPub && <span className="tab-live-badge">LIVE DRAW</span>}
                  </button>
                )
              })}
            </div>

            {/* Active Category Details Panel */}
            {activeCategory && (
              <div className="pub-hub-cat-detail-panel">
                <div className="pub-cat-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div className="pub-cat-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="cat-title-text">{activeCategory}</span>
                    <span className="cat-entries-badge">
                      {(groupedSelectedParticipants[activeCategory] || []).length} Registered Entries
                    </span>
                    {publishedStatusMap[`${selectedMatch.id}-${activeCategory}`] && (
                      <button
                        type="button"
                        onClick={() => onOpenFixtures(selectedMatch, activeCategory)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                          border: '1px solid rgba(56, 189, 248, 0.5)',
                          color: '#ffffff',
                          fontWeight: '800',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>🎯 View Fixtures & Draw Sheet →</span>
                      </button>
                    )}
                  </div>

                  {selectedMatch.categoryWinners?.[activeCategory] && (
                    <div className="pub-cat-winner-pill">
                      <span className="winner-trophy">🏆</span>
                      <span className="winner-label">Category Champion:</span>
                      <strong className="winner-name">{formatPersonName(selectedMatch.categoryWinners[activeCategory])}</strong>
                    </div>
                  )}
                </div>

                {/* Participant Entries Grid */}
                {(groupedSelectedParticipants[activeCategory] || []).length > 0 ? (
                  <div className="pub-players-grid">
                    {(groupedSelectedParticipants[activeCategory] || []).map((participant, pIdx) => {
                      const displayName = participant.name?.trim() ? participant.name : 'Participant'
                      const isSeed = participant.seed || participant.isSeed

                      return (
                        <div key={participant.id || pIdx} className="pub-player-card">
                          <div className="pub-player-avatar">
                            <span>{pIdx + 1}</span>
                          </div>

                          <div className="pub-player-info">
                            <div className="pub-player-name-row">
                              <span className="pub-player-name">{formatPersonName(displayName)}</span>
                              {isSeed && (
                                <span className="pub-seed-badge">Seed {participant.seed || ''}</span>
                              )}
                            </div>

                            {Boolean(participant.court || participant.place) && (
                              <div className="pub-player-meta">
                                <span className="pub-club-pin">📍</span>
                                <span>{[participant.court, participant.place].filter(Boolean).join(' • ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="pub-no-players-box">
                    <span className="no-players-icon">👥</span>
                    <p>No players listed under {activeCategory} yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Public Front Page Header */}
          <header className="public-main-header flex items-center justify-between gap-4 p-4 md:p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-md shadow-xl">
            <div className="public-header-brand flex items-center gap-3.5 sm:gap-4">
              <div className="public-brand-logo-container w-11 h-11 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-400/30 flex-shrink-0">
                <span className="public-header-icon text-2xl sm:text-3xl" role="img" aria-label="Badminton">🏸</span>
                <span className="public-brand-aura" />
              </div>
              <div className="public-brand-info">
                <div className="public-brand-title-wrap flex items-center gap-2 flex-wrap">
                  <h1 className="public-header-title text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white m-0">
                    BADMINTON <span className="title-highlight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">MAFIA</span>
                  </h1>
                  <span className="public-mafia-badge px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-500/20 text-sky-400 border border-sky-400/30 tracking-wider">OFFICIAL</span>
                </div>
                <div className="public-header-subtitle flex items-center gap-2 text-xs sm:text-sm text-slate-400 mt-0.5">
                  <span className="live-status-pulse w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Official Tournament Portal & Live Draws</span>
                </div>
              </div>
            </div>

            <div className="public-header-actions flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAuth}
                className="public-auth-btn icon-only p-2.5 sm:p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700 transition active:scale-95"
                title={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
                aria-label={authSession ? 'Organizer / Umpire Portal' : 'Organizer / Umpire Login'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </button>
            </div>
          </header>

          {/* Status Filter Bar */}
          <div className="public-filter-bar-pro flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-none sm:flex-wrap">
            {[
              { id: 'all', label: 'All Tournaments' },
              { id: 'ongoing', label: 'Ongoing', live: true },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => {
              const isActive = publicFilter === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPublicFilter(tab.id)}
                  className={`public-filter-btn-pro ${isActive ? 'active' : ''} px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap flex items-center gap-2`}
                >
                  {tab.live && <span className="live-filter-dot w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tournament Feed Grid */}
          <div className="public-feed-pro">
            {filteredPublicMatches.length > 0 ? (
              filteredPublicMatches.map((match, idx) => (
                <PublicTournamentCard
                  key={match.id}
                  match={match}
                  idx={idx}
                  publishedStatusMap={publishedStatusMap}
                  onSelectMatch={setSelectedMatch}
                  onOpenFixtures={onOpenFixtures}
                  onOpenResultModal={onOpenResultModal}
                />
              ))
            ) : (
              <div className="pro-empty-feed">
                <div className="pro-empty-icon">🏸</div>
                <h3 className="pro-empty-title">
                  No {publicFilter === 'all' ? '' : publicFilter.charAt(0).toUpperCase() + publicFilter.slice(1)} Tournaments
                </h3>
                <p className="pro-empty-subtitle">
                  There are no tournaments currently listed in this section.
                </p>
                {publicFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setPublicFilter('all')}
                    className="pro-empty-reset-btn"
                  >
                    Show All Tournaments
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
