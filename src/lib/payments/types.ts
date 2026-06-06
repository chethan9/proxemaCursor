export type GatewayName = "myfatoorah" | "razorpay" | "tap" | "polar";

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
  sourceToken?: string;
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

export interface TapInitPayload {
  type: "tap-inline";
  publishableKey: string;
  amountMinor: number;
  currency: string;
  prefill: { email: string; name?: string; phone?: string };
}

export interface TapChargeRedirectPayload {
  type: "tap-redirect";
  transactionUrl: string;
}

export interface ChargeInitiated {
  gateway: GatewayName;
  gatewayRef: string;
  payload: MyFatoorahInitPayload | RazorpayInitPayload | TapInitPayload | TapChargeRedirectPayload;
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

/**
 * Request to charge a previously saved payment source/token (recurring/off-session).
 * Used by the renewal cron when a customer has a payment_method_id on file
 * (trial → active conversion, manual auto-renewals).
 */
export interface RecurringChargeRequest {
  amountMinor: number;
  currency: string;
  description: string;
  customerEmail: string;
  clientReference: string;
  /** Token previously stored as client_payment_methods.gateway_token. */
  savedToken: string;
}

export interface RecurringChargeResult {
  /** True when the gateway accepted the charge synchronously. */
  ok: boolean;
  /** Gateway transaction id on success or attempt id on failure. */
  gatewayRef?: string;
  /** Stable error code, e.g. recurring_not_implemented, gateway_declined, gateway_error. */
  errorCode?: string;
  errorMessage?: string;
  rawPayload?: unknown;
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
  /**
   * Optional. Charge a previously saved source/token off-session.
   * Implement once the gateway adds first-class recurring support; until then,
   * the renewal cron treats absence of this method as "not yet integrated".
   */
  chargeSavedSource?(req: RecurringChargeRequest): Promise<RecurringChargeResult>;
}