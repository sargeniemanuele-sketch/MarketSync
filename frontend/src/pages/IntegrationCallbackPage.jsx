import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BackButton from "../components/ui/BackButton.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import { APP_ROUTES, PROVIDERS } from "../utils/constants.js";
import { normalizeProviderSlug } from "../utils/providers.js";

function buildRedirectUrl(provider, status) {
  const params = new URLSearchParams();

  if (provider) {
    params.set("provider", provider);
  }

  if (status) {
    params.set("status", status);
  }

  const query = params.toString();
  return query ? `${APP_ROUTES.integrations}?${query}` : APP_ROUTES.integrations;
}

export default function IntegrationCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshBootstrap, selectedClientId } = useAppData();
  const [error, setError] = useState(null);
  const provider = normalizeProviderSlug(searchParams.get("provider"));
  const status = searchParams.get("status");

  useEffect(() => {
    const isKnownProvider = Boolean(PROVIDERS[provider]);

    if (!isKnownProvider || !status) {
      setError("Collegamento non valido. Riprova dalla sezione Integrazioni.");
      return;
    }

    async function completeCallback() {
      await refreshBootstrap({ preferredClientId: selectedClientId });
      navigate(buildRedirectUrl(provider, status), { replace: true });
    }

    completeCallback().catch(() => {
      navigate(buildRedirectUrl(provider, "error"), { replace: true });
    });
  }, [navigate, provider, refreshBootstrap, selectedClientId, status]);

  return (
    <div className="space-y-6">
      <BackButton fallbackTo={APP_ROUTES.integrations} />
      <Card>
        {error ? (
          <ErrorMessage message={error} title="Collegamento non completato" />
        ) : (
          <Spinner label="Completo il collegamento" />
        )}
      </Card>
    </div>
  );
}
