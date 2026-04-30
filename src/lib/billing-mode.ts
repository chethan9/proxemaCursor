/**
 * Central definition of whether subscription billing rules apply.
 * `billingDevMode` overrides `billingEnforcementEnabled` so QA can test
 * without flipping the production enforcement switch.
 */
export type BillingGateSettings = {
  billingEnforcementEnabled: boolean;
  billingDevMode: boolean;
};

export function isBillingEffectivelyEnforced(settings: BillingGateSettings): boolean {
  if (settings.billingDevMode) return false;
  return settings.billingEnforcementEnabled;
}
