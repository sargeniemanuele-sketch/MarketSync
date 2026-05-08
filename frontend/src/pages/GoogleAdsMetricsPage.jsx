import { PROVIDER_KEYS } from "../utils/constants.js";
import { ProviderMetricsPage } from "./ShopifyMetricsPage.jsx";

export default function GoogleAdsMetricsPage() {
  return (
    <ProviderMetricsPage
      description="Conversioni, spesa, click, impression e rendimento provenienti da Google Ads."
      eyebrow="Piattaforma advertising"
      provider={PROVIDER_KEYS.google_ads}
      title="Metriche Google Ads"
    />
  );
}
