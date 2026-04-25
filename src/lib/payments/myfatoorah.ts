import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, MyFatoorahInitPayload,
} from "./types";
import { getEffectiveSecret, getEffectiveWebhookSecret } from "./config";

class MyFatoorahGateway implements PaymentGateway {
  name = "myfatoorah" as const;
  private envApiKey = process.env.MYFATOORAH_API_KEY || "";
  private envWebhookSecret = process.env.MYFATOORAH_WEBHOOK_SECRET || "";
  private baseUrl = process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";

  supportedCurrencies() { return ["KWD", "SAR", "AED", "BHD", "OMR", "QAR", "JOD", "USD"]; }

  private async apiKey() { return getEffectiveSecret("myfatoorah", "MYFATOORAH_API_KEY"); }
  private async webhookSecret() { return getEffectiveWebhookSecret("myfatoorah", "MYFATOORAH_WEBHOOK_SECRET"); }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    const key = await this.apiKey();
    if (!key) throw new Error("MyFatoorah not configured");
    const r = await fetch(`${this.baseUrl}/v2/SendPayment`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        InvoiceValue: req.amountMinor / 100,
        CurrencyIso: req.currency,
        CustomerName: req.customerName || "Customer",
        CustomerEmail: req.customerEmail,
        CallBackUrl: req.returnUrl,
        ErrorUrl: req.returnUrl,
        Language: "EN",
        DisplayCurrencyIso: req.currency,
        CustomerReference: req.clientReference,
      }),
    });
    const j = await r.json();
    if (!j.IsSuccess) throw new Error(j.Message || "MyFatoorah charge init failed");
    const payload: MyFatoorahInitPayload = { type: "redirect", redirectUrl: j.Data.InvoiceURL };
    return { gateway: "myfatoorah", gatewayRef: String(j.Data.InvoiceId), payload };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const key = await this.apiKey();
    const r = await fetch(`${this.baseUrl}/v2/getPaymentStatus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ KeyType: "InvoiceId", Key: gatewayRef }),
    });
    const j = await r.json();
    const status = String(j?.Data?.InvoiceStatus || "").toLowerCase();
    const map: Record<string, PaymentStatusResult["status"]> = {
      paid: "paid", pending: "pending", failed: "failed", canceled: "canceled", expired: "failed",
    };
    return { status: map[status] || "pending", amountMinor: Math.round((j?.Data?.InvoiceValue || 0) * 100), currency: j?.Data?.InvoiceDisplayValue, gatewayRef };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const key = await this.apiKey();
    const r = await fetch(`${this.baseUrl}/v2/MakeRefund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ KeyType: "InvoiceId", Key: req.gatewayRef, RefundAmount: req.amountMinor / 100, Comment: req.reason || "Refund" }),
    });
    const j = await r.json();
    if (!j.IsSuccess) return { ok: false, error: j.Message };
    return { ok: true, refundRef: String(j?.Data?.RefundReference || "") };
  }

  async parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    const secret = await this.webhookSecret();
    const sig = (input.headers["mfsignature"] || input.headers["MFSignature"]) as string | undefined;
    if (secret && sig) {
      const crypto = await import("crypto");
      const expected = crypto.createHmac("sha256", secret).update(input.rawBody).digest("base64");
      if (expected !== sig) throw new Error("Invalid MyFatoorah webhook signature");
    }
    const body = JSON.parse(input.rawBody.toString());
    const status = String(body?.Data?.TransactionStatus || body?.Data?.InvoiceStatus || "").toLowerCase();
    const map: Record<string, WebhookEvent["paymentStatus"]> = { succss: "paid", paid: "paid", success: "paid", failed: "failed", canceled: "canceled" };
    return {
      id: String(body?.EventId || body?.Data?.PaymentId || Date.now()),
      type: "payment.status",
      gatewayRef: String(body?.Data?.InvoiceId || ""),
      paymentStatus: map[status] || "pending",
      amountMinor: Math.round((body?.Data?.InvoiceValue || 0) * 100),
      currency: body?.Data?.DisplayCurrencyIso,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }

  isConfigured() { return Boolean(this.envApiKey); }
}

export const myFatoorahGateway: PaymentGateway = new MyFatoorahGateway();
