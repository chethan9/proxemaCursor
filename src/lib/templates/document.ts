export type BlockId = string;
export type Align = "left" | "center" | "right";

export interface BaseBlockProps {
  align?: Align;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

export interface TextBlock { id: BlockId; type: "text"; props: BaseBlockProps & { text: string; fontSize?: number; fontWeight?: "normal" | "medium" | "semibold" | "bold"; color?: string } }
export interface HeadingBlock { id: BlockId; type: "heading"; props: BaseBlockProps & { text: string; level: 1 | 2 | 3; color?: string } }
export interface ImageBlock { id: BlockId; type: "image"; props: BaseBlockProps & { src: string; width?: number; height?: number; alt?: string } }
export interface DividerBlock { id: BlockId; type: "divider"; props: BaseBlockProps & { color?: string; thickness?: number } }
export interface SpacerBlock { id: BlockId; type: "spacer"; props: { height: number } }
export interface ColumnsBlock { id: BlockId; type: "columns"; props: BaseBlockProps & { count: 2 | 3; gap?: number; columns: AnyBlock[][] } }
export interface AddressBlock { id: BlockId; type: "address_block"; props: BaseBlockProps & { source: "billing" | "shipping"; showName?: boolean; showCompany?: boolean; showPhone?: boolean; showEmail?: boolean; label?: string } }
export interface OrderItemsTableBlock { id: BlockId; type: "order_items_table"; props: BaseBlockProps & { showImage?: boolean; showSku?: boolean; showQty?: boolean; showPrice?: boolean; showTotal?: boolean; showBin?: boolean; headerColor?: string } }
export interface TotalsBlock { id: BlockId; type: "totals_block"; props: BaseBlockProps & { showSubtotal?: boolean; showShipping?: boolean; showTax?: boolean; showDiscount?: boolean; showTotal?: boolean; emphasize?: "total" | "none" } }
export interface BarcodeBlock { id: BlockId; type: "barcode"; props: BaseBlockProps & { source: "order_number" | "custom"; value?: string; format?: "code128"; width?: number; height?: number } }
export interface QrCodeBlock { id: BlockId; type: "qr_code"; props: BaseBlockProps & { value: string; size?: number } }
export interface SignatureLineBlock { id: BlockId; type: "signature_line"; props: BaseBlockProps & { label?: string; widthPercent?: number } }
export interface HtmlBlock { id: BlockId; type: "html"; props: { html: string } }
export interface PageBreakBlock { id: BlockId; type: "page_break"; props: Record<string, never> }

export type AnyBlock =
  | TextBlock | HeadingBlock | ImageBlock | DividerBlock | SpacerBlock | ColumnsBlock
  | AddressBlock | OrderItemsTableBlock | TotalsBlock | BarcodeBlock | QrCodeBlock
  | SignatureLineBlock | HtmlBlock | PageBreakBlock;

export type BlockType = AnyBlock["type"];

export interface PageSettings {
  size: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface DocumentStyles {
  primaryColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  fontFamily: string;
  baseFontSize: number;
}

export interface TemplateDocument {
  version: 1;
  page: PageSettings;
  blocks: AnyBlock[];
}

export const defaultPage = (): PageSettings => ({
  size: "A4",
  orientation: "portrait",
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
});

export const defaultStyles = (): DocumentStyles => ({
  primaryColor: "#0F172A",
  textColor: "#0F172A",
  mutedColor: "#64748B",
  borderColor: "#E2E8F0",
  fontFamily: "Inter, sans-serif",
  baseFontSize: 11,
});

export const emptyDocument = (): TemplateDocument => ({
  version: 1,
  page: defaultPage(),
  blocks: [],
});

export type TemplateType = "invoice" | "pickslip" | "email" | "report";

export interface TemplateRow {
  id: string;
  client_id: string | null;
  is_sample: boolean;
  name: string;
  description: string | null;
  type: TemplateType;
  is_default_for_type: boolean;
  current_version_id: string | null;
  thumbnail_url: string | null;
  print_mode: "pdf" | "html";
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  document: TemplateDocument;
  styles: DocumentStyles;
  change_note: string | null;
  created_at: string;
  created_by: string | null;
}