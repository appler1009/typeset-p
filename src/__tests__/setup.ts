import { vi } from 'vitest';

// jsdom doesn't implement canvas — stub it so canvas-based measurement calls
// don't throw; tests that care about pixel values supply widths directly.
class MockCanvasRenderingContext2D {
  font = '';
  measureText(text: string) {
    const w = text === ' ' ? 4 : text.length * 8;
    return { width: w };
  }
}

class MockHTMLCanvasElement {
  getContext() {
    return new MockCanvasRenderingContext2D();
  }
}

const origCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') return new MockHTMLCanvasElement() as unknown as HTMLElement;
  return origCreateElement(tag);
});
