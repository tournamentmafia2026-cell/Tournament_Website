import { getRoundName } from './badmintonDrawEngine'
import {
  formatTournamentName,
  formatAddress,
  formatCourtName,
  formatPersonName,
  formatPlaceOrClub,
  formatCategoryName,
} from './textFormatters'

export const printOfficialFixturesA4 = ({
  currentDraw,
  tournament,
  selectedCategory,
}) => {
  if (!currentDraw || !currentDraw.matches) {
    window.print()
    return
  }

  const drawSize = currentDraw.drawSize || 16
  const totalRounds = currentDraw.totalRounds || Math.round(Math.log2(drawSize)) || 4
  const tournamentName = formatTournamentName(tournament?.matchName, 'BADMINTON TOURNAMENT')
  const venue = formatAddress(tournament?.matchAddress) || formatCourtName(tournament?.courtName || '')
  const dates = tournament?.startDate ? `${tournament.startDate} to ${tournament.endDate || tournament.startDate}` : ''

  // Group matches by round
  const matchesByRound = {}
  currentDraw.matches.forEach((m) => {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = []
    matchesByRound[m.round].push(m)
  })

  const round1Matches = matchesByRound[1] || []

  // Number of 16-draw sectional pages
  const LINES_PER_PAGE = 16
  const MATCHES_PER_PAGE = 8
  const sectionPages = Math.max(1, Math.ceil(drawSize / LINES_PER_PAGE))

  // Determine pagination dynamically for ANY draw size:
  // - 16-draw (and 4, 8): 1 page complete with Final & Champion
  // - 32-draw: 2 sections + 1 Finals page = 3 pages
  // - 64-draw: 4 sections + 1 Playoff page (QF/SF/Final) = 5 pages
  // - 128-draw: 8 sections + 1 Pre-Quarter page (R16/QF) + 1 Finals page (SF/Final) = 10 pages
  // - 256-draw: 16 sections + 2 Playoff pages (R32/R16) + 1 Finals page = 19 pages
  const is256Plus = drawSize >= 256
  const is128Draw = drawSize === 128
  const is64Draw = drawSize === 64
  const is32Draw = drawSize === 32
  const isSmallDraw = drawSize <= 16

  let totalPages = sectionPages
  if (is256Plus) {
    totalPages = sectionPages + 3 // 16 sections + 2 Playoff pages + 1 Finals page
  } else if (is128Draw) {
    totalPages = sectionPages + 2 // 8 sections + 1 Pre-Quarter page + 1 Finals page = 10 pages
  } else if (is64Draw) {
    totalPages = sectionPages + 1 // 4 sections + 1 QF/SF/Finals playoff page = 5 pages
  } else if (is32Draw) {
    totalPages = sectionPages + 1 // 2 sections + 1 SF/Finals page = 3 pages
  }

  // Full A4 Page Sizing
  const ROW_HEIGHT = 38
  const INTRA_GAP = 14
  const BLOCK_GAP = 36
  const BLOCK_HEIGHT = ROW_HEIGHT * 2 + INTRA_GAP // 38 + 14 + 38 = 90px
  const STEP_HEIGHT = BLOCK_HEIGHT + BLOCK_GAP // 90 + 36 = 126px
  const TREE_HEIGHT = 8 * STEP_HEIGHT // 8 * 126 = 1008px

  // Dynamic Column & Name Widths to perfectly fit A4 width (730px max printable)
  // For 16-draw: 4 rounds fit on 1 page (185px names + 4 * 118px + 50px = 707px)
  // For 32+ draw: 3 rounds per section (210px names + 3 * 155px + 50px = 725px)
  const NAMES_WIDTH = isSmallDraw ? 185 : 210
  const COL_WIDTH = isSmallDraw ? 118 : 155
  const BRACKET_OFFSET = isSmallDraw ? 32 : 46

  let pagesHtml = ''
  let currentPageNum = 0

  // =========================================================================
  // 1. SECTIONAL BRACKET PAGES (16 lines per page)
  // =========================================================================
  for (let pageIdx = 0; pageIdx < sectionPages; pageIdx++) {
    currentPageNum++
    const startMatchIdx = pageIdx * MATCHES_PER_PAGE
    const startLineNum = startMatchIdx * 2 + 1
    const endLineNum = startLineNum + LINES_PER_PAGE - 1

    // Baseline Y coordinates for lines in this page
    const getP1BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT
    const getP2BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT + INTRA_GAP + ROW_HEIGHT
    const getLocalMatchCenterY = (localIdx) => (getP1BaselineY(localIdx) + getP2BaselineY(localIdx)) / 2

    // Rounds shown on a single section page:
    // - For 16-draw: all 4 rounds (R16, QF, SF, FINAL)
    // - For 8-draw: all 3 rounds (QF, SF, FINAL)
    // - For 4-draw: all 2 rounds (SF, FINAL)
    // - For draw >= 32: 3 preliminary rounds (e.g. R32->R16->QF, or R64->R32->R16)
    const localRounds = isSmallDraw ? totalRounds : 3
    const pageMatchCenters = {}
    pageMatchCenters[1] = Array.from({ length: MATCHES_PER_PAGE }, (_, idx) => getLocalMatchCenterY(idx))

    for (let r = 2; r <= localRounds; r++) {
      const count = Math.pow(2, 4 - r)
      pageMatchCenters[r] = []
      for (let i = 0; i < count; i++) {
        const prev = pageMatchCenters[r - 1] || []
        const p1 = prev[i * 2] ?? 0
        const p2 = prev[i * 2 + 1] ?? (p1 + 75)
        pageMatchCenters[r].push((p1 + p2) / 2)
      }
    }

    const svgWidth = localRounds * COL_WIDTH + 80

    // Render 16 player rows HTML
    let namesColumnHtml = ''
    for (let localMIdx = 0; localMIdx < MATCHES_PER_PAGE; localMIdx++) {
      const globalMatchIdx = startMatchIdx + localMIdx
      const m = round1Matches[globalMatchIdx]
      const line1 = startLineNum + localMIdx * 2
      const line2 = line1 + 1
      const p1 = m?.player1
      const p2 = m?.player2

      const p1Meta = p1 ? [p1.place, p1.court].filter(Boolean).join(' • ') : ''
      const p2Meta = p2 ? [p2.place, p2.court].filter(Boolean).join(' • ') : ''

      const p1Text = p1
        ? p1.isBye
          ? '<span class="txt-bye">BYE</span>'
          : `${p1.seed ? `<span class="seed-pill">S${p1.seed}</span> ` : ''}${p1.name}${p1Meta ? ` <span class="pplace">(${p1Meta})</span>` : ''}`
        : '<span class="txt-tbd">BYE</span>'

      const p2Text = p2
        ? p2.isBye
          ? '<span class="txt-bye">BYE</span>'
          : `${p2.seed ? `<span class="seed-pill">S${p2.seed}</span> ` : ''}${p2.name}${p2Meta ? ` <span class="pplace">(${p2Meta})</span>` : ''}`
        : '<span class="txt-tbd">BYE</span>'

      namesColumnHtml += `
        <div class="pair-block" style="margin-bottom: ${BLOCK_GAP}px;">
          <div class="line-row" style="height: ${ROW_HEIGHT}px;">
            <span class="ln-num">${line1}</span>
            <div class="pname-box">${p1Text}</div>
          </div>
          <div style="height: ${INTRA_GAP}px;"></div>
          <div class="line-row" style="height: ${ROW_HEIGHT}px;">
            <span class="ln-num">${line2}</span>
            <div class="pname-box">${p2Text}</div>
          </div>
        </div>
      `
    }

    // Render SVG connecting branches for this section page
    let svgContent = ''
    for (let r = 1; r <= localRounds; r++) {
      const xStart = (r - 1) * COL_WIDTH
      const xBracket = xStart + BRACKET_OFFSET
      const xEnd = xStart + COL_WIDTH

      const count = Math.max(1, Math.pow(2, 4 - r)) // 8, 4, 2, 1
      const actualRoundNum = r
      const roundMatchesGlobal = matchesByRound[actualRoundNum] || []

      for (let localIdx = 0; localIdx < count; localIdx++) {
        let yTop, yBot, yMid

        if (r === 1) {
          yTop = getP1BaselineY(localIdx)
          yBot = getP2BaselineY(localIdx)
          yMid = (yTop + yBot) / 2
        } else {
          const prev = pageMatchCenters[r - 1] || []
          yTop = prev[localIdx * 2] ?? 0
          yBot = prev[localIdx * 2 + 1] ?? (yTop + 65)
          yMid = (yTop + yBot) / 2
        }

        // Global match index for this round across tournament
        const globalMatchIdx = pageIdx * count + localIdx
        const matchObj = roundMatchesGlobal[globalMatchIdx]
        const matchNum = globalMatchIdx + 1

        const isFinal = (actualRoundNum === totalRounds)
        const isSemi = (actualRoundNum === totalRounds - 1)
        const isQuarter = (actualRoundNum === totalRounds - 2)
        const isR16 = (actualRoundNum === totalRounds - 3)
        const isR32 = (actualRoundNum === totalRounds - 4)
        const isR64 = (actualRoundNum === totalRounds - 5)
        const isR128 = (actualRoundNum === totalRounds - 6)

        // Clear Numeric Match Tagging (1, 2, 3, 4...)
        let roundLabel = ''
        if (isFinal) {
          roundLabel = 'FINAL'
        } else if (isSemi) {
          roundLabel = `SEMI FINAL - ${matchNum}`
        } else if (isQuarter) {
          roundLabel = `QR. FINAL - ${matchNum}`
        } else if (isR16) {
          roundLabel = `R16 - ${matchNum}`
        } else if (isR32) {
          roundLabel = `R32 - ${matchNum}`
        } else if (isR64) {
          roundLabel = `R64 - ${matchNum}`
        } else if (isR128) {
          roundLabel = `R128 - ${matchNum}`
        } else {
          roundLabel = `${getRoundName(r, totalRounds)} - ${matchNum}`
        }

        const winnerName = matchObj?.winner && !matchObj.winner.isBye
          ? (matchObj.winner.seed ? `[S${matchObj.winner.seed}] ${matchObj.winner.name}` : `✓ ${matchObj.winner.name}`)
          : ''

        if (isFinal) {
          // Final match branch leading to Trophy Box
          const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd + 20} ${yMid}`
          const champObj = matchObj?.winner && !matchObj.winner.isBye ? matchObj.winner : null
          const champLabel = champObj ? (champObj.seed ? `🏆 [S${champObj.seed}] ${champObj.name}` : `🏆 ${champObj.name}`) : '🏆 CHAMPION'

          svgContent += `
            <g class="branch-group">
              <path d="${pathData}" class="branch-line" stroke-width="2.2" />
              <text x="${xBracket + 4}" y="${yMid - 6}" class="round-title-text" style="fill: #b45309; font-weight: 900;">CHAMPIONSHIP FINAL</text>
              <text x="${xBracket + 4}" y="${yMid + 16}" class="winner-text" style="fill: #000; font-weight: 900; font-size: 11.5px;">${champLabel}</text>
            </g>
          `
        } else {
          const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
          svgContent += `
            <g class="branch-group">
              <path d="${pathData}" class="branch-line" />
              <text x="${xBracket + 4}" y="${yMid - 5}" class="round-title-text">${roundLabel}</text>
              ${winnerName ? `<text x="${xBracket + 4}" y="${yMid + 15}" class="winner-text">${winnerName}</text>` : ''}
            </g>
          `
        }
      }
    }

    const sectionTitle = sectionPages > 1
      ? `Section ${pageIdx + 1} of ${sectionPages} (Lines ${startLineNum} - ${endLineNum})`
      : `Full Draw (Lines 1 - ${endLineNum})`

    pagesHtml += `
      <div class="a4-fixture-page">
        <!-- Page Header -->
        <div class="a4-header-box">
          <div class="a4-header-top">
            <h1 class="a4-tour-name">${tournamentName}</h1>
            <div class="a4-badge">${sectionTitle}</div>
          </div>
          <div class="a4-header-meta">
            <span>Category: <strong>${selectedCategory}</strong> • Knockout Draw (${drawSize} Draw Bracket • ${currentDraw.totalByes || 0} Byes)</span>
            ${venue ? `<span>• Venue: <strong>${venue}</strong></span>` : ''}
            ${dates ? `<span>• Dates: <strong>${dates}</strong></span>` : ''}
          </div>
        </div>

        <!-- Tree Canvas -->
        <div class="a4-tree-container" style="height: ${TREE_HEIGHT + 10}px;">
          <div class="a4-names-col" style="width: ${NAMES_WIDTH}px;">
            ${namesColumnHtml}
          </div>
          <svg class="a4-svg-canvas" style="left: ${NAMES_WIDTH}px; width: ${svgWidth}px; height: ${TREE_HEIGHT + 10}px;">
            ${svgContent}
          </svg>
        </div>

        <!-- Page Footer -->
        <div class="a4-footer-box">
          <span>Official Tournament Fixture Draw Sheet • Page ${currentPageNum} of ${totalPages}</span>
          <span>Category: ${selectedCategory} • Generated via Badminton Tournament Portal</span>
        </div>
      </div>
    `
  }

  // =========================================================================
  // 2. 256+ DRAW INTERMEDIATE STAGES (Round of 32 & Round of 16 - 2 Pages)
  // =========================================================================
  if (is256Plus) {
    const r32RoundNum = totalRounds - 4 // Round 4 (16 matches)
    const r16RoundNum = totalRounds - 3 // Round 5 (8 matches)
    const qfRoundNum = totalRounds - 2  // Round 6 (4 matches)

    const r32Matches = matchesByRound[r32RoundNum] || []
    const r16Matches = matchesByRound[r16RoundNum] || []

    // Page 17 (Top Half: 16 qualifiers) & Page 18 (Bottom Half: 16 qualifiers)
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      currentPageNum++
      const halfTitle = pIdx === 0 ? 'Top Half Playoff (Lines 1 - 128)' : 'Bottom Half Playoff (Lines 129 - 256)'
      const startMatch = pIdx * 8

      let namesHtml = ''
      for (let i = 0; i < 8; i++) {
        const line1 = i * 2 + 1
        const line2 = line1 + 1
        const m = r32Matches[startMatch + i]
        const p1 = m?.player1
        const p2 = m?.player2

        const globalQualifierNum1 = (pIdx * 16) + line1
        const globalQualifierNum2 = (pIdx * 16) + line2

        const p1Meta = p1 ? [p1.place, p1.court].filter(Boolean).join(' • ') : ''
        const p2Meta = p2 ? [p2.place, p2.court].filter(Boolean).join(' • ') : ''

        const p1Text = p1 && !p1.isBye
          ? `${p1.seed ? `<span class="seed-pill">S${p1.seed}</span> ` : ''}${p1.name}${p1Meta ? ` (${p1Meta})` : ''}`
          : `<span class="txt-tbd">Winner of R64 - ${globalQualifierNum1}</span>`

        const p2Text = p2 && !p2.isBye
          ? `${p2.seed ? `<span class="seed-pill">S${p2.seed}</span> ` : ''}${p2.name}${p2Meta ? ` (${p2Meta})` : ''}`
          : `<span class="txt-tbd">Winner of R64 - ${globalQualifierNum2}</span>`

        namesHtml += `
          <div class="pair-block" style="margin-bottom: ${BLOCK_GAP}px;">
            <div class="line-row" style="height: ${ROW_HEIGHT}px;">
              <span class="ln-num">${line1}</span>
              <div class="pname-box">${p1Text}</div>
            </div>
            <div style="height: ${INTRA_GAP}px;"></div>
            <div class="line-row" style="height: ${ROW_HEIGHT}px;">
              <span class="ln-num">${line2}</span>
              <div class="pname-box">${p2Text}</div>
            </div>
          </div>
        `
      }

      // SVG for R32 -> R16 -> QF
      const getP1BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT
      const getP2BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT + INTRA_GAP + ROW_HEIGHT
      const r32Centers = Array.from({ length: 8 }, (_, idx) => (getP1BaselineY(idx) + getP2BaselineY(idx)) / 2)
      const r16Centers = []
      for (let i = 0; i < 4; i++) {
        r16Centers.push((r32Centers[i * 2] + r32Centers[i * 2 + 1]) / 2)
      }
      const qfCenters = []
      for (let i = 0; i < 2; i++) {
        qfCenters.push((r16Centers[i * 2] + r16Centers[i * 2 + 1]) / 2)
      }

      let svgContent = ''
      // Col 1: R32
      for (let i = 0; i < 8; i++) {
        const yTop = getP1BaselineY(i)
        const yBot = getP2BaselineY(i)
        const yMid = r32Centers[i]
        const m = r32Matches[startMatch + i]
        const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''
        const pathData = `M 0 ${yTop} L 40 ${yTop} L 40 ${yBot} L 0 ${yBot} M 40 ${yMid} L ${COL_WIDTH} ${yMid}`
        svgContent += `
          <g class="branch-group">
            <path d="${pathData}" class="branch-line" />
            <text x="44" y="${yMid - 5}" class="round-title-text">R32 - ${startMatch + i + 1}</text>
            ${winnerName ? `<text x="44" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
          </g>
        `
      }

      // Col 2: R16
      const startR16Match = pIdx * 4
      for (let i = 0; i < 4; i++) {
        const yTop = r32Centers[i * 2]
        const yBot = r32Centers[i * 2 + 1]
        const yMid = r16Centers[i]
        const xStart = COL_WIDTH
        const xBracket = xStart + 40
        const xEnd = xStart + COL_WIDTH
        const m = r16Matches[startR16Match + i]
        const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''
        const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
        svgContent += `
          <g class="branch-group">
            <path d="${pathData}" class="branch-line" />
            <text x="${xBracket + 4}" y="${yMid - 5}" class="round-title-text">R16 - ${startR16Match + i + 1}</text>
            ${winnerName ? `<text x="${xBracket + 4}" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
          </g>
        `
      }

      // Col 3: QF
      const startQFMatch = pIdx * 2
      const qfMatchesList = matchesByRound[qfRoundNum] || []
      for (let i = 0; i < 2; i++) {
        const yTop = r16Centers[i * 2]
        const yBot = r16Centers[i * 2 + 1]
        const yMid = qfCenters[i]
        const xStart = COL_WIDTH * 2
        const xBracket = xStart + 40
        const xEnd = xStart + COL_WIDTH
        const m = qfMatchesList[startQFMatch + i]
        const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''
        const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
        svgContent += `
          <g class="branch-group">
            <path d="${pathData}" class="branch-line" />
            <text x="${xBracket + 4}" y="${yMid - 5}" class="round-title-text">QR. FINAL - ${startQFMatch + i + 1}</text>
            ${winnerName ? `<text x="${xBracket + 4}" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
          </g>
        `
      }

      pagesHtml += `
        <div class="a4-fixture-page">
          <div class="a4-header-box">
            <div class="a4-header-top">
              <h1 class="a4-tour-name">${tournamentName}</h1>
              <div class="a4-badge finals-badge">ROUND OF 32, 16 & QUARTER-FINALS (${halfTitle})</div>
            </div>
            <div class="a4-header-meta">
              <span>Category: <strong>${selectedCategory}</strong> • Championship Stage (${drawSize} Draw Playoff)</span>
              ${venue ? `<span>• Venue: <strong>${venue}</strong></span>` : ''}
              ${dates ? `<span>• Dates: <strong>${dates}</strong></span>` : ''}
            </div>
          </div>

          <div class="a4-tree-container" style="height: ${TREE_HEIGHT + 10}px;">
            <div class="a4-names-col" style="width: ${NAMES_WIDTH}px;">
              ${namesHtml}
            </div>
            <svg class="a4-svg-canvas" style="left: ${NAMES_WIDTH}px; width: ${COL_WIDTH * 3 + 80}px; height: ${TREE_HEIGHT + 10}px;">
              ${svgContent}
            </svg>
          </div>

          <div class="a4-footer-box">
            <span>Official Tournament Fixture Draw Sheet • Page ${currentPageNum} of ${totalPages} (Playoff Stage)</span>
            <span>Category: ${selectedCategory} • Generated via Badminton Tournament Portal</span>
          </div>
        </div>
      `
    }
  }

  // =========================================================================
  // 3. 128-DRAW SPECIAL STAGE: ROUND OF 16 & QUARTER-FINALS (Pre-Quarter Stage)
  // =========================================================================
  if (is128Draw) {
    currentPageNum++
    const r16RoundNum = totalRounds - 3 // Round 4 (8 matches)
    const qfRoundNum = totalRounds - 2  // Round 5 (4 matches)

    const r16Matches = matchesByRound[r16RoundNum] || []
    const qfMatches = matchesByRound[qfRoundNum] || []

    // 16 Qualifier lines for R16
    let r16NamesHtml = ''
    for (let i = 0; i < 8; i++) {
      const line1 = i * 2 + 1
      const line2 = line1 + 1
      const m = r16Matches[i]

      const p1 = m?.player1
      const p2 = m?.player2

      const secNum1 = Math.floor((line1 - 1) / 2) + 1
      const secNum2 = Math.floor((line2 - 1) / 2) + 1

      const p1Meta = p1 ? [p1.place, p1.court].filter(Boolean).join(' • ') : ''
      const p2Meta = p2 ? [p2.place, p2.court].filter(Boolean).join(' • ') : ''

      const p1Text = p1 && !p1.isBye
        ? `${p1.seed ? `<span class="seed-pill">S${p1.seed}</span> ` : ''}${p1.name}${p1Meta ? ` (${p1Meta})` : ''}`
        : `<span class="txt-tbd">Winner of R32 - ${line1} (Sec ${secNum1})</span>`

      const p2Text = p2 && !p2.isBye
        ? `${p2.seed ? `<span class="seed-pill">S${p2.seed}</span> ` : ''}${p2.name}${p2Meta ? ` (${p2Meta})` : ''}`
        : `<span class="txt-tbd">Winner of R32 - ${line2} (Sec ${secNum2})</span>`

      r16NamesHtml += `
        <div class="pair-block" style="margin-bottom: ${BLOCK_GAP}px;">
          <div class="line-row" style="height: ${ROW_HEIGHT}px;">
            <span class="ln-num">${line1}</span>
            <div class="pname-box">${p1Text}</div>
          </div>
          <div style="height: ${INTRA_GAP}px;"></div>
          <div class="line-row" style="height: ${ROW_HEIGHT}px;">
            <span class="ln-num">${line2}</span>
            <div class="pname-box">${p2Text}</div>
          </div>
        </div>
      `
    }

    // SVG for Round of 16 -> Quarter Finals
    const getP1BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT
    const getP2BaselineY = (localIdx) => localIdx * STEP_HEIGHT + ROW_HEIGHT + INTRA_GAP + ROW_HEIGHT
    const getLocalMatchCenterY = (localIdx) => (getP1BaselineY(localIdx) + getP2BaselineY(localIdx)) / 2

    const r16Centers = Array.from({ length: 8 }, (_, idx) => getLocalMatchCenterY(idx))
    const qfCenters = []
    for (let i = 0; i < 4; i++) {
      qfCenters.push((r16Centers[i * 2] + r16Centers[i * 2 + 1]) / 2)
    }

    let r16SvgContent = ''
    // Column 1: Round of 16 (8 matches)
    for (let i = 0; i < 8; i++) {
      const yTop = getP1BaselineY(i)
      const yBot = getP2BaselineY(i)
      const yMid = r16Centers[i]
      const pathData = `M 0 ${yTop} L 40 ${yTop} L 40 ${yBot} L 0 ${yBot} M 40 ${yMid} L ${COL_WIDTH} ${yMid}`
      const m = r16Matches[i]
      const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''

      r16SvgContent += `
        <g class="branch-group">
          <path d="${pathData}" class="branch-line" />
          <text x="44" y="${yMid - 5}" class="round-title-text">R16 - ${i + 1}</text>
          ${winnerName ? `<text x="44" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
        </g>
      `
    }

    // Column 2: Quarter Finals (4 matches)
    for (let i = 0; i < 4; i++) {
      const yTop = r16Centers[i * 2]
      const yBot = r16Centers[i * 2 + 1]
      const yMid = qfCenters[i]
      const xStart = COL_WIDTH
      const xBracket = xStart + 40
      const xEnd = xStart + COL_WIDTH
      const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
      const m = qfMatches[i]
      const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''

      r16SvgContent += `
        <g class="branch-group">
          <path d="${pathData}" class="branch-line" />
          <text x="${xBracket + 4}" y="${yMid - 5}" class="round-title-text">QR. FINAL - ${i + 1}</text>
          ${winnerName ? `<text x="${xBracket + 4}" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
        </g>
      `
    }

    pagesHtml += `
      <div class="a4-fixture-page">
        <!-- Pre-Quarter Header -->
        <div class="a4-header-box">
          <div class="a4-header-top">
            <h1 class="a4-tour-name">${tournamentName}</h1>
            <div class="a4-badge finals-badge">ROUND OF 16 & QUARTER-FINALS (TOP 16)</div>
          </div>
          <div class="a4-header-meta">
            <span>Category: <strong>${selectedCategory}</strong> • Pre-Quarter & Quarter Finals (${drawSize} Draw Playoff)</span>
            ${venue ? `<span>• Venue: <strong>${venue}</strong></span>` : ''}
            ${dates ? `<span>• Dates: <strong>${dates}</strong></span>` : ''}
          </div>
        </div>

        <!-- Pre-Quarter Tree Canvas -->
        <div class="a4-tree-container" style="height: ${TREE_HEIGHT + 10}px;">
          <div class="a4-names-col" style="width: ${NAMES_WIDTH}px;">
            ${r16NamesHtml}
          </div>
          <svg class="a4-svg-canvas" style="left: ${NAMES_WIDTH}px; width: ${COL_WIDTH * 2 + 80}px; height: ${TREE_HEIGHT + 10}px;">
            ${r16SvgContent}
          </svg>
        </div>

        <!-- Page Footer -->
        <div class="a4-footer-box">
          <span>Official Tournament Fixture Draw Sheet • Page ${currentPageNum} of ${totalPages} (Playoff Stage)</span>
          <span>Category: ${selectedCategory} • Generated via Badminton Tournament Portal</span>
        </div>
      </div>
    `
  }

  // =========================================================================
  // 4. 64-DRAW SPECIAL STAGE: QUARTER-FINALS, SEMI-FINALS & FINAL PLAYOFF PAGE
  // =========================================================================
  if (is64Draw) {
    currentPageNum++
    const qfRoundNum = totalRounds - 2  // Round 4 (4 matches)
    const sfRoundNum = totalRounds - 1  // Round 5 (2 matches)
    const finalRoundNum = totalRounds   // Round 6 (1 match)

    const qfMatches = matchesByRound[qfRoundNum] || []
    const sfMatches = matchesByRound[sfRoundNum] || []
    const finalMatch = (matchesByRound[finalRoundNum] || [])[0]
    const champion = finalMatch?.winner && !finalMatch.winner.isBye ? finalMatch.winner : null

    // 8 Quarter-Finalist Qualifier Lines
    let qfNamesHtml = ''
    for (let i = 0; i < 4; i++) {
      const line1 = i * 2 + 1
      const line2 = line1 + 1
      const m = qfMatches[i]

      const p1 = m?.player1
      const p2 = m?.player2

      const secNum1 = Math.floor((line1 - 1) / 2) + 1
      const secNum2 = Math.floor((line2 - 1) / 2) + 1

      const p1Meta = p1 ? [p1.place, p1.court].filter(Boolean).join(' • ') : ''
      const p2Meta = p2 ? [p2.place, p2.court].filter(Boolean).join(' • ') : ''

      const p1Text = p1 && !p1.isBye
        ? `${p1.seed ? `<span class="seed-pill">S${p1.seed}</span> ` : ''}${p1.name}${p1Meta ? ` (${p1Meta})` : ''}`
        : `<span class="txt-tbd">Winner of R16 - ${line1} (Sec ${secNum1})</span>`

      const p2Text = p2 && !p2.isBye
        ? `${p2.seed ? `<span class="seed-pill">S${p2.seed}</span> ` : ''}${p2.name}${p2Meta ? ` (${p2Meta})` : ''}`
        : `<span class="txt-tbd">Winner of R16 - ${line2} (Sec ${secNum2})</span>`

      qfNamesHtml += `
        <div class="pair-block" style="margin-bottom: 80px;">
          <div class="line-row" style="height: ${ROW_HEIGHT + 6}px;">
            <span class="ln-num">${line1}</span>
            <div class="pname-box">${p1Text}</div>
          </div>
          <div style="height: ${INTRA_GAP + 6}px;"></div>
          <div class="line-row" style="height: ${ROW_HEIGHT + 6}px;">
            <span class="ln-num">${line2}</span>
            <div class="pname-box">${p2Text}</div>
          </div>
        </div>
      `
    }

    // Playoff Tree for 64-draw (QF -> SF -> Final)
    const STEP_64 = (ROW_HEIGHT + 6) * 2 + (INTRA_GAP + 6) + 80
    const getP1_64 = (idx) => idx * STEP_64 + (ROW_HEIGHT + 6)
    const getP2_64 = (idx) => idx * STEP_64 + (ROW_HEIGHT + 6) * 2 + (INTRA_GAP + 6)
    const qfCenters64 = Array.from({ length: 4 }, (_, idx) => (getP1_64(idx) + getP2_64(idx)) / 2)
    const sfCenters64 = [
      (qfCenters64[0] + qfCenters64[1]) / 2,
      (qfCenters64[2] + qfCenters64[3]) / 2,
    ]
    const finalCenter64 = (sfCenters64[0] + sfCenters64[1]) / 2

    let qfSvgContent = ''
    // Column 1: Quarter Finals (4 matches)
    for (let i = 0; i < 4; i++) {
      const yTop = getP1_64(i)
      const yBot = getP2_64(i)
      const yMid = qfCenters64[i]
      const pathData = `M 0 ${yTop} L 40 ${yTop} L 40 ${yBot} L 0 ${yBot} M 40 ${yMid} L ${COL_WIDTH} ${yMid}`
      const m = qfMatches[i]
      const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''

      qfSvgContent += `
        <g class="branch-group">
          <path d="${pathData}" class="branch-line" />
          <text x="44" y="${yMid - 5}" class="round-title-text">QR. FINAL - ${i + 1}</text>
          ${winnerName ? `<text x="44" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
        </g>
      `
    }

    // Column 2: Semi Finals (2 matches)
    for (let i = 0; i < 2; i++) {
      const yTop = qfCenters64[i * 2]
      const yBot = qfCenters64[i * 2 + 1]
      const yMid = sfCenters64[i]
      const xStart = COL_WIDTH
      const xBracket = xStart + 40
      const xEnd = xStart + COL_WIDTH
      const pathData = `M ${xStart} ${yTop} L ${xBracket} ${yTop} L ${xBracket} ${yBot} L ${xStart} ${yBot} M ${xBracket} ${yMid} L ${xEnd} ${yMid}`
      const m = sfMatches[i]
      const winnerName = m?.winner && !m.winner.isBye ? (m.winner.seed ? `[S${m.winner.seed}] ${m.winner.name}` : `✓ ${m.winner.name}`) : ''

      qfSvgContent += `
        <g class="branch-group">
          <path d="${pathData}" class="branch-line" />
          <text x="${xBracket + 4}" y="${yMid - 5}" class="round-title-text">SEMI FINAL - ${i + 1}</text>
          ${winnerName ? `<text x="${xBracket + 4}" y="${yMid + 16}" class="winner-text">${winnerName}</text>` : ''}
        </g>
      `
    }

    // Column 3: Championship Final
    const xStartFinal = COL_WIDTH * 2
    const xBracketFinal = xStartFinal + 40
    const xEndFinal = xStartFinal + COL_WIDTH
    const finalPath = `M ${xStartFinal} ${sfCenters64[0]} L ${xBracketFinal} ${sfCenters64[0]} L ${xBracketFinal} ${sfCenters64[1]} L ${xStartFinal} ${sfCenters64[1]} M ${xBracketFinal} ${finalCenter64} L ${xEndFinal} ${finalCenter64}`
    const winnerFinalName = champion ? (champion.seed ? `[S${champion.seed}] ${champion.name}` : `🏆 ${champion.name}`) : ''

    qfSvgContent += `
      <g class="branch-group">
        <path d="${finalPath}" class="branch-line" stroke-width="2.2" />
        <text x="${xBracketFinal + 4}" y="${finalCenter64 - 5}" class="round-title-text" style="fill: #b45309; font-weight: 900;">CHAMPIONSHIP FINAL</text>
        ${winnerFinalName ? `<text x="${xBracketFinal + 4}" y="${finalCenter64 + 18}" class="winner-text" style="font-size: 13px; font-weight: 900;">${winnerFinalName}</text>` : ''}
      </g>
    `

    pagesHtml += `
      <div class="a4-fixture-page">
        <!-- 64-Draw Playoff Header -->
        <div class="a4-header-box">
          <div class="a4-header-top">
            <h1 class="a4-tour-name">${tournamentName}</h1>
            <div class="a4-badge finals-badge">🏆 QUARTER-FINALS, SEMI-FINALS & CHAMPIONSHIP FINAL</div>
          </div>
          <div class="a4-header-meta">
            <span>Category: <strong>${selectedCategory}</strong> • Championship Stage (Top 8 Qualifiers • 64 Draw)</span>
            ${venue ? `<span>• Venue: <strong>${venue}</strong></span>` : ''}
            ${dates ? `<span>• Dates: <strong>${dates}</strong></span>` : ''}
          </div>
        </div>

        <!-- 64-Draw Playoff Tree Canvas -->
        <div class="a4-tree-container" style="height: 720px;">
          <div class="a4-names-col" style="width: 250px;">
            ${qfNamesHtml}
          </div>
          <svg class="a4-svg-canvas" style="left: 250px; width: ${COL_WIDTH * 3 + 100}px; height: 720px;">
            ${qfSvgContent}
          </svg>
        </div>

        <!-- Official Champion Trophy Box -->
        <div class="champion-grand-box" style="margin-top: 10px; padding: 12px;">
          <div class="trophy-badge">🏆 ${selectedCategory.toUpperCase()} CHAMPION</div>
          <div class="champion-name-display" style="font-size: 17px;">
            ${champion ? `🏆 ${champion.name}` : '____________________________________'}
          </div>
          <div class="champion-sub-text">
            ${champion?.place ? `Representing: ${champion.place}` : 'Badminton Championship Winner'}
          </div>
        </div>

        <!-- Official Signatures Box -->
        <div class="finals-signatures-grid" style="margin: 10px 0;">
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Court Umpire Signature</div>
          </div>
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Tournament Referee Signature</div>
          </div>
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Organizing Secretary</div>
          </div>
        </div>

        <!-- Page Footer -->
        <div class="a4-footer-box">
          <span>Official Tournament Fixture Draw Sheet • Page ${currentPageNum} of ${totalPages} (Championship Playoff)</span>
          <span>Category: ${selectedCategory} • Generated via Badminton Tournament Portal</span>
        </div>
      </div>
    `
  }

  // =========================================================================
  // 5. FINALS STAGE PAGE (For 32-Draw, 128-Draw, 256-Draw+: Semi-Finals & Final)
  // =========================================================================
  if (is32Draw || is128Draw || is256Plus) {
    currentPageNum++
    const semiRoundNum = totalRounds - 1
    const finalRoundNum = totalRounds

    const semiMatches = matchesByRound[semiRoundNum] || []
    const finalMatch = (matchesByRound[finalRoundNum] || [])[0]
    const champion = finalMatch?.winner && !finalMatch.winner.isBye ? finalMatch.winner : null

    const sf1 = semiMatches[0]
    const sf2 = semiMatches[1]

    const sf1P1 = sf1?.player1
    const sf1P2 = sf1?.player2
    const sf2P1 = sf2?.player1
    const sf2P2 = sf2?.player2

    const sf1Winner = sf1?.winner && !sf1.winner.isBye ? sf1.winner : null
    const sf2Winner = sf2?.winner && !sf2.winner.isBye ? sf2.winner : null

    const fP1 = finalMatch?.player1 || sf1Winner
    const fP2 = finalMatch?.player2 || sf2Winner

    const renderPlayerRow = (p, defaultLabel) => {
      if (!p || p.isBye) {
        return `<span class="txt-tbd">${defaultLabel}</span>`
      }
      const meta = [p.place, p.court].filter(Boolean).join(' • ')
      return `${p.seed ? `<span class="seed-pill">S${p.seed}</span> ` : ''}<strong>${p.name}</strong>${meta ? ` <span class="pplace">(${meta})</span>` : ''}`
    }

    const sf1Label1 = is256Plus || is128Draw ? 'Winner of QR. FINAL - 1' : 'Winner of QR. FINAL - 1 (Lines 1 - 8)'
    const sf1Label2 = is256Plus || is128Draw ? 'Winner of QR. FINAL - 2' : 'Winner of QR. FINAL - 2 (Lines 9 - 16)'
    const sf2Label1 = is256Plus || is128Draw ? 'Winner of QR. FINAL - 3' : 'Winner of QR. FINAL - 3 (Lines 17 - 24)'
    const sf2Label2 = is256Plus || is128Draw ? 'Winner of QR. FINAL - 4' : 'Winner of QR. FINAL - 4 (Lines 25 - 32)'

    pagesHtml += `
      <div class="a4-fixture-page finals-page">
        <!-- Finals Page Header -->
        <div class="a4-header-box">
          <div class="a4-header-top">
            <h1 class="a4-tour-name">${tournamentName}</h1>
            <div class="a4-badge finals-badge">🏆 FINALS STAGE (SEMI-FINALS & FINAL)</div>
          </div>
          <div class="a4-header-meta">
            <span>Category: <strong>${selectedCategory}</strong> • Championship Stage (${drawSize} Draw)</span>
            ${venue ? `<span>• Venue: <strong>${venue}</strong></span>` : ''}
            ${dates ? `<span>• Dates: <strong>${dates}</strong></span>` : ''}
          </div>
        </div>

        <!-- Grand Championship Bracket Area -->
        <div class="finals-bracket-container">
          <!-- Left Column: Semi-Finals (SF-1 & SF-2) -->
          <div class="finals-stage-col semi-finals-col">
            <div class="stage-col-header">
              <span class="stage-title">SEMI-FINALS</span>
              <span class="stage-sub">Top 4 Qualifiers from Sections</span>
            </div>

            <!-- Semi Final 1 Block (SF-1) -->
            <div class="finals-match-card">
              <div class="match-card-tag">SEMI-FINAL - 1 (Top Half)</div>
              <div class="finals-player-slot">
                <span class="slot-pos">SF 1-A</span>
                <div class="slot-name">${renderPlayerRow(sf1P1, sf1Label1)}</div>
              </div>
              <div class="finals-player-slot">
                <span class="slot-pos">SF 1-B</span>
                <div class="slot-name">${renderPlayerRow(sf1P2, sf1Label2)}</div>
              </div>
              <div class="finals-winner-line">
                <span>Winner (SF-1): <strong>${sf1Winner ? `✓ ${sf1Winner.name}` : '______________________'}</strong></span>
              </div>
            </div>

            <div class="finals-stage-spacer"></div>

            <!-- Semi Final 2 Block (SF-2) -->
            <div class="finals-match-card">
              <div class="match-card-tag">SEMI-FINAL - 2 (Bottom Half)</div>
              <div class="finals-player-slot">
                <span class="slot-pos">SF 2-A</span>
                <div class="slot-name">${renderPlayerRow(sf2P1, sf2Label1)}</div>
              </div>
              <div class="finals-player-slot">
                <span class="slot-pos">SF 2-B</span>
                <div class="slot-name">${renderPlayerRow(sf2P2, sf2Label2)}</div>
              </div>
              <div class="finals-winner-line">
                <span>Winner (SF-2): <strong>${sf2Winner ? `✓ ${sf2Winner.name}` : '______________________'}</strong></span>
              </div>
            </div>
          </div>

          <!-- Middle Connection SVG -->
          <div class="finals-svg-connector">
            <svg style="width: 80px; height: 100%;" viewBox="0 0 80 400" preserveAspectRatio="none">
              <path d="M 0 100 L 40 100 L 40 200 L 80 200" stroke="#000" stroke-width="2" fill="none" />
              <path d="M 0 300 L 40 300 L 40 200" stroke="#000" stroke-width="2" fill="none" />
            </svg>
          </div>

          <!-- Right Column: Final Match & Champion Box -->
          <div class="finals-stage-col championship-col">
            <div class="stage-col-header">
              <span class="stage-title">GRAND FINAL</span>
              <span class="stage-sub">Championship Match</span>
            </div>

            <!-- Final Match Card -->
            <div class="finals-match-card grand-final-card">
              <div class="match-card-tag gold">CHAMPIONSHIP FINAL</div>
              <div class="finals-player-slot">
                <span class="slot-pos gold">FINAL-1</span>
                <div class="slot-name">${renderPlayerRow(fP1, 'Winner of SEMI-FINAL - 1')}</div>
              </div>
              <div class="finals-player-slot">
                <span class="slot-pos gold">FINAL-2</span>
                <div class="slot-name">${renderPlayerRow(fP2, 'Winner of SEMI-FINAL - 2')}</div>
              </div>
              <div class="finals-winner-line">
                <span>Match Score: <strong>${finalMatch?.scoreSet1A ? `${finalMatch.scoreSet1A}-${finalMatch.scoreSet1B}${finalMatch.scoreSet2A ? `, ${finalMatch.scoreSet2A}-${finalMatch.scoreSet2B}` : ''}` : '____ - ____ , ____ - ____'}</strong></span>
              </div>
            </div>

            <!-- Official Champion Trophy Box -->
            <div class="champion-grand-box">
              <div class="trophy-badge">🏆 ${selectedCategory.toUpperCase()} CHAMPION</div>
              <div class="champion-name-display">
                ${champion ? `🏆 ${champion.name}` : '____________________________________'}
              </div>
              <div class="champion-sub-text">
                ${champion?.place ? `Representing: ${champion.place}` : 'Badminton Championship 2026 Winner'}
              </div>
            </div>
          </div>
        </div>

        <!-- Official Signatures Box on Finals Page -->
        <div class="finals-signatures-grid">
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Court Umpire Signature</div>
          </div>
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Tournament Referee Signature</div>
          </div>
          <div class="sig-item">
            <div class="sig-line"></div>
            <div class="sig-lbl">Organizing Secretary</div>
          </div>
        </div>

        <!-- Page Footer -->
        <div class="a4-footer-box">
          <span>Official Tournament Fixture Draw Sheet • Page ${currentPageNum} of ${totalPages} (Finals Stage)</span>
          <span>Category: ${selectedCategory} • Generated via Badminton Tournament Portal</span>
        </div>
      </div>
    `
  }

  // Create or reuse hidden iframe
  let iframe = document.getElementById('fixtures-print-iframe')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'fixtures-print-iframe'
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
        <title>${tournamentName} - ${selectedCategory} Fixtures</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 5mm 8mm;
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
            width: 100%;
          }
          .a4-fixture-page {
            width: 100%;
            max-width: 100%;
            height: 284mm;
            max-height: 284mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            overflow: hidden;
            box-sizing: border-box;
            padding: 2mm 0;
          }
          .a4-fixture-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .a4-header-box {
            border: 1.8px solid #000;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 8px;
            background: #f8fafc;
          }
          .a4-header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .a4-tour-name {
            font-size: 17px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #000;
          }
          .a4-badge {
            border: 1.8px solid #000;
            border-radius: 4px;
            padding: 3px 10px;
            font-size: 11.5px;
            font-weight: 900;
            background: #fff;
          }
          .a4-badge.finals-badge {
            background: #000;
            color: #fff;
          }
          .a4-header-meta {
            font-size: 11px;
            color: #222;
            margin-top: 4px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
          }
          .a4-tree-container {
            position: relative;
            display: flex;
            flex: 1;
            margin-bottom: 6px;
          }
          .a4-names-col {
            display: flex;
            flex-direction: column;
            z-index: 2;
          }
          .pair-block {
            display: flex;
            flex-direction: column;
          }
          .line-row {
            display: flex;
            align-items: flex-end;
            border-bottom: 1.8px solid #000;
            font-size: 11px;
          }
          .ln-num {
            width: 20px;
            font-weight: 900;
            font-size: 10.5px;
            color: #000;
            text-align: center;
          }
          .pname-box {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding-left: 4px;
            padding-bottom: 2px;
            font-weight: 900;
            color: #000;
            font-size: 10.5px;
          }
          .seed-pill {
            background: #000;
            color: #fff;
            padding: 1px 3px;
            border-radius: 2px;
            font-size: 8.5px;
            font-weight: 900;
            margin-right: 3px;
          }
          .pplace {
            font-size: 8.5px;
            color: #444;
            font-weight: 600;
            margin-left: 2px;
          }
          .txt-bye {
            color: #666;
            font-style: italic;
            font-weight: 800;
          }
          .txt-tbd {
            color: #888;
            font-style: italic;
          }
          .a4-svg-canvas {
            position: absolute;
            top: 0;
            z-index: 1;
          }
          .branch-line {
            fill: none;
            stroke: #000;
            stroke-width: 1.8px;
          }
          .round-title-text {
            font-size: 9.5px;
            font-weight: 900;
            fill: #1e3a8a;
            text-anchor: start;
            letter-spacing: 0.03em;
          }
          .winner-text {
            font-size: 11px;
            font-weight: 900;
            fill: #000;
            text-anchor: start;
          }

          /* =========================================
             FINALS STAGE PAGE STYLES
             ========================================= */
          .finals-page {
            padding: 4mm 2mm;
          }
          .finals-bracket-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex: 1;
            margin: 14px 0;
            padding: 0 10px;
          }
          .finals-stage-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: center;
          }
          .stage-col-header {
            text-align: center;
            margin-bottom: 16px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
          }
          .stage-title {
            display: block;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 0.05em;
            color: #000;
          }
          .stage-sub {
            font-size: 10.5px;
            color: #555;
            font-weight: 700;
          }
          .finals-match-card {
            border: 2px solid #000;
            border-radius: 6px;
            padding: 12px 14px;
            background: #fff;
            margin-bottom: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.06);
          }
          .grand-final-card {
            border: 2.5px solid #000;
            background: #f8fafc;
            margin-bottom: 20px;
          }
          .match-card-tag {
            font-size: 10.5px;
            font-weight: 900;
            color: #1e3a8a;
            letter-spacing: 0.04em;
            margin-bottom: 8px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 3px;
          }
          .match-card-tag.gold {
            color: #b45309;
            font-size: 11px;
          }
          .finals-player-slot {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px dashed #ccc;
          }
          .finals-player-slot:last-of-type {
            border-bottom: none;
          }
          .slot-pos {
            font-size: 10px;
            font-weight: 900;
            background: #000;
            color: #fff;
            padding: 2px 6px;
            border-radius: 3px;
            min-width: 48px;
            text-align: center;
          }
          .slot-pos.gold {
            background: #b45309;
          }
          .slot-name {
            font-size: 13px;
            font-weight: 800;
            color: #000;
            flex: 1;
          }
          .finals-winner-line {
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1.5px solid #000;
            font-size: 11px;
            color: #000;
            display: flex;
            justify-content: space-between;
          }
          .finals-stage-spacer {
            height: 30px;
          }
          .finals-svg-connector {
            width: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
          }
          .champion-grand-box {
            border: 2.5px solid #000;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            background: #fff;
          }
          .trophy-badge {
            font-size: 13px;
            font-weight: 900;
            color: #000;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }
          .champion-name-display {
            font-size: 18px;
            font-weight: 900;
            color: #000;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .champion-sub-text {
            font-size: 11px;
            color: #555;
            font-weight: 700;
          }
          .finals-signatures-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin: 16px 0 10px 0;
            padding-top: 10px;
          }
          .sig-item {
            text-align: center;
          }
          .sig-line {
            border-top: 1.5px solid #000;
            margin-bottom: 4px;
          }
          .sig-lbl {
            font-size: 10px;
            font-weight: 800;
            color: #000;
          }

          .a4-footer-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1.8px solid #000;
            padding-top: 6px;
            font-size: 9.5px;
            color: #333;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `)
  iframeDoc.close()

  setTimeout(() => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }, 250)
}
