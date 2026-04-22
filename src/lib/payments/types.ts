export type GatewayName = "myfatoorah" | "razorpay";

export interface ChargeRequest {
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  clientReference: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface MyFatoorahInitPayload {
  type: "redirect";
  paymentUrl: string;
}

export interface RazorpayInitPayload {
  type: "inline";
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  prefill: { email: string; name?: string; contact?: string };
}

export interface ChargeInitiated {
  gateway: GatewayName;
  gatewayRef: string;
  payload: MyFatoorahInitPayload | RazorpayInitPayload;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "canceled";

export interface PaymentStatusResult {
  status: PaymentStatus;
  gatewayRef: string;
  amountMinor: number;
  currency: string;
  paidAt?: Date;
  failureReason?: string;
  rawPayload: unknown;
}

export interface RefundRequest {
  gatewayRef: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface RefundResult {
  refundRef: string;
  status: "succeeded" | "pending" | "failed";
  rawPayload: unknown;
}

export interface WebhookEvent {
  id: string;
  type: string;
  gatewayRef: string;
  paymentStatus?: PaymentStatus;
  amountMinor?: number;
  currency?: string;
  rawPayload: unknown;
  receivedAt: Date;
}

export interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody: string;
}

export interface PaymentGateway {
  name: GatewayName;
  supportedCurrencies(): string[];
  initiateCharge(req: ChargeRequest): Promise<ChargeInitiated>;
  getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
  parseWebhook(req: WebhookInput): Promise<WebhookEvent>;
  isConfigured(): boolean;
}