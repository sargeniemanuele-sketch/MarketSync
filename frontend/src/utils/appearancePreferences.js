export const APPEARANCE_PREFERENCES_STORAGE_KEY =
  "marketsync.appearancePreferences.v1";

export const APPEARANCE_THEMES = {
  system: "system",
  light: "light",
  dark: "dark",
};

export const INTERFACE_DENSITIES = {
  comfortable: "comfortable",
  compact: "compact",
};

export const KPI_CARD_STYLES = {
  standard: "standard",
  compact: "compact",
};

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

let systemThemeListenerRegistered = false;

function normalizeEnumValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

export function getDefaultAppearancePreferences() {
  return {
    theme: APPEARANCE_THEMES.system,
    density: INTERFACE_DENSITIES.comfortable,
    kpiCardStyle: KPI_CARD_STYLES.standard,
    reduceMotion: false,
  };
}

export function normalizeAppearancePreferences(value) {
  const defaults = getDefaultAppearancePreferences();
  const source = value && typeof value === "object" ? value : {};

  return {
    theme: normalizeEnumValue(
      source.theme,
      Object.values(APPEARANCE_THEMES),
      defaults.theme,
    ),
    density: normalizeEnumValue(
      source.density,
      Object.values(INTERFACE_DENSITIES),
      defaults.density,
    ),
    kpiCardStyle: normalizeEnumValue(
      source.kpiCardStyle,
      Object.values(KPI_CARD_STYLES),
      defaults.kpiCardStyle,
    ),
    reduceMotion:
      typeof source.reduceMotion === "boolean"
        ? source.reduceMotion
        : defaults.reduceMotion,
  };
}

export function readAppearancePreferences() {
  if (typeof window === "undefined") {
    return getDefaultAppearancePreferences();
  }

  try {
    const rawValue = window.localStorage.getItem(
      APPEARANCE_PREFERENCES_STORAGE_KEY,
    );
    return normalizeAppearancePreferences(rawValue ? JSON.parse(rawValue) : null);
  } catch {
    return getDefaultAppearancePreferences();
  }
}

export function resolveAppearanceTheme(theme) {
  const normalizedTheme = normalizeEnumValue(
    theme,
    Object.values(APPEARANCE_THEMES),
    APPEARANCE_THEMES.system,
  );

  if (normalizedTheme === APPEARANCE_THEMES.dark) {
    return APPEARANCE_THEMES.dark;
  }

  if (normalizedTheme === APPEARANCE_THEMES.light) {
    return APPEARANCE_THEMES.light;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia(COLOR_SCHEME_QUERY).matches
      ? APPEARANCE_THEMES.dark
      : APPEARANCE_THEMES.light;
  }

  return APPEARANCE_THEMES.light;
}

export function applyAppearancePreferences(preferences) {
  const normalizedPreferences = normalizeAppearancePreferences(preferences);

  if (typeof document === "undefined") {
    return normalizedPreferences;
  }

  const resolvedTheme = resolveAppearanceTheme(normalizedPreferences.theme);
  const root = document.documentElement;

  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = normalizedPreferences.theme;
  root.dataset.density = normalizedPreferences.density;
  root.dataset.kpiCardStyle = normalizedPreferences.kpiCardStyle;
  root.dataset.reduceMotion = String(normalizedPreferences.reduceMotion);
  root.classList.toggle("dark", resolvedTheme === APPEARANCE_THEMES.dark);

  return normalizedPreferences;
}

function registerSystemThemeListener() {
  if (
    systemThemeListenerRegistered ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return;
  }

  const mediaQueryList = window.matchMedia(COLOR_SCHEME_QUERY);
  const handleSystemThemeChange = () => {
    const currentPreferences = readAppearancePreferences();

    if (currentPreferences.theme === APPEARANCE_THEMES.system) {
      applyAppearancePreferences(currentPreferences);
    }
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleSystemThemeChange);
  } else if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(handleSystemThemeChange);
  } else {
    return;
  }

  systemThemeListenerRegistered = true;
}

export function initAppearancePreferences() {
  const preferences = readAppearancePreferences();

  applyAppearancePreferences(preferences);
  registerSystemThemeListener();

  return preferences;
}

export function writeAppearancePreferences(preferences) {
  const normalizedPreferences = normalizeAppearancePreferences(preferences);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        APPEARANCE_PREFERENCES_STORAGE_KEY,
        JSON.stringify(normalizedPreferences),
      );
    } catch {
      // La pagina resta utilizzabile anche se il browser blocca localStorage.
    }
  }

  applyAppearancePreferences(normalizedPreferences);

  return normalizedPreferences;
}
