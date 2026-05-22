/**
 * Knuth-Plass optimal paragraph line-breaking.
 *
 * Operates on pre-segmented token arrays (strings + pixel widths) and returns
 * a KPLine array describing where to break and how much to stretch word spacing.
 *
 * Browser-only. Call only after fonts are loaded and canvas is available.
 */

const SOFT_HYPHEN = '­';

const HANG_LAST_CHARS = new Set([
  ',', '.', ';', ':', '!', '?', ')', ']', '}',
  '’', '”', '′', '»', '…',
]);

export interface KPLine {
  text: string;
  wordSpacingExtra: number;
  isLast: boolean;
  wordWidth: number;
  spaceCount: number;
}

export function measureNormalSpaceWidth(font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  return ctx.measureText(' ').width;
}

export function measureHyphenWidth(font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  return ctx.measureText('-').width;
}

export function computeOptimalLines(
  segments: readonly string[],
  widths: readonly number[],
  maxWidth: number,
  normalSpaceW: number,
  hyphenW: number,
  textAlign: 'left' | 'justify' | 'right' = 'justify',
  targetWidth?: number,
): KPLine[] {
  const n = segments.length;
  if (n === 0) return [];

  const candidates: Array<{ segIndex: number; isSoftHyphen: boolean }> = [
    { segIndex: 0, isSoftHyphen: false },
  ];

  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    if (seg === SOFT_HYPHEN) {
      if (i + 1 < n) candidates.push({ segIndex: i + 1, isSoftHyphen: true });
    } else if (seg.trim().length === 0 && i + 1 < n) {
      candidates.push({ segIndex: i + 1, isSoftHyphen: false });
    }
  }
  candidates.push({ segIndex: n, isSoftHyphen: false });

  const nc = candidates.length;

  function getLineInfo(fromIdx: number, toIdx: number) {
    const from = candidates[fromIdx].segIndex;
    const to = candidates[toIdx].segIndex;
    const endsWithHyphen = candidates[toIdx].isSoftHyphen;
    let wordWidth = 0;
    let spaceCount = 0;

    for (let si = from; si < to; si++) {
      const seg = segments[si];
      if (seg === SOFT_HYPHEN) continue;
      if (seg.trim().length === 0) spaceCount++;
      else wordWidth += widths[si];
    }
    if (to > from && segments[to - 1].trim().length === 0) spaceCount--;
    if (endsWithHyphen) wordWidth += hyphenW;
    return { wordWidth, spaceCount, endsWithHyphen };
  }

  const HYPHEN_PENALTY   =  150;
  const LADDER_2_PENALTY =  400;
  const LADDER_3_PENALTY = 1500;

  const WIDOW_THRESHOLD = 0.15;
  const WIDOW_PENALTY   = 3000;

  const ZONE_TIGHT  = 0;
  const ZONE_NORMAL = 1;
  const ZONE_LOOSE  = 2;
  const LOOSE_THRESHOLD     = 0.30;
  const ALTERNATION_PENALTY =  700;

  function zoneOf(wordWidth: number, spaceCount: number): number {
    if (textAlign !== 'justify' || spaceCount <= 0) return ZONE_NORMAL;
    const justifiedSpace = (maxWidth - wordWidth) / spaceCount;
    if (justifiedSpace < normalSpaceW * 0.95) return ZONE_TIGHT;
    const r = (justifiedSpace - normalSpaceW) / normalSpaceW;
    if (r < 0)               return ZONE_TIGHT;
    if (r > LOOSE_THRESHOLD) return ZONE_LOOSE;
    return ZONE_NORMAL;
  }

  function lineBadness(
    wordWidth: number,
    spaceCount: number,
    endsWithHyphen: boolean,
    isLastLine: boolean,
    prevRunLength: number,
    prevZone: number,
    currentZone: number,
  ): number {
    if (isLastLine) {
      const lastLineWidth = wordWidth + spaceCount * normalSpaceW;
      if (lastLineWidth > maxWidth) return 1e8;
      const ratio = lastLineWidth / maxWidth;
      if (ratio < WIDOW_THRESHOLD) {
        const t = 1 - ratio / WIDOW_THRESHOLD;
        return WIDOW_PENALTY * t * t;
      }
      return 0;
    }

    const hyphenPenalty = !endsWithHyphen       ? 0
      : prevRunLength >= 2                      ? LADDER_3_PENALTY
      : prevRunLength >= 1                      ? LADDER_2_PENALTY
      :                                           HYPHEN_PENALTY;

    const alternationPenalty =
      (prevZone === ZONE_TIGHT && currentZone === ZONE_LOOSE) ||
      (prevZone === ZONE_LOOSE && currentZone === ZONE_TIGHT)
        ? ALTERNATION_PENALTY : 0;

    if (textAlign === 'justify') {
      if (spaceCount <= 0) {
        const slack = maxWidth - wordWidth;
        return slack < 0 ? 1e8 : slack * slack * 10 + hyphenPenalty + alternationPenalty;
      }
      const justifiedSpace = (maxWidth - wordWidth) / spaceCount;
      if (justifiedSpace < 0 || justifiedSpace < normalSpaceW * 0.95) return 1e8;

      const ratio = (justifiedSpace - normalSpaceW) / normalSpaceW;
      const absRatio = Math.abs(ratio);
      const badness = absRatio * absRatio * absRatio * 1000;

      const riverExcess = justifiedSpace / normalSpaceW - 1.5;
      const riverPenalty = riverExcess > 0 ? 5000 + riverExcess * riverExcess * 10000 : 0;

      return badness + riverPenalty + hyphenPenalty + alternationPenalty;
    } else {
      const lineWidth = wordWidth + spaceCount * normalSpaceW;
      if (lineWidth > maxWidth) return 1e8;
      const slackRatio = (maxWidth - lineWidth) / maxWidth;
      return slackRatio * slackRatio * slackRatio * 100 + hyphenPenalty;
    }
  }

  const RUN_STATES  = 3;
  const ZONE_STATES = 3;

  function make3D<T>(fill: T): T[][][] {
    return Array.from({ length: nc }, () =>
      Array.from({ length: RUN_STATES }, () => new Array<T>(ZONE_STATES).fill(fill))
    );
  }

  const dp       = make3D<number>(Infinity);
  const prev     = make3D<number>(-1);
  const prevRun  = make3D<number>(-1);
  const prevZone = make3D<number>(-1);
  dp[0][0][ZONE_NORMAL] = 0;

  for (let j = 1; j < nc; j++) {
    const isLast = j === nc - 1;
    for (let i = j - 1; i >= 0; i--) {
      const { wordWidth, spaceCount, endsWithHyphen } = getLineInfo(i, j);
      if (wordWidth + spaceCount * normalSpaceW > maxWidth * 2) break;

      const zj = isLast ? ZONE_NORMAL : zoneOf(wordWidth, spaceCount);

      for (let ri = 0; ri < RUN_STATES; ri++) {
        for (let zi = 0; zi < ZONE_STATES; zi++) {
          if (dp[i][ri][zi] === Infinity) continue;
          const bad = lineBadness(wordWidth, spaceCount, endsWithHyphen, isLast, ri, zi, zj);
          const total = dp[i][ri][zi] + bad;
          const rj = endsWithHyphen ? Math.min(2, ri + 1) : 0;
          if (total < dp[j][rj][zj]) {
            dp[j][rj][zj]       = total;
            prev[j][rj][zj]     = i;
            prevRun[j][rj][zj]  = ri;
            prevZone[j][rj][zj] = zi;
          }
        }
      }
    }
  }

  let bestRun = 0, bestZone = 0;
  for (let r = 0; r < RUN_STATES; r++) {
    for (let z = 0; z < ZONE_STATES; z++) {
      if (dp[nc - 1][r][z] < dp[nc - 1][bestRun][bestZone]) { bestRun = r; bestZone = z; }
    }
  }

  const breakIndices: number[] = [];
  let cur = nc - 1, curRun = bestRun, curZone = bestZone;
  while (cur > 0) {
    if (prev[cur][curRun][curZone] === -1) { cur--; continue; }
    breakIndices.push(cur);
    const nextCur  = prev[cur][curRun][curZone];
    const nextRun  = prevRun[cur][curRun][curZone];
    const nextZone = prevZone[cur][curRun][curZone];
    cur = nextCur; curRun = nextRun; curZone = nextZone;
  }
  breakIndices.reverse();

  const lines: KPLine[] = [];
  let fromCandidate = 0;

  for (const toCandidate of breakIndices) {
    const from = candidates[fromCandidate].segIndex;
    const to = candidates[toCandidate].segIndex;
    const endsWithHyphen = candidates[toCandidate].isSoftHyphen;
    const isLast = toCandidate === nc - 1;

    let rawText = '';
    let wordWidth = 0;
    let spaceCount = 0;
    let endsWithTrailingSpace = false;

    for (let si = from; si < to; si++) {
      const seg = segments[si];
      if (seg === SOFT_HYPHEN) continue;
      rawText += seg;
      if (seg.trim().length === 0) {
        spaceCount++;
        endsWithTrailingSpace = true;
      } else {
        wordWidth += widths[si];
        endsWithTrailingSpace = false;
      }
    }

    if (endsWithTrailingSpace) spaceCount--;
    let text = endsWithTrailingSpace ? rawText.trimEnd() : rawText;

    if (endsWithHyphen) { text += '-'; wordWidth += hyphenW; }

    let wordSpacingExtra = 0;
    const fillWidth = targetWidth ?? maxWidth;
    if (textAlign === 'justify' && spaceCount > 0) {
      const rawJustified = (fillWidth - wordWidth) / spaceCount;
      wordSpacingExtra = rawJustified - normalSpaceW;
    }

    lines.push({ text, wordSpacingExtra, isLast, wordWidth, spaceCount });
    fromCandidate = toCandidate;
  }

  if (textAlign === 'justify') {
    if (lines.length >= 2) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].wordSpacingExtra !== 0) {
          sum += lines[i].wordSpacingExtra;
          count++;
        }
      }
      const avg = count > 0 ? sum / count : 0;
      const last = lines[lines.length - 1];
      if (last.spaceCount > 0) {
        const maxExtra = (maxWidth - last.wordWidth) / last.spaceCount - normalSpaceW;
        last.wordSpacingExtra = Math.max(0, Math.min(avg, maxExtra));
      } else {
        last.wordSpacingExtra = 0;
      }
    } else if (lines.length === 1) {
      lines[0].wordSpacingExtra = 0;
    }
  }

  return lines;
}

export function kpLinesToHtml(
  lines: KPLine[],
  formatLine?: (text: string) => string,
  prependFirstLine?: string,
  calibRatio?: number,
  textAlign: 'left' | 'justify' | 'right' = 'justify',
): string {
  let result = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineText = line.text;
    if (i === 0 && prependFirstLine) {
      lineText = prependFirstLine + lineText;
    }
    const content = formatLine
      ? formatLine(lineText)
      : lineText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

    const hasHangLast = !line.isLast && lineText.length > 0 && HANG_LAST_CHARS.has(lineText.charAt(lineText.length - 1));

    const rawWs = line.wordSpacingExtra;
    const adjustedWs = calibRatio !== undefined && calibRatio < 1
      ? rawWs * calibRatio
      : rawWs;
    const ws =
      adjustedWs !== 0
        ? `;word-spacing:${adjustedWs.toFixed(3)}px`
        : '';
    const justifyStyle = textAlign === 'justify' && !line.isLast
      ? 'text-align:justify;text-align-last:justify;'
      : '';
    const hangStyle = hasHangLast
      ? 'width:calc(100% + 0.16em);margin-right:-0.16em;'
      : 'width:100%;';
    result += `<span style="display:inline-block;${hangStyle}white-space:nowrap;${justifyStyle}${ws}">${content}</span>`;
    if (i < lines.length - 1 && !line.text.endsWith('-')) {
      result += ' ';
    }
  }
  return result;
}
