import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  LayoutGrid,
  Monitor,
  Moon,
  Palette,
  Sparkles,
  Sun,
} from "lucide-react";
import { useState } from "react";
import BackButton from "../components/ui/BackButton.jsx";
import Card from "../components/ui/Card.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import SaveButton from "../components/ui/SaveButton.jsx";
import { APP_ROUTES } from "../utils/constants.js";
import {
  APPEARANCE_THEMES,
  INTERFACE_DENSITIES,
  KPI_CARD_STYLES,
  readAppearancePreferences,
  writeAppearancePreferences,
} from "../utils/appearancePreferences.js";

const themeOptions = [
  {
    description: "Segue l'impostazione del dispositivo.",
    icon: Monitor,
    label: "Sistema",
    value: APPEARANCE_THEMES.system,
  },
  {
    description: "Interfaccia chiara per il lavoro quotidiano.",
    icon: Sun,
    label: "Chiaro",
    value: APPEARANCE_THEMES.light,
  },
  {
    description: "Interfaccia scura sui componenti base dell'app.",
    icon: Moon,
    label: "Scuro",
    value: APPEARANCE_THEMES.dark,
  },
];

const densityOptions = [
  {
    description: "Spaziatura più ampia tra controlli e sezioni.",
    label: "Comoda",
    value: INTERFACE_DENSITIES.comfortable,
  },
  {
    description: "Layout più denso per schermate operative.",
    label: "Compatta",
    value: INTERFACE_DENSITIES.compact,
  },
];

const kpiCardStyleOptions = [
  {
    description: "Card complete con gerarchia visuale standard.",
    label: "Standard",
    value: KPI_CARD_STYLES.standard,
  },
  {
    description: "Card più sintetiche per dashboard operative.",
    label: "Compatto",
    value: KPI_CARD_STYLES.compact,
  },
];

function Notice({ message }) {
  if (!message) {
    return null;
  }

  const isSuccess = message.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={[
        "rounded-md border p-4",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200",
      ].join(" ")}
      role={isSuccess ? "status" : "alert"}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <p className="text-sm font-medium">{message.text}</p>
      </div>
    </div>
  );
}

function OptionGroup({ columns = "md:grid-cols-2", label, onChange, options, value }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</legend>
      <div className={["ms-card-grid mt-3 grid gap-3", columns].join(" ")}>
        {options.map((option) => {
          const isSelected = option.value === value;
          const Icon = option.icon;

          return (
            <label
              className={[
                "ms-option-card flex min-h-28 cursor-pointer flex-col rounded-lg border p-4 transition",
                isSelected
                  ? "border-brand-300 bg-brand-50 shadow-sm dark:border-brand-400/40 dark:bg-brand-500/15"
                  : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-500/40 dark:hover:bg-slate-900",
              ].join(" ")}
              key={option.value}
            >
              <input
                checked={isSelected}
                className="sr-only"
                name={label}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  {Icon ? (
                    <span
                      className={[
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-white text-brand-700 dark:bg-brand-500/20 dark:text-brand-200"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {option.label}
                  </span>
                </span>
                <span
                  className={[
                    "h-4 w-4 rounded-full border",
                    isSelected
                      ? "border-brand-600 bg-brand-600 ring-4 ring-brand-100 dark:border-brand-400 dark:bg-brand-400 dark:ring-brand-500/20"
                      : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900",
                  ].join(" ")}
                  aria-hidden="true"
                />
              </span>
              <span className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleField({ checked, description, label, onChange }) {
  return (
    <label className="ms-panel flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
      <span>
        <span className="block text-sm font-semibold text-slate-950 dark:text-slate-50">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description}
        </span>
      </span>
      <input
        checked={checked}
        className="mt-1 h-4 w-4 flex-none rounded border-slate-300 text-brand-600 focus:ring-brand-600 dark:border-slate-600 dark:bg-slate-900"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

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
      <div className="ms-setting-body mt-6">{children}</div>
    </Card>
  );
}

export default function AppearancePreferencesPage() {
  const [message, setMessage] = useState(null);
  const [preferences, setPreferences] = useState(() => readAppearancePreferences());

  function updatePreference(key, value) {
    setMessage(null);
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSave() {
    const savedPreferences = writeAppearancePreferences(preferences);

    setPreferences(savedPreferences);
    setMessage({
      type: "success",
      text: "Preferenze aspetto salvate.",
    });
  }

  return (
    <div className="ms-page-stack max-w-6xl space-y-8">
      <PageHeader
        actions={
          <BackButton label="Torna alle impostazioni" to={APP_ROUTES.settings} />
        }
        description="Configura tema, densità e dettagli visuali salvati su questo dispositivo."
        title="Aspetto"
      />

      <Notice message={message} />

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <p className="text-sm font-medium">
            Le preferenze visuali vengono applicate dopo il salvataggio e restano attive
            anche dopo il refresh.
          </p>
        </div>
      </div>

      <SettingBlock
        description="Scegli la preferenza cromatica da usare quando il supporto grafico sarà completo."
        icon={Palette}
        title="Tema"
      >
        <OptionGroup
          columns="lg:grid-cols-3"
          label="Tema"
          onChange={(value) => updatePreference("theme", value)}
          options={themeOptions}
          value={preferences.theme}
        />
      </SettingBlock>

      <div className="ms-card-grid grid gap-4 lg:grid-cols-2">
        <SettingBlock
          description="Memorizza quanto deve essere ariosa l'interfaccia."
          icon={Gauge}
          title="Densità interfaccia"
        >
          <OptionGroup
            label="Densità interfaccia"
            onChange={(value) => updatePreference("density", value)}
            options={densityOptions}
            value={preferences.density}
          />
        </SettingBlock>

        <SettingBlock
          description="Prepara la preferenza per la resa delle card KPI in dashboard."
          icon={LayoutGrid}
          title="Stile card KPI"
        >
          <OptionGroup
            label="Stile card KPI"
            onChange={(value) => updatePreference("kpiCardStyle", value)}
            options={kpiCardStyleOptions}
            value={preferences.kpiCardStyle}
          />
        </SettingBlock>
      </div>

      <SettingBlock
        description="Riduci gli effetti visuali quando preferisci un'esperienza più stabile."
        icon={Sparkles}
        title="Animazioni UI"
      >
        <ToggleField
          checked={preferences.reduceMotion}
          description="Salva la preferenza per limitare transizioni e animazioni nelle prossime evoluzioni dell'interfaccia."
          label="Riduci animazioni"
          onChange={(value) => updatePreference("reduceMotion", value)}
        />
      </SettingBlock>

      <div className="flex justify-end">
        <SaveButton className="w-full sm:w-auto" label="Salva preferenze" onClick={handleSave} />
      </div>
    </div>
  );
}
