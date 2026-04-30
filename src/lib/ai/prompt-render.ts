import Handlebars from "handlebars";

export type PromptContext = {
  product_name?: string;
  user_input: Record<string, string | number | boolean | undefined>;
  index?: number;
  total?: number;
};

/** Compile feature prompt_template with product name and user_input.* */
export function renderPromptTemplate(template: string, ctx: PromptContext): string {
  const compiled = Handlebars.compile(template, { noEscape: true });
  return compiled({
    product_name: ctx.product_name ?? "",
    user_input: ctx.user_input ?? {},
    index: ctx.index ?? 1,
    total: ctx.total ?? 1,
  });
}
