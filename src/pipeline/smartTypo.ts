/**
 * Browser-native smart typography.
 *
 * Operates on plain text and returns plain text. No DOM parser, no cheerio,
 * no Node.js dependencies — safe to bundle and run in any browser context.
 *
 * Ported from davidmerfield/Typeset's quotes.js and punctuation.js regex logic,
 * adapted to return Unicode characters instead of HTML entities.
 */

export interface SmartTypoOptions {
  smartQuotes?: boolean;
  smallCaps?: boolean;
}

/**
 * Apply smart typography to plain text. Returns plain text with Unicode
 * curly quotes, em/en dashes, and ellipses substituted in.
 */
export function applySmartTypo(text: string, opts: SmartTypoOptions = {}): string {
  let out = text;
  if (opts.smartQuotes !== false) {
    out = convertQuotes(out);
    out = convertPunctuation(out);
  }
  return out;
}

// ── Smart quotes ─────────────────────────────────────────────────────────────
// Ported directly from typeset/src/quotes.js (MIT, davidmerfield)

function convertQuotes(text: string): string {
  return text
    // Opening double quote: preceded by non-word or start, followed by non-whitespace
    .replace(/(\W|^)"([^\s!?:;.,»])/g, '$1“$2')
    // Closing double quote after an opening one
    .replace(/(“[^"]*)"([^"]*$|[^“"]*“)/g, '$1”$2')
    // Remaining " at end of word
    .replace(/([^0-9])"/g, '$1”')
    // Opening single quote
    .replace(/(\W|^)'(\S)/g, '$1‘$2')
    // Contraction apostrophe (don't, it's)
    .replace(/([a-z])'([a-z])/gi, '$1’$2')
    // Closing single quote
    .replace(/((‘[^']*)|[a-z])'([^0-9]|$)/gi, '$1’$3')
    // Abbreviated years like '93
    .replace(/(‘)([0-9]{2}[^’]*)(‘([^0-9]|$)|$|’[a-z])/gi, '’$2$3')
    // Backwards apostrophe edge case
    .replace(/(\B|^)‘(?=([^’]*’\b)*([^’‘]*\W[’‘]\b|[^’‘]*$))/gi, '$1’');
}

// ── Punctuation substitutions ─────────────────────────────────────────────────

function convertPunctuation(text: string): string {
  return text
    // En dash for number ranges (1-5 → 1–5)
    .replace(/(\d+)\s?-\s?(\d+)/g, '$1–$2')
    // Em dash (-- → —)
    .replace(/--/g, '—')
    // Ellipsis
    .replace(/\.\.\./g, '…');
}
