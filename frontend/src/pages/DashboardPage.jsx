import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ClientSelector from "../components/dashboard/ClientSelector.jsx";
import KpiCard from "../components/dashboard/KpiCard.jsx";
import ProviderSection from "../components/dashboard/ProviderSection.jsx";
import RangeSelector from "../components/dashboard/RangeSelector.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useDashboardMetrics from "../hooks/useDashboardMetrics.js";
import { APP_ROUTES, DASHBOARD_PROVIDER_KEYS, PROVIDERS } from "../utils/constants.js";
import {
  applyDashboardPreferencesToProviderSection,
  getCustomMetricSelectionForClient,
  readDashboardPreferences,
} from "../utils/dashboardPreferences.js";
import {
  formatPeriodPill,
  formatSelectedPeriod,
  getRangeLabel,
  normalizeRangeKey,
  resolveEffectivePeriod,
  resolveFallbackPeriod,
} from "../utils/ranges.js";

function toText(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "object") {
    return value.formattedValue || value.label || value.message || JSON.stringify(value);
  }

  return String(value);
}

function DashboardSkeleton() {
  return (
    <div className="ms-section space-y-4" aria-label="Caricamento dashboard">
      <div className="ms-card-grid grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card className="h-32 animate-pulse bg-slate-50 dark:bg-slate-900/80" key={item} />
        ))}
      </div>
      <Card className="h-52 animate-pulse bg-slate-50 dark:bg-slate-900/80" />
    </div>
  );
}

const GLOBAL_BANNER_EXCLUDED_CODES = new Set([
  "PROVIDER_NOT_CONNECTED",
  "INTEGRATION_INCOMPLETE",
]);

function GlobalWarnings({ warnings = [] }) {
  const visible = warnings.filter((w) => !GLOBAL_BANNER_EXCLUDED_CODES.has(w?.code));

  if (!visible.length) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/15">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700 dark:text-amber-200" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Avvisi dashboard</h2>
          <div className="mt-3 space-y-2">
            {visible.map((warning, index) => (
              <p className="text-sm leading-6 text-amber-800 dark:text-amber-200" key={`${warning.code || "warning"}-${index}`}>
                {warning.provider ? (
                  <span className="font-semibold">
                    {PROVIDERS[warning.provider]?.label || warning.provider}:{" "}
                  </span>
                ) : null}
                {warning.message || warning}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function AggregateCompletenessBanner({ completeness }) {
  if (!completeness || completeness.isComplete || !completeness.message) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/15">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-700 dark:text-amber-200" aria-hidden="true" />
        <p className="text-sm leading-6 text-amber-900 dark:text-amber-100">{completeness.message}</p>
      </div>
    </Card>
  );
}

function PeriodPill({ label }) {
  if (!label) return null;

  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </span>
  );
}

function OverviewSection({
  aggregateCompleteness,
  cards = [],
  detailParams = null,
  periodLabel = "",
  warnings = [],
}) {
  const hasContent = cards.length > 0 || warnings.length > 0 || Boolean(aggregateCompleteness);

  if (!hasContent) {
    return (
      <section className="ms-section space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Panoramica generale</h2>
              <PeriodPill label={periodLabel} />
            </div>
          </div>
        </div>
        <EmptyState
          description="Nessun dato disponibile per il cliente e il periodo selezionati."
          icon={BarChart3}
          title="Dati non disponibili"
        />
      </section>
    );
  }

  return (
    <section className="ms-section space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Panoramica generale</h2>
            <PeriodPill label={periodLabel} />
          </div>
        </div>
      </div>
      <AggregateCompletenessBanner completeness={aggregateCompleteness} />
      <GlobalWarnings warnings={warnings} />
      {cards.length > 0 ? (
        <div className="ms-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <KpiCard detailParams={detailParams} key={card.id || card.key || card.label} metric={card} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MetricCardsBlock({
  action = null,
  cards = [],
  description,
  detailParams = null,
  emptyAction = null,
  emptyDescription = "",
  emptyTitle = "",
  icon: Icon = BarChart3,
  periodLabel = "",
  title,
}) {
  if (!cards.length && !emptyTitle) {
    return null;
  }

  return (
    <section className="ms-section space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden="true" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
              <PeriodPill label={periodLabel} />
            </div>
            {description ? <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {cards.length > 0 ? (
        <div className="ms-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <KpiCard detailParams={detailParams} key={card.id || card.key || card.label} metric={card} />
          ))}
        </div>
      ) : (
        <EmptyState
          action={emptyAction}
          description={emptyDescription}
          icon={Icon}
          title={emptyTitle}
        />
      )}
    </section>
  );
}

function ProviderHighlights({ highlights = [] }) {
  if (!highlights.length) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Riepilogo piattaforme</h2>
      <div className="ms-card-grid mt-4 grid gap-3 md:grid-cols-3">
        {highlights.map((item, index) => (
            <div className="ms-panel rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950" key={item.key || index}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {item.label || item.title || item.providerLabel || item.key || "Highlight"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {toText(item.message || item.description || item.formattedValue || item.value)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState(() =>
    normalizeRangeKey(readDashboardPreferences().defaultRange),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const dashboardPreferences = useMemo(() => readDashboardPreferences(), []);
  const {
    bootstrapError,
    hasClients,
    isBootstrapLoading,
    refreshBootstrap,
    selectedClient,
    selectedClientId,
  } = useAppData();
  const isCustomRangeIncomplete = range === "custom" && (!startDate || !endDate);
  const metricsEnabled =
    !isBootstrapLoading &&
    !bootstrapError &&
    Boolean(selectedClientId) &&
    !isCustomRangeIncomplete;
  const {
    cooldownSeconds,
    dashboardData,
    error,
    isLoading,
    meta,
    overview,
    refetch,
    sections,
    warnings,
  } = useDashboardMetrics({
    clientId: selectedClientId,
    enabled: metricsEnabled,
    endDate,
    range,
    startDate,
  });
  const providerSections = useMemo(
    () =>
      DASHBOARD_PROVIDER_KEYS.map((providerKey) =>
        applyDashboardPreferencesToProviderSection(
          sections[providerKey],
          dashboardPreferences,
        ),
      ).filter(Boolean),
    [dashboardPreferences, sections],
  );
  const overviewCards = useMemo(() => overview?.mainCards ?? [], [overview?.mainCards]);
  const customMetricCards = useMemo(
    () => (overview?.customMetricCards ?? []).filter((card) => card?.enabled !== false),
    [overview?.customMetricCards],
  );
  const visibleCustomMetricCards = useMemo(() => {
    const selectedKeys = getCustomMetricSelectionForClient(
      selectedClientId,
      customMetricCards,
      dashboardPreferences,
    );

    if (customMetricCards.length <= selectedKeys.length) {
      return customMetricCards;
    }

    const cardsByKey = new Map(customMetricCards.map((card) => [String(card.key), card]));

    return selectedKeys
      .map((key) => cardsByKey.get(String(key)))
      .filter(Boolean);
  }, [customMetricCards, dashboardPreferences, selectedClientId]);
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

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
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
        }
        eyebrow="Dashboard"
        meta={
          <>
            {selectedClient ? <Badge tone="neutral">{selectedClient.name}</Badge> : null}
            <Badge tone="neutral">{getRangeLabel(range)}</Badge>
            {periodPillLabel ? <Badge tone="neutral">{periodPillLabel}</Badge> : null}
          </>
        }
        title="Dashboard"
      />

      {isBootstrapLoading ? (
        <Card>
          <Spinner label="Caricamento dashboard..." />
        </Card>
      ) : null}

      {!isBootstrapLoading && bootstrapError ? (
        <div className="space-y-4">
          <ErrorMessage message={bootstrapError} title="Impossibile caricare la dashboard" />
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
                <ClientSelector id="dashboard-client-selector" />
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

          {!isCustomRangeIncomplete && isLoading ? <DashboardSkeleton /> : null}

          {!isCustomRangeIncomplete && !isLoading && error ? (
            <div className="space-y-4">
              <ErrorMessage message={error} title="Dashboard non caricata" />
              <Button onClick={refetch} variant="secondary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Riprova dashboard
              </Button>
            </div>
          ) : null}

          {!isCustomRangeIncomplete && !isLoading && !error && dashboardData ? (
            <>
              <OverviewSection
                aggregateCompleteness={overview?.aggregateCompleteness}
                cards={overviewCards}
                detailParams={metricDetailParams}
                periodLabel={periodPillLabel}
                warnings={warnings}
              />
              <MetricCardsBlock
                action={
                  customMetricCards.length > 4 ? (
                    <Button as={Link} to={APP_ROUTES.customMetrics} size="sm" variant="secondary">
                      Vedi tutte
                    </Button>
                  ) : null
                }
                cards={visibleCustomMetricCards}
                detailParams={metricDetailParams}
                emptyAction={
                  <Button as={Link} to={APP_ROUTES.customMetrics} variant="secondary">
                    Crea metrica custom
                  </Button>
                }
                emptyDescription="Non hai ancora creato metriche custom per questo cliente."
                emptyTitle="Nessuna metrica custom"
                icon={SlidersHorizontal}
                periodLabel={periodPillLabel}
                title="Metriche custom"
              />
              <ProviderHighlights highlights={overview?.providerHighlights} />
              {providerSections.map((section) => (
                <ProviderSection
                  key={section.provider}
                  {...section}
                  detailParams={metricDetailParams}
                  periodLabel={periodPillLabel}
                />
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
