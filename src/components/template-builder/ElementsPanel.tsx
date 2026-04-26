import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ELEMENT_META, BLOCK_META } from "@/lib/templates/block-defaults";
import type { BlockType } from "@/lib/templates/document";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Type, Heading, Image as ImageIcon, Minus, ArrowDownUp, Columns3, Code, MapPin, Table2, Calculator, Barcode, QrCode, PenLine, FileX } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  text: Type, heading: Heading, image: ImageIcon, divider: Minus, spacer: ArrowDownUp, columns: Columns3, html: Code,
  address_block: MapPin, order_items_table: Table2, totals_block: Calculator, barcode: Barcode, qr_code: QrCode, signature_line: PenLine, page_break: FileX,
};

export function ElementsPanel() {
  const [tab, setTab] = useState<"elements" | "blocks">("elements");
  return (
    <div className="h-full flex flex-col">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "elements" | "blocks")} className="flex-1 flex flex-col">
        <div className="px-3 pt-3 border-b border-border">
          <TabsList className="bg-muted/60 w-full grid grid-cols-2 h-8">
            <TabsTrigger value="elements" className="text-xs">Elements</TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs">Blocks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="elements" className="flex-1 overflow-y-auto p-3 mt-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Basic</div>
          <div className="grid grid-cols-2 gap-2">
            {ELEMENT_META.map((m) => <DraggableItem key={m.type} type={m.type} label={m.label} />)}
          </div>
        </TabsContent>
        <TabsContent value="blocks" className="flex-1 overflow-y-auto p-3 mt-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">WooCommerce</div>
          <div className="grid grid-cols-2 gap-2">
            {BLOCK_META.map((m) => <DraggableItem key={m.type} type={m.type} label={m.label} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DraggableItem({ type, label }: { type: BlockType; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `lib-${type}`, data: { source: "library", blockType: type } });
  const Icon = ICON_MAP[type];
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-primary/5 cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-40",
      )}
    >
      <Icon className="h-4 w-4 text-foreground/70" />
      <span className="text-[11px] font-medium text-foreground/90 leading-none">{label}</span>
    </button>
  );
}