import Handlebars from "handlebars";
import { registerHelpers, resolveAsyncTokens } from "./helpers";

const hb = Handlebars.create();
registerHelpers(hb);

export interface RenderError {
  message: string;
  line?: number;
  column?: number;
}

export async function renderTemplateHtml(html: string, context: Record<string, unknown>): Promise<string> {
  let template;
  try {
    template = hb.compile(html, { noEscape: false, strict: false });
  } catch (e) {
    const err = e as Error & { lineNumber?: number; column?: number };
    const error: RenderError = { message: err.message, line: err.lineNumber, column: err.column };
    throw Object.assign(new Error(`Template parse error: ${error.message}`), { renderError: error, status: 400 });
  }

  let rendered: string;
  try {
    rendered = template(context);
  } catch (e) {
    const err = e as Error;
    throw Object.assign(new Error(`Template render error: ${err.message}`), { renderError: { message: err.message }, status: 400 });
  }

  return await resolveAsyncTokens(rendered);
}