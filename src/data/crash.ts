// Absturzberichte – Browser (Vorschau, Web-Fassung): keine. Die App-Fassung mit Sentry steht in crash.native.ts
// (gleiche Exporte).

/** Sind Absturzberichte eingerichtet (Sentry-DSN vorhanden)? */
export const crashAvailable = false;
/** Absturzberichte ein- oder ausschalten (nur mit Zustimmung auf diesem Gerät) */
export function startCrashReports(_on: boolean): void { /* im Browser keine Absturzberichte */ }
/** Geöffnete Seite für den nächsten Bericht merken (ohne IDs) */
export function crashPage(_path: string): void { /* im Browser keine Absturzberichte */ }
