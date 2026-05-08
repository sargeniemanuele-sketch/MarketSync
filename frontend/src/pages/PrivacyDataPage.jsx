import {
  Database,
  ShieldCheck,
} from "lucide-react";
import BackButton from "../components/ui/BackButton.jsx";
import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { APP_ROUTES } from "../utils/constants.js";

const accountDataItems = [
  "Dati profilo",
  "Clienti creati",
  "Preferenze dashboard",
  "Preferenze aspetto",
  "Integrazioni collegate",
  "Dati tecnici di sistema per il funzionamento dell'app",
];

function SettingBlock({ children, description, icon: Icon, title }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
      </div>
      {children ? <div className="ms-setting-body mt-6">{children}</div> : null}
    </Card>
  );
}

export default function PrivacyDataPage() {
  return (
    <div className="ms-page-stack max-w-6xl space-y-8">
      <PageHeader
        actions={
          <BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />
        }
        description="Gestisci informazioni, preferenze locali e dati associati all'account."
        title="Privacy e dati"
      />

      <SettingBlock
        description="MarketSync usa le integrazioni in sola lettura: visualizza KPI e dati collegati, senza modificare campagne, account pubblicitari o configurazioni delle piattaforme."
        icon={ShieldCheck}
        title="Accesso in sola lettura"
      />

      <SettingBlock
        description="L'account può contenere informazioni applicative e riferimenti necessari alla configurazione dell'esperienza."
        icon={Database}
        title="Dati account"
      >
        <ul className="ms-card-grid grid gap-3 sm:grid-cols-2">
          {accountDataItems.map((item) => (
            <li
              className="ms-panel rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      </SettingBlock>
    </div>
  );
}
