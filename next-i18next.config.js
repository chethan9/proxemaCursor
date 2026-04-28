/** @type {import('next-i18next').UserConfig} */
module.exports = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ar", "es", "fr", "de", "pt", "hi", "zh", "ja", "ru"],
    localeDetection: true,
  },
  localePath: typeof window === "undefined" ? require("path").resolve("./public/locales") : "/locales",
  reloadOnPrerender: process.env.NODE_ENV === "development",
  defaultNS: "common",
  fallbackLng: "en",
};