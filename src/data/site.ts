// Website, Kontakt und Anbieter (Impressum): eine Quelle für App und Website. website/build.mjs liest dieselbe Datei
// (site.json) – Änderungen (z. B. neue Anschrift nach der Gründung) gelten damit überall.
import site from "./site.json";

const clean = (u: string | undefined): string => (u || "").trim().replace(/\/+$/, "");

export const APP_NAME = site.app;
/** Adresse der Website (ohne Schrägstrich am Ende) */
export const SITE_URL = clean(site.url);
/** Kontakt für Fragen, Datenschutz-Anliegen und Löschanträge */
export const CONTACT_EMAIL = site.email;
/** Anbieter nach § 5 DDG (Impressum) */
export const PUBLISHER = site.publisher;

/** Feste Seiten der Website; Datenschutz und Impressum lassen sich per Umgebungsvariable umlenken */
export const LEGAL_URLS = {
  privacy: clean(process.env.EXPO_PUBLIC_PRIVACY_URL) || `${SITE_URL}/datenschutz`,
  imprint: clean(process.env.EXPO_PUBLIC_IMPRINT_URL) || `${SITE_URL}/impressum`,
  deleteAccount: `${SITE_URL}/konto-loeschen`,
  help: `${SITE_URL}/hilfe`,
};

/** Installationslinks der Testversion bzw. der Stores aus site.json (Umgebungsvariablen haben Vorrang) */
export const SITE_INSTALL = site.install;
