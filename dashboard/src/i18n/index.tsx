import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { en } from "./en";
import { fr } from "./fr";

type Language = "fr" | "en";

const DICTIONARIES = { fr, en } as const;
const STORAGE_KEY = "bot.language";

function readStored(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    // Ignored: falls back to the browser language.
  }
  return navigator.language.startsWith("en") ? "en" : "fr";
}

function resolve(dictionary: unknown, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      dictionary
    );
  return typeof value === "string" ? value : undefined;
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStored);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this session only.
    }
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: string, variables: Record<string, string | number> = {}) => {
      const template =
        resolve(DICTIONARIES[language], key) ?? resolve(en, key) ?? key;

      return template.replace(/\{(\w+)\}/g, (match, name) =>
        variables[name] !== undefined ? String(variables[name]) : match
      );
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
