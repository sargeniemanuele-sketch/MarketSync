import { CheckCircle2, Plug, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AccountSelectionList from "../components/integrations/AccountSelectionList.jsx";
import IntegrationCard from "../components/integrations/IntegrationCard.jsx";
import ClientSelector from "../components/dashboard/ClientSelector.jsx";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ConfirmModal from "../components/ui/ConfirmModal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorMessage from "../components/ui/ErrorMessage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import useAppData from "../hooks/useAppData.js";
import useIntegrations from "../hooks/useIntegrations.js";
import {
  APP_ROUTES,
  APP_STORAGE_KEYS,
  PROVIDER_KEYS,
  PROVIDERS,
} from "../utils/constants.js";
import { normalizeProviderSlug } from "../utils/providers.js";

const providerKeys = [PROVIDER_KEYS.shopify, PROVIDER_KEYS.meta_ads, PROVIDER_KEYS.google_ads];
const accountProviderKeys = new Set([PROVIDER_KEYS.meta_ads, PROVIDER_KEYS.google_ads]);
const shopifyDomainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\.myshopify\.com)?$/;
const integrationReturnTtlMs = 15 * 60 * 1000;

function getProviderLabel(providerKey) {
  return PROVIDERS[providerKey]?.label ?? providerKey;
}

function getCallbackMessage(status, providerKey) {
  if (!status || !providerKey) {
    return null;
  }

  const providerLabel = getProviderLabel(providerKey);

  if (status === "connected") {
    return {
      tone: "success",
      message: `${providerLabel} collegato. Se hai più account disponibili, seleziona quello da usare.`,
    };
  }

  if (status === "needs_account_selection" || status === "incomplete") {
    return {
      tone: "success",
      message: `${providerLabel} collegato. Scegli l'account da usare per questo cliente.`,
    };
  }

  if (status === "error") {
    return {
      tone: "error",
      message: `Collegamento ${providerLabel} non riuscito. Riprova.`,
    };
  }

  return null;
}

function getPostCallbackAccountLoadError(providerKey, message) {
  if (!providerKey || !message) {
    return null;
  }

  if (providerKey === PROVIDER_KEYS.google_ads) {
    return message;
  }

  return `${getProviderLabel(providerKey)} collegato, ma non è possibile caricare gli account. ${message}`;
}

function readIntegrationReturn() {
  try {
    const raw = window.sessionStorage.getItem(APP_STORAGE_KEYS.integrationReturn);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const isFresh =
      typeof parsed?.createdAt === "number" &&
      Date.now() - parsed.createdAt <= integrationReturnTtlMs;

    if (!parsed?.provider || !parsed?.clientId || !parsed?.returnTo || !isFresh) {
      window.sessionStorage.removeItem(APP_STORAGE_KEYS.integrationReturn);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clearIntegrationReturn() {
  try {
    window.sessionStorage.removeItem(APP_STORAGE_KEYS.integrationReturn);
  } catch {
    // Session storage is only used to resume the UX after OAuth.
  }
}

function getMatchingIntegrationReturn(providerKey, clientId) {
  const pendingReturn = readIntegrationReturn();

  if (
    pendingReturn?.provider === providerKey &&
    pendingReturn?.clientId === String(clientId)
  ) {
    return pendingReturn;
  }

  return null;
}

export default function IntegrationsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const callbackProvider = normalizeProviderSlug(searchParams.get("provider"));
  const callbackStatus = searchParams.get("status");
  const {
    bootstrapError,
    hasClients,
    isBootstrapLoading,
    selectedClient,
    selectedClientId,
  } = useAppData();
  const {
    accounts,
    connectProvider,
    connectingProvider,
    disconnectingProvider,
    disconnectProvider,
    error,
    fetchIntegrations,
    integrations,
    isLoading,
    loadProviderAccounts,
    loadingAccountsProvider,
    selectAccount,
    selectingAccountRef,
    successMessage,
  } = useIntegrations({ clientId: selectedClientId });
  const [disconnectCandidate, setDisconnectCandidate] = useState(null);
  const [shopDomain, setShopDomain] = useState("");
  const [shopDomainError, setShopDomainError] = useState(null);
  const [visibleAccountPanels, setVisibleAccountPanels] = useState({});
  const [postCallbackAccountLoadError, setPostCallbackAccountLoadError] = useState(null);
  const autoLoadedAccountsRef = useRef(null);

  useEffect(() => {
    setShopDomain("");
    setShopDomainError(null);
    setVisibleAccountPanels({});
    setPostCallbackAccountLoadError(null);
  }, [selectedClientId]);

  const displayedIntegrations = useMemo(
    () => ({
      ...(selectedClient?.integrations ?? {}),
      ...(integrations ?? {}),
    }),
    [integrations, selectedClient?.integrations],
  );
  const connectedCount = providerKeys.filter(
    (providerKey) => displayedIntegrations[providerKey]?.status === "connected",
  ).length;
  const callbackMessage = getCallbackMessage(
    callbackStatus,
    callbackProvider,
  );

  useEffect(() => {
    if (
      !["connected", "needs_account_selection", "incomplete"].includes(callbackStatus) ||
      !callbackProvider ||
      !selectedClientId ||
      !accountProviderKeys.has(callbackProvider)
    ) {
      return;
    }

    const autoLoadKey = `${selectedClientId}:${callbackProvider}:${callbackStatus}`;

    if (autoLoadedAccountsRef.current === autoLoadKey) {
      return;
    }

    autoLoadedAccountsRef.current = autoLoadKey;
    setVisibleAccountPanels((current) => ({ ...current, [callbackProvider]: true }));
    setPostCallbackAccountLoadError(null);
    loadProviderAccounts(callbackProvider).catch((error) => {
      setPostCallbackAccountLoadError(
        getPostCallbackAccountLoadError(callbackProvider, error?.message),
      );
    });
  }, [callbackProvider, callbackStatus, loadProviderAccounts, selectedClientId]);

  async function handleConnect(providerKey) {
    if (providerKey === PROVIDER_KEYS.shopify) {
      const normalizedShopDomain = shopDomain.trim().toLowerCase();

      if (!normalizedShopDomain) {
        setShopDomainError("Inserisci il nome del tuo store Shopify.");
        return;
      }

      if (!shopifyDomainPattern.test(normalizedShopDomain)) {
        setShopDomainError("Inserisci il nome del tuo store Shopify, ad esempio: nome-store o nome-store.myshopify.com.");
        return;
      }

      setShopDomainError(null);
      const shop = normalizedShopDomain.includes(".")
        ? normalizedShopDomain
        : `${normalizedShopDomain}.myshopify.com`;

      try {
        await connectProvider(providerKey, { shop });
      } catch {
        // L'hook espone gia un errore leggibile nella pagina.
      }
      return;
    }

    try {
      await connectProvider(providerKey);
    } catch {
      // L'hook espone gia un errore leggibile nella pagina.
    }
  }

  async function handleLoadAccounts(providerKey) {
    setVisibleAccountPanels((current) => ({ ...current, [providerKey]: true }));
    setPostCallbackAccountLoadError(null);

    try {
      await loadProviderAccounts(providerKey);
    } catch {
      // L'hook espone gia un errore leggibile nella pagina.
    }
  }

  async function handleSelectAccount(providerKey, account) {
    try {
      const pendingReturn = getMatchingIntegrationReturn(providerKey, selectedClientId);

      await selectAccount(providerKey, {
        accountLabel: account.label,
        externalRef: account.externalRef,
        managerCustomerId: account.managerCustomerId,
        accountInfo: {
          displayName:     account.label           ?? null,
          businessName:    account.businessName    ?? null,
          businessId:      account.businessId      ?? null,
          parentManagerId: account.parentManagerId ?? null,
          currency:        account.currency        ?? null,
          timezone:        account.timezone        ?? null,
        },
      });

      if (pendingReturn?.returnTo) {
        clearIntegrationReturn();
        navigate(pendingReturn.returnTo, { replace: true });
      }
    } catch {
      // L'hook espone gia un errore leggibile nella pagina.
    }
  }

  async function handleConfirmDisconnect() {
    if (!disconnectCandidate) {
      return;
    }

    try {
      await disconnectProvider(disconnectCandidate);
    } catch {
      // L'hook espone gia un errore leggibile nella pagina.
    } finally {
      setDisconnectCandidate(null);
    }
  }

  return (
    <div className="ms-page-stack space-y-6">
      <PageHeader
        actions={
          <>
            <BackButton fallbackTo={APP_ROUTES.dashboard} />
            <Button
              disabled={!selectedClientId || isLoading}
              isLoading={isLoading}
              onClick={fetchIntegrations}
              variant="secondary"
            >
              <RefreshCw className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")} aria-hidden="true" />
              Aggiorna
            </Button>
          </>
        }
        description="Collega Shopify, Meta Ads e Google Ads al cliente selezionato e scegli l'account da usare quando necessario."
        eyebrow="Piattaforme esterne"
        meta={
          <>
            <Badge tone="neutral">{connectedCount}/3 connessi</Badge>
            {selectedClient ? <Badge tone="neutral">{selectedClient.name}</Badge> : null}
          </>
        }
        title="Integrazioni"
      />

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-end">
          <ClientSelector id="integrations-client-selector" />
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            Le modifiche si applicano solo al cliente selezionato.
          </p>
        </div>
      </Card>

      {isBootstrapLoading ? (
        <Card>
          <Spinner label="Caricamento integrazioni" />
        </Card>
      ) : null}

      {!isBootstrapLoading && bootstrapError ? (
        <ErrorMessage message={bootstrapError} title="Integrazioni non disponibili" />
      ) : null}

      {!isBootstrapLoading && !bootstrapError && !hasClients ? (
        <EmptyState
          action={
            <Button as={Link} to={APP_ROUTES.clients}>
              Vai ai clienti
            </Button>
          }
          description="Crea almeno un cliente prima di collegare le piattaforme esterne."
          icon={Plug}
          title="Nessun cliente disponibile"
        />
      ) : null}

      {!isBootstrapLoading && !bootstrapError && hasClients && !selectedClient ? (
        <EmptyState
          description="Seleziona un cliente per vedere e modificare lo stato delle integrazioni."
          icon={Plug}
          title="Nessun cliente selezionato"
        />
      ) : null}

      {callbackMessage?.tone === "success" && !postCallbackAccountLoadError && !error ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
            <p className="text-sm">{callbackMessage.message}</p>
          </div>
        </div>
      ) : null}

      {callbackMessage?.tone === "error" ? (
        <ErrorMessage message={callbackMessage.message} title="Collegamento non completato" />
      ) : null}

      {postCallbackAccountLoadError ? (
        <ErrorMessage
          message={postCallbackAccountLoadError}
          title="Account non caricati"
        />
      ) : error ? (
        <ErrorMessage message={error} title="Operazione integrazione non riuscita" />
      ) : null}

      {successMessage && callbackMessage?.tone !== "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
          {successMessage}
        </div>
      ) : null}

      {!isBootstrapLoading && !bootstrapError && selectedClient ? (
        <>
          {isLoading ? (
            <Card>
              <Spinner label="Aggiornamento stato piattaforme" />
            </Card>
          ) : null}

          <div className="ms-card-grid grid gap-4 xl:grid-cols-3">
            {providerKeys.map((providerKey) => {
              const supportsAccounts = accountProviderKeys.has(providerKey);
              const showAccountsPanel =
                supportsAccounts &&
                (visibleAccountPanels[providerKey] || loadingAccountsProvider === providerKey);

              return (
                <IntegrationCard
                  accountsPanel={
                    showAccountsPanel ? (
                      <AccountSelectionList
                        accounts={(accounts[providerKey] ?? []).map((account) => ({
                          ...account,
                          provider: providerKey,
                        }))}
                        emptyDescription={
                          providerKey === PROVIDER_KEYS.google_ads
                            ? "Nessun account Google Ads disponibile per questo utente. Verifica che questo account Google abbia accesso a un account Google Ads."
                            : undefined
                        }
                        emptyTitle={
                          providerKey === PROVIDER_KEYS.google_ads
                            ? "Nessun account Google Ads disponibile"
                            : undefined
                        }
                        isLoading={loadingAccountsProvider === providerKey}
                        onSelect={(account) => handleSelectAccount(providerKey, account)}
                        selectingAccountRef={selectingAccountRef}
                      />
                    ) : null
                  }
                  integration={displayedIntegrations[providerKey]}
                  isConnecting={connectingProvider === providerKey}
                  isDisconnecting={disconnectingProvider === providerKey}
                  isLoadingAccounts={loadingAccountsProvider === providerKey}
                  key={providerKey}
                  onConnect={() => handleConnect(providerKey)}
                  onDisconnect={() => setDisconnectCandidate(providerKey)}
                  onLoadAccounts={() => handleLoadAccounts(providerKey)}
                  onShopDomainChange={(value) => {
                    setShopDomain(value);
                    setShopDomainError(null);
                  }}
                  providerKey={providerKey}
                  shopDomain={shopDomain}
                  shopDomainError={shopDomainError}
                  supportsAccounts={supportsAccounts}
                />
              );
            })}
          </div>
        </>
      ) : null}

      <ConfirmModal
        confirmLabel="Disconnetti"
        description={
          disconnectCandidate
            ? `Vuoi scollegare ${getProviderLabel(disconnectCandidate)} dal cliente selezionato? I dati salvati verranno rimossi e i KPI non saranno più disponibili.`
            : ""
        }
        isOpen={Boolean(disconnectCandidate)}
        isSubmitting={Boolean(disconnectCandidate && disconnectingProvider === disconnectCandidate)}
        onCancel={() => setDisconnectCandidate(null)}
        onConfirm={handleConfirmDisconnect}
        title="Disconnetti integrazione"
        variant="danger"
      />
    </div>
  );
}
