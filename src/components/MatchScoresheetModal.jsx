import { useEffect, useRef, useState } from 'react'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatCategoryName,
  splitDoublesNames,
} from '../utils/textFormatters'
import { isDoublesCategory } from '../utils/badmintonCategories'

export const MatchScoresheetModal = ({
  isOpen = false,
  onClose = () => {},
  match = null,
  tournament = null,
  category = 'Men Singles',
}) => {
  const modalRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !match) return null

  const isDoubles = isDoublesCategory(category)
  const [p1Name1, p1Name2] = splitDoublesNames(match.player1?.name || '')
  const [p2Name1, p2Name2] = splitDoublesNames(match.player2?.name || '')

  const p1 = {
    ...match.player1,
    name: formatPersonName(match.player1?.name || (isDoubles ? 'Doubles Pair 1' : 'Player 1')),
    player1: formatPersonName(p1Name1 || 'Player 1'),
    player2: formatPersonName(p1Name2 || (isDoubles ? 'Partner' : '')),
  }
  const p2 = {
    ...match.player2,
    name: formatPersonName(match.player2?.name || (isDoubles ? 'Doubles Pair 2' : 'Player 2')),
    player1: formatPersonName(p2Name1 || 'Player 2'),
    player2: formatPersonName(p2Name2 || (isDoubles ? 'Partner' : '')),
  }
  const tournamentName = formatTournamentName(tournament?.matchName, 'Badminton Tournament')
  const matchNum = match.matchNumber ? `M#${match.matchNumber}` : `Match #${match.id || 1}`
  const roundName = match.roundName || `Round ${match.round || 1}`
  const courtName = formatCourtName(match.court || tournament?.courtName || '')
  const displayCategory = formatCategoryName(category)

  const handlePrint = () => {
    const printContent = document.getElementById('printable-scoresheet')
    if (!printContent) {
      window.print()
      return
    }

    // Use isolated hidden iframe to guarantee 100% Page 1 single half-page print
    let iframe = document.getElementById('scoresheet-print-iframe')
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.id = 'scoresheet-print-iframe'
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0px'
      iframe.style.height = '0px'
      iframe.style.border = 'none'
      iframe.style.zIndex = '-1000'
      document.body.appendChild(iframe)
    }

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
    iframeDoc.open()
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${tournamentName} - ${matchNum} Scoresheet</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              background: #ffffff;
              color: #000000;
              font-family: Arial, Helvetica, sans-serif;
              margin: 0;
              padding: 0;
              height: auto;
              width: 100%;
            }
            .official-scoresheet-sheet.half-page-a5 {
              width: 100%;
              max-width: 100%;
              max-height: 136mm;
              border: 1.5px solid #000;
              border-radius: 4px;
              padding: 4mm 6mm;
              margin: 0 auto;
              overflow: hidden;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
              page-break-after: avoid;
            }
            .a5-compact-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 1.5px solid #000;
              padding-bottom: 3px;
              margin-bottom: 3px;
            }
            .a5-compact-title-wrap { flex: 1; }
            .a5-compact-tournament {
              font-size: 13px;
              font-weight: 900;
              color: #000;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 0.02em;
              line-height: 1.1;
            }
            .a5-compact-doctype {
              font-size: 9px;
              font-weight: 800;
              color: #1e3a8a;
              letter-spacing: 0.05em;
              margin-top: 1px;
            }
            .a5-compact-match-badge {
              border: 1.5px solid #000;
              border-radius: 3px;
              padding: 1px 6px;
              text-align: center;
              background: #f8fafc;
              min-width: 50px;
            }
            .a5-compact-match-badge .badge-tag {
              font-size: 7px;
              font-weight: 800;
              color: #555;
              display: block;
            }
            .a5-compact-match-badge .badge-num {
              font-size: 11.5px;
              font-weight: 900;
              color: #000;
              display: block;
              line-height: 1;
            }
            .a5-meta-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f8fafc;
              border: 1px solid #000;
              padding: 2px 6px;
              margin-bottom: 3px;
              font-size: 8.5px;
            }
            .a5-meta-bar .meta-cell { display: flex; align-items: center; gap: 3px; }
            .a5-meta-bar .lbl { color: #333; font-weight: 700; }
            .a5-meta-bar .val { color: #000; font-weight: 800; }
            .a5-meta-bar .val-line { color: #000; }
            .a5-matchup-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border: 1.5px solid #000;
              border-radius: 3px;
              padding: 2px 6px;
              margin-bottom: 3px;
              background: #fff;
            }
            .a5-matchup-bar .matchup-side {
              font-size: 10px;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .a5-matchup-bar .matchup-side.doubles-side {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 1px;
            }
            .a5-matchup-bar .doubles-names-container {
              display: flex;
              flex-direction: column;
              gap: 1px;
              font-size: 8.5px;
              line-height: 1.15;
            }
            .a5-matchup-bar .doubles-player-row {
              display: flex;
              align-items: center;
              gap: 3px;
            }
            .a5-matchup-bar .doubles-num {
              font-size: 7.5px;
              font-weight: 800;
              color: #2563eb;
            }
            .a5-matchup-bar .doubles-name {
              font-weight: 900;
              color: #000;
            }
            .a5-matchup-bar .side-tag {
              font-size: 7.5px;
              font-weight: 800;
              color: #2563eb;
              letter-spacing: 0.03em;
            }
            .a5-matchup-bar .pname { font-weight: 900; color: #000; }
            .a5-matchup-bar .seed-badge { color: #dc2626; font-size: 8.5px; font-weight: 800; }
            .a5-matchup-bar .pplace { color: #555; font-size: 8px; }
            .a5-matchup-bar .matchup-vs {
              font-size: 8px;
              font-weight: 900;
              color: #333;
              background: #f1f5f9;
              border: 1px solid #000;
              border-radius: 999px;
              padding: 1px 5px;
              margin: 0 4px;
            }
            .a5-sets-grid {
              display: flex;
              flex-direction: column;
              gap: 3px;
              margin-bottom: 3px;
            }
            .a5-set-row-block {
              border: 1px solid #000;
              border-radius: 3px;
              padding: 2px 5px;
              background: #fff;
            }
            .set-row-head {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1px;
            }
            .set-row-head .set-lbl { font-size: 8.5px; font-weight: 900; color: #000; }
            .set-row-head .set-scr { font-size: 8.5px; font-weight: 800; color: #000; }
            .a5-mini-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              margin-bottom: 1px;
            }
            .a5-mini-table th, .a5-mini-table td {
              border: 1px solid #000;
              text-align: center;
              padding: 0;
              height: 13.5px;
              line-height: 13.5px;
              box-sizing: border-box;
            }
            .a5-mini-table .th-pname {
              width: ${isDoubles ? '76px' : '62px'};
              font-size: 7px;
              font-weight: 800;
              background: #f8fafc;
              text-align: left;
              padding-left: 2px;
              color: #000;
            }
            .a5-mini-table .td-pname {
              font-size: 7.5px;
              font-weight: 800;
              text-align: left;
              padding-left: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              background: #f8fafc;
              color: #000;
            }
            .a5-mini-table .td-pname.doubles-pname {
              font-size: 6.5px;
              line-height: 1.1;
              padding: 1px 2px;
              height: 17px;
              vertical-align: middle;
            }
            .a5-mini-table .doubles-cell-stack {
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 1px;
            }
            .a5-mini-table .doubles-cell-stack .dp-item {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 74px;
              font-weight: 800;
            }
            .a5-mini-table tr.doubles-row td {
              height: 17px;
              line-height: 17px;
            }
            .a5-mini-table .th-n {
              font-size: 6.5px;
              font-weight: 700;
              color: #000;
              background: #f8fafc;
            }
            .a5-mini-table .th-n.int-col { background: #e0f2fe; color: #0369a1; font-weight: 900; }
            .a5-mini-table .th-n.gm-col { background: #dcfce7; color: #15803d; font-weight: 900; }
            .a5-mini-table .td-n { font-size: 7.5px; font-weight: 900; color: #dc2626; background: #fff; }
            .a5-mini-table .td-n.int-box { background: #f0f9ff; }
            .a5-mini-table .td-n.gm-box { background: #f0fdf4; }
            .a5-mini-table .td-n.ticked { background: #f1f5f9; }
            .a5-mini-table .th-tot { width: 28px; font-size: 6.5px; font-weight: 900; background: #000; color: #fff; }
            .a5-mini-table .td-tot { font-size: 8px; font-weight: 900; background: #f8fafc; color: #000; }
            .set-row-winner {
              font-size: 7.5px;
              color: #000;
              padding-top: 1px;
              border-top: 1px dotted #000;
            }
            .a5-result-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border: 1px solid #000;
              background: #f8fafc;
              padding: 2px 6px;
              margin-bottom: 3px;
              font-size: 8.5px;
            }
            .a5-result-bar .res-cell { display: flex; align-items: center; gap: 4px; }
            .a5-result-bar .res-lbl { font-weight: 800; color: #000; }
            .a5-result-bar .res-val { color: #000; }
            .a5-signatures-bar {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              padding-top: 2px;
              text-align: center;
            }
            .a5-signatures-bar .sig-col { text-align: center; }
            .a5-signatures-bar .sig-line { border-top: 1px solid #000; margin-bottom: 2px; }
            .a5-signatures-bar .sig-title { font-size: 7.5px; font-weight: 800; color: #000; }
          </style>
        </head>
        <body>
          ${printContent.outerHTML}
        </body>
      </html>
    `)
    iframeDoc.close()

    setTimeout(() => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    }, 200)
  }

  return (
    <div className="scoresheet-modal-backdrop" onClick={onClose}>
      <div
        className="scoresheet-modal-container"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Action Bar (Hidden on Print) */}
        <div className="scoresheet-modal-toolbar no-print">
          <div className="scoresheet-toolbar-title">
            <span>📋</span>
            <span>Official Scoresheet • {matchNum} ({category})</span>
            <span className="a5-badge-tag">{isDoubles ? 'Doubles Format' : 'A5 Half-Page Format'}</span>
          </div>

          <div className="scoresheet-toolbar-actions">
            <button
              type="button"
              className="btn-print-action"
              onClick={handlePrint}
              title="Print Official Score Sheet"
            >
              🖨️ Print Scoresheet
            </button>
            <button
              type="button"
              className="btn-close-action"
              onClick={onClose}
              title="Close Preview"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* =========================================================================
            CLEAN, 100% SINGLE HALF-PAGE A5 BADMINTON SCORESHEET
           ========================================================================= */}
        <div className="official-scoresheet-sheet half-page-a5" id="printable-scoresheet">
          {/* Header */}
          <div className="a5-compact-header">
            <div className="a5-compact-title-wrap">
              <h1 className="a5-compact-tournament">{tournamentName}</h1>
              <div className="a5-compact-doctype">
                {isDoubles ? 'OFFICIAL BADMINTON DOUBLES SCORE SHEET' : 'OFFICIAL BADMINTON MATCH SCORE SHEET'}
              </div>
            </div>
            <div className="a5-compact-match-badge">
              <span className="badge-tag">MATCH</span>
              <strong className="badge-num">{matchNum}</strong>
            </div>
          </div>

          {/* 1-Row Compact Metadata Bar */}
          <div className="a5-meta-bar">
            <div className="meta-cell">
              <span className="lbl">Category:</span>
              <strong className="val">{category}</strong>
            </div>
            <div className="meta-cell">
              <span className="lbl">Stage/Round:</span>
              <strong className="val">{roundName}</strong>
            </div>
            <div className="meta-cell">
              <span className="lbl">Court:</span>
              <strong className="val">{courtName || '—'}</strong>
            </div>
            <div className="meta-cell">
              <span className="lbl">Umpire:</span>
              <span className="val-line">____________________</span>
            </div>
          </div>

          {/* Player Matchup Lineup */}
          <div className="a5-matchup-bar">
            {isDoubles ? (
              <div className="matchup-side side-left doubles-side">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="side-tag">SIDE A (PAIR):</span>
                  {Boolean(p1.seed || p1.isSeed) && <span className="seed-badge">(S{p1.seed})</span>}
                  {p1.place && <span className="pplace">[{p1.place}]</span>}
                </div>
                <div className="doubles-names-container">
                  <div className="doubles-player-row">
                    <span className="doubles-num">1.</span>
                    <strong className="doubles-name">{p1.player1}</strong>
                  </div>
                  <div className="doubles-player-row">
                    <span className="doubles-num">2.</span>
                    <strong className="doubles-name">{p1.player2}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="matchup-side side-left">
                <span className="side-tag">SIDE A:</span>
                <strong className="pname">
                  {p1.name || 'Player 1'}
                  {Boolean(p1.seed || p1.isSeed) && <span className="seed-badge"> (S{p1.seed})</span>}
                </strong>
                {p1.place && <span className="pplace">[{p1.place}]</span>}
              </div>
            )}

            <div className="matchup-vs">VS</div>

            {isDoubles ? (
              <div className="matchup-side side-right doubles-side">
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="side-tag">SIDE B (PAIR):</span>
                  {Boolean(p2.seed || p2.isSeed) && <span className="seed-badge">(S{p2.seed})</span>}
                  {p2.place && <span className="pplace">[{p2.place}]</span>}
                </div>
                <div className="doubles-names-container">
                  <div className="doubles-player-row">
                    <span className="doubles-num">1.</span>
                    <strong className="doubles-name">{p2.player1}</strong>
                  </div>
                  <div className="doubles-player-row">
                    <span className="doubles-num">2.</span>
                    <strong className="doubles-name">{p2.player2}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="matchup-side side-right">
                <span className="side-tag">SIDE B:</span>
                <strong className="pname">
                  {p2.name || 'Player 2'}
                  {Boolean(p2.seed || p2.isSeed) && <span className="seed-badge"> (S{p2.seed})</span>}
                </strong>
                {p2.place && <span className="pplace">[{p2.place}]</span>}
              </div>
            )}
          </div>

          {/* 3 Compact Sets Running Points Table */}
          <div className="a5-sets-grid">
            {[1, 2, 3].map((sNum) => {
              const scoreA = match[`scoreSet${sNum}A`]
              const scoreB = match[`scoreSet${sNum}B`]
              const hasRecordedScore = scoreA !== undefined && scoreA !== ''

              return (
                <div key={sNum} className="a5-set-row-block">
                  <div className="set-row-head">
                    <strong className="set-lbl">SET {sNum} {sNum === 3 ? '(If Required)' : ''}</strong>
                    <span className="set-scr">
                      {hasRecordedScore ? `Score: ${scoreA} - ${scoreB}` : 'Score: ___ - ___'}
                    </span>
                  </div>

                  {/* Clean 1-30 Points Scoring Table */}
                  <table className="a5-mini-table">
                    <thead>
                      <tr>
                        <th className="th-pname">{isDoubles ? 'Doubles Pair' : 'Player'}</th>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                          <th key={n} className={`th-n ${n === 11 ? 'int-col' : ''} ${n === 21 ? 'gm-col' : ''}`}>
                            {n}
                          </th>
                        ))}
                        <th className="th-tot">TOT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Player 1 Row */}
                      <tr className={isDoubles ? 'doubles-row' : ''}>
                        <td className={`td-pname ${isDoubles ? 'doubles-pname' : ''}`} title={isDoubles ? `${p1.player1} & ${p1.player2} (A)` : p1.name}>
                          {isDoubles ? (
                            <div className="doubles-cell-stack">
                              <div className="dp-item">1.{p1.player1}</div>
                              <div className="dp-item">2.{p1.player2} (A)</div>
                            </div>
                          ) : (
                            <span>{p1.name?.split(' ')[0] || 'Player 1'} (A)</span>
                          )}
                        </td>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                          const isTicked = hasRecordedScore && Number(scoreA) >= n
                          return (
                            <td key={n} className={`td-n ${n === 11 ? 'int-box' : ''} ${n === 21 ? 'gm-box' : ''} ${isTicked ? 'ticked' : ''}`}>
                              {isTicked ? '/' : ''}
                            </td>
                          )
                        })}
                        <td className="td-tot">
                          <strong>{hasRecordedScore ? scoreA : ''}</strong>
                        </td>
                      </tr>

                      {/* Player 2 Row */}
                      <tr className={isDoubles ? 'doubles-row' : ''}>
                        <td className={`td-pname ${isDoubles ? 'doubles-pname' : ''}`} title={isDoubles ? `${p2.player1} & ${p2.player2} (B)` : p2.name}>
                          {isDoubles ? (
                            <div className="doubles-cell-stack">
                              <div className="dp-item">1.{p2.player1}</div>
                              <div className="dp-item">2.{p2.player2} (B)</div>
                            </div>
                          ) : (
                            <span>{p2.name?.split(' ')[0] || 'Player 2'} (B)</span>
                          )}
                        </td>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                          const isTicked = hasRecordedScore && Number(scoreB) >= n
                          return (
                            <td key={n} className={`td-n ${n === 11 ? 'int-box' : ''} ${n === 21 ? 'gm-box' : ''} ${isTicked ? 'ticked' : ''}`}>
                              {isTicked ? '/' : ''}
                            </td>
                          )
                        })}
                        <td className="td-tot">
                          <strong>{hasRecordedScore ? scoreB : ''}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Winner Line for this set */}
                  <div className="set-row-winner">
                    <span><strong>Winner:</strong> __________________________________________________</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Match Result & Final Score */}
          <div className="a5-result-bar">
            <div className="res-cell res-winner">
              <span className="res-lbl">Match Winner:</span>
              <span className="res-val">
                {match.winner ? (
                  <strong>
                    🏆 {isDoubles
                      ? `${splitDoublesNames(match.winner.name)[0]} / ${splitDoublesNames(match.winner.name)[1] || ''}`
                      : match.winner.name}
                  </strong>
                ) : '____________________________________'}
              </span>
            </div>
            <div className="res-cell res-score">
              <span className="res-lbl">Final Score:</span>
              <span className="res-val">
                {match.scoreSet1A && match.scoreSet1B ? (
                  <strong>
                    {match.scoreSet1A}-{match.scoreSet1B}
                    {match.scoreSet2A ? `, ${match.scoreSet2A}-${match.scoreSet2B}` : ''}
                    {match.scoreSet3A ? `, ${match.scoreSet3A}-${match.scoreSet3B}` : ''}
                  </strong>
                ) : (
                  '____ - ____ ,  ____ - ____ ,  ____ - ____'
                )}
              </span>
            </div>
          </div>

          {/* Official Signatures Bar */}
          <div className="a5-signatures-bar">
            <div className="sig-col">
              <div className="sig-line" />
              <div className="sig-title">{isDoubles ? 'Side A (P1 & P2) Sign' : 'Player 1 Sign'}</div>
            </div>
            <div className="sig-col">
              <div className="sig-line" />
              <div className="sig-title">{isDoubles ? 'Side B (P1 & P2) Sign' : 'Player 2 Sign'}</div>
            </div>
            <div className="sig-col">
              <div className="sig-line" />
              <div className="sig-title">Umpire Sign</div>
            </div>
            <div className="sig-col">
              <div className="sig-line" />
              <div className="sig-title">Referee Sign</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
