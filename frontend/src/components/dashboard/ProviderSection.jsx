import { AlertTriangle, PlugZap } from "lucide-react";
import { getProviderLogo } from "../../utils/providerLogos.js";
import { formatDateTime } from "../../utils/formatters.js";
import ProviderIcon from "../providers/ProviderIcon.jsx";
import Badge from "../ui/Badge.jsx";
import Card from "../ui/Card.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import KpiCard from "./KpiCard.jsx";

function renderCards(cards, providerLabel, detailParams) {
  return cards.map((card) => (
    <KpiCard
      detailParams={detailParams}
      key={card.id || card.key || card.label}
      metric={card}
      providerLabel={card.providerLabel || providerLabel}
    />
  ));
}

function getEmptyStateCopy(status, providerLabel) {
  if (status === "not_connected") {
    return {
      description: `${providerLabel} non risulta collegato per il cliente selezionato.`,
      title: "Piattaforma non collegata",
    };
  }

  if (status === "failed") {
    return {
      description: `Nessun dato ${providerLabel} disponibile per questo periodo.`,
      title: "Dati non caricati",
    };
  }

  if (status === "expired") {
    return {
      description: `Il collegamento ${providerLabel} è scaduto. Ricollegalo dalla sezione Integrazioni.`,
      title: "Collegamento scaduto",
    };
  }

  if (status === "needs_reauth") {
    return {
      description: `Il collegamento ${providerLabel} richiede una nuova autorizzazione.`,
      title: "Ricollega piattaforma",
    };
  }

  if (status === "error") {
    return {
      description: `Il collegamento ${providerLabel} non è disponibile.`,
      title: "Collegamento non disponibile",
    };
  }

  if (status === "incomplete") {
    return {
      description: `Il collegamento ${providerLabel} richiede una configurazione aggiuntiva.`,
      title: "Collegamento incompleto",
    };
  }

  if (status === "needs_account_selection") {
    return {
      description: `Scegli l'account ${providerLabel} da usare per questo cliente.`,
      title: "Seleziona account",
    };
  }

  return {
    description: `Nessuna card KPI ${providerLabel} disponibile per il periodo selezionato.`,
    title: "Metriche non disponibili",
  };
}

export default function ProviderSection({
  message,
  meta,
  primaryCards = [],
  periodLabel = "",
  provider,
  providerLabel,
  providerLogoKey,
  secondaryCards = [],
  status,
  warnings = [],
  detailParams = null,
}) {
  const logo = getProviderLogo(providerLogoKey || provider);
  const title = providerLabel || logo.label;
  const hasCards = primaryCards.length > 0 || secondaryCards.length > 0;
  const emptyState = getEmptyStateCopy(status, title);
  const metaRows = [
    { label: "Aggiornato il", value: meta?.lastFetchedAt },
  ].filter((row) => row.value);

  return (
    <section className="ms-provider-section space-y-4">
      <Card className="ms-provider-header-card p-4 sm:p-5">
        <div className="ms-provider-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderIcon providerLogoKey={providerLogoKey || provider} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
                {periodLabel ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {periodLabel}
                  </span>
                ) : null}
              </div>
              {message ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status ? <Badge status={status} /> : null}
          </div>
        </div>

        {metaRows.length > 0 ? (
          <div className="ms-provider-meta mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            {metaRows.map((row) => (
              <span key={row.label}>
                <span className="font-medium text-slate-600 dark:text-slate-300">{row.label}:</span>{" "}
                {formatDateTime(row.value)}
              </span>
            ))}
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="ms-provider-warnings mt-4 space-y-2">
            {warnings.map((warning, index) => (
              <div
                className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
                key={warning.id || `${warning.code || "warning"}-${warning.message || warning}-${index}`}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                <span>{warning.message || warning}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {hasCards ? (
        <div className="ms-provider-card-stack space-y-4">
          {primaryCards.length > 0 ? (
            <div className="ms-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {renderCards(primaryCards, title, detailParams)}
            </div>
          ) : null}
          {secondaryCards.length > 0 ? (
            <div className="ms-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {renderCards(secondaryCards, title, detailParams)}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          description={emptyState.description}
          icon={PlugZap}
          title={emptyState.title}
        />
      )}
    </section>
  );
}
