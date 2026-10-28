// Absturzberichte – App (iOS/Android) über Sentry, Speicherort EU. Nur mit Zustimmung auf diesem Gerät (Konto bzw. Hinweis
// auf der Startseite) und nur, wenn EXPO_PUBLIC_SENTRY_DSN gesetzt ist. Gesendet werden Fehler mit Stelle im Code,
// App-Version, Gerät, Betriebssystem und die zuletzt geöffneten Seiten (ohne IDs) – keine Namen, E-Mail- oder IP-Adressen,
// keine Bildschirmfotos, keine Konsolen- und Netzwerkdaten. Gleiche Exporte wie crash.ts (Browser).
import * as Sentry from "@sentry/react-native";
import { appInfo } from "./release";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || "";
export const crashAvailable = !!DSN;
let started = false;

export function startCrashReports(on: boolean): void {
  if (!DSN) return;
  if (on && !started) {
    const a = appInfo();
    Sentry.init({
      dsn: DSN,
      environment: a.channel || "development",
      release: `trainerbank@${a.version}${a.build ? "+" + a.build : ""}`,
      dist: a.build || undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableUserInteractionTracing: false,
      enableAutoSessionTracking: true,
      maxBreadcrumbs: 20,
      // nur die eigenen Seiten-Einträge (keine Konsole, keine Netzwerk-Anfragen mit Adressen und IDs)
      beforeBreadcrumb: b => b.category === "page" ? b : null,
      beforeSend: e => {
        delete e.user; delete e.request;
        const dev = e.contexts?.device as { name?: unknown } | undefined;
        if (dev) delete dev.name;
        return e;
      },
    });
    if (a.updateId) Sentry.setTag("update", a.updateId.slice(0, 8));
    started = true;
  } else if (!on && started) {
    started = false;
    Sentry.close().catch(() => undefined);
  }
}

export function crashPage(path: string): void {
  if (started && path) Sentry.addBreadcrumb({ category: "page", message: path, level: "info" });
}
