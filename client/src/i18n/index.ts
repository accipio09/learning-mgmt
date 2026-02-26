import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import de from "./locales/de.json";
import ru from "./locales/ru.json";
import ja from "./locales/ja.json";
import uk from "./locales/uk.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import vi from "./locales/vi.json";

// Day-of-week → language code mapping
const DAY_LANGUAGE_MAP: Record<number, string> = {
  0: "vi", // Sunday
  1: "de", // Monday
  2: "ru", // Tuesday
  3: "ja", // Wednesday
  4: "uk", // Thursday
  5: "es", // Friday
  6: "fr", // Saturday
};

export function getTodayLanguage(): string {
  return DAY_LANGUAGE_MAP[new Date().getDay()];
}

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    ru: { translation: ru },
    ja: { translation: ja },
    uk: { translation: uk },
    es: { translation: es },
    fr: { translation: fr },
    vi: { translation: vi },
  },
  lng: getTodayLanguage(),
  fallbackLng: false,
  interpolation: { escapeValue: false },
});

export default i18n;
