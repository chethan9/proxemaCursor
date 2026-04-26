export interface OrderItemsTableAttrs {
  showImage: boolean;
  showSku: boolean;
  showQty: boolean;
  showPrice: boolean;
  showTotal: boolean;
  headerColor: string;
}

export interface TotalsBlockAttrs {
  showSubtotal: boolean;
  showShipping: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showTotal: boolean;
}

export interface AddressAttrs {
  source: "billing" | "shipping";
  label: string;
}

export interface BarcodeAttrs {
  source: "order_number" | "custom";
  value: string;
  format: "code128" | "ean13";
  width: number;
  height: number;
}

export interface QrCodeAttrs {
  value: string;
  size: number;
}