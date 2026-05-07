import Handlebars from "handlebars";

export type PromptContext = {
  product_name?: string;
  user_input: Record<string, string | number | boolean | undefined>;
  index?: number;
  total?: number;
  /** Optional extra instructions (also available as {{additional_prompt}} in templates). */
  additional_prompt?: string;
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

/**
 * Builds the final image prompt. User-supplied additional instructions come **first**
 * so models treat them as highest priority; then feature template, then resolution/aspect constraints.
 */
export function composeImageGenerationPrompt(parts: {
  renderedTemplate: string;
  imageInstruction?: string;
  additionalPrompt?: string;
}): string {
  const extra = parts.additionalPrompt?.trim();
  const img = parts.imageInstruction?.trim();
  const template = parts.renderedTemplate?.trim();

  const segments: string[] = [];
  if (extra) {
    segments.push(`Priority instructions (follow these first):\n${extra}`);
  }
  if (template) {
    segments.push(`Feature guidance:\n${template}`);
  }
  if (img) {
    segments.push(`Output constraints:\n${img}`);
  }
  return segments.join("\n\n");
}

