import { describe, it, expect } from 'vitest';
import { applySmartTypo } from '../pipeline/smartTypo.js';

describe('applySmartTypo', () => {
  describe('smart quotes disabled', () => {
    it('passes text through unchanged when smartQuotes is false', () => {
      expect(applySmartTypo('"hello"', { smartQuotes: false })).toBe('"hello"');
    });
  });

  describe('double quotes', () => {
    it('curls opening double quote after space', () => {
      expect(applySmartTypo('say "hello"')).toBe('say “hello”');
    });

    it('curls opening double quote at start of string', () => {
      expect(applySmartTypo('"Hello there"')).toBe('“Hello there”');
    });

    it('curls double quotes around interior phrase', () => {
      const result = applySmartTypo('He said "good morning" to her.');
      expect(result).toBe('He said “good morning” to her.');
    });

    it('handles multiple quoted phrases on one line', () => {
      const result = applySmartTypo('"first" and "second"');
      expect(result).toBe('“first” and “second”');
    });
  });

  describe('single quotes and apostrophes', () => {
    it('curls opening single quote at start of string', () => {
      expect(applySmartTypo("'Hello'")).toMatch(/[‘’]/);
    });

    it('converts contraction apostrophe', () => {
      expect(applySmartTypo("don't")).toBe('don’t');
    });

    it('converts it\'s contraction', () => {
      expect(applySmartTypo("it's")).toBe('it’s');
    });

    it('converts possessive apostrophe', () => {
      expect(applySmartTypo("the cat's meow")).toBe('the cat’s meow');
    });
  });

  describe('punctuation substitutions', () => {
    it('converts -- to em dash', () => {
      expect(applySmartTypo('hello--world')).toBe('hello—world');
    });

    it('converts ... to ellipsis', () => {
      expect(applySmartTypo('and then...')).toBe('and then…');
    });

    it('converts number range to en dash', () => {
      expect(applySmartTypo('pages 10-20')).toBe('pages 10–20');
    });

    it('converts number range with spaces', () => {
      expect(applySmartTypo('pages 10 - 20')).toBe('pages 10–20');
    });

    it('applies em dash and ellipsis in the same string', () => {
      const result = applySmartTypo('wait--it\'s over...');
      expect(result).toContain('—');
      expect(result).toContain('…');
    });
  });

  describe('combined transformations', () => {
    it('applies smart quotes and punctuation together', () => {
      const result = applySmartTypo('"Wait--is it over?" she asked...');
      expect(result).toContain('“'); // opening double quote
      expect(result).toContain('—'); // em dash
      expect(result).toContain('…'); // ellipsis
    });

    it('does not double-convert already-curled quotes', () => {
      const once = applySmartTypo('"hello"');
      const twice = applySmartTypo(once);
      expect(twice).toBe(once);
    });
  });
});
