/**
 * Shared utilities for text normalization and hanging punctuation.
 */

/**
 * Replace typographic special spaces with regular U+0020 so the KP
 * space-counting logic works correctly. Preserves soft hyphens (U+00AD).
 */
export function normalizeWhitespaceForKP(text: string): string {
  return text
    .replace(/[\t\n\r\f]+/g, ' ')
    .replace(/[    ]/g, ' ')
    .replace(/​/g, '');
}

const HANG_LEADING_CHARS = new Set([
  '"', '“', '”', '«', '»', '«', '»',
  "'", '′', '‘', '’',
]);

export function stripLeadingHangPunctuation(text: string): { leading: string; rest: string } {
  const firstChar = text.charAt(0);
  if (HANG_LEADING_CHARS.has(firstChar)) {
    return { leading: firstChar, rest: text.slice(1) };
  }
  return { leading: '', rest: text };
}

const SINGLE_HANG = ["'", '′', '‘', '’'];
const DOUBLE_HANG = ['"', '“', '”', '«', '»', '«', '»'];

/**
 * Wrap line-initial punctuation in pull/push spans for optical margin alignment.
 * Applied per KP output line so only characters that actually start a rendered line get pulled.
 */
export function hangPunctuation(text: string): string {
  const normalized = text.replace(/\s+/g, ' ');
  const words = normalized.split(' ');

  // Only the first word of the line can hang into the left margin.
  for (const p of SINGLE_HANG) {
    if (words[0].startsWith(p)) {
      words[0] = `<span class="pull-single">${p}</span>${words[0].slice(p.length)}`;
      break;
    }
  }
  for (const p of DOUBLE_HANG) {
    if (words[0].startsWith(p)) {
      words[0] = `<span class="pull-double">${p}</span>${words[0].slice(p.length)}`;
      break;
    }
  }

  return words.join(' ');
}

/** Strip HTML tags and decode basic entities using the DOM. */
export function stripHtmlTags(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

/**
 * Check whether the element currently has native CSS hanging-punctuation active.
 * If so, we skip manual hangPunctuation() spans to avoid double-pulling.
 */
export function hasNativeHanging(el: Element): boolean {
  const s = window.getComputedStyle(el);
  const val = (s as unknown as Record<string, string>).hangingPunctuation ?? '';
  return val.includes('first');
}
