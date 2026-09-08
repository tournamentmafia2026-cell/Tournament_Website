import React from 'react'
import { isChiefOrganizerSession } from '../hooks/useOrganizerAuth'

export function OrganizerPortalHeader({
  authSession,
  activePage,
  setActivePage,
  onLogout,
  onBackToPublic,
  onSelectMatch,
  publishedMatches = [],
  isLiveStreamActive,
  onToggleLiveStream,
  onStopLiveStream,
}) {
  const isChief = isChiefOrganizerSession(authSession)

  return (
    <header className="app-top-navbar flex flex-col gap-3 p-3 sm:p-4 md:p-5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="top-navbar-brand flex items-center gap-3">
          <div className="navbar-logo-badge w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-400/30 flex items-center justify-center text-xl flex-shrink-0">
            <span className="navbar-logo-icon">🏸</span>
          </div>
          <div className="navbar-brand-info">
            <div className="navbar-title-row flex items-center gap-2 flex-wrap">
              <strong className="navbar-brand-title text-base sm:text-lg font-black tracking-tight text-white">
                BADMINTON <span className="text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]">MAFIA</span>
              </strong>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider border ${
                  isChief
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    : 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                }`}
              >
                {isChief ? 'CHIEF ORGANIZER' : 'MATCH OFFICIAL'}
              </span>
            </div>
            <span className="navbar-brand-subtitle text-xs text-slate-400 block truncate max-w-xs sm:max-w-md">
              {isChief
                ? 'Official Tournament Management & Live Draws Control'
                : `Restricted Access: ${authSession?.assignedMatchName || 'Assigned Tournament'}`}
            </span>
          </div>
        </div>

        {/* Navigation Tabs - Original Names & Actions */}
        <nav className="top-navbar-links flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap">
          {!isChief && authSession?.assignedMatchName && (
            <span className="bg-amber-500/20 border border-amber-400/50 text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
              <span>🔒</span>
              <span>{authSession.assignedMatchName}</span>
            </span>
          )}

          {isChief && (
            <button
              type="button"
              className={`top-nav-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
                activePage === 'login'
                  ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
              }`}
              onClick={() => setActivePage('login')}
            >
              🔐 Logins
            </button>
          )}

          {isChief && (
            <button
              type="button"
              className={`top-nav-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
                activePage === 'newMatchUpdate'
                  ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
              }`}
              onClick={() => setActivePage('newMatchUpdate')}
            >
              ➕ New Match
            </button>
          )}

          <button
            type="button"
            className={`top-nav-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
              activePage === 'matchManagement'
                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
            onClick={() => setActivePage('matchManagement')}
          >
            🏆 Management
          </button>

          <button
            type="button"
            className={`top-nav-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
              activePage === 'fixturesManagement'
                ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
            }`}
            onClick={() => {
              if (authSession?.assignedMatchId) {
                const target = publishedMatches.find((m) => String(m.id) === String(authSession.assignedMatchId))
                if (target) onSelectMatch(target)
              }
              setActivePage('fixturesManagement')
            }}
          >
            ⚡ Fixtures
          </button>

          <button
            type="button"
            onClick={onBackToPublic}
            className="top-nav-btn public-toggle-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            👁️ Public
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="top-nav-btn px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 cursor-pointer"
          >
            🚪 Logout
          </button>
        </nav>
      </div>
    </header>
  )
}
