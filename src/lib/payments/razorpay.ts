import crypto from "crypto";
import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, RazorpayInitPayload,
} from "./types";
import { getEffectiveSecret, getEffectivePublishable, getEffectiveWebhookSecret } from "./config";

class RazorpayGateway implements PaymentGateway {
  name = "razorpay" as const;
  private envKeyId = process.env.RAZORPAY_KEY_ID || "";
  private envKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
  private envWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  private baseUrl = "https://api.razorpay.com/v1";

  supportedCurrencies() { return ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"]; }

  private async keyId() { return getEffectivePublishable("razorpay", "RAZORPAY_KEY_ID"); }
  private async keySecret() { return getEffectiveSecret("razorpay", "RAZORPAY_KEY_SECRET"); }
  private async webhookSecret() { return getEffectiveWebhookSecret("razorpay", "RAZORPAY_WEBHOOK_SECRET"); }

  private async authHeader() {
    const id = await this.keyId();
    const sec = await this.keySecret();
    return `Basic ${Buffer.from(`${id}:${sec}`).toString("base64")}`;
  }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    const id = await this.keyId();
    if (!id) throw new Error("Razorpay not configured");
    const r = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: { Authorization: await this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: req.amountMinor, currency: req.currency, receipt: req.clientReference, notes: { description: req.description || "" } }),
    });
    const j = await r.json();
    if (!j.id) throw new Error(j?.error?.description || "Razorpay order failed");
    const payload: RazorpayInitPayload = {
      type: "inline",
      keyId: id,
      orderId: j.id,
      amount: j.amount,
      currency: j.currency,
      prefill: { email: req.customerEmail, name: req.customerName || "" },
    };
    return { gateway: "razorpay", gatewayRef: j.id, payload };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const r = await fetch(`${this.baseUrl}/orders/${gatewayRef}`, { headers: { Authorization: await this.authHeader() } });
    const j = await r.json();
    const map: Record<string, PaymentStatusResult["status"]> = { paid: "paid", attempted: "pending", created: "pending" };
    return { status: map[j.status] || "pending", amountMinor: j.amount, currency: j.currency, gatewayRef, rawPayload: j };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const r = await fetch(`${this.baseUrl}/payments/${req.gatewayRef}/refund`, {
      method: "POST",
      headers: { Authorization: await this.authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: req.amountMinor, notes: { reason: req.reason || "" } }),
    });
    const j = await r.json();
    if (j.error) return { refundRef: "", status: "failed", rawPayload: j };
    return { refundRef: j.id, status: "succeeded", rawPayload: j };
  }

  async parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    const secret = await this.webhookSecret();
    const sig = (input.headers["x-razorpay-signature"] || input.headers["X-Razorpay-Signature"]) as string | undefined;
    if (secret && sig) {
      const expected = crypto.createHmac("sha256", secret).update(input.rawBody).digest("hex");
      if (expected !== sig) throw new Error("Invalid Razorpay webhook signature");
    }
    const body = JSON.parse(input.rawBody.toString());
    const evt = String(body?.event || "");
    const map: Record<string, WebhookEvent["paymentStatus"]> = {
      "payment.captured": "paid",
      "payment.authorized": "paid",
      "payment.failed": "failed",
      "order.paid": "paid",
      "refund.created": "refunded",
    };
    const payment = body?.payload?.payment?.entity || {};
    return {
      id: String(body?.id || payment.id || Date.now()),
      type: evt,
      gatewayRef: String(payment.order_id || payment.id || ""),
      paymentStatus: map[evt] || "pending",
      amountMinor: payment.amount,
      currency: payment.currency,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }

  isConfigured() { return Boolean(this.envKeyId && this.envKeySecret); }
}

export const razorpayGateway: PaymentGateway = new RazorpayGateway();
