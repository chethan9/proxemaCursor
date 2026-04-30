import { pageDimensionsMm, resolvePageSettings, type PageSettings } from "@/lib/templates/document";

/**
 * CSS injected into the GrapesJS canvas frame — gives the workspace a light
 * background and renders an A4-style paper sheet that mirrors the print
 * output (size, margins, padding, page background).
 */
export function buildCanvasFrameCss(page?: PageSettings): string {
  const r = resolvePageSettings(page);
  const dims = pageDimensionsMm(page);
  const m = r.margin;
  const pad = r.padding;
  // Canvas .tmpl-page combines @page margin + body padding into a single
  // visual inset so the WYSIWYG matches what users get in the PDF.
  const insetTop = m.top + pad.top;
  const insetRight = m.right + pad.right;
  const insetBottom = m.bottom + pad.bottom;
  const insetLeft = m.left + pad.left;
  return `
  body { margin: 0; background: #f8fafc; min-height: 100%; }
  #wrapper { min-height: 100vh; padding: 32px 24px 64px; display: flex; justify-content: center; align-items: flex-start; }
  .tmpl-page {
    width: ${dims.width}mm;
    max-width: 100%;
    min-height: ${dims.height}mm;
    background: ${r.background};
    border: 1px solid #e2e8f0;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04);
    border-radius: 6px;
    padding: ${insetTop}mm ${insetRight}mm ${insetBottom}mm ${insetLeft}mm;
    box-sizing: border-box;
    transition: width 0.2s, min-height 0.2s, padding 0.2s, background 0.2s;
  }
  .tmpl-placeholder {
    border: 2px dashed #c7d2fe;
    border-radius: 12px;
    padding: 36px 24px;
    text-align: center;
    color: #6366f1;
    font-size: 13px;
    background: #eef2ff;
  }

  /* Elementor-style rows / columns — flex layout, droppable columns */
  .tml-row {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 16px;
    width: 100%;
    box-sizing: border-box;
    margin: 0 0 12px 0;
  }
  .tml-row--tight { gap: 12px; }
  .tml-row--loose { gap: 24px; }
  .tml-row--top { align-items: flex-start; }
  .tml-col {
    flex: 1 1 0;
    min-width: 0;
    box-sizing: border-box;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    background: #fafafa;
    padding: 12px;
    min-height: 48px;
  }
  .tml-col--6 {
    flex: 1 1 calc(50% - 8px);
    max-width: calc(50% - 8px);
  }
  .tml-col--4 {
    flex: 1 1 calc(33.333% - 11px);
    max-width: calc(33.333% - 11px);
  }
  .tml-col--8 {
    flex: 1 1 calc(66.666% - 6px);
    max-width: calc(66.666% - 6px);
  }
  .tml-col--12 {
    flex: 1 1 100%;
    max-width: 100%;
  }
  @media print {
    .tml-row { flex-wrap: nowrap; }
    .tml-col { border-style: solid; border-color: #e2e8f0; background: #fff; }
  }
`;
}

/** Default frame CSS (A4 portrait) for first paint before the editor mounts. */
export const CANVAS_FRAME_CSS = buildCanvasFrameCss();
