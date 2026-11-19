"use client";

import { useCallback, useState } from "react";

import { t, type Dictionary, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "ltb-locale";

/**
 * ES/EN locale hook. Initial render matches SSR; persistence is write-only
 * until a user gesture (avoids hydration mismatch from localStorage).
 */
export function useLocale(initial: Locale = "es"): {
  locale: Locale;
  dict: Dictionary;
  setLocale: (next: Locale) => void;
} {
  const [locale, setLocaleState] = useState<Locale>(initial);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return { locale, dict: t(locale), setLocale };
}
