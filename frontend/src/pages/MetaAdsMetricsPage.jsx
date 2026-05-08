import { PROVIDER_KEYS } from "../utils/constants.js";
import { ProviderMetricsPage } from "./ShopifyMetricsPage.jsx";

export default function MetaAdsMetricsPage() {
  return (
    <ProviderMetricsPage
      description="Spesa, ROAS, acquisti, conversioni e costi media provenienti da Meta Ads."
      eyebrow="Piattaforma advertising"
      provider={PROVIDER_KEYS.meta_ads}
      title="Metriche Meta Ads"
    />
  );
}
