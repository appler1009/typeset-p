# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-05-26

### Added

- Optional `typeset-p/styles.css` with default `--typeset-pull-single` and `--typeset-pull-double` for font-specific optical margin tuning.
- `last-line` attribute (`average` | `justify` | `ragged`) for final-line behavior when `align="justify"` in custom mode.
- CSS custom properties on hang spans: inline styles use `var(--typeset-pull-single, …)` and `var(--typeset-pull-double, …)` with built-in fallbacks.

### Fixed

- With `hanging-punctuation="false"`, leading quotes are now included in Knuth-Plass line-width measurement so justified lines starting with quotes no longer over-stretch.

### Changed

- README documents hanging-punctuation behavior by mode (`custom`, `browser`, disabled) and last-line spacing in justify mode.

## [0.1.1] - 2026-05-22

### Changed

- Optical margin alignment uses inline margins instead of `pull-*` CSS classes (no external stylesheet required).
- Default `mode` is `custom`.

## [0.1.0] - Initial release

- `<typeset-p>` Web Component with Knuth-Plass line breaking, smart typography, hyphenation, and optical margin alignment.
