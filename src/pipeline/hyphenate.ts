/**
 * Browser-side soft hyphenation using the `hyphen` package.
 *
 * Inserts Unicode soft hyphens (U+00AD) at valid Knuth-Liang break points so
 * the KP algorithm can treat them as optional line-break candidates.
 *
 * minWordLength: 8 — matches the reference app's hyphenopoly config and keeps
 * hyphenation reserved for longer words where it meaningfully improves spacing.
 */

import createHyphenator from 'hyphen';
import enUsPatterns from 'hyphen/patterns/en-us';

const hyphenateSync = createHyphenator(enUsPatterns, {
  minWordLength: 8,
  hyphenChar: '­',
});

/**
 * Insert soft hyphens into all words of 8+ characters.
 * Returns the original string unchanged if hyphenation fails.
 */
export function hyphenateText(text: string): string {
  try {
    return hyphenateSync(text);
  } catch {
    return text;
  }
}
