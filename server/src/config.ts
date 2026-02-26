import path from "path";
import dotenv from "dotenv";

// Project root is one level up from server/
const PROJECT_ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  briefsDir: path.resolve(process.env.BRIEFS_DIR || path.join(PROJECT_ROOT, "briefs")),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  dbPath: path.join(PROJECT_ROOT, "data", "learning-mgmt.db"),
};

// Day-of-week → language mapping
const LANGUAGE_MAP: Record<number, string> = {
  0: "vi", // Sunday
  1: "de", // Monday
  2: "ru", // Tuesday
  3: "ja", // Wednesday
  4: "uk", // Thursday
  5: "es", // Friday
  6: "fr", // Saturday
};

const LANGUAGE_NAMES: Record<string, string> = {
  de: "German",
  ru: "Russian",
  ja: "Japanese",
  uk: "Ukrainian",
  es: "Spanish",
  fr: "French",
  vi: "Vietnamese",
};

export function getLanguageForDate(date: Date): string {
  return LANGUAGE_MAP[date.getDay()];
}

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}
