import crypto from "crypto";
import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, TapInitPayload, TapChargeRedirectPayload,
} from "./types";
import { getEffectiveSecret, getEffectivePublishable, getEffectiveWebhookSecret } from "./config";

export class TapGateway implements PaymentGateway {
  name = "tap" as const;
  envSecret = process.env.TAP_SECRET_KEY || "";
  envPublic = process.env.TAP_PUBLIC_KEY || "";
  envWebhookSecret = process.env.TAP_WEBHOOK_SECRET || "";
  private baseUrl = "https://api.tap.company/v2";

  supportedCurrencies() { return ["KWD", "SAR", "AED", "BHD", "OMR", "QAR", "JOD", "EGP", "USD"]; }

  async getSecret() { return getEffectiveSecret("tap", "TAP_SECRET_KEY"); }
  async getPublishable() { return getEffectivePublishable("tap", "TAP_PUBLIC_KEY"); }
  async getWebhookSecret() { return getEffectiveWebhookSecret("tap", "TAP_WEBHOOK_SECRET"); }

  async initiateCharge(req: ChargeRequest & { sourceToken?: string }): Promise<ChargeInitiated> {
    const sk = await this.getSecret();
    if (!sk) throw new Error("Tap not configured");
    if (!req.sourceToken) {
      const pk = await this.getPublishable();
      const payload: TapInitPayload = {
        type: "inline",
        publishableKey: pk,
        prefill: { email: req.customerEmail || "", name: req.customerName || "" },
      };
      return { gateway: "tap", gatewayRef: "", payload };
    }
    const [firstName, ...rest] = (req.customerName || "Customer").split(" ");
    const body = {
      amount: req.amountMinor / 100,
      currency: req.currency,
      threeDSecure: true,
      save_card: false,
      description: req.description || "Subscription",
      reference: { transaction: req.clientReference },
      receipt: { email: true, sms: false },
      customer: {
        first_name: firstName || "Customer",
        last_name: rest.join(" ") || undefined,
        email: req.customerEmail,
      },
      source: { id: req.sourceToken },
      redirect: { url: req.returnUrl },
    };
    const r = await fetch(`${this.baseUrl}/charges/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!j.id) throw new Error(j?.errors?.[0]?.description || j?.message || "Tap charge failed");
    const payload: TapChargeRedirectPayload = {
      type: "tap-charge",
      transactionUrl: j?.transaction?.url || undefined,
      chargeId: j.id,
    };
    return { gateway: "tap", gatewayRef: j.id, payload };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const sk = await this.getSecret();
    const r = await fetch(`${this.baseUrl}/charges/${gatewayRef}`, { headers: { Authorization: `Bearer ${sk}` } });
    const j = await r.json();
    return { status: this.mapStatus(j.status), amountMinor: Math.round((j.amount || 0) * 100), currency: j.currency, gatewayRef };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const sk = await this.getSecret();
    const r = await fetch(`${this.baseUrl}/refunds/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ charge_id: req.gatewayRef, amount: req.amountMinor / 100, currency: "USD", reason: "requested_by_customer", reference: { merchant: req.reason || "" } }),
    });
    const j = await r.json();
    if (!j.id) return { ok: false, error: j?.errors?.[0]?.description };
    return { ok: true, refundRef: j.id };
  }

  async parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    const secret = await this.getWebhookSecret();
    const body = JSON.parse(input.rawBody.toString());
    if (secret && body?.hashstring) {
      const fields = `x_id${body.id || ""}x_amount${body.amount || ""}x_currency${body.currency || ""}x_gateway_reference${body?.reference?.gateway || ""}x_payment_reference${body?.reference?.payment || ""}x_status${body.status || ""}x_created${body.transaction?.created || body.created || ""}`;
      const expected = crypto.createHmac("sha256", secret).update(fields).digest("hex");
      if (expected !== body.hashstring) throw new Error("Invalid Tap webhook signature");
    }
    return {
      id: String(body?.id || Date.now()),
      type: "charge.update",
      gatewayRef: String(body?.id || ""),
      paymentStatus: this.mapStatus(body?.status),
      amountMinor: Math.round((body?.amount || 0) * 100),
      currency: body?.currency,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }

  private mapStatus(s: string): WebhookEvent["paymentStatus"] {
    const v = String(s || "").toUpperCase();
    if (v === "CAPTURED" || v === "AUTHORIZED") return "paid";
    if (v === "INITIATED" || v === "IN_PROGRESS") return "pending";
    if (v === "FAILED" || v === "DECLINED" || v === "ABANDONED") return "failed";
    if (v === "CANCELLED" || v === "VOIDED") return "canceled";
    return "pending";
  }

  isConfigured() { return Boolean(this.envPublic && this.envSecret); }
}

export const tapGateway: TapGateway = new TapGateway();
