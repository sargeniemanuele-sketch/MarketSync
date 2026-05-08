import {
  ExternalLink,
  Link2,
  ListChecks,
  Loader2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import ProviderIcon from "../providers/ProviderIcon.jsx";
import { PROVIDER_KEYS, PROVIDERS } from "../../utils/constants.js";
import { formatDateTime } from "../../utils/formatters.js";

const PROVIDER_SUBTITLES = {
  shopify: "Store Shopify",
  meta_ads: "Account pubblicitario Meta",
  google_ads: "Account Google Ads",
};

const reconnectStatuses = new Set(["connected", "expired", "needs_reauth", "error"]);
const disconnectStatuses = new Set([
  "connected",
  "incomplete",
  "needs_account_selection",
  "expired",
  "needs_reauth",
  "error",
]);
const accountSelectionStatuses = new Set(["connected", "incomplete", "needs_account_selection"]);

function getStatusText(integration) {
  if (integration?.connected || integration?.status === "connected") {
    return "Attiva";
  }

  if (integration?.status === "needs_account_selection" || integration?.status === "incomplete") {
    return "Da completare";
  }

  return "Non attiva";
}

function getConnectLabel(status, supportsAccounts) {
  if (supportsAccounts && (status === "incomplete" || status === "needs_account_selection")) {
    return "Completa configurazione";
  }

  return reconnectStatuses.has(status) ? "Ricollega" : "Collega";
}

export default function IntegrationCard({
  accountsPanel = null,
  integration,
  isConnecting = false,
  isDisconnecting = false,
  isLoadingAccounts = false,
  onConnect,
  onDisconnect,
  onLoadAccounts,
  onShopDomainChange,
  providerKey,
  shopDomain = "",
  shopDomainError = null,
  supportsAccounts = false,
}) {
  const provider = PROVIDERS[providerKey];
  const status = integration?.status ?? "not_connected";
  const canDisconnect = integration?.connected || disconnectStatuses.has(status);
  const canLoadAccounts = supportsAccounts && accountSelectionStatuses.has(status);
  const primaryActionLoadsAccounts =
    supportsAccounts && (status === "incomplete" || status === "needs_account_selection");
  const isPrimaryLoading = primaryActionLoadsAccounts ? isLoadingAccounts : isConnecting;
  const isShopify = providerKey === PROVIDER_KEYS.shopify;

  return (
    <Card className="ms-integration-card flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon providerLogoKey={providerKey} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-950 dark:text-slate-50">{provider.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {PROVIDER_SUBTITLES[providerKey] ?? provider.key}
            </p>
          </div>
        </div>
        <Badge status={status} />
      </div>

      <dl className="ms-integration-details mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Connessione</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-100">{getStatusText(integration)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Collegata il</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
            {formatDateTime(integration?.connectedAt)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Ultimo aggiornamento</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
            {formatDateTime(integration?.lastSyncAt)}
          </dd>
        </div>
      </dl>

      {integration?.accountInfo?.displayName ? (
        <div className="ms-integration-account mt-4 space-y-1 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
          <div className="flex items-baseline gap-1.5">
            <span className="flex-none text-slate-500 dark:text-slate-400">
              {isShopify ? "Store:" : "Account:"}
            </span>
            <span className="truncate font-medium text-slate-800 dark:text-slate-200">
              {integration.accountInfo.displayName}
            </span>
          </div>
          {integration.accountInfo.businessName ? (
            <div className="flex items-baseline gap-1.5">
              <span className="flex-none text-slate-500 dark:text-slate-400">Azienda:</span>
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                {integration.accountInfo.businessName}
              </span>
            </div>
          ) : null}
          {integration.accountInfo.parentManagerId && !isShopify ? (
            <div className="flex items-baseline gap-1.5">
              <span className="flex-none text-slate-500 dark:text-slate-400">Account manager:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {integration.accountInfo.parentManagerId}
              </span>
            </div>
          ) : null}
          {isShopify && integration.accountInfo.myshopifyDomain ? (
            <div className="flex items-baseline gap-1.5">
              <span className="flex-none text-slate-500 dark:text-slate-400">Indirizzo store:</span>
              <span className="break-all font-medium text-slate-800 dark:text-slate-200">
                {integration.accountInfo.myshopifyDomain}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {integration?.lastError?.message ? (
        <div className="ms-alert-box mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200">
          {integration.lastError.message}
        </div>
      ) : null}

      {isShopify ? (
        <div className="ms-integration-shop mt-5">
          <Input
            error={shopDomainError}
            id="shopify-shop-domain"
            label="Nome store Shopify"
            onChange={(event) => onShopDomainChange(event.target.value)}
            placeholder="nome-store.myshopify.com"
            value={shopDomain}
          />
        </div>
      ) : null}

      <div className="ms-integration-actions mt-5 flex flex-wrap gap-2">
        <Button
          disabled={isPrimaryLoading}
          isLoading={isPrimaryLoading}
          onClick={primaryActionLoadsAccounts ? onLoadAccounts : onConnect}
          size="sm"
        >
          {isPrimaryLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : primaryActionLoadsAccounts ? (
            <ListChecks className="h-4 w-4" aria-hidden="true" />
          ) : status === "connected" ? (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden="true" />
          )}
          {getConnectLabel(status, supportsAccounts)}
        </Button>

        {canLoadAccounts && !primaryActionLoadsAccounts ? (
          <Button
            disabled={isLoadingAccounts}
            isLoading={isLoadingAccounts}
            onClick={onLoadAccounts}
            size="sm"
            variant="secondary"
          >
            {isLoadingAccounts ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ListChecks className="h-4 w-4" aria-hidden="true" />
            )}
            Scegli account
          </Button>
        ) : null}

        {canDisconnect ? (
          <Button
            disabled={isDisconnecting}
            isLoading={isDisconnecting}
            onClick={onDisconnect}
            size="sm"
            variant="danger"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Unplug className="h-4 w-4" aria-hidden="true" />
            )}
            Disconnetti
          </Button>
        ) : null}
      </div>

      {providerKey === PROVIDER_KEYS.google_ads ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          MarketSync legge solo i dati necessari per mostrarti KPI e report. Non modifica campagne, budget, annunci, keyword, audience o impostazioni. Puoi disconnettere Google Ads in qualsiasi momento.
        </p>
      ) : null}

      {provider.route ? (
        <Link
        className="ms-integration-link mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
          to={provider.route}
        >
          Apri sezione dati
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}

      {accountsPanel ? <div className="ms-integration-accounts-panel mt-5">{accountsPanel}</div> : null}
    </Card>
  );
}
