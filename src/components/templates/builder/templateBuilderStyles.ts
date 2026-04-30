/** Injected into Grapes canvas frame — light workspace, white “paper” sheet. */
export const CANVAS_FRAME_CSS = `
  body { margin: 0; background: #f8fafc; min-height: 100%; }
  #wrapper { min-height: 100vh; padding: 32px 24px 64px; display: flex; justify-content: center; align-items: flex-start; }
  .tmpl-page {
    width: 210mm;
    max-width: 100%;
    min-height: 297mm;
    background: #fff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04);
    border-radius: 6px;
    padding: 14mm;
    box-sizing: border-box;
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
`;
