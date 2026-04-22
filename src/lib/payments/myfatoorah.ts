import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, PaymentStatus,
} from "./types";

const THREE_DECIMAL = new Set(["KWD", "BHD", "OMR", "JOD"]);
const SUPPORTED = ["KWD", "SAR", "AED", "BHD", "QAR", "OMR", "JOD", "USD", "EUR", "GBP"];

function toMajor(amountMinor: number, currency: string): number {
  const div = THREE_DECIMAL.has(currency) ? 1000 : 100;
  return amountMinor / div;
}

function fromMajor(amountMajor: number, currency: string): number {
  const mult = THREE_DECIMAL.has(currency) ? 1000 : 100;
  return Math.round(amountMajor * mult);
}

function mapMFStatus(mfStatus: string | undefined): PaymentStatus {
  const s = (mfStatus || "").toLowerCase();
  if (s === "paid" || s === "succeeded") return "paid";
  if (s === "failed" || s === "canceled" || s === "expired") return "failed";
  if (s === "refunded") return "refunded";
  return "pending";
}

class MyFatoorahGateway implements PaymentGateway {
  name = "myfatoorah" as const;

  private get baseUrl() {
    return process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";
  }

  private get apiKey() {
    return process.env.MYFATOORAH_API_KEY || "";
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  supportedCurrencies() {
    return [...SUPPORTED];
  }

  private async call(path: string, body: unknown) {
    if (!this.apiKey) throw new Error("MyFatoorah not configured (MYFATOORAH_API_KEY missing)");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.IsSuccess) throw new Error(data.Message || data.ValidationErrors?.[0]?.Error || "MyFatoorah call failed");
    return data.Data;
  }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    const amount = toMajor(req.amountMinor, req.currency);
    const data = await this.call("/v2/ExecutePayment", {
      PaymentMethodId: 0,
      CustomerName: req.customerName || "Customer",
      CustomerEmail: req.customerEmail,
      CustomerMobile: req.customerPhone,
      InvoiceValue: amount,
      DisplayCurrencyIso: req.currency,
      CallBackUrl: req.returnUrl,
      ErrorUrl: `${req.returnUrl}${req.returnUrl.includes("?") ? "&" : "?"}failed=1`,
      Language: "en",
      CustomerReference: req.clientReference,
      InvoiceItems: [{ ItemName: req.description, Quantity: 1, UnitPrice: amount }],
    });
    return {
      gateway: "myfatoorah",
      gatewayRef: String(data.InvoiceId),
      payload: { type: "redirect", paymentUrl: data.PaymentURL },
    };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const data = await this.call("/v2/GetPaymentStatus", {
      Key: gatewayRef,
      KeyType: "InvoiceId",
    });
    const tx = data.InvoiceTransactions?.[0];
    const currency = tx?.Currency || "USD";
    const status = mapMFStatus(data.InvoiceStatus);
    return {
      status,
      gatewayRef,
      amountMinor: fromMajor(Number(data.InvoiceDisplayValue) || 0, currency),
      currency,
      paidAt: status === "paid" && tx?.TransactionDate ? new Date(tx.TransactionDate) : undefined,
      failureReason: status === "failed" ? tx?.Error : undefined,
      rawPayload: data,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const data = await this.call("/v2/MakeRefund", {
      KeyType: "InvoiceId",
      Key: req.gatewayRef,
      RefundChargeOnCustomer: false,
      ServiceChargeOnCustomer: false,
      Amount: toMajor(req.amountMinor, req.currency),
      Comment: req.reason || "Refund",
    });
    return {
      refundRef: String(data.RefundReference || data.Id || data.InvoiceId),
      status: "succeeded",
      rawPayload: data,
    };
  }

  async parseWebhook(req: WebhookInput): Promise<WebhookEvent> {
    const expected = process.env.MYFATOORAH_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers["myfatoorah-signature"] || req.headers["authorization"];
      const raw = Array.isArray(got) ? got[0] : got;
      if (raw !== expected && raw !== `Bearer ${expected}`) {
        throw new Error("Invalid MyFatoorah webhook signature");
      }
    }
    const body = JSON.parse(req.rawBody);
    const data = body.Data || body;
    const status = mapMFStatus(data.InvoiceStatus || data.TransactionStatus);
    const currency = data.DisplayCurrencyIso || "USD";
    return {
      id: body.EventID || body.Event || `mf-${Date.now()}`,
      type: status === "paid" ? "payment.paid" : status === "failed" ? "payment.failed" : "payment.updated",
      gatewayRef: String(data.InvoiceId || data.PaymentId),
      paymentStatus: status,
      amountMinor: data.InvoiceValue ? fromMajor(Number(data.InvoiceValue), currency) : undefined,
      currency,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }
}

export const myFatoorahGateway: PaymentGateway = new MyFatoorahGateway();