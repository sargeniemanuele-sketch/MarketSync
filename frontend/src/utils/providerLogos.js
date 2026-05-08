export const PROVIDER_LOGOS = {
  shopify: {
    label: "Shopify",
    initials: "S",
    className:
      "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
  },
  meta_ads: {
    label: "Meta Ads",
    initials: "M",
    className:
      "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/30",
  },
  google_ads: {
    label: "Google Ads",
    initials: "G",
    className:
      "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
  },
  overview: {
    label: "Overview",
    initials: "O",
    className:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
  },
  custom_metric: {
    label: "Metriche custom",
    initials: "C",
    className:
      "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30",
  },
};

export function getProviderLogo(providerLogoKey) {
  return (
    PROVIDER_LOGOS[providerLogoKey] || {
      label: "Provider",
      initials: "?",
      className:
        "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    }
  );
}
