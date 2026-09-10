'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, getTranslation, translations } from '@/lib/i18n';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('lena_dena_lang') as Language;
        if (saved && (saved === 'en' || saved === 'hi' || saved === 'bn')) {
          setLangState(saved);
        }
      }
    } catch {
      // Storage restricted or disabled (e.g. older Safari private mode)
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lena_dena_lang', newLang);
      }
    } catch {
      // Storage restricted or disabled
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: getTranslation(lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
