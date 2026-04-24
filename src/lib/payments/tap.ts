import crypto from "crypto";
import type {
  PaymentGateway, ChargeRequest, ChargeInitiated, PaymentStatusResult,
  RefundRequest, RefundResult, WebhookEvent, WebhookInput, PaymentStatus,
} from "./types";

const SUPPORTED = ["KWD", "SAR", "AED", "BHD", "OMR", "QAR", "JOD", "EGP", "USD"];
const THREE_DECIMAL = new Set(["KWD", "BHD", "OMR", "JOD"]);

function toMajor(amountMinor: number, currency: string): number {
  const div = THREE_DECIMAL.has(currency) ? 1000 : 100;
  return amountMinor / div;
}

function fromMajor(amountMajor: number, currency: string): number {
  const mult = THREE_DECIMAL.has(currency) ? 1000 : 100;
  return Math.round(amountMajor * mult);
}

function mapTapStatus(status: string | undefined): PaymentStatus {
  const s = (status || "").toUpperCase();
  if (s === "CAPTURED" || s === "AUTHORIZED") return "paid";
  if (s === "INITIATED" || s === "IN_PROGRESS") return "pending";
  if (s === "FAILED" || s === "DECLINED" || s === "ABANDONED" || s === "TIMEDOUT" || s === "UNKNOWN") return "failed";
  if (s === "CANCELLED" || s === "VOIDED") return "canceled";
  if (s === "REFUNDED") return "refunded";
  return "pending";
}

class TapGateway implements PaymentGateway {
  name = "tap" as const;
  private baseUrl = "https://api.tap.company";

  private get secretKey() { return process.env.TAP_SECRET_KEY || ""; }
  private get publicKey() { return process.env.TAP_PUBLIC_KEY || ""; }
  private get webhookSecret() { return process.env.TAP_WEBHOOK_SECRET || ""; }

  isConfigured() {
    return Boolean(this.secretKey && this.publicKey);
  }

  supportedCurrencies() { return [...SUPPORTED]; }

  getPublicKey() { return this.publicKey; }

  private async call(method: string, path: string, body?: unknown) {
    if (!this.isConfigured()) throw new Error("Tap not configured (TAP_SECRET_KEY / TAP_PUBLIC_KEY missing)");
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.errors?.[0]?.description || data?.message || `Tap ${method} ${path} failed: ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    // If no token yet → return inline payload so the client can tokenize via Card SDK
    if (!req.sourceToken) {
      return {
        gateway: "tap",
        gatewayRef: "",
        payload: {
          type: "tap-inline",
          publishableKey: this.publicKey,
          amountMinor: req.amountMinor,
          currency: req.currency,
          prefill: { email: req.customerEmail, name: req.customerName, phone: req.customerPhone },
        },
      };
    }

    // Token provided → create charge
    const [firstName, ...rest] = (req.customerName || "Customer").split(" ");
    const lastName = rest.join(" ") || "-";
    const phoneDigits = (req.customerPhone || "").replace(/\D/g, "");
    const countryCode = phoneDigits.length > 8 ? phoneDigits.slice(0, phoneDigits.length - 8) : "965";
    const phoneNumber = phoneDigits.length > 8 ? phoneDigits.slice(-8) : phoneDigits || "50000000";

    const charge = await this.call("POST", "/v2/charges/", {
      amount: toMajor(req.amountMinor, req.currency),
      currency: req.currency,
      threeDSecure: true,
      save_card: false,
      description: req.description,
      statement_descriptor: "WOOSYNC",
      reference: { transaction: req.clientReference.slice(0, 64), order: req.clientReference.slice(0, 64) },
      receipt: { email: true, sms: false },
      customer: {
        first_name: firstName || "Customer",
        last_name: lastName,
        email: req.customerEmail,
        phone: { country_code: countryCode, number: phoneNumber },
      },
      source: { id: req.sourceToken },
      post: { url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/billing/webhooks/tap` },
      redirect: { url: req.returnUrl },
      metadata: req.metadata || {},
    });

    const redirectUrl = charge?.transaction?.url;
    if (redirectUrl) {
      return {
        gateway: "tap",
        gatewayRef: String(charge.id),
        payload: { type: "tap-redirect", transactionUrl: redirectUrl },
      };
    }
    // 3DS not required — charge settled synchronously; still return as redirect to status page
    return {
      gateway: "tap",
      gatewayRef: String(charge.id),
      payload: { type: "tap-redirect", transactionUrl: req.returnUrl + `&tap_id=${encodeURIComponent(charge.id)}` },
    };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const data = await this.call("GET", `/v2/charges/${gatewayRef}`);
    const status = mapTapStatus(data.status);
    const currency = data.currency || "USD";
    return {
      status,
      gatewayRef,
      amountMinor: data.amount ? fromMajor(Number(data.amount), currency) : 0,
      currency,
      paidAt: status === "paid" && data.transaction?.created ? new Date(Number(data.transaction.created)) : undefined,
      failureReason: status === "failed" ? (data.response?.message || data.response?.code) : undefined,
      rawPayload: data,
    };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const data = await this.call("POST", "/v2/refunds/", {
      charge_id: req.gatewayRef,
      amount: toMajor(req.amountMinor, req.currency),
      currency: req.currency,
      reason: "requested_by_customer",
      metadata: { note: req.reason || "Refund" },
    });
    const status = (data.status || "").toUpperCase();
    return {
      refundRef: String(data.id),
      status: status === "REFUNDED" ? "succeeded" : status === "FAILED" ? "failed" : "pending",
      rawPayload: data,
    };
  }

  async parseWebhook(req: WebhookInput): Promise<WebhookEvent> {
    const body = JSON.parse(req.rawBody);
    if (this.webhookSecret) {
      const hashstring = body.hashstring as string | undefined;
      const id = body.id || "";
      const amount = body.amount ?? "";
      const currency = body.currency ?? "";
      const gateway_reference = body.reference?.gateway || body.gateway_reference || "";
      const payment_reference = body.reference?.payment || body.payment_reference || "";
      const status = body.status ?? "";
      const created = body.transaction?.created || body.created || "";
      const toHash = `x_id${id}x_amount${amount}x_currency${currency}x_gateway_reference${gateway_reference}x_payment_reference${payment_reference}x_status${status}x_created${created}`;
      const computed = crypto.createHmac("sha256", this.webhookSecret).update(toHash).digest("hex");
      if (!hashstring || computed !== hashstring) {
        throw new Error("Invalid Tap webhook signature");
      }
    }
    const status = mapTapStatus(body.status);
    const currency = body.currency || "USD";
    return {
      id: String(body.id),
      type: status === "paid" ? "payment.paid" : status === "failed" ? "payment.failed" : `payment.${status}`,
      gatewayRef: String(body.id),
      paymentStatus: status,
      amountMinor: body.amount ? fromMajor(Number(body.amount), currency) : undefined,
      currency,
      rawPayload: body,
      receivedAt: new Date(),
    };
  }
}

export const tapGateway: TapGateway = new TapGateway();