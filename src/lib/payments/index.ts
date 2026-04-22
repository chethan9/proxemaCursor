import type { GatewayName, PaymentGateway } from "./types";
import { myFatoorahGateway } from "./myfatoorah";
import { razorpayGateway } from "./razorpay";
import { getGatewayForCountry } from "./routing";

export function getGateway(name: GatewayName): PaymentGateway {
  if (name === "myfatoorah") return myFatoorahGateway;
  if (name === "razorpay") return razorpayGateway;
  throw new Error(`Unknown gateway: ${name}`);
}

export function getGatewayForClient(country: string | null | undefined): PaymentGateway {
  return getGateway(getGatewayForCountry(country));
}

export function getAllGateways(): PaymentGateway[] {
  return [myFatoorahGateway, razorpayGateway];
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
} from "./types";