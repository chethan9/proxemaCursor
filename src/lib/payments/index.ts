import type { GatewayName, PaymentGateway } from "./types";
import { myFatoorahGateway } from "./myfatoorah";
import { razorpayGateway } from "./razorpay";
import { tapGateway } from "./tap";
import { getGatewayForCountry } from "./routing";

export function getGateway(name: GatewayName): PaymentGateway {
  if (name === "myfatoorah") return myFatoorahGateway;
  if (name === "razorpay") return razorpayGateway;
  if (name === "tap") return tapGateway;
  throw new Error(`Unknown gateway: ${name}`);
}

export function getGatewayForClient(country: string | null | undefined, overrides?: Record<string, GatewayName>): PaymentGateway {
  return getGateway(getGatewayForCountry(country, overrides));
}

export function getAllGateways(): PaymentGateway[] {
  return [myFatoorahGateway, razorpayGateway, tapGateway];
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
} from "./types";