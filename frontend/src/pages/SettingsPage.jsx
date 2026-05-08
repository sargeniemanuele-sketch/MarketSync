import { ArrowRight, Database, Gauge, KeyRound, Palette, UserCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../components/ui/Badge.jsx";
import BackButton from "../components/ui/BackButton.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { APP_ROUTES } from "../utils/constants.js";

const accountSettings = [
  {
    action: "Apri profilo",
    description: "Gestisci nome, nickname, bio e informazioni del tuo account.",
    icon: UserCircle,
    title: "Profilo",
    to: APP_ROUTES.profile,
  },
];

const appSettings = [
  {
    action: "Apri preferenze",
    description: "Cliente predefinito, periodo iniziale e visualizzazione dashboard.",
    icon: Gauge,
    title: "Preferenze dashboard",
    to: APP_ROUTES.dashboardPreferences,
  },
  {
    action: "Apri aspetto",
    description: "Tema, densità e preferenze visive dell’app.",
    icon: Palette,
    title: "Aspetto",
    to: APP_ROUTES.appearancePreferences,
  },
];

const dataSettings = [
  {
    action: "Apri privacy",
    description: "Esportazione, eliminazione account e gestione dei dati.",
    icon: Database,
    title: "Privacy e dati",
    to: APP_ROUTES.privacyData,
  },
  {
    action: "Apri accessi",
    description: "Panoramica delle piattaforme collegate e accessi in sola lettura.",
    icon: KeyRound,
    title: "Permessi e accessi",
    to: APP_ROUTES.permissionsAccess,
  },
];

function SettingsSection({ items, title }) {
  return (
    <section className="ms-section space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">{title}</h2>
      <div className="ms-card-grid grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <SettingsCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

function SettingsCard({ item }) {
  const Icon = item.icon;
  const isInteractive = Boolean(item.to);

  if (isInteractive) {
    return (
      <Card
        as={Link}
        className="group block transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 dark:hover:border-brand-500/40 dark:hover:shadow-none dark:focus-visible:ring-offset-slate-950"
        to={item.to}
      >
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3">
            <Button as="span" size="sm" variant="secondary">
              {item.action}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-50/70 text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">{item.title}</h3>
              <Badge tone="neutral">In arrivo</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="ms-page-stack max-w-5xl space-y-8">
      <PageHeader
        actions={<BackButton fallbackTo={APP_ROUTES.dashboard} />}
        description="Gestisci account, preferenze e configurazioni dell’app."
        title="Impostazioni"
      />

      <SettingsSection items={accountSettings} title="Account" />
      <SettingsSection items={appSettings} title="App" />
      <SettingsSection items={dataSettings} title="Dati" />
    </div>
  );
}
