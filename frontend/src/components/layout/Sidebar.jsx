import {
  AlertTriangle,
  LayoutDashboard,
  Plug,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { APP_NAME, APP_ROUTES } from "../../utils/constants.js";
import useAppData from "../../hooks/useAppData.js";
import ClientSelector from "../dashboard/ClientSelector.jsx";
import ProviderIcon from "../providers/ProviderIcon.jsx";

const navigationItems = [
  { label: "Dashboard", to: APP_ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Shopify", to: APP_ROUTES.shopify, providerKey: "shopify" },
  { label: "Meta Ads", to: APP_ROUTES.meta_ads, providerKey: "meta_ads" },
  { label: "Google Ads", to: APP_ROUTES.google_ads, providerKey: "google_ads" },
  { label: "Clienti", to: APP_ROUTES.clients, icon: Users },
  { label: "Integrazioni", to: APP_ROUTES.integrations, icon: Plug },
  { label: "Metriche Custom", to: APP_ROUTES.customMetrics, icon: SlidersHorizontal },
  { label: "Impostazioni", to: APP_ROUTES.settings, icon: Settings },
];

export default function Sidebar() {
  const { bootstrapError, hasClients, isBootstrapLoading } = useAppData();

  return (
    <aside className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r lg:border-slate-800">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-slate-800 px-4 lg:px-5">
          <NavLink to={APP_ROUTES.dashboard} className="flex items-center gap-3">
            <img src="/brand/marketsync-icon.png" alt="" className="h-9 w-9 rounded-md" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-normal text-white">{APP_NAME}</span>
          </NavLink>
        </div>
        <div className="border-b border-slate-800 px-4 py-3 lg:px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Cliente attivo
            </span>
            <NavLink
              className="text-xs font-medium text-brand-300 transition hover:text-brand-100"
              to={APP_ROUTES.clients}
            >
              Vai ai clienti
            </NavLink>
          </div>
          <div className="mt-2">
            <ClientSelector
              aria-label="Cliente attivo"
              className="text-sm"
              label=""
              variant="sidebar"
            />
          </div>
          {isBootstrapLoading ? (
            <p className="mt-2 text-xs text-slate-400">Caricamento clienti</p>
          ) : null}
          {!isBootstrapLoading && !hasClients && !bootstrapError ? (
            <p className="mt-2 text-xs text-slate-400">Nessun cliente</p>
          ) : null}
          {bootstrapError ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-200">
              <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              Clienti non disponibili
            </p>
          ) : null}
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4 lg:py-5"
          aria-label="Navigazione principale"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "flex min-w-max items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition lg:min-w-0",
                    isActive
                      ? "bg-white text-slate-950 shadow-sm dark:bg-brand-500/15 dark:text-brand-100 dark:ring-1 dark:ring-inset dark:ring-brand-400/20"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white dark:hover:bg-slate-800",
                  ].join(" ")
                }
              >
                {item.providerKey ? (
                  <ProviderIcon providerLogoKey={item.providerKey} size="sm" />
                ) : (
                  <Icon className="h-4 w-4 flex-none" aria-hidden="true" />
                )}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
