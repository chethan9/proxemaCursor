import { stripTrailingIncompleteProximaWidget } from "@/lib/assistant/widget-schema";

/**
 * While the assistant streams Markdown, react-markdown renders partial tokens (e.g. `[label](/pa`)
 * as visible raw syntax. Trim trailing incomplete link/image constructs for a plain preview.
 */
export function stripTrailingIncompleteMarkdown(raw: string): string {
  let s = raw;
  for (let pass = 0; pass < 8; pass++) {
    const len = s.length;
    const lastOpen = s.lastIndexOf("[");
    const lastClose = s.lastIndexOf("]");
    if (lastOpen > lastClose) {
      s = s.slice(0, lastOpen);
      continue;
    }
    const bangImg = s.lastIndexOf("![");
    if (bangImg !== -1 && (lastClose < bangImg || lastClose === -1)) {
      s = s.slice(0, bangImg);
      continue;
    }
    if (/\]\([^)]*$/.test(s)) {
      const linkParen = s.search(/\]\([^)]*$/);
      if (linkParen !== -1) {
        const linkStart = s.lastIndexOf("![", linkParen);
        const linkStart2 = s.lastIndexOf("[", linkParen);
        const start =
          linkStart !== -1 && (linkStart2 === -1 || linkStart < linkStart2) ? linkStart : linkStart2 >= 0 ? linkStart2 : -1;
        if (start >= 0) {
          s = s.slice(0, start);
          continue;
        }
      }
    }
    if (s.length === len) break;
  }
  return stripTrailingIncompleteProximaWidget(s);
}
