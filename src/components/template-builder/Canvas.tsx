import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AnyBlock, TemplateDocument, DocumentStyles } from "@/lib/templates/document";
import { renderDocumentToHtml } from "@/lib/templates/render-html";
import { sampleInvoiceData } from "@/lib/templates/sample-data";
import { Trash2, Copy, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasProps {
  doc: TemplateDocument;
  styles: DocumentStyles;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  width: number;
}

export function Canvas({ doc, styles, selectedId, onSelect, onDelete, onDuplicate, width }: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root", data: { containerId: "root" } });

  return (
    <div className="flex-1 overflow-auto bg-muted/30 py-8 px-6" onClick={() => onSelect(null)}>
      <div
        className="mx-auto bg-white shadow-sm border border-border"
        style={{ width: `${width}px`, minHeight: "1000px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={setNodeRef} className={cn("min-h-[800px] relative", isOver && "ring-2 ring-primary ring-inset")}>
          {doc.blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center px-8">
              <div className="text-sm font-medium text-muted-foreground mb-1">Drag elements here</div>
              <div className="text-xs text-muted-foreground/70">From the left panel — drop blocks to start designing</div>
            </div>
          ) : (
            <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {doc.blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  selected={selectedId === block.id}
                  onSelect={() => onSelect(block.id)}
                  onDelete={() => onDelete(block.id)}
                  onDuplicate={() => onDuplicate(block.id)}
                  doc={doc}
                  styles={styles}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableBlock({ block, selected, onSelect, onDelete, onDuplicate, doc, styles }: { block: AnyBlock; selected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; doc: TemplateDocument; styles: DocumentStyles }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const singleBlockDoc: TemplateDocument = { ...doc, blocks: [block], page: { ...doc.page, margins: { top: 0, right: 0, bottom: 0, left: 0 } } };
  const html = renderDocumentToHtml(singleBlockDoc, sampleInvoiceData, styles);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={cn("relative group", selected && "ring-2 ring-primary ring-inset")}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {selected && (
        <>
          <button {...attributes} {...listeners} className="absolute -left-8 top-1/2 -translate-y-1/2 h-6 w-6 rounded bg-primary text-primary-foreground flex items-center justify-center cursor-grab active:cursor-grabbing z-10" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="absolute -top-7 right-0 flex items-center gap-1 z-10">
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="h-6 w-6 rounded bg-card border border-border hover:bg-muted flex items-center justify-center" title="Duplicate">
              <Copy className="h-3 w-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-6 w-6 rounded bg-card border border-border hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center" title="Delete">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="absolute -top-5 left-0 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] uppercase tracking-wider font-semibold rounded-sm z-10">{block.type.replace(/_/g, " ")}</div>
        </>
      )}
      {!selected && <div className="absolute inset-0 hover:ring-2 hover:ring-primary/30 hover:ring-inset transition-all pointer-events-none" />}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}