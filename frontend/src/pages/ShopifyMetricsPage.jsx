import { Building2, CalendarClock, Link2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ClientSelector from "../components/dashboard/ClientSelector.jsx";
import ProviderSection from "../components/dashboard/ProviderSection.jsx";
import RangeSelector from "../components/dashboard/RangeSelector.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import * as integrationsApi from "../api/integrationsApi.js";
import useAppData from "../hooks/useAppData.js";
import useProviderMetrics from "../hooks/useProviderMetrics.js";
import {
  APP_ROUTES,
  APP_STORAGE_KEYS,
  PROVIDER_KEYS,
  PROVIDERS,
} from "../utils/constants.js";
import {
  formatPeriodPill,
  formatSelectedPeriod,
  getRangeLabel,
  normalizeRangeKey,
  resolveEffectivePeriod,
  resolveFallbackPeriod,
} from "../utils/ranges.js";

const completionStatuses = new Set([
  "incomplete",
  "needs_account_selection",
  "not_connected",
  "needs_reauth",
  "expired",
]);

function ProviderMetricsSkeleton() {
  return (
    <div className="ms-section space-y-4" aria-label="Caricamento metriche piattaforma">
      <Card className="h-28 animate-pulse bg-slate-50 dark:bg-slate-900/80" />
      <div className="ms-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card className="h-44 animate-pulse bg-slate-50 dark:bg-slate-900/80" key={item} />
        ))}
      </div>
    </div>
  );
}

function resolveIntegrationStatus(integration) {
  if (!integration) {
    return "not_connected";
  }

  return integration.status || (integration.connected ? "connected" : "not_connected");
}

function canLoadIntegration(integration) {
  return resolveIntegrationStatus(integration) === "connected" && Boolean(integration?.connected);
}

function getIntegrationMessage(providerLabel, status, integration) {
  if (integration?.lastError?.message) {
    return integration.lastError.message;
  }

  if (status === "expired") {
    return `Il collegamento ${providerLabel} è scaduto. Ricollegalo dalla sezione Integrazioni.`;
  }

  if (status === "needs_reauth") {
    return `Il collegamento ${providerLabel} richiede una nuova autorizzazione.`;
  }

  if (status === "error") {
    return `Il collegamento ${providerLabel} non è disponibile.`;
  }

  if (status === "incomplete") {
    return `Il collegamento ${providerLabel} è incompleto.`;
  }

  if (status === "needs_account_selection") {
    return `Scegli l'account ${providerLabel} da usare per questo cliente.`;
  }

  if (status === "disconnected" || status === "not_connected") {
    return `${providerLabel} non risulta collegato per il cliente selezionato.`;
  }

  return `Le metriche ${providerLabel} non sono disponibili per il cliente selezionato.`;
}

function getStatusFromErrorCode(code) {
  if (code === "INTEGRATION_NOT_FOUND") {
    return "not_connected";
  }

  if (code === "INTEGRATION_EXPIRED") {
    return "expired";
  }

  if (code === "INTEGRATION_INCOMPLETE") {
    return "incomplete";
  }

  if (code === "GOOGLE_ADS_ACCOUNT_SELECTION_REQUIRED" || code === "META_ACCOUNT_SELECTION_REQUIRED") {
    return "needs_account_selection";
  }

  if (
    code === "INTEGRATION_NOT_ACTIVE" ||
    code === "GOOGLE_ADS_REAUTH_REQUIRED" ||
    code === "META_REAUTH_REQUIRED" ||
    code === "SHOPIFY_REAUTH_REQUIRED"
  ) {
    return "needs_reauth";
  }

  return null;
}

function rememberIntegrationReturn({ clientId, provider }) {
  try {
    const returnTo =
      `${window.location.pathname}${window.location.search}${window.location.hash}` ||
      APP_ROUTES.google_ads;

    window.sessionStorage.setItem(
      APP_STORAGE_KEYS.integrationReturn,
      JSON.stringify({
        clientId: String(clientId),
        createdAt: Date.now(),
        provider,
        returnTo,
      }),
    );
  } catch {
    // Session storage is only used to resume the UX after OAuth.
  }
}

function clearIntegrationReturn() {
  try {
    window.sessionStorage.removeItem(APP_STORAGE_KEYS.integrationReturn);
  } catch {
    // Session storage is only used to resume the UX after OAuth.
  }
}

function buildUnavailableSection({ integration, provider, status }) {
  const providerLabel = PROVIDERS[provider]?.label ?? provider;
  const message = getIntegrationMessage(providerLabel, status, integration);

  return {
    message,
    meta: {
      hasData: false,
      sourceProvider: provider,
    },
    primaryCards: [],
    provider,
    providerLabel,
    providerLogoKey: provider,
    secondaryCards: [],
    status,
    warnings: message
      ? [
          {
            code: status,
            message,
            provider,
          },
        ]
      : [],
  };
}

export function ProviderMetricsPage({
  description,
  eyebrow,
  provider,
  title,
}) {
  const navigate = useNavigate();
  const [range, setRange] = useState(() => normalizeRangeKey("last_30_days"));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const {
    bootstrapError,
    hasClients,
    isBootstrapLoading,
    refreshBootstrap,
    selectedClient,
    selectedClientId,
    selectedClientIntegrations,
  } = useAppData();
  const providerLabel = PROVIDERS[provider]?.label ?? title;
  const integration = selectedClientIntegrations?.[provider] ?? null;
  const integrationStatus = resolveIntegrationStatus(integration);
  const isIntegrationReady = canLoadIntegration(integration);
  const isCustomRangeIncomplete = range === "custom" && (!startDate || !endDate);
  const metricsEnabled =
    !isBootstrapLoading &&
    !bootstrapError &&
    Boolean(selectedClientId) &&
    isIntegrationReady &&
    !isCustomRangeIncomplete;
  const providerCooldownMs = provider === PROVIDER_KEYS.google_ads ? 120_000 : 60_000;

  const {
    cooldownSeconds,
    error,
    errorCode,
    isLoading,
    meta,
    refetch,
    section,
  } = useProviderMetrics({
    clientId: selectedClientId,
    cooldownMs: providerCooldownMs,
    enabled: metricsEnabled,
    endDate,
    provider,
    range,
    startDate,
  });
  const [integrationActionError, setIntegrationActionError] = useState(null);
  const [isCompletingConnection, setIsCompletingConnection] = useState(false);
  const integrationErrorStatus = getStatusFromErrorCode(errorCode);
  const completionStatus = integrationErrorStatus ?? integrationStatus;
  const shouldShowCompletionCta =
    Boolean(selectedClientId) &&
    completionStatuses.has(completionStatus);
  const unavailableSection =
    !isIntegrationReady && selectedClient
      ? buildUnavailableSection({
          integration,
          provider,
          status: integrationStatus,
        })
      : null;
  const integrationErrorSection = integrationErrorStatus
    ? buildUnavailableSection({
        integration: {
          lastError: {
            message: error,
          },
        },
        provider,
        status: integrationErrorStatus,
      })
    : null;
  const effectiveSection = integrationErrorSection ?? section ?? unavailableSection;
  const fallbackPeriod = useMemo(
    () => resolveFallbackPeriod({ range, startDate, endDate }),
    [endDate, range, startDate],
  );
  const effectivePeriod = useMemo(
    () => resolveEffectivePeriod(meta, fallbackPeriod),
    [fallbackPeriod, meta],
  );
  const periodPillLabel = formatPeriodPill(effectivePeriod);
  const selectedPeriodDescription = formatSelectedPeriod(effectivePeriod);
  const metricDetailParams = useMemo(
    () => ({
      endDate,
      granularity: "auto",
      range,
      startDate,
    }),
    [endDate, range, startDate],
  );

  function handleRangeChange(nextRange) {
    setRange(normalizeRangeKey(nextRange));
  }

  async function handleCompleteConnection() {
    if (!selectedClientId) {
      return;
    }

    setIntegrationActionError(null);

    if (provider === PROVIDER_KEYS.shopify) {
      navigate(APP_ROUTES.integrations);
      return;
    }

    setIsCompletingConnection(true);
    rememberIntegrationReturn({
      clientId: selectedClientId,
      provider,
    });

    try {
      const response = await integrationsApi.connect(provider, selectedClientId);
      const redirectUrl = response?.url ?? response?.data?.url ?? response?.connectUrl;

      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      window.location.href = integrationsApi.buildConnectUrl(
        provider,
        selectedClientId,
      );
    } catch (error) {
      const fallbackUrl = integrationsApi.buildConnectUrl(
        provider,
        selectedClientId,
      );

      if (!error?.response) {
        window.location.href = fallbackUrl;
        return;
      }

      clearIntegrationReturn();
      setIntegrationActionError(
        integrationsApi.getIntegrationErrorMessage(
          error,
          `Collegamento ${providerLabel} non avviato.`,
        ),
      );
      setIsCompletingConnection(false);
    }
  }

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
          <>
            <BackButton fallbackTo={APP_ROUTES.dashboard} />
            <Button
              disabled={!metricsEnabled || isLoading || cooldownSeconds > 0}
              onClick={refetch}
              variant="secondary"
            >
              <RefreshCw
                className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")}
                aria-hidden="true"
              />
              {isLoading
                ? "Aggiorno"
                : cooldownSeconds > 0
                  ? `Aggiorna (${cooldownSeconds}s)`
                  : "Aggiorna"}
            </Button>
          </>
        }
        description={description}
        eyebrow={eyebrow}
        meta={
          <>
            {selectedClient ? <Badge tone="neutral">{selectedClient.name}</Badge> : null}
            <Badge tone="neutral">{getRangeLabel(range)}</Badge>
            {integrationStatus ? <Badge status={integrationStatus} /> : null}
            {periodPillLabel ? <Badge tone="neutral">{periodPillLabel}</Badge> : null}
          </>
        }
        title={title}
      />

      {isBootstrapLoading ? (
        <Card>
          <Spinner label="Caricamento dati..." />
        </Card>
      ) : null}

      {!isBootstrapLoading && bootstrapError ? (
        <div className="space-y-4">
          <ErrorMessage message={bootstrapError} title="Impossibile caricare i dati" />
          <Button onClick={refreshBootstrap} variant="secondary">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Riprova
          </Button>
        </div>
      ) : null}

      {!isBootstrapLoading && !bootstrapError && !hasClients ? (
        <EmptyState
          action={
            <Button as={Link} to={APP_ROUTES.clients} variant="secondary">
              Vai ai clienti
            </Button>
          }
          description="Non sono presenti clienti. Vai alla sezione Clienti per aggiungerne uno."
          icon={Building2}
          title="Nessun cliente disponibile"
        />
      ) : null}

      {!isBootstrapLoading && !bootstrapError && selectedClient ? (
        <>
          <Card>
            <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr] lg:items-start">
              <div className="xl:hidden">
                <ClientSelector id={`${provider}-client-selector`} />
              </div>
              <div className="hidden xl:block">
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Cliente</p>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {selectedClient.name}
                  </p>
                </div>
              </div>
              <RangeSelector
                endDate={endDate}
                onChange={handleRangeChange}
                onEndDateChange={setEndDate}
                onStartDateChange={setStartDate}
                periodDescription={selectedPeriodDescription}
                startDate={startDate}
                value={range}
              />
            </div>
          </Card>

          {isCustomRangeIncomplete ? (
            <EmptyState
              description="Seleziona data inizio e data fine per visualizzare i dati per il periodo personalizzato."
              icon={CalendarClock}
              title="Periodo personalizzato incompleto"
            />
          ) : null}

          {!isCustomRangeIncomplete && integrationActionError ? (
            <ErrorMessage
              message={integrationActionError}
              title={`Collegamento ${providerLabel} non avviato`}
            />
          ) : null}

          {!isCustomRangeIncomplete && !isIntegrationReady && effectiveSection ? (
            <div className="space-y-4">
              <ProviderSection
                {...effectiveSection}
                detailParams={metricDetailParams}
                periodLabel={periodPillLabel}
              />
              {shouldShowCompletionCta ? (
                <Button
                  disabled={isCompletingConnection}
                  isLoading={isCompletingConnection}
                  onClick={handleCompleteConnection}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Completa collegamento {providerLabel}
                </Button>
              ) : null}
            </div>
          ) : null}

          {!isCustomRangeIncomplete && isIntegrationReady && isLoading ? (
            <ProviderMetricsSkeleton />
          ) : null}

          {!isCustomRangeIncomplete &&
          isIntegrationReady &&
          !isLoading &&
          error &&
          integrationErrorStatus &&
          effectiveSection ? (
            <div className="space-y-4">
              <ProviderSection
                {...effectiveSection}
                detailParams={metricDetailParams}
                periodLabel={periodPillLabel}
              />
              {shouldShowCompletionCta ? (
                <Button
                  disabled={isCompletingConnection}
                  isLoading={isCompletingConnection}
                  onClick={handleCompleteConnection}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Completa collegamento {providerLabel}
                </Button>
              ) : (
                <Button onClick={refetch} variant="secondary">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Riprova {providerLabel}
                </Button>
              )}
            </div>
          ) : null}

          {!isCustomRangeIncomplete &&
          isIntegrationReady &&
          !isLoading &&
          error &&
          !integrationErrorStatus ? (
            <div className="space-y-4">
              <ErrorMessage message={error} title={`Metriche ${providerLabel} non caricate`} />
              <Button onClick={refetch} variant="secondary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Riprova {providerLabel}
              </Button>
            </div>
          ) : null}

          {!isCustomRangeIncomplete &&
          isIntegrationReady &&
          !isLoading &&
          !error &&
          effectiveSection ? (
            <ProviderSection
              {...effectiveSection}
              detailParams={metricDetailParams}
              periodLabel={periodPillLabel}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function ShopifyMetricsPage() {
  return (
    <ProviderMetricsPage
      description="Ordini, ricavi, AOV, clienti nuovi e ricorrenti provenienti da Shopify."
      eyebrow="Piattaforma e-commerce"
      provider={PROVIDER_KEYS.shopify}
      title="Metriche Shopify"
    />
  );
}
