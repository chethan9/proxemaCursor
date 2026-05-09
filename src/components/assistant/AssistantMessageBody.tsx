"use client";

import { AssistantMessageMarkdown } from "@/components/assistant/AssistantMessageMarkdown";
import { AssistantWidgets } from "@/components/assistant/AssistantWidgets";
import { parseAssistantMessageParts } from "@/lib/assistant/widget-schema";

type Props = {
  content: string;
  /** Store UUID from route — used for default product/order links in widgets */
  storeId?: string | null;
};

export function AssistantMessageBody({ content, storeId = null }: Props) {
  const parts = parseAssistantMessageParts(content);
  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        part.type === "markdown" ? (
          <AssistantMessageMarkdown key={i} content={part.text} storeId={storeId} />
        ) : (
          <AssistantWidgets key={i} widget={part.widget} storeId={storeId} />
        ),
      )}
    </div>
  );
}
