import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";

import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import he from "./he.json";

const LANGUAGE_STORAGE_KEY = "voicequote_language";

const RTL_LANGUAGES = ["he", "ar"];

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "he", label: "Hebrew", nativeLabel: "עברית" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
];

/**
 * Get the persisted language or detect from device locale.
 */
export async function getStoredLanguage(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
      return stored;
    }
  } catch {}

  // Fallback: detect from device locale
  const deviceLocale = Localization.getLocales()?.[0]?.languageCode || "en";
  if (SUPPORTED_LANGUAGES.some((l) => l.code === deviceLocale)) {
    return deviceLocale;
  }
  return "en";
}

/**
 * Persist language choice.
 */
export async function storeLanguage(lang: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {}
}

/**
 * Apply RTL settings based on language code.
 */
export function applyRTL(lang: string): boolean {
  const isRTL = RTL_LANGUAGES.includes(lang);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    return true; // needs restart
  }
  return false;
}

/**
 * Change the app language. Returns true if a restart is needed (RTL change).
 */
export async function changeLanguage(lang: string): Promise<boolean> {
  await i18n.changeLanguage(lang);
  await storeLanguage(lang);
  const needsRestart = applyRTL(lang);
  return needsRestart;
}

/**
 * Initialize i18n. Call this before rendering the app.
 */
export async function initI18n(): Promise<void> {
  const lang = await getStoredLanguage();

  // Apply RTL immediately on startup (no restart needed on first launch)
  applyRTL(lang);

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      de: { translation: de },
      he: { translation: he },
      ar: { translation: ar },
      es: { translation: es },
    },
    lng: lang,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: "v4",
  });
}

export default i18n;
