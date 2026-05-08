import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../../utils/constants.js";
import { formatMetricValue, formatPercentage, formatSignedNumber } from "../../utils/formatters.js";
import { getProviderLogo } from "../../utils/providerLogos.js";
import ProviderIcon from "../providers/ProviderIcon.jsx";
import Card from "../ui/Card.jsx";
import InfoTooltip from "../ui/InfoTooltip.jsx";
import SparklineMini from "./SparklineMini.jsx";

const trendConfig = {
  decrease: {
    className: "text-rose-700 dark:text-rose-300",
    icon: ArrowDownRight,
    label: "In calo",
  },
  down: {
    className: "text-rose-700 dark:text-rose-300",
    icon: ArrowDownRight,
    label: "In calo",
  },
  flat: {
    className: "text-slate-500 dark:text-slate-400",
    icon: ArrowRight,
    label: "Stabile",
  },
  increase: {
    className: "text-emerald-700 dark:text-emerald-300",
    icon: ArrowUpRight,
    label: "In crescita",
  },
  negative: {
    className: "text-rose-700 dark:text-rose-300",
    icon: ArrowDownRight,
    label: "In calo",
  },
  neutral: {
    className: "text-slate-500 dark:text-slate-400",
    icon: ArrowRight,
    label: "Stabile",
  },
  positive: {
    className: "text-emerald-700 dark:text-emerald-300",
    icon: ArrowUpRight,
    label: "In crescita",
  },
  stable: {
    className: "text-slate-500 dark:text-slate-400",
    icon: ArrowRight,
    label: "Stabile",
  },
  up: {
    className: "text-emerald-700 dark:text-emerald-300",
    icon: ArrowUpRight,
    label: "In crescita",
  },
};

function normalizeAvailability(availability) {
  if (!availability) {
    return null;
  }

  if (typeof availability === "string") {
    return { status: availability, message: null };
  }

  return {
    message: availability.message ?? null,
    status: availability.status ?? null,
  };
}

function KpiHelp({ help }) {
  if (!help) {
    return null;
  }

  function firstText(...values) {
    return values.find((value) => typeof value === "string" && value.trim()) ?? null;
  }

  const title = help.title ?? help.label ?? "KPI";
  const description = firstText(help.descriptionIt, help.description, help.text);
  const formula = firstText(help.formulaIt, help.formula);
  const note = firstText(help.noteIt, help.note);
  const shouldShowFormula = formula && formula !== description;
  const shouldShowNote = note && note !== description && note !== formula;

  if (!title && !description && !shouldShowFormula && !shouldShowNote) {
    return null;
  }

  return (
    <InfoTooltip
      ariaLabel={`Informazioni su ${help.title || "KPI"}`}
      className="self-center"
      data-card-navigation="ignore"
    >
      {title ? (
        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</p>
      ) : null}
      {description ? (
        <p className={["text-xs leading-5 text-slate-600 dark:text-slate-300", title ? "mt-2" : ""].join(" ")}>
          <span className="font-semibold text-slate-700 dark:text-slate-200">Descrizione:</span>{" "}
          {description}
        </p>
      ) : null}
      {shouldShowFormula ? (
        <p
          className={[
            "text-xs leading-5 text-slate-600 dark:text-slate-300",
            description || title ? "mt-2" : "",
          ].join(" ")}
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">Formula:</span> {formula}
        </p>
      ) : null}
      {shouldShowNote ? (
        <p
          className={[
            "text-xs leading-5 text-slate-600 dark:text-slate-300",
            description || shouldShowFormula || title ? "mt-2" : "",
          ].join(" ")}
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">Nota:</span> {note}
        </p>
      ) : null}
    </InfoTooltip>
  );
}

function buildMetricDetailUrl(data, detailParams = {}) {
  const provider = data?.provider;
  const metricKey = data?.key;

  if (!provider || !metricKey) {
    return null;
  }

  const query = new URLSearchParams();
  const range = detailParams.range || "last_7_days";

  query.set("range", range);
  query.set("granularity", detailParams.granularity || "auto");

  if (range === "custom") {
    if (detailParams.startDate) {
      query.set("startDate", detailParams.startDate);
    }

    if (detailParams.endDate) {
      query.set("endDate", detailParams.endDate);
    }
  }

  const path = APP_ROUTES.metricDetail
    .replace(":provider", encodeURIComponent(provider))
    .replace(":metricKey", encodeURIComponent(metricKey));

  return `${path}?${query.toString()}`;
}

function isInteractiveChild(target) {
  return Boolean(
    target?.closest?.(
      "button,a,input,select,textarea,[role='button'],[data-card-navigation='ignore']",
    ),
  );
}

export default function KpiCard({ className = "", detailParams = null, metric, ...props }) {
  const navigate = useNavigate();
  const data = metric ? { ...props, ...metric } : props;
  const comparison = data.comparison && typeof data.comparison === "object" ? data.comparison : {};
  const delta = data.delta ?? comparison.delta;
  const deltaPercentage = data.deltaPercentage ?? comparison.deltaPercentage;
  const trend = data.trend ?? comparison.trend ?? null;
  const trendInfo = trendConfig[trend] || trendConfig.flat;
  const TrendIcon = trendInfo.icon;
  const availability = normalizeAvailability(data.availability);
  const providerLogo = getProviderLogo(data.providerLogoKey || data.provider);
  const value = formatMetricValue(data);
  const previousRawValue = data.previousValue ?? comparison.previousValue;
  const previousValue =
    data.formattedPreviousValue ||
    formatMetricValue({
      currency: data.currency,
      formattedValue: data.formattedPreviousValue,
      unit: data.unit,
      value: previousRawValue,
    });
  const hasComparisonValue = deltaPercentage !== null && deltaPercentage !== undefined;
  const hasDeltaValue = delta !== null && delta !== undefined;
  const hasComparison = hasComparisonValue || hasDeltaValue;
  const help =
    data.help ??
    (data.formula || data.description
      ? {
          title: data.label || "KPI",
          description: data.description ?? null,
          formula: data.formula ?? null,
        }
      : null);
  const detailTo = buildMetricDetailUrl(data, detailParams);
  const isClickable = Boolean(detailTo);

  function openDetail() {
    if (detailTo) {
      navigate(detailTo);
    }
  }

  function handleClick(event) {
    if (isInteractiveChild(event.target)) {
      return;
    }

    openDetail();
  }

  function handleKeyDown(event) {
    if (
      !isClickable ||
      isInteractiveChild(event.target) ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }

    event.preventDefault();
    openDetail();
  }

  return (
    <Card
      aria-label={isClickable ? `Apri dettaglio ${data.label || data.key}` : undefined}
      className={[
        "ms-kpi-card flex min-h-44 flex-col justify-between p-4 transition",
        isClickable
          ? "cursor-pointer outline-none hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:hover:border-slate-700 dark:hover:shadow-none dark:focus-visible:ring-offset-slate-950"
          : "",
        className,
      ].join(" ")}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      role={isClickable ? "link" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="ms-kpi-main flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="ms-kpi-label-row flex min-w-0 items-center gap-1.5">
            <h3 className="ms-kpi-label min-w-0 truncate text-sm font-medium text-slate-600 dark:text-slate-300">
              {data.label || "KPI"}
            </h3>
            <KpiHelp help={help} />
          </div>
          <p className="ms-kpi-value mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">{value}</p>
          {availability?.message ? (
            <p className="ms-kpi-availability mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{availability.message}</p>
          ) : null}
        </div>
        <ProviderIcon
          providerLogoKey={data.providerLogoKey || data.provider}
          size="md"
          showFallback={false}
          title={data.providerLabel || providerLogo.label}
          className="ms-kpi-provider-icon mt-1"
        />
      </div>

      <div className="ms-kpi-sparkline-wrap mt-4">
        <SparklineMini className="ms-kpi-sparkline" points={data.sparkline} />
      </div>

      <div className="ms-kpi-footer mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        {hasComparison ? (
          <div
            className={["ms-kpi-trend inline-flex items-center gap-1 font-medium", trendInfo.className].join(
              " ",
            )}
            title={trendInfo.label}
          >
            <TrendIcon className="h-4 w-4" aria-hidden="true" />
            <span>{hasComparisonValue ? formatPercentage(deltaPercentage) : formatSignedNumber(delta)}</span>
          </div>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">Confronto non disponibile</span>
        )}
      </div>

      {previousRawValue !== null && previousRawValue !== undefined ? (
        <p className="ms-kpi-previous mt-3 text-xs text-slate-500 dark:text-slate-400">Periodo precedente: {previousValue}</p>
      ) : null}
    </Card>
  );
}
