export const INTERNAL_PROVIDER_KEYS = Object.freeze(['shopify', 'meta_ads', 'google_ads']);

export const PUBLIC_PROVIDER_SLUGS = Object.freeze({
  shopify: 'shopify',
  meta_ads: 'meta-ads',
  google_ads: 'google-ads',
});

const PROVIDER_ALIASES = Object.freeze({
  shopify: 'shopify',
  'meta-ads': 'meta_ads',
  meta_ads: 'meta_ads',
  'google-ads': 'google_ads',
  google_ads: 'google_ads',
});

export function normalizeProviderSlug(provider) {
  if (typeof provider !== 'string') return null;
  const key = provider.trim().toLowerCase();
  return PROVIDER_ALIASES[key] ?? null;
}

export function providerToPublicSlug(provider) {
  const normalized = normalizeProviderSlug(provider);
  return normalized ? PUBLIC_PROVIDER_SLUGS[normalized] : null;
}
