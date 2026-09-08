import React, { useState, useEffect, useMemo } from 'react'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
} from '../utils/textFormatters'
import { sortBadmintonCategories } from '../utils/badmintonCategories'

export const TournamentResultsModal = ({
  isOpen,
  tournament,
  onClose,
  publishedStatusMap = {},
}) => {
  const [allDraws, setAllDraws] = useState({})

  // Load draws from localStorage
  useEffect(() => {
    if (!isOpen || !tournament?.id) return
    try {
      const raw = localStorage.getItem('badminton-tournament-draws')
      if (raw) {
        setAllDraws(JSON.parse(raw))
      }
    } catch (e) {
      console.error('Failed to load draws', e)
    }
  }, [isOpen, tournament?.id])

  // Extract category podium data (Winner, Runner, Semi-Finalists)
  const categoryResults = useMemo(() => {
    if (!tournament) return []
    const cats = sortBadmintonCategories(tournament.categories || ['Men Singles', 'Women Singles'])
    return cats
      .map((cat) => {
        const drawKey = `${tournament.id}-${cat}`
        const draw = allDraws[drawKey]

        let winner = tournament.categoryWinners?.[cat] || ''
        let runner = ''
        let semiFinalists = []
        let isCompleted = false

        if (draw && draw.matches && draw.matches.length > 0) {
          const totalRounds = draw.totalRounds || Math.round(Math.log2(draw.drawSize || 16)) || 4
          const finalMatch = draw.matches.find((m) => m.round === totalRounds)

          if (finalMatch?.winner && !finalMatch.winner.isBye) {
            isCompleted = true
            winner = finalMatch.winner.name || winner

            const isP1 =
              (finalMatch.winner.id && finalMatch.player1?.id === finalMatch.winner.id) ||
              finalMatch.player1?.name === finalMatch.winner.name
            const runnerP = isP1 ? finalMatch.player2 : finalMatch.player1
            if (runnerP && !runnerP.isBye) {
              runner = runnerP.name || ''
            }
          }

          // Semi-finalists (joint 3rd place)
          const semiMatches = draw.matches.filter((m) => m.round === totalRounds - 1)
          semiMatches.forEach((sf) => {
            if (sf?.winner && !sf.winner.isBye) {
              const isSfP1 =
                (sf.winner.id && sf.player1?.id === sf.winner.id) ||
                sf.player1?.name === sf.winner.name
              const sfLoser = isSfP1 ? sf.player2 : sf.player1
              if (sfLoser && !sfLoser.isBye && sfLoser.name) {
                semiFinalists.push(sfLoser.name)
              }
            }
          })
        }

        if (winner) isCompleted = true

        return {
          category: cat,
          isCompleted,
          winner,
          runner,
          semiFinalists,
        }
      })
      // Only show categories whose results are updated
      .filter((r) => r.isCompleted)
  }, [tournament, allDraws])

  if (!isOpen || !tournament) return null

  // Handle Official A4 Horizontal Print (Winner, Runner, Semi-Finalists)
  const handlePrint = () => {
    const tName = formatTournamentName(tournament.matchName, 'BADMINTON TOURNAMENT')
    const tVenue = formatAddress(tournament.matchAddress) || formatCourtName(tournament.courtName || '')
    const tDates = tournament.startDate
      ? `${tournament.startDate} to ${tournament.endDate || tournament.startDate}`
      : ''

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${tName} - Official Results</title>
          <style>
            @page { size: A4 landscape; margin: 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; background: #fff; padding: 10px; }
            .cert-box { border: 2.5px solid #0f172a; padding: 24px; border-radius: 8px; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
            .badge { display: inline-block; background: #0f172a; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 14px; border-radius: 999px; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.05em; }
            .title { font-size: 24px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; color: #0f172a; }
            .sub { font-size: 14px; font-weight: 700; color: #b45309; text-transform: uppercase; margin-bottom: 6px; }
            .meta { font-size: 12px; color: #475569; display: flex; justify-content: center; gap: 20px; font-weight: 600; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 30px; font-size: 13px; }
            th { background: #f1f5f9; color: #0f172a; font-weight: 800; border: 1.5px solid #0f172a; padding: 10px 12px; text-align: left; text-transform: uppercase; font-size: 12px; }
            td { border: 1px solid #cbd5e1; padding: 12px; vertical-align: middle; }
            tr:nth-child(even) td { background: #f8fafc; }
            .col-cat { font-weight: 800; font-size: 13.5px; color: #0f172a; width: 22%; }
            .col-win { font-weight: 900; color: #854d0e; background: #fefce8 !important; font-size: 14px; width: 26%; }
            .col-run { font-weight: 800; color: #1e293b; width: 26%; font-size: 13.5px; }
            .col-semi { font-weight: 700; color: #475569; width: 26%; font-size: 13px; }

            .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 40px; text-align: center; }
            .sig-line { border-top: 1.5px solid #0f172a; margin-bottom: 6px; }
            .sig-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; }
            .sig-sub { font-size: 9.5px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="cert-box">
            <div class="header">
              <div class="badge">Official Tournament Results</div>
              <h1 class="title">${tName}</h1>
              <div class="sub">🏆 Category Winners, Runners & Semi-Finalists</div>
              <div class="meta">
                ${tVenue ? `<span>📍 Venue: <strong>${tVenue}</strong></span>` : ''}
                ${tDates ? `<span>📅 Dates: <strong>${tDates}</strong></span>` : ''}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Category</th>
                  <th>🥇 Winner (Champion)</th>
                  <th>🥈 Runner-Up</th>
                  <th>🥉 Semi-Finalists (3rd Place)</th>
                </tr>
              </thead>
              <tbody>
                ${categoryResults
                  .map(
                    (row, idx) => `
                  <tr>
                    <td style="text-align: center; font-weight: 800;">${idx + 1}</td>
                    <td class="col-cat">🏸 ${row.category}</td>
                    <td class="col-win">🥇 ${row.winner ? formatPersonName(row.winner) : 'TBD'}</td>
                    <td class="col-run">${row.runner ? `🥈 ${formatPersonName(row.runner)}` : '-'}</td>
                    <td class="col-semi">${row.semiFinalists.length > 0 ? `🥉 ${row.semiFinalists.map(formatPersonName).join(' • ')}` : '-'}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="sigs">
              <div>
                <div class="sig-line"></div>
                <div class="sig-lbl">Chief Referee</div>
                <div class="sig-sub">Official Verification</div>
              </div>
              <div>
                <div class="sig-line"></div>
                <div class="sig-lbl">Tournament Director</div>
                <div class="sig-sub">Organizing Committee</div>
              </div>
              <div>
                <div class="sig-line"></div>
                <div class="sig-lbl">Organizing Secretary</div>
                <div class="sig-sub">Badminton Association</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
      }, 2000)
    }, 250)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 27, 75, 0.96) 100%)',
          border: '1.5px solid rgba(234, 179, 8, 0.5)',
          borderRadius: '18px',
          padding: '22px 24px',
          maxWidth: '880px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 0 35px rgba(234, 179, 8, 0.2)',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
            paddingBottom: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px' }}>🏆</span>
            <div>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '19px', fontWeight: '800' }}>
                Tournament Results
              </h3>
              <div style={{ fontSize: '13px', color: '#fde047', fontWeight: '700', marginTop: '2px' }}>
                {formatTournamentName(tournament.matchName)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Area: Horizontal One-by-One Layout for Winner, Runner & Semi-Finalists */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            paddingRight: '4px',
          }}
        >
          {categoryResults.length > 0 ? (
            categoryResults.map((row) => (
              <div
                key={row.category}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
                }}
              >
                {/* Category Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#e2e8f0' }}>
                    🏸 {row.category}
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#86efac',
                      border: '1px solid rgba(74, 222, 128, 0.35)',
                    }}
                  >
                    ✓ Result Updated
                  </span>
                </div>

                {/* Horizontal Row: Winner, Runner, and Semi-Finalists Side by Side */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '10px',
                    alignItems: 'stretch',
                  }}
                >
                  {/* 1. WINNER (Champion) */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(202, 138, 4, 0.12) 100%)',
                      border: '1px solid rgba(234, 179, 8, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>🥇</span>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#fde047', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Winner (Champion)
                      </div>
                      <div style={{ fontSize: '14px', color: '#ffffff', fontWeight: '900', marginTop: '2px' }}>
                        {row.winner ? formatPersonName(row.winner) : 'TBD'}
                      </div>
                    </div>
                  </div>

                  {/* 2. RUNNER-UP */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(148, 163, 184, 0.12)',
                      border: '1px solid rgba(203, 213, 225, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>🥈</span>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Runner-Up (Finalist)
                      </div>
                      <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '800', marginTop: '2px' }}>
                        {row.runner ? formatPersonName(row.runner) : '-'}
                      </div>
                    </div>
                  </div>

                  {/* 3. SEMI-FINALISTS */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'rgba(251, 146, 60, 0.12)',
                      border: '1px solid rgba(251, 146, 60, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>🥉</span>
                    <div>
                      <div style={{ fontSize: '10.5px', color: '#fdba74', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Semi-Finalists (3rd Place)
                      </div>
                      <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '700', marginTop: '2px' }}>
                        {row.semiFinalists && row.semiFinalists.length > 0
                          ? row.semiFinalists.map(formatPersonName).join(' • ')
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '12px',
                border: '1px dashed rgba(148, 163, 184, 0.25)',
                color: '#94a3b8',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏸</div>
              <h4 style={{ color: '#f8fafc', margin: '0 0 6px 0', fontSize: '16px' }}>
                No Category Results Updated Yet
              </h4>
              <p style={{ margin: 0, fontSize: '13px' }}>
                Results will appear here once finals are completed or winners are updated!
              </p>
            </div>
          )}
        </div>

        {/* Simple Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            Close
          </button>

          {categoryResults.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(234, 179, 8, 0.35)',
              }}
            >
              <span>🖨️</span>
              <span>Print Result</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
