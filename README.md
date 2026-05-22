# typeset-p

A Web Component for professional-quality paragraph typesetting in the browser. Drop it in wherever you render body text and get Knuth-Plass optimal line-breaking, smart quotes, soft hyphenation, and optical margin alignment — all without touching your existing markup or styles.

```html
<typeset-p mode="custom" align="justify">
  It was a truth generally accepted that a man with a fortune must be
  in need of a wife, yet the quiet countryside seemed to have forgotten this.
</typeset-p>
```

## Installation

```bash
npm install typeset-p
```

## Quick start

Import once — anywhere in your app — to register the custom element globally:

```js
import 'typeset-p';
```

Then use `<typeset-p>` anywhere in your HTML or component templates. It inherits font, size, and color from CSS like any other element.

## Modes

The `mode` attribute controls how much processing is applied.

| Mode | What it does |
|------|-------------|
| `default` | Plain browser rendering, no enhancement |
| `browser` | Native CSS only: `text-wrap: pretty`, `hyphens: auto`, `hanging-punctuation: first last`. No JavaScript runs — quality depends entirely on what the browser supports. |
| `custom` | Full JS pipeline: smart quotes → soft hyphenation → Knuth-Plass line-breaking → per-line word spacing |

`custom` produces the best results but requires JavaScript and a loaded font. `browser` is a zero-JS fallback that delegates everything to the browser's own typesetting — useful as a server-rendered default or for contexts where JS is unavailable.

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | `"default"` \| `"browser"` \| `"custom"` | `"default"` | Processing mode |
| `align` | `"left"` \| `"justify"` \| `"right"` | `"left"` | Text alignment |
| `font` | string | inherited from CSS | Font family passed to canvas measurement, e.g. `"Lora, Georgia, serif"`. Set this explicitly in `custom` mode — if omitted, the value is read from `getComputedStyle`, but CSS-only font changes (e.g. a class swap) won't trigger a re-render unless the container also resizes. |
| `font-size` | string | inherited from CSS | Font size passed to canvas measurement, e.g. `"18px"` |
| `hyphenate` | `"false"` to disable | enabled | Soft hyphenation for words ≥ 8 characters |
| `smart-quotes` | `"false"` to disable | enabled | Converts `"straight"` quotes to `"curly"` quotes, `--` to em dashes, `...` to ellipses |
| `hanging-punctuation` | `"false"` to disable | enabled | Optical margin alignment — pulls leading quotes into the left margin |

## CSS for optical margin alignment

In `custom` mode, the component wraps line-initial punctuation in spans for optical margin alignment. Add these rules to your stylesheet:

```css
typeset-p .pull-single { margin-left: -0.22em; } /* single quotes, apostrophes */
typeset-p .pull-double { margin-left: -0.42em; } /* double quotes, guillemets  */
```

Without these rules the component still works — the spans are emitted but have no visual effect.

## Usage by framework

### Vanilla HTML

```html
<script type="module" src="https://unpkg.com/typeset-p/dist/index.js"></script>

<typeset-p mode="custom" align="justify">
  Your paragraph text here.
</typeset-p>
```

### React

```jsx
import 'typeset-p';

export function Article({ children }) {
  return (
    <typeset-p mode="custom" align="justify" font="Georgia, serif" font-size="18px">
      {children}
    </typeset-p>
  );
}
```

TypeScript users: add this once to a `.d.ts` file in your project to get typed JSX attributes:

```ts
import type { TypesetPAttributes } from 'typeset-p';

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        'typeset-p': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
          & TypesetPAttributes;
      }
    }
  }
}
```

### Vue

```vue
<script setup>
import 'typeset-p';
</script>

<template>
  <typeset-p mode="custom" align="justify">
    Your paragraph text here.
  </typeset-p>
</template>
```

To suppress Vue's unknown element warning, tell it to ignore the tag:

```js
// vite.config.js / vue.config.js
export default {
  vue: {
    compilerOptions: {
      isCustomElement: tag => tag === 'typeset-p',
    },
  },
};
```

### Svelte

```svelte
<script>
  import 'typeset-p';
</script>

<typeset-p mode="custom" align="justify">
  Your paragraph text here.
</typeset-p>
```

### Angular

Register the `CUSTOM_ELEMENTS_SCHEMA` in your module or component, then import the package in `main.ts`:

```ts
// main.ts
import 'typeset-p';
```

```ts
// app.module.ts
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

## Responding to attribute changes

The component re-runs the full pipeline whenever `mode`, `align`, `font`, `font-size`, or any feature toggle attribute changes. You can drive it from JavaScript like any other element:

```js
const el = document.querySelector('typeset-p');
el.setAttribute('font-size', '20px');  // re-typesets immediately
el.setAttribute('align', 'justify');
```

It also watches its own width via `ResizeObserver` and re-breaks lines automatically when the container is resized.

## Manual registration

If you need to control when or under what name the element is registered:

```js
import { TypesetP } from 'typeset-p';

customElements.define('typeset-p', TypesetP);
// or a custom name:
customElements.define('my-paragraph', TypesetP);
```

## SSR / server-side rendering

The package is safe to import in Node.js. The element registers itself only when `customElements` is available, so importing it in Next.js, Nuxt, SvelteKit, or Astro will not throw on the server. The element renders as plain text during SSR and hydrates in the browser.

## TypeScript

The package ships full type declarations. `document.querySelector('typeset-p')` automatically returns `TypesetP` thanks to the `HTMLElementTagNameMap` augmentation included in the package.

Named types are exported for use in your own code:

```ts
import type { TypesetPMode, TypesetPAlign, TypesetPAttributes } from 'typeset-p';
```

## Browser support

Requires a browser with `ResizeObserver`, `FontFace` API, and `customElements` — all evergreen browsers since 2020.
