import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespaceForKP,
  stripLeadingHangPunctuation,
  hangPunctuation,
} from '../utils.js';

describe('normalizeWhitespaceForKP', () => {
  it('leaves plain ASCII text unchanged', () => {
    expect(normalizeWhitespaceForKP('hello world')).toBe('hello world');
  });

  it('collapses tab to space', () => {
    expect(normalizeWhitespaceForKP('a\tb')).toBe('a b');
  });

  it('collapses newline to space', () => {
    expect(normalizeWhitespaceForKP('a\nb')).toBe('a b');
  });

  it('collapses carriage return to space', () => {
    expect(normalizeWhitespaceForKP('a\rb')).toBe('a b');
  });

  it('collapses multiple whitespace chars to single space', () => {
    expect(normalizeWhitespaceForKP('a\t\n\rb')).toBe('a b');
  });

  it('replaces thin space (U+2009) with regular space', () => {
    expect(normalizeWhitespaceForKP('a b')).toBe('a b');
  });

  it('replaces narrow no-break space (U+202F) with regular space', () => {
    expect(normalizeWhitespaceForKP('a b')).toBe('a b');
  });

  it('removes zero-width space (U+200B)', () => {
    expect(normalizeWhitespaceForKP('a​b')).toBe('ab');
  });

  it('preserves soft hyphen (U+00AD)', () => {
    expect(normalizeWhitespaceForKP('some­word')).toBe('some­word');
  });
});

describe('stripLeadingHangPunctuation', () => {
  it('returns empty leading for normal text', () => {
    expect(stripLeadingHangPunctuation('hello')).toEqual({ leading: '', rest: 'hello' });
  });

  it('strips leading opening double curly quote', () => {
    const { leading, rest } = stripLeadingHangPunctuation('“hello”');
    expect(leading).toBe('“');
    expect(rest).toBe('hello”');
  });

  it('strips leading closing double curly quote', () => {
    const { leading, rest } = stripLeadingHangPunctuation('”text');
    expect(leading).toBe('”');
    expect(rest).toBe('text');
  });

  it('strips leading opening single curly quote', () => {
    const { leading, rest } = stripLeadingHangPunctuation('‘hello');
    expect(leading).toBe('‘');
    expect(rest).toBe('hello');
  });

  it('strips leading straight double quote', () => {
    const { leading, rest } = stripLeadingHangPunctuation('"hello"');
    expect(leading).toBe('"');
    expect(rest).toBe('hello"');
  });

  it('strips leading guillemet', () => {
    const { leading, rest } = stripLeadingHangPunctuation('«hello»');
    expect(leading).toBe('«');
    expect(rest).toBe('hello»');
  });

  it('returns full text as rest if no leading hang char', () => {
    const result = stripLeadingHangPunctuation('The quick brown fox');
    expect(result.leading).toBe('');
    expect(result.rest).toBe('The quick brown fox');
  });
});

describe('hangPunctuation', () => {
  it('wraps line-initial opening double quote in pull-double span', () => {
    const result = hangPunctuation('"Hello world"');
    expect(result).toContain('<span class="pull-double">"</span>');
  });

  it('wraps line-initial opening single curly quote in pull-single span', () => {
    const result = hangPunctuation('‘Hello');
    expect(result).toContain('<span class="pull-single">‘</span>');
  });

  it('wraps line-initial straight single quote in pull-single span', () => {
    const result = hangPunctuation("'Hello world'");
    expect(result).toContain('<span class="pull-single">\'</span>');
  });

  it('does NOT wrap mid-line double quote', () => {
    // The word "said" starts the line; the embedded quote should not get a span
    const result = hangPunctuation('He said "hello" to her');
    expect(result).not.toContain('pull-double');
    expect(result).not.toContain('pull-single');
  });

  it('does NOT wrap mid-line single quote / apostrophe', () => {
    const result = hangPunctuation("don't look now");
    // "don't" starts the line and has no leading hang char, so no span
    expect(result).not.toContain('pull-single');
    expect(result).not.toContain('pull-double');
  });

  it('does NOT emit push-* spans', () => {
    const result = hangPunctuation('"Hello world"');
    expect(result).not.toContain('push-single');
    expect(result).not.toContain('push-double');
  });

  it('leaves text without leading punctuation unchanged', () => {
    const input = 'The quick brown fox jumps';
    expect(hangPunctuation(input)).toBe(input);
  });

  it('normalizes internal whitespace to single spaces', () => {
    const result = hangPunctuation('word   word');
    expect(result).toBe('word word');
  });

  it('handles guillemet opening', () => {
    const result = hangPunctuation('«Bonjour»');
    expect(result).toContain('<span class="pull-double">«</span>');
  });

  it('preserves the rest of the line after the pull span', () => {
    const result = hangPunctuation('"Hello there, world"');
    expect(result).toContain('Hello there,');
  });
});
