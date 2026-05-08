import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Spinner from "../ui/Spinner.jsx";

const META_ACCOUNT_STATUSES = {
  1: "Attivo",
  2: "Disabilitato",
  3: "Addebiti non corrisposti",
  7: "Archiviato",
  9: "In bozza",
  100: "Chiuso",
};

const GOOGLE_ACCOUNT_STATUSES = {
  ENABLED: "Abilitato",
  PAUSED: "Sospeso",
  REMOVED: "Rimosso",
  SUSPENDED: "Sospeso",
};

function formatAccountStatus(status) {
  if (status === null || status === undefined || status === "") {
    return null;
  }

  const asNumber = Number(status);
  if (!Number.isNaN(asNumber) && META_ACCOUNT_STATUSES[asNumber]) {
    return META_ACCOUNT_STATUSES[asNumber];
  }

  const upper = String(status).toUpperCase();
  if (GOOGLE_ACCOUNT_STATUSES[upper]) {
    return GOOGLE_ACCOUNT_STATUSES[upper];
  }

  return String(status);
}

function buildAccountSelectionRef(account) {
  return [
    account.provider ?? "",
    account.externalRef ?? "",
    account.managerCustomerId || "direct",
  ].join(":");
}

const META_ADS_NOTE =
  "Stai selezionando l'account pubblicitario Meta da usare per i KPI. Il nome può essere diverso dal portfolio business o dalla pagina Facebook.";

export default function AccountSelectionList({
  accounts = [],
  emptyDescription = "Carica gli account disponibili dopo il collegamento.",
  emptyTitle = "Nessun account caricato",
  isLoading = false,
  onSelect,
  selectingAccountRef = null,
}) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <Spinner label="Caricamento account" />
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-4 w-4 flex-none text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">{emptyTitle}</p>
            <p className="mt-1">{emptyDescription}</p>
          </div>
        </div>
      </div>
    );
  }

  const provider = accounts[0]?.provider ?? null;
  const isMetaAds = provider === "meta_ads";
  const hasBusinessInfo = isMetaAds && accounts.some((a) => Boolean(a.businessName));

  return (
    <div className="space-y-3">
      {isMetaAds && !hasBusinessInfo ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {META_ADS_NOTE}
        </p>
      ) : null}
      {accounts.map((account) => {
        const selectingKey = buildAccountSelectionRef(account);
        const isSelecting = selectingAccountRef === selectingKey;
        const statusLabel = formatAccountStatus(account.status);

        return (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
            key={selectingKey}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{account.label}</h3>
                {account.businessName ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Azienda: {account.businessName}
                  </p>
                ) : null}
                <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  ID: {account.externalRef ?? "Non disponibile"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusLabel ? <Badge tone="neutral">{statusLabel}</Badge> : null}
                  {account.isManager ? <Badge tone="neutral">Manager account</Badge> : null}
                  {account.parentManagerId ? (
                    <Badge tone="neutral">Account gestito {account.parentManagerId}</Badge>
                  ) : null}
                  {account.currency ? <Badge tone="neutral">{account.currency}</Badge> : null}
                  {account.timezone ? <Badge tone="neutral">{account.timezone}</Badge> : null}
                </div>
              </div>
              <Button
                disabled={!account.externalRef || isSelecting}
                isLoading={isSelecting}
                onClick={() => onSelect(account)}
                size="sm"
                type="button"
              >
                {isSelecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                Seleziona
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
