import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  RefreshCw,
  Table2,
} from "lucide-react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo } from "react";
import RangeSelector from "../components/dashboard/RangeSelector.jsx";
import ProviderIcon from "../components/providers/ProviderIcon.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useMetricDetail from "../hooks/useMetricDetail.js";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference.js";
import { APP_ROUTES, PROVIDERS } from "../utils/constants.js";
import {
  formatMetricValue,
  formatPercentage,
  formatSignedNumber,
} from "../utils/formatters.js";
import { getProviderLogo } from "../utils/providerLogos.js";
import {
  formatPeriodPill,
  formatSelectedPeriod,
  getRangeLabel,
  normalizeRangeKey,
  resolveEffectivePeriod,
  resolveFallbackPeriod,
} from "../utils/ranges.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const DEFAULT_DETAIL_RANGE = "last_7_days";
const DEFAULT_GRANULARITY = "auto";

const GRANULARITY_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "hourly", label: "Oraria" },
  { key: "daily", label: "Giornaliera" },
  { key: "weekly", label: "Settimanale" },
  { key: "monthly", label: "Mensile" },
];

const GRANULARITY_LABELS = Object.fromEntries(
  GRANULARITY_OPTIONS.map((option) => [option.key, option.label]),
);

const trendConfig = {
  decrease: { className: "text-rose-700 dark:text-rose-300", icon: ArrowDownRight },
  down: { className: "text-rose-700 dark:text-rose-300", icon: ArrowDownRight },
  flat: { className: "text-slate-500 dark:text-slate-400", icon: ArrowRight },
  increase: { className: "text-emerald-700 dark:text-emerald-300", icon: ArrowUpRight },
  negative: { className: "text-rose-700 dark:text-rose-300", icon: ArrowDownRight },
  neutral: { className: "text-slate-500 dark:text-slate-400", icon: ArrowRight },
  positive: { className: "text-emerald-700 dark:text-emerald-300", icon: ArrowUpRight },
  stable: { className: "text-slate-500 dark:text-slate-400", icon: ArrowRight },
  up: { className: "text-emerald-700 dark:text-emerald-300", icon: ArrowUpRight },
};

function normalizeDetailRange(rangeKey) {
  if (rangeKey === "this_month") {
    return "last_30_days";
  }

  return normalizeRangeKey(rangeKey, DEFAULT_DETAIL_RANGE);
}

function normalizeGranularity(value) {
  return GRANULARITY_LABELS[value] ? value : DEFAULT_GRANULARITY;
}

function parseIsoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function countInclusiveDays(startDate, endDate) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  if (!start || !end) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
}

function isHourlyDisabled({ endDate, range, startDate }) {
  if (range === "last_14_days" || range === "last_30_days") {
    return true;
  }

  if (range !== "custom") {
    return false;
  }

  const dayCount = countInclusiveDays(startDate, endDate);
  return dayCount !== null && dayCount > 7;
}

function buildCellValue(row, column) {
  if (column.key === "value" && row.formattedValue) {
    return row.formattedValue;
  }

  const value = row[column.key];

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "object") {
    return value.formattedValue || value.label || (value.value ?? "-");
  }

  return String(value);
}

function getMetricChartValue(point) {
  const value = Number(point?.value);
  return Number.isFinite(value) ? value : 0;
}

function formatAxisMetricValue(metric, value) {
  return formatMetricValue({
    currency: metric?.currency,
    unit: metric?.unit,
    value,
  });
}

function buildYAxisDomain(points) {
  const values = points
    .map((point) => Number(point?.value))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    return {};
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const allNonNegative = minValue >= 0;

  if (minValue === maxValue) {
    if (minValue === 0) {
      return { max: 1, min: 0 };
    }

    const padding = Math.max(Math.abs(minValue) * 0.08, 1);
    return {
      max: maxValue + padding,
      min: allNonNegative ? Math.max(0, minValue - padding) : minValue - padding,
    };
  }

  const padding = (maxValue - minValue) * 0.08;
  return {
    max: maxValue + padding,
    min: allNonNegative ? Math.max(0, minValue - padding) : minValue - padding,
  };
}

function DetailWarnings({ warnings = [] }) {
  if (!warnings.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning, index) => (
        <div
          className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
          key={`${warning?.code || "warning"}-${index}`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            {warning?.code === "HOURLY_GRANULARITY_FALLBACK"
              ? warning.message ||
                "La visualizzazione oraria non è disponibile per questo periodo. Vengono mostrati i dati giornalieri."
              : warning?.message || warning}
          </span>
        </div>
      ))}
    </div>
  );
}

function GranularitySelector({
  disabled = false,
  disableHourly = false,
  effectiveGranularity,
  onChange,
  requestedGranularity,
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Intervallo di tempo</p>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        {GRANULARITY_OPTIONS.map((option) => {
          const isActive = option.key === requestedGranularity;
          const isDisabled = disabled || (option.key === "hourly" && disableHourly);

          return (
            <button
              className={[
                "rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                isActive
                  ? "bg-slate-950 text-white shadow-sm dark:bg-brand-500/20 dark:text-brand-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50",
              ].join(" ")}
              disabled={isDisabled}
              key={option.key}
              onClick={() => onChange(option.key)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
        Intervallo: {GRANULARITY_LABELS[effectiveGranularity || requestedGranularity] || "Auto"}
        {effectiveGranularity && effectiveGranularity !== requestedGranularity
          ? ` (${GRANULARITY_LABELS[requestedGranularity] || "Auto"} non disponibile)`
          : ""}
      </p>
    </div>
  );
}

function MetricHeader({ effectivePeriodLabel, meta, metric, provider }) {
  const providerLogo = getProviderLogo(metric?.providerLogoKey || provider);
  const providerLabel = metric?.providerLabel || PROVIDERS[provider]?.label || providerLogo.label;
  const value = formatMetricValue(metric);
  const description = metric?.descriptionIt || metric?.description || null;
  const formula = provider === "custom_metric" ? null : metric?.formulaIt || metric?.formula || null;
  const note = metric?.noteIt || metric?.note || null;
  const shouldShowFormula = formula && formula !== description;
  const shouldShowNote = note && note !== description && note !== formula;
  const hasDeltaPercentage =
    metric?.deltaPercentage !== null && metric?.deltaPercentage !== undefined;
  const hasDelta = metric?.delta !== null && metric?.delta !== undefined;
  const trendInfo = trendConfig[metric?.trend] || trendConfig.flat;
  const TrendIcon = trendInfo.icon;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <ProviderIcon providerLogoKey={metric?.providerLogoKey || provider} size="lg" />
            <Badge tone="neutral">{providerLabel}</Badge>
            {effectivePeriodLabel ? <Badge tone="neutral">{effectivePeriodLabel}</Badge> : null}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">
            {metric?.label || metric?.key || "Metrica"}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
          {shouldShowFormula ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Formula:</span>{" "}
              {formula}
            </p>
          ) : null}
          {shouldShowNote ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Nota:</span>{" "}
              {note}
            </p>
          ) : null}
        </div>

        <div className="min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Totale periodo
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">{value}</p>
          {hasDeltaPercentage || hasDelta ? (
            <div className={["mt-2 inline-flex items-center gap-1 text-sm font-medium", trendInfo.className].join(" ")}>
              <TrendIcon className="h-4 w-4" aria-hidden="true" />
              <span>
                {hasDeltaPercentage
                  ? formatPercentage(metric.deltaPercentage)
                  : formatSignedNumber(metric.delta)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Trend non disponibile</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function MetricChart({ chart, metric }) {
  const reduceMotion = useReducedMotionPreference();
  const points = Array.isArray(chart?.points) ? chart.points : [];

  if (!chart || !points.length) {
    return (
      <EmptyState
        description="Grafico non disponibile per questa metrica o intervallo di tempo."
        icon={BarChart3}
        title="Grafico non disponibile"
      />
    );
  }

  const yAxisDomain = buildYAxisDomain(points);
  const data = {
    labels: points.map((point) => point.label || point.date || point.timestamp),
    datasets: [
      {
        backgroundColor: "rgba(37, 99, 235, 0.12)",
        borderColor: "rgb(37, 99, 235)",
        borderWidth: 2,
        data: points.map(getMetricChartValue),
        fill: true,
        label: metric?.label || metric?.key || "Metrica",
        pointBackgroundColor: "rgb(37, 99, 235)",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointRadius: points.length > 45 ? 0 : 3,
        pointHoverRadius: 5,
        tension: 0.28,
      },
    ],
  };

  const options = {
    ...(reduceMotion ? { animation: false } : {}),
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const point = points[context.dataIndex];
            return point?.formattedValue || formatAxisMetricValue(metric, context.parsed.y);
          },
        },
      },
    },
    responsive: true,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#64748b",
          maxRotation: 0,
        },
      },
      y: {
        ...yAxisDomain,
        grid: {
          color: "rgba(148, 163, 184, 0.22)",
        },
        ticks: {
          callback(value) {
            return formatAxisMetricValue(metric, value);
          },
          color: "#64748b",
        },
      },
    },
  };

  return (
    <div className="h-[360px] w-full">
      <Line data={data} options={options} />
    </div>
  );
}

function MetricTable({ table }) {
  const columns = Array.isArray(table?.columns) && table.columns.length
    ? table.columns
    : [
        { key: "period", label: "Periodo" },
        { key: "value", label: "Valore" },
      ];
  const rows = Array.isArray(table?.rows) ? table.rows : [];

  if (!rows.length) {
    return (
      <EmptyState
        description="Nessun dato disponibile per la tabella."
        icon={Table2}
        title="Tabella vuota"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-950">
          <tr>
            {columns.map((column) => (
              <th
                className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200"
                key={column.key}
                scope="col"
              >
                {column.label || column.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
          {rows.map((row, index) => (
            <tr key={row.timestamp || row.period || index}>
              {columns.map((column) => (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-300" key={column.key}>
                  {buildCellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomMetricInfo({ metric }) {
  const sources = Array.isArray(metric?.sources) ? metric.sources : [];
  const warnings = Array.isArray(metric?.warnings) ? metric.warnings : [];

  if (metric?.provider !== "custom_metric") {
    return null;
  }

  return (
    <Card>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Formula</h2>
          <p className="mt-3 break-words rounded-md bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800">
            {metric.formulaLabel || metric.formula || "Formula non disponibile"}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Fonti</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.length > 0 ? (
              sources.map((source, index) => (
                <Badge key={`${source.variableKey || "source"}-${index}`} tone="neutral">
                  {source.variableKey}: {source.sourceProvider}/{source.metricKey}
                </Badge>
              ))
            ) : (
              <Badge tone="neutral">Fonti non disponibili</Badge>
            )}
          </div>
        </div>
      </div>
      {warnings.length > 0 ? (
        <div className="mt-5">
          <DetailWarnings warnings={warnings} />
        </div>
      ) : null}
    </Card>
  );
}

export default function MetricDetailPage() {
  const { metricKey, provider } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    bootstrapError,
    hasClients,
    isBootstrapLoading,
    refreshBootstrap,
    selectedClient,
    selectedClientId,
  } = useAppData();
  const range = normalizeDetailRange(searchParams.get("range"));
  const granularity = normalizeGranularity(searchParams.get("granularity"));
  const startDate = range === "custom" ? searchParams.get("startDate") || "" : "";
  const endDate = range === "custom" ? searchParams.get("endDate") || "" : "";
  const isCustomRangeIncomplete = range === "custom" && (!startDate || !endDate);
  const metricsEnabled =
    !isBootstrapLoading &&
    !bootstrapError &&
    Boolean(selectedClientId) &&
    Boolean(provider) &&
    Boolean(metricKey) &&
    !isCustomRangeIncomplete;
  const fallbackPeriod = useMemo(
    () => resolveFallbackPeriod({ range, startDate, endDate }),
    [endDate, range, startDate],
  );
  const shouldDisableHourly = isHourlyDisabled({ endDate, range, startDate });
  const {
    chart,
    error,
    isLoading,
    meta,
    metric,
    refetch,
    table,
    warnings,
  } = useMetricDetail({
    clientId: selectedClientId,
    enabled: metricsEnabled,
    endDate,
    granularity,
    metricKey,
    provider,
    range,
    startDate,
  });
  const effectivePeriod = useMemo(
    () => resolveEffectivePeriod(meta, fallbackPeriod),
    [fallbackPeriod, meta],
  );
  const periodPillLabel = formatPeriodPill(effectivePeriod);
  const selectedPeriodDescription = formatSelectedPeriod(effectivePeriod);
  const effectiveGranularity = meta?.granularity || chart?.granularity || null;

  const updateQuery = useCallback(
    (updates, { replace = false } = {}) => {
      const next = new URLSearchParams(searchParams);
      const nextRange = updates.range ?? range;

      if (updates.range !== undefined) {
        next.set("range", updates.range);
      }

      if (updates.granularity !== undefined) {
        next.set("granularity", updates.granularity);
      }

      if (nextRange === "custom") {
        if (updates.startDate !== undefined) {
          updates.startDate ? next.set("startDate", updates.startDate) : next.delete("startDate");
        }

        if (updates.endDate !== undefined) {
          updates.endDate ? next.set("endDate", updates.endDate) : next.delete("endDate");
        }
      } else {
        next.delete("startDate");
        next.delete("endDate");
      }

      setSearchParams(next, { replace });
    },
    [range, searchParams, setSearchParams],
  );

  useEffect(() => {
    const currentRange = searchParams.get("range");
    const currentGranularity = searchParams.get("granularity");

    if (currentRange !== range || currentGranularity !== granularity) {
      updateQuery({ granularity, range }, { replace: true });
    }
  }, [granularity, range, searchParams, updateQuery]);

  function handleRangeChange(nextRangeValue) {
    const nextRange = normalizeDetailRange(nextRangeValue);
    const nextGranularity =
      granularity === "hourly" && isHourlyDisabled({ endDate, range: nextRange, startDate })
        ? "daily"
        : granularity;

    updateQuery({ granularity: nextGranularity, range: nextRange });
  }

  function handleGranularityChange(nextGranularity) {
    updateQuery({ granularity: normalizeGranularity(nextGranularity) });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <BackButton fallbackTo={APP_ROUTES.dashboard} />
            <Button disabled={!metricsEnabled || isLoading} onClick={refetch} variant="secondary">
              <RefreshCw
                className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")}
                aria-hidden="true"
              />
              {isLoading ? "Aggiorno" : "Aggiorna"}
            </Button>
          </div>
        }
        description="Dettaglio della singola metrica selezionata."
        eyebrow="Dettaglio metrica"
        meta={
          <>
            {selectedClient ? <Badge tone="neutral">{selectedClient.name}</Badge> : null}
            <Badge tone="neutral">{getRangeLabel(range)}</Badge>
            <Badge tone="neutral">{GRANULARITY_LABELS[granularity]}</Badge>
            {periodPillLabel ? <Badge tone="neutral">{periodPillLabel}</Badge> : null}
          </>
        }
        title={metric?.label || metricKey || "Metrica"}
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
          description="Non ci sono clienti disponibili. Seleziona o crea un cliente prima di aprire il dettaglio metrica."
          icon={CalendarClock}
          title="Nessun cliente attivo"
        />
      ) : null}

      {!isBootstrapLoading && !bootstrapError && hasClients && !selectedClient ? (
        <EmptyState
          action={
            <Button as={Link} to={APP_ROUTES.clients} variant="secondary">
              Vai ai clienti
            </Button>
          }
          description="Seleziona un cliente attivo per caricare il dettaglio della metrica."
          icon={CalendarClock}
          title="Nessun cliente selezionato"
        />
      ) : null}

      {!isBootstrapLoading && !bootstrapError && selectedClient ? (
        <>
          <Card>
            <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,420px)]">
              <RangeSelector
                endDate={endDate}
                onChange={handleRangeChange}
                onEndDateChange={(value) => updateQuery({ endDate: value })}
                onStartDateChange={(value) => updateQuery({ startDate: value })}
                periodDescription={selectedPeriodDescription}
                startDate={startDate}
                value={range}
              />
              <GranularitySelector
                disableHourly={shouldDisableHourly}
                disabled={isLoading}
                effectiveGranularity={effectiveGranularity}
                onChange={handleGranularityChange}
                requestedGranularity={granularity}
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

          {!isCustomRangeIncomplete && isLoading ? (
            <div className="space-y-4" aria-label="Caricamento dettaglio metrica">
              <Card className="h-40 animate-pulse bg-slate-50 dark:bg-slate-900/80" />
              <Card className="h-[420px] animate-pulse bg-slate-50 dark:bg-slate-900/80" />
              <Card className="h-56 animate-pulse bg-slate-50 dark:bg-slate-900/80" />
            </div>
          ) : null}

          {!isCustomRangeIncomplete && !isLoading && error ? (
            <div className="space-y-4">
              <ErrorMessage message={error} title="Dettaglio metrica non caricato" />
              <Button onClick={refetch} variant="secondary">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Riprova dettaglio
              </Button>
            </div>
          ) : null}

          {!isCustomRangeIncomplete && !isLoading && !error ? (
            <>
              <DetailWarnings warnings={warnings} />

              {metric ? (
                <MetricHeader
                  effectivePeriodLabel={periodPillLabel}
                  meta={meta}
                  metric={metric}
                  provider={provider}
                />
              ) : null}

              <CustomMetricInfo metric={metric} />

              <Card>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Andamento</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Una sola metrica, con intervallo{" "}
                      {GRANULARITY_LABELS[effectiveGranularity]?.toLowerCase() ||
                        effectiveGranularity ||
                        "auto"}
                      .
                    </p>
                  </div>
                  {effectiveGranularity ? (
                    <Badge tone="neutral">
                      Visualizzazione{" "}
                      {GRANULARITY_LABELS[effectiveGranularity]?.toLowerCase() || effectiveGranularity}
                    </Badge>
                  ) : null}
                </div>
                <MetricChart chart={chart} metric={metric} />
              </Card>

              <Card>
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Dati periodo</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Valori disponibili per la tabella della metrica.
                  </p>
                </div>
                <MetricTable table={table} />
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
