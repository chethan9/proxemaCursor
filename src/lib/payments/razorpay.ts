import crypto from "crypto";
import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, PaymentStatus,
} from "./types";

const SUPPORTED = [
  "INR", "USD", "EUR", "GBP", "SGD", "AED", "MYR", "AUD", "CAD",
  "SAR", "QAR", "OMR", "BHD", "KWD", "JPY", "CHF", "SEK", "NOK", "DKK",
  "PLN", "ZAR", "NZD", "THB", "IDR", "PHP", "MXN", "BRL",
];

function mapRZPStatus(rzpStatus: string | undefined): PaymentStatus {
  if (!rzpStatus) return "pending";
  if (rzpStatus === "captured" || rzpStatus === "authorized") return "paid";
  if (rzpStatus === "failed") return "failed";
  if (rzpStatus === "refunded") return "refunded";
  return "pending";
}

class RazorpayGateway implements PaymentGateway {
  name = "razorpay" as const;
  private baseUrl = "https://api.razorpay.com";

  private get keyId() {
    return process.env.RAZORPAY_KEY_ID || "";
  }

  private get keySecret() {
    return process.env.RAZORPAY_KEY_SECRET || "";
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

  supportedCurrencies() {
    return [...SUPPORTED];
  }

  private authHeader() {
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  private async call(method: string, path: string, body?: unknown) {
    if (!this.isConfigured()) throw new Error("Razorpay not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.description || data.error?.code || `Razorpay ${method} ${path} failed: ${res.status}`);
    }
    return data;
  }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    const data = await this.call("POST", "/v1/orders", {
      amount: req.amountMinor,
      currency: req.currency,
      receipt: req.clientReference.slice(0, 40),
      notes: {
        description: req.description,
        ...(req.metadata || {}),
      },
    });
    return {
      gateway: "razorpay",
      gatewayRef: data.id,
      payload: {
        type: "inline",
        orderId: data.id,
        keyId: this.keyId,
        amount: req.amountMinor,
        currency: req.currency,
        prefill: {
          email: req.customerEmail,
          name: req.customerName,
          contact: req.customerPhone,
        },
      },
    };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const data = await this.call("GET", `/v1/orders/${gatewayRef}/payments`);
    const payment = data.items?.[0];
    if (!payment) {
      return { status: "pending", gatewayRef, amountMinor: 0, currency: "INR", rawPayload: data };
    }
    return {
      status: mapRZPStatus(payment.status),
      gatewayRef,
      amountMinor: payment.amount,
      currency: payment.currency,
      paidAt: payment.status === "captured" ? new Date(payment.created_at * 1000) : undefined,
      failureReason: payment.error_description,
      rawPayload: data,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const payments = await this.call("GET", `/v1/orders/${req.gatewayRef}/payments`);
    const paymentId = payments.items?.[0]?.id;
    if (!paymentId) throw new Error("No payment found for order");
    const data = await this.call("POST", `/v1/payments/${paymentId}/refund`, {
      amount: req.amountMinor,
      notes: { reason: req.reason || "Refund" },
    });
    return {
      refundRef: data.id,
      status: data.status === "processed" ? "succeeded" : "pending",
      rawPayload: data,
    };
  }

  async parseWebhook(req: WebhookInput): Promise<WebhookEvent> {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
    const sigStr = Array.isArray(signature) ? signature[0] : signature;
    if (!sigStr) throw new Error("Missing x-razorpay-signature header");
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (expected !== sigStr) throw new Error("Invalid Razorpay webhook signature");

    const body = JSON.parse(req.rawBody);
    const event = body.event as string;
    const payment = body.payload?.payment?.entity;
    const status = mapRZPStatus(payment?.status);
    return {
      id: body.event_id || `rzp-${body.created_at}-${payment?.id || "x"}`,
      type: event,
      gatewayRef: payment?.order_id || "",
      paymentStatus: status,
      amountMinor: payment?.amount,
      currency: payment?.currency,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }
}

export const razorpayGateway: PaymentGateway = new RazorpayGateway();