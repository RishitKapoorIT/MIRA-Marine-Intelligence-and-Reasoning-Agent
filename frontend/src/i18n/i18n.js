import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import hiTranslation from './locales/hi.json';
import knTranslation from './locales/kn.json';

/**
 * Scope note (Part D):
 * This provides immediate UI-string internationalization across all navigation,
 * badges, cards, forms, and alerts in English, Hindi, and Kannada.
 * It does NOT replace natural-language chat understanding or species taxonomic names,
 * which are scoped under dedicated FR-A2/A6 Sarvam/Bhashini integrations.
 */

const savedLanguage = localStorage.getItem('orca_language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation },
      kn: { translation: knTranslation },
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export const changeLanguage = (lng) => {
  i18n.changeLanguage(lng);
  localStorage.setItem('orca_language', lng);
};

export default i18n;
