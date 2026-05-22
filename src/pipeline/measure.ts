/**
 * Canvas/DOM calibration and font readiness.
 *
 * measureCanvasDomRatio: returns the ratio (canvasWidth / domWidth) for a
 * calibration string, letting the KP algorithm scale its maxWidth so canvas
 * measurements agree with what the browser actually renders.
 *
 * ensureFontReady: waits for document.fonts to load the requested face before
 * any measurement happens.
 */

const CALIB_SAMPLE =
  'The quick brown fox jumped over the lazy dog. A stitch in time saves nine.“What do you mean?” she asked—quite startled.';

export async function measureCanvasDomRatio(fontFamily: string, fontSize: number): Promise<number> {
  const fontString = `${fontSize}px ${fontFamily}`;

  const span = document.createElement('span');
  span.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'visibility:hidden',
    'white-space:nowrap',
    `font-family:${fontFamily}`,
    `font-size:${fontSize}px`,
    '-webkit-font-smoothing:antialiased',
    'text-rendering:optimizeLegibility',
    'font-variant-ligatures:common-ligatures',
    'font-feature-settings:"liga" 1, "kern" 1, "case" 1',
    'font-variant-numeric:oldstyle-nums proportional-nums',
    'font-optical-sizing:auto',
  ].join(';');
  span.textContent = CALIB_SAMPLE;
  document.body.appendChild(span);
  void span.offsetWidth;
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const domW = span.getBoundingClientRect().width;
  document.body.removeChild(span);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = fontString;
  const canvasW = ctx.measureText(CALIB_SAMPLE).width;

  if (canvasW <= 0 || domW <= 0) return 1;
  return canvasW / domW;
}

export async function ensureFontReady(fontFamily: string, fontSize: number): Promise<void> {
  const primary = fontFamily.split(',')[0]!.replace(/^["']|["']$/g, '').trim();
  await Promise.all([
    document.fonts.load(`${fontSize}px ${primary}`).catch(() => undefined),
    document.fonts.load(`700 ${fontSize}px ${primary}`).catch(() => undefined),
  ]);
  await document.fonts.ready;
}
