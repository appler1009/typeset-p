/**
 * typeset-p — browser-only Web Component for advanced typesetting.
 *
 * Import this module to register the <typeset-p> custom element:
 *
 *   import 'typeset-p';
 *
 * Or import the class directly for manual registration or subclassing:
 *
 *   import { TypesetP } from 'typeset-p';
 *   customElements.define('typeset-p', TypesetP);
 */

export { TypesetP } from './typeset-p.js';
export type { TypesetPMode, TypesetPAlign, TypesetPAttributes } from './typeset-p.js';

// Auto-register when imported as a side-effect.
import { TypesetP } from './typeset-p.js';

if (typeof customElements !== 'undefined' && !customElements.get('typeset-p')) {
  customElements.define('typeset-p', TypesetP);
}

// ── Global type augmentations ────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    'typeset-p': TypesetP;
  }
}
