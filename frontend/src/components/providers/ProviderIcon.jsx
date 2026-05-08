import shopifyPng from "../../assets/providers/shopify.png";
import metaAdsPng from "../../assets/providers/meta-ads.png";
import googleAdsPng from "../../assets/providers/google-ads.png";
import { PROVIDER_LOGOS } from "../../utils/providerLogos.js";

const SIZE_MAP = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

const ICON_MAP = {
  shopify: { src: shopifyPng, label: "Shopify" },
  meta_ads: { src: metaAdsPng, label: "Meta Ads" },
  google_ads: { src: googleAdsPng, label: "Google Ads" },
};

export default function ProviderIcon({
  providerLogoKey,
  provider,
  size = "sm",
  className = "",
  showFallback = true,
  title,
}) {
  const key = providerLogoKey || provider;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.sm;
  const combinedClass = [sizeClass, "flex-none", className].filter(Boolean).join(" ");
  const icon = key ? ICON_MAP[key] : null;

  if (icon) {
    return (
      <img
        src={icon.src}
        alt=""
        aria-hidden="true"
        className={combinedClass}
        draggable={false}
        title={title}
      />
    );
  }

  if (!showFallback) {
    return null;
  }

  const logoInfo = key ? PROVIDER_LOGOS[key] : null;
  const initial = logoInfo ? logoInfo.initials : (key ? key.charAt(0).toUpperCase() : "?");
  const fallbackColorClass =
    logoInfo?.className ??
    "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";

  return (
    <span
      className={["inline-flex items-center justify-center rounded-full text-xs font-bold ring-1", fallbackColorClass, combinedClass].join(" ")}
      aria-hidden="true"
      title={title}
    >
      {initial}
    </span>
  );
}
