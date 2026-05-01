/** Map Woo slug to i18n key segment under `orders.statuses.*` */
export function wooStatusSlugToI18nKey(slug: string): string {
  return slug === "on-hold" ? "onHold" : slug;
}

export function orderStatusDisplayLabel(
  t: (key: string, opts?: { defaultValue?: string }) => string,
  slug: string,
): string {
  return t(`orders.statuses.${wooStatusSlugToI18nKey(slug)}`, { defaultValue: slug.replace(/-/g, " ") });
}
