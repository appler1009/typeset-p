/**
 * <typeset-p> — Web Component for advanced browser-side typesetting.
 *
 * Modes:
 *  default  — plain browser rendering, no enhancement
 *  browser  — CSS text-wrap:pretty + hyphens:auto + hanging-punctuation:first last
 *  custom   — full pipeline: smart quotes → soft hyphens → font readiness →
 *             canvas calibration → Knuth-Plass line breaking → per-line word spacing
 *
 * Usage:
 *   <typeset-p mode="custom" align="justify" font="Lora" font-size="18px">
 *     Then wise Telemachus answered him...
 *   </typeset-p>
 */

import { applySmartTypo, type SmartTypoOptions } from './pipeline/smartTypo.js';
import { hyphenateText } from './pipeline/hyphenate.js';
import { measureCanvasDomRatio, ensureFontReady } from './pipeline/measure.js';
import {
  computeOptimalLines,
  kpLinesToHtml,
  measureNormalSpaceWidth,
  measureHyphenWidth,
  type KPLine,
} from './pipeline/knuthPlass.js';
import { prepareWithSegments } from '@chenglou/pretext';
import {
  normalizeWhitespaceForKP,
  stripLeadingHangPunctuation,
  hangPunctuation,
  hasNativeHanging,
} from './utils.js';

export type TypesetPMode = 'default' | 'browser' | 'custom';
export type TypesetPAlign = 'left' | 'justify' | 'right';

/** All attributes accepted by <typeset-p>. */
export interface TypesetPAttributes {
  mode?: TypesetPMode;
  align?: TypesetPAlign;
  font?: string;
  'font-size'?: string;
  /** Set to "false" to disable soft hyphenation. Default: enabled. */
  hyphenate?: string;
  /** Set to "false" to disable smart quote conversion. Default: enabled. */
  'smart-quotes'?: string;
  /** Set to "false" to disable optical margin alignment. Default: enabled. */
  'hanging-punctuation'?: string;
}

type Mode = TypesetPMode;
type Align = TypesetPAlign;

const OBSERVED = ['mode', 'align', 'font', 'font-size', 'hyphenate', 'smart-quotes', 'hanging-punctuation'] as const;

// SSR guard: HTMLElement is not defined in Node.js. Extend a no-op class there
// so the module can be imported without crashing in Next.js / Nuxt / SvelteKit.
const _HTMLElement: typeof HTMLElement =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

export class TypesetP extends _HTMLElement {
  static readonly observedAttributes: readonly string[] = OBSERVED;

  private _resizeObserver: ResizeObserver | null = null;
  private _resizeDebounce: ReturnType<typeof setTimeout> | null = null;
  private _version = 0;
  private _containerWidth = 0;
  private _computedFont = '';
  private _rawText = '';

  connectedCallback() {
    this._rawText = this.textContent ?? '';
    this._setupResizeObserver();
    this._setupFontListener();
    this._run();
  }

  disconnectedCallback() {
    this._cleanup();
    document.fonts.removeEventListener('loadingdone', this._onFontsLoaded);
  }

  attributeChangedCallback() {
    if (this.isConnected) this._run();
  }

  // ── Attribute helpers ────────────────────────────────────────────────────

  private get _mode(): Mode {
    const v = this.getAttribute('mode');
    if (v === 'browser' || v === 'custom') return v;
    return 'default';
  }

  private get _align(): Align {
    const v = this.getAttribute('align');
    if (v === 'justify' || v === 'right') return v;
    return 'left';
  }

  private get _font(): string {
    return this.getAttribute('font') ?? getComputedStyle(this).fontFamily;
  }

  private get _fontSize(): number {
    const attr = this.getAttribute('font-size');
    if (attr) {
      const parsed = parseFloat(attr);
      if (!isNaN(parsed)) return parsed;
    }
    return parseFloat(getComputedStyle(this).fontSize) || 16;
  }

  private _bool(attr: string): boolean {
    return !this.hasAttribute(attr) || this.getAttribute(attr) !== 'false';
  }

  // ── Lifecycle helpers ────────────────────────────────────────────────────

  private _setupResizeObserver() {
    if (this._resizeObserver) return;
    this._resizeObserver = new ResizeObserver(() => {
      if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
      this._resizeDebounce = setTimeout(() => {
        const w = this.clientWidth;
        const f = this.getAttribute('font') ?? getComputedStyle(this).fontFamily;
        const changed = w !== this._containerWidth || f !== this._computedFont;
        if (changed) {
          this._containerWidth = w;
          this._computedFont = f;
          this._run();
        }
      }, 150);
    });
    this._resizeObserver.observe(this);
    this._containerWidth = this.clientWidth;
    this._computedFont = this.getAttribute('font') ?? getComputedStyle(this).fontFamily;
  }

  // Arrow function so it can be passed to addEventListener and removed by reference.
  private _onFontsLoaded = () => {
    if (this._mode === 'custom') this._run();
  };

  private _setupFontListener() {
    document.fonts.addEventListener('loadingdone', this._onFontsLoaded);
  }

  private _cleanup() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
    this._resizeDebounce = null;
    this._version++;
  }

  // ── Main render dispatcher ───────────────────────────────────────────────

  private _run() {
    this._version++;
    const version = this._version;

    switch (this._mode) {
      case 'default':
        this._renderDefault();
        break;
      case 'browser':
        this._renderBrowser();
        break;
      case 'custom':
        this._renderCustom(version).catch(() => { /* cancelled or failed */ });
        break;
    }
  }

  private _renderDefault() {
    // Plain browser rendering — restore raw text, remove any KP spans.
    this.style.cssText = '';
    this.textContent = this._rawText;
  }

  private _renderBrowser() {
    this.style.cssText = [
      'display:block',
      'text-wrap:pretty',
      'hyphens:auto',
      'hanging-punctuation:first last',
    ].join(';');
    this.textContent = this._rawText;
  }

  private async _renderCustom(version: number) {
    // Ensure display:block before reading clientWidth so the element has a real
    // layout width even if the consumer hasn't set display on it via CSS.
    this.style.cssText = 'display:block;';

    const font = this._font;
    const fontSize = this._fontSize;
    const align = this._align;
    const containerWidth = this.clientWidth;
    this._computedFont = font;

    if (containerWidth <= 0) return;

    const opts: SmartTypoOptions = {
      smartQuotes: this._bool('smart-quotes'),
    };

    // Step 1: smart typography — pure text → text transform, no DOM parser needed
    let processedText = applySmartTypo(this._rawText, opts);

    // Step 2: soft hyphenation
    if (this._bool('hyphenate')) {
      processedText = hyphenateText(processedText);
    }
    if (version !== this._version) return;

    // Step 3: normalize special whitespace for KP
    processedText = normalizeWhitespaceForKP(processedText);

    // Step 4: font readiness barrier
    await ensureFontReady(font, fontSize);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (version !== this._version) return;

    // Step 5: canvas/DOM calibration
    const rawRatio = await measureCanvasDomRatio(font, fontSize);
    if (version !== this._version) return;
    const calibRatio = Math.min(1, rawRatio);
    const effectiveRatio = Math.min(calibRatio, 0.995);
    const maxWidth = containerWidth * effectiveRatio - fontSize * 0.25;

    // Step 6: segment + measure
    const fontString = `${fontSize}px ${font}`;
    const normalSpaceW = measureNormalSpaceWidth(fontString);
    const hyphenW = measureHyphenWidth(fontString);

    // Strip leading hang punctuation before measuring (it'll be re-prepended)
    const { leading, rest } = stripLeadingHangPunctuation(processedText);
    const prepared = prepareWithSegments(rest, fontString);

    // Step 7: Knuth-Plass DP
    const lines: KPLine[] = computeOptimalLines(
      prepared.segments,
      prepared.widths,
      maxWidth,
      normalSpaceW,
      hyphenW,
      align,
      containerWidth,
    );
    if (version !== this._version) return;

    if (lines.length === 0) return;

    // Step 8: serialize to HTML
    const nativeHang = hasNativeHanging(this);
    const hangFn = this._bool('hanging-punctuation') && !nativeHang
      ? hangPunctuation
      : undefined;

    const html = kpLinesToHtml(lines, hangFn, leading, effectiveRatio, align);

    if (version !== this._version) return;

    // Step 9: inject into the element
    this.innerHTML = html;
  }
}
