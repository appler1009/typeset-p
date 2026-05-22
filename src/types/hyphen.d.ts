declare module 'hyphen' {
  function createHyphenator(
    patterns: unknown,
    options?: { minWordLength?: number; hyphenChar?: string }
  ): (text: string) => string;
  export = createHyphenator;
}

declare module 'hyphen/patterns/en-us' {
  const patterns: unknown;
  export = patterns;
}
