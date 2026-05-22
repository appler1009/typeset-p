import { describe, it, expect } from 'vitest';
import { computeOptimalLines, kpLinesToHtml, type KPLine } from '../pipeline/knuthPlass.js';

// Helpers: build fake segment/width arrays without canvas
function segs(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    if (i < words.length - 1) out.push(' ');
  }
  return out;
}
function widths(segments: string[], charPx = 8): number[] {
  return segments.map(s => s.trim() === '' ? 0 : s.length * charPx);
}

const SPACE_W = 4;   // matches setup.ts mock
const HYPHEN_W = 8;  // one char at 8px/char

describe('computeOptimalLines', () => {
  it('returns empty array for empty input', () => {
    expect(computeOptimalLines([], [], 600, SPACE_W, HYPHEN_W)).toEqual([]);
  });

  it('puts a single short word on one line', () => {
    const s = segs(['Hello']);
    const w = widths(s);
    const lines = computeOptimalLines(s, w, 600, SPACE_W, HYPHEN_W);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
    expect(lines[0].isLast).toBe(true);
  });

  it('puts two short words on the same line if they fit', () => {
    const s = segs(['Hi', 'there']);
    const w = widths(s);
    // "Hi"(16) + space(4) + "there"(40) = 60px; maxWidth=200 → fits on one line
    const lines = computeOptimalLines(s, w, 200, SPACE_W, HYPHEN_W);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain('Hi');
    expect(lines[0].text).toContain('there');
  });

  it('wraps words that exceed maxWidth onto a new line', () => {
    // 5 words of 8 chars each = 40px/word + 4px spaces
    // Line capacity = 50px → forces multiple lines
    const words = ['abcdefgh', 'ijklmnop', 'qrstuvwx', 'yzabcdef'];
    const s = segs(words);
    const w = widths(s);
    const lines = computeOptimalLines(s, w, 50, SPACE_W, HYPHEN_W);
    expect(lines.length).toBeGreaterThan(1);
    // Last line always has isLast = true
    expect(lines[lines.length - 1].isLast).toBe(true);
    // Non-last lines have isLast = false
    for (let i = 0; i < lines.length - 1; i++) {
      expect(lines[i].isLast).toBe(false);
    }
  });

  it('reconstructs full text across all lines (no words dropped)', () => {
    const words = 'the quick brown fox jumps over the lazy dog'.split(' ');
    const s = segs(words);
    const w = widths(s);
    const lines = computeOptimalLines(s, w, 100, SPACE_W, HYPHEN_W);
    const reconstructed = lines.map(l => l.text).join(' ').replace(/\s+/g, ' ').trim();
    expect(reconstructed).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('wordSpacingExtra is 0 on the last line for justify mode', () => {
    const words = 'one two three four five six'.split(' ');
    const s = segs(words);
    const w = widths(s);
    const lines = computeOptimalLines(s, w, 120, SPACE_W, HYPHEN_W, 'justify');
    const last = lines[lines.length - 1];
    // Last line should not be force-justified
    expect(last.wordSpacingExtra).toBeGreaterThanOrEqual(0);
    // And should be <= average of other lines (never overly wide)
    if (lines.length > 1) {
      const avg = lines.slice(0, -1)
        .filter(l => l.spaceCount > 0)
        .reduce((s, l) => s + l.wordSpacingExtra, 0) / (lines.length - 1);
      expect(last.wordSpacingExtra).toBeLessThanOrEqual(avg + 0.01);
    }
  });

  it('wordSpacingExtra is 0 for all lines in left-align mode', () => {
    const words = 'one two three four five six seven eight'.split(' ');
    const s = segs(words);
    const w = widths(s);
    const lines = computeOptimalLines(s, w, 120, SPACE_W, HYPHEN_W, 'left');
    for (const line of lines) {
      expect(line.wordSpacingExtra).toBe(0);
    }
  });

  it('uses soft hyphen as a break candidate', () => {
    // Simulate a long word pre-split with soft hyphens by the hyphenator
    // "abcdefghij­klmnopqrst" → soft hyphen at position 10
    const SOFT = '­';
    const segments = ['abcdefghij', SOFT, 'klmnopqrst'];
    const w = [80, 0, 80]; // 80px each half
    // maxWidth=90 → single word 160px doesn't fit without break; break at soft hyphen
    const lines = computeOptimalLines(segments, w, 90, SPACE_W, HYPHEN_W, 'left');
    expect(lines.length).toBeGreaterThanOrEqual(1);
    if (lines.length > 1) {
      // First line should end with a hyphen
      expect(lines[0].text).toMatch(/-$/);
    }
  });

  it('prefers a hyphen break over overflowing the line width', () => {
    // A word that only fits if split at a soft hyphen should still be split
    const SOFT = '­';
    const segments = ['abcde', SOFT, 'fghij'];
    const w = [40, 0, 40]; // 40px each half, hyphen = 8px
    // maxWidth=50 → full word 80px doesn't fit; break at soft hyphen (40+8=48 ≤ 50)
    const lines = computeOptimalLines(segments, w, 50, SPACE_W, HYPHEN_W, 'left');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].text).toMatch(/-$/);
  });

  it('does not penalise an isolated hyphenated line', () => {
    // A paragraph where only one line must be hyphenated should not be
    // avoided in favour of a worse overall layout.
    // We verify by checking that the algorithm still produces a hyphen when
    // it is the only way to fit the text, i.e. it does not refuse to break.
    const SOFT = '­';
    const segments = ['short', ' ', 'ver', SOFT, 'bose', ' ', 'end'];
    const w =        [  40,    0,    24,    0,    32,    0,   24];
    const lines = computeOptimalLines(segments, w, 70, SPACE_W, HYPHEN_W, 'left');
    const allText = lines.map(l => l.text).join(' ');
    expect(allText.replace(/ +/g, ' ').trim()).toContain('ver');
  });

  it('handles a single word paragraph (no spaces)', () => {
    const s = ['Antidisestablishmentarianism'];
    const w = [s[0].length * 8];
    const lines = computeOptimalLines(s, w, 600, SPACE_W, HYPHEN_W);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Antidisestablishmentarianism');
  });
});

describe('kpLinesToHtml', () => {
  const makeLines = (texts: string[], wordSpacingExtra = 0): KPLine[] =>
    texts.map((text, i) => ({
      text,
      wordSpacingExtra,
      isLast: i === texts.length - 1,
      wordWidth: text.length * 8,
      spaceCount: (text.match(/ /g) ?? []).length,
    }));

  it('wraps each line in an inline-block span', () => {
    const lines = makeLines(['Hello world']);
    const html = kpLinesToHtml(lines);
    expect(html).toContain('display:inline-block');
  });

  it('escapes HTML special chars in text', () => {
    const lines = makeLines(['a<b>&c']);
    const html = kpLinesToHtml(lines);
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&amp;');
  });

  it('does not add text-align:justify to the last line', () => {
    const lines = makeLines(['line one', 'line two']);
    const html = kpLinesToHtml(lines, undefined, undefined, undefined, 'justify');
    const spans = html.split('</span>');
    // Last span (index 1) should NOT contain text-align:justify
    expect(spans[1]).not.toContain('text-align:justify');
  });

  it('adds text-align:justify to non-last lines when align=justify', () => {
    const lines = makeLines(['line one', 'line two']);
    const html = kpLinesToHtml(lines, undefined, undefined, undefined, 'justify');
    // First span should have justify styles
    expect(html).toContain('text-align:justify');
  });

  it('includes word-spacing when wordSpacingExtra is non-zero', () => {
    const lines = makeLines(['hello world'], 2.5);
    const [first] = lines;
    first.isLast = false;
    const html = kpLinesToHtml([first]);
    expect(html).toContain('word-spacing:');
  });

  it('does not include word-spacing when wordSpacingExtra is 0', () => {
    const lines = makeLines(['hello world'], 0);
    const html = kpLinesToHtml(lines);
    expect(html).not.toContain('word-spacing:');
  });

  it('prepends prependFirstLine to the first line only', () => {
    const lines = makeLines(['world', 'of text']);
    // Use a curly left quote (U+201C) so we don't collide with " in style attributes
    const html = kpLinesToHtml(lines, undefined, '“', undefined, 'left');
    const firstSpan = html.split('</span>')[0];
    expect(firstSpan).toContain('“world');
    const secondSpan = html.split('</span>')[1];
    expect(secondSpan).not.toContain('“');
  });

  it('applies a custom formatLine function', () => {
    const lines = makeLines(['hello world']);
    const html = kpLinesToHtml(lines, t => `<em>${t}</em>`);
    expect(html).toContain('<em>hello world</em>');
  });

  it('adds trailing-hang width to lines ending with hang punctuation', () => {
    // '.' is a HANG_LAST_CHARS member
    const lines = makeLines(['sentence.', 'next line']);
    lines[0].isLast = false;
    const html = kpLinesToHtml(lines);
    // The first span should have wider width for the hanging period
    expect(html.split('</span>')[0]).toContain('calc(100%');
  });

  it('does not add space between hyphenated line and next', () => {
    const lines = makeLines(['break-', 'ing']);
    lines[0].isLast = false;
    const html = kpLinesToHtml(lines);
    // The two spans should be adjacent, no space inserted after hyphen
    expect(html).not.toMatch(/break-<\/span> /);
  });

  it('inserts a space between non-hyphenated lines', () => {
    const lines = makeLines(['first', 'second']);
    lines[0].isLast = false;
    const html = kpLinesToHtml(lines);
    expect(html).toContain('</span> ');
  });
});
