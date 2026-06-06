import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import type {
  PaymentGateway,
  ChargeRequest,
  ChargeInitiated,
  PaymentStatusResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
  MyFatoorahInitPayload,
  PaymentStatus,
} from "./types";
import { getEffectiveWebhookSecret } from "./config";
import { getPolarClient } from "./polar-client.server";

function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v == null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v[0]! : String(v);
  }
  return out;
}

function mapCheckoutStatus(status: string): PaymentStatus {
  if (status === "succeeded" || status === "confirmed") return "paid";
  if (status === "failed") return "failed";
  if (status === "expired") return "canceled";
  return "pending";
}

class PolarGateway implements PaymentGateway {
  name = "polar" as const;

  supportedCurrencies() {
    return ["USD", "EUR", "GBP", "INR", "SAR", "AED", "KWD", "BHD", "OMR", "QAR", "JOD"];
  }

  private async webhookSecret() {
    return getEffectiveWebhookSecret("polar", "POLAR_WEBHOOK_SECRET");
  }

  async initiateCharge(req: ChargeRequest): Promise<ChargeInitiated> {
    const polar = await getPolarClient();
    const productId = req.metadata?.polarProductId;
    if (!productId) throw new Error("Polar checkout requires metadata.polarProductId");

    const metadata: Record<string, string | number | boolean> = {
      client_reference: req.clientReference,
    };
    if (req.metadata?.purpose) metadata.purpose = req.metadata.purpose;
    if (req.metadata?.subscriptionId) metadata.subscription_id = req.metadata.subscriptionId;
    if (req.metadata?.purchaseId) metadata.purchase_id = req.metadata.purchaseId;

    const checkout = await polar.checkouts.create({
      products: [productId],
      customerEmail: req.customerEmail,
      customerName: req.customerName ?? null,
      externalCustomerId: req.metadata?.externalCustomerId ?? null,
      successUrl: req.returnUrl,
      returnUrl: req.returnUrl,
      metadata,
      allowDiscountCodes: false,
      requireBillingAddress: false,
      allowTrial: req.metadata?.polarAllowTrial !== "false",
      currency: req.currency?.toLowerCase() as "usd" | undefined,
      ...(req.metadata?.polarUseCustomAmount === "true" ? { amount: req.amountMinor } : {}),
    });

    const payload: MyFatoorahInitPayload = { type: "redirect", paymentUrl: checkout.url };
    return { gateway: "polar", gatewayRef: checkout.id, payload };
  }

  async getPaymentStatus(gatewayRef: string): Promise<PaymentStatusResult> {
    const polar = await getPolarClient();
    const checkout = await polar.checkouts.get({ id: gatewayRef });
    return {
      status: mapCheckoutStatus(checkout.status),
      gatewayRef,
      amountMinor: checkout.totalAmount ?? checkout.amount ?? 0,
      currency: (checkout.currency || "usd").toUpperCase(),
      paidAt: checkout.status === "succeeded" ? checkout.modifiedAt ?? undefined : undefined,
      rawPayload: checkout,
    };
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    return { refundRef: "", status: "failed", rawPayload: { error: "Polar refunds not implemented in adapter" } };
  }

  async parseWebhook(input: WebhookInput): Promise<WebhookEvent> {
    const secret = await this.webhookSecret();
    if (!secret) throw new Error("Polar webhook secret not configured");

    const headers = normalizeHeaders(input.headers);
    let event: ReturnType<typeof validateEvent>;
    try {
      event = validateEvent(input.rawBody, headers, secret);
    } catch (e) {
      if (e instanceof WebhookVerificationError) throw new Error("Invalid Polar webhook signature");
      throw e;
    }

    let paymentStatus: PaymentStatus | undefined;
    let gatewayRef = "";
    let amountMinor: number | undefined;
    let currency: string | undefined;

    if (event.type === "order.paid") {
      paymentStatus = "paid";
      gatewayRef = event.data.checkoutId ?? "";
      amountMinor = event.data.totalAmount;
      currency = event.data.currency?.toUpperCase();
    } else if (event.type === "order.refunded") {
      paymentStatus = "refunded";
      gatewayRef = event.data.checkoutId ?? "";
      amountMinor = event.data.totalAmount;
      currency = event.data.currency?.toUpperCase();
    } else if (event.type === "checkout.updated") {
      gatewayRef = event.data.id;
      paymentStatus = mapCheckoutStatus(event.data.status);
      amountMinor = event.data.totalAmount ?? event.data.amount;
      currency = event.data.currency?.toUpperCase();
    } else if (event.type === "checkout.expired") {
      gatewayRef = event.data.id;
      paymentStatus = "canceled";
    } else if (event.type === "subscription.canceled" || event.type === "subscription.revoked") {
      paymentStatus = "canceled";
      gatewayRef = event.data.id;
    } else if (event.type === "subscription.past_due") {
      paymentStatus = "failed";
      gatewayRef = event.data.id;
    } else if (event.type === "subscription.active") {
      paymentStatus = "paid";
      gatewayRef = event.data.id;
    }

    return {
      id: `${event.type}-${gatewayRef || Date.now()}`,
      type: event.type,
      gatewayRef,
      paymentStatus,
      amountMinor,
      currency,
      rawPayload: event,
      receivedAt: new Date(),
    };
  }

  isConfigured() {
    return Boolean(process.env.POLAR_ACCESS_TOKEN);
  }
}

export const polarGateway: PaymentGateway = new PolarGateway();
