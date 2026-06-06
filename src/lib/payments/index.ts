import type { GatewayName, PaymentGateway } from "./types";
import { myFatoorahGateway } from "./myfatoorah";
import { razorpayGateway } from "./razorpay";
import { tapGateway } from "./tap";
import { polarGateway } from "./polar";
import { getGatewayForCountry } from "./routing";

export function getGateway(name: GatewayName): PaymentGateway {
  if (name === "myfatoorah") return myFatoorahGateway;
  if (name === "razorpay") return razorpayGateway;
  if (name === "tap") return tapGateway;
  if (name === "polar") return polarGateway;
  throw new Error(`Unknown gateway: ${name}`);
}

export function getGatewayForClient(country: string | null | undefined, overrides?: Record<string, GatewayName>): PaymentGateway {
  return getGateway(getGatewayForCountry(country, overrides));
}

export function getAllGateways(): PaymentGateway[] {
  return [myFatoorahGateway, razorpayGateway, tapGateway, polarGateway];
}

export {
  getGatewayForCountry,
  getDefaultCurrencyForCountry,
  isMiddleEastCountry,
  getSupportedCountries,
  MYFATOORAH_COUNTRIES,
} from "./routing";

export type {
  PaymentGateway,
  GatewayName,
  ChargeRequest,
  ChargeInitiated,
  PaymentStatusResult,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookInput,
  PaymentStatus,
  MyFatoorahInitPayload,
  RazorpayInitPayload,
  TapInitPayload,
  TapChargeRedirectPayload,
  RecurringChargeRequest,
  RecurringChargeResult,
} from "./types";