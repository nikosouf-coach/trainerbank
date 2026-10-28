# Trainerbank einrichten und veröffentlichen

Diese Anleitung führt dich vom Code im GitHub-Repository bis zur App im App Store und bei Google Play.
Alles, was sich automatisieren lässt, ist vorbereitet. Du legst die Konten an, trägst Schlüssel ein und klickst die
Workflows an. Rechne für den ersten Durchgang mit zwei bis drei Stunden, verteilt auf ein paar Tage (Apple und Google
prüfen Konten und Apps). Nur der allererste Build braucht einmal einen Rechner mit Terminal (Schritt 7).

> Preise und Bedingungen ändern sich. Die Angaben unten sind ein Richtwert – auf den jeweiligen Seiten prüfen.
> Passwörter, Tokens und Schlüssel gehören nur in GitHub bzw. Expo, nie in Chats oder E-Mails.

---

## 1. Konten anlegen

| Konto | Wofür | Kosten (Richtwert) |
|---|---|---|
| GitHub | Code, automatische Tests und Deploys | vorhanden |
| [Supabase](https://supabase.com) | Datenbank, Anmeldung, Dateien, Server-Funktionen | Pro-Tarif ca. 25 US-$/Monat (tägliche Backups; der kostenlose Tarif pausiert nach einer Woche ohne Nutzung) |
| [Expo](https://expo.dev) | App-Builds in der Cloud (EAS), Updates ohne Store-Prüfung, Push-Versand | kostenloser Tarif reicht für den Start |
| [Sentry](https://sentry.io) | Absturzberichte (nur mit Zustimmung der Nutzer) | kostenloser Tarif reicht für den Start |
| [Apple Developer Program](https://developer.apple.com/programs/) | App Store, TestFlight | 99 €/Jahr |
| [Google Play Console](https://play.google.com/console) | Google Play | 25 US-$ einmalig |
| [Anthropic Console](https://console.anthropic.com) | KI-Coach und Befund-Auswertung (im Piloten aus) | nach Verbrauch; Tageslimit pro Nutzer ist eingebaut |
| Domain mit kleinem Webspace | Datenschutzerklärung, Impressum, später Website | wenige Euro im Monat |

**Für den Test als Einzelperson, zur Veröffentlichung als Firma.** Für ein Firmenkonto verlangen Apple und Google
eine D-U-N-S-Nummer der Firma (kostenlos, rund eine Woche). Für TestFlight und den geschlossenen Test reicht ein Konto
als Einzelperson; es ist meist in ein bis zwei Tagen frei. Nach der Gründung der Firma (UG): das Google-Konto in der
Play Console auf die Organisation umstellen (braucht D-U-N-S-Nummer und eine bestätigte Website); bei Apple die
Umstellung früh beantragen – sie dauert laut Entwicklerforum teils Monate – oder ein Firmenkonto anlegen und die App
dort veröffentlichen. Wer in der EU Abos verkauft, gilt in den Stores als Händler: Adresse, Telefon und E-Mail stehen
dann öffentlich auf der Produktseite (bei Firmen die Adresse aus der D-U-N-S-Nummer).

**Google Play, privates Konto:** Vor der ersten Veröffentlichung verlangt Google einen geschlossenen Test mit
mindestens 12 Testern, 14 Tage am Stück. Der Pilot erfüllt das, wenn mindestens 12 Android-Nutzer mitmachen; danach in
der Play Console „Zugriff auf Produktion beantragen“ (Prüfung meist bis zu 7 Tage).

---

## 2. Supabase-Projekt anlegen

1. Auf supabase.com eine Organisation anlegen, Tarif **Pro**. Dann **New project** → Name `trainerbank`, Region
   **Central EU (Frankfurt)**, sicheres Datenbank-Passwort erzeugen und im Passwort-Manager speichern.
2. Unter **Project Settings → General** die **Project ID** (Reference ID) notieren.
3. Unter **Project Settings → API** die **Project URL** und den **anon public key** notieren.
4. Unter **Account → Access Tokens** einen Token erzeugen (für GitHub).
5. Unter **Authentication → URL Configuration**:
   - Site URL: deine Website, z. B. `https://trainerbank.de`
   - Redirect URLs: `trainerbank://` hinzufügen
6. Unter **Authentication → Emails** die Absenderadresse und die Texte (Bestätigung, Passwort zurücksetzen) auf
   Deutsch anpassen. Für den echten Betrieb einen eigenen SMTP-Server eintragen, sonst gilt ein niedriges Versandlimit.
7. In den Einstellungen der Organisation den Vertrag zur Auftragsverarbeitung (DPA) anfordern und unterschreiben.

## 3. Schlüssel in GitHub hinterlegen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Wert |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token aus 2.4 |
| `SUPABASE_PROJECT_REF` | Project ID aus 2.2 |
| `SUPABASE_DB_PASSWORD` | Datenbank-Passwort aus 2.1 |
| `CRON_SECRET` | eine lange Zufallszeichenkette (z. B. aus dem Passwort-Manager, 40+ Zeichen) |
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |
| `ANTHROPIC_API_KEY` | erst, wenn der KI-Coach eingeschaltet wird (im Piloten aus) |

Zusätzlich unter dem Reiter **Variables** (nicht Secrets): `EAS_PROJECT_ID` = Projekt-ID aus Schritt 5.

Unter **Settings → Environments** eine Umgebung `production` anlegen (der Backend-Deploy nutzt sie; dort kannst du
eine Freigabe durch dich verlangen).

## 4. Backend einspielen

GitHub → **Actions → Backend deployen → Run workflow**. Der Workflow testet zuerst alle Zugriffsregeln, spielt dann
die Datenbank ein, setzt die Server-Schlüssel und lädt die Server-Funktionen hoch. Danach läuft er bei jeder
Änderung im Ordner `supabase/` automatisch.

Einmalig im Supabase-Dashboard → **SQL Editor**:

```sql
-- Push-Erinnerungen
select vault.create_secret('https://DEINE-PROJECT-ID.supabase.co', 'project_url');
select vault.create_secret('DEIN-CRON-SECRET', 'cron_secret');
-- Betreiber der App (sieht alle Rückmeldungen unter Mehr → Rückmeldungen) – nach deiner Registrierung in der App
insert into public.app_admins (user_id) select id from auth.users where email = 'DEINE-E-MAIL';
```

Prüfen: `select jobname, schedule, active from cron.job;` zeigt `push-reminders`, `purge-stale-health-data` und
`purge-old-feedback`.

## 5. App mit Expo verbinden (im Browser)

1. Auf expo.dev → **Projects → Create a project** → Name `trainerbank`. Die **Projekt-ID** (lange Zeichenkette) ist
   nicht geheim: als GitHub-Variable `EAS_PROJECT_ID` eintragen (Schritt 3) und an Claude schicken – sie wird dann als
   Standard in `app.config.ts` eingetragen, damit der erste Build ohne weitere Einstellung läuft.
2. expo.dev → Projekt **trainerbank** → **Environment variables** für die Umgebungen `preview` und `production`:

| Name | Wert | Sichtbarkeit |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key | Plain text (ist öffentlich, Schutz kommt aus den Zugriffsregeln) |
| `EXPO_PUBLIC_PRIVACY_URL` | Adresse der Datenschutzerklärung | Plain text |
| `EXPO_PUBLIC_IMPRINT_URL` | Adresse des Impressums | Plain text |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN aus Schritt 6 (ohne: keine Absturzberichte) | Plain text |
| `EXPO_PUBLIC_INSTALL_IOS` | öffentlicher TestFlight-Link (Schritt 9) – erscheint als QR-Code beim Einladen | Plain text |
| `EXPO_PUBLIC_INSTALL_ANDROID` | Link zum Test bei Google Play (Schritt 9) | Plain text |
| `EXPO_PUBLIC_INVITE_URL` | optional, sobald die Website Einladungen weiterleitet (z. B. `https://trainerbank.de`); ohne öffnet der Einladungslink direkt die App | Plain text |
| `EAS_PROJECT_ID` | Projekt-ID | Plain text |

Für die Entwicklung auf einem Rechner dieselben Werte in eine Datei `.env` schreiben (Vorlage: `.env.example`).

**Bundle-ID:** voreingestellt ist `de.goatsocceracademy.trainerbank`. Sie lässt sich nach dem ersten Hochladen nicht
mehr ändern. Wenn du eine andere willst (z. B. `de.trainerbank.app`), vorher in `eas.json` (`APP_BUNDLE_ID`) ändern.

## 6. Absturzberichte (Sentry)

1. Auf sentry.io registrieren und bei der Anlage der Organisation als Speicherort **EU** wählen (lässt sich später
   nicht ändern).
2. Projekt **React Native** anlegen und die **DSN** kopieren → als `EXPO_PUBLIC_SENTRY_DSN` bei Expo eintragen
   (Schritt 5). Die DSN ist nicht geheim.
3. Im Projekt unter **Settings → Security & Privacy** „Prevent Storing of IP Addresses“ einschalten; in den
   Einstellungen der Organisation den Vertrag zur Auftragsverarbeitung (DPA) annehmen.

Die App sendet Berichte nur, wenn die Nutzer auf ihrem Gerät zustimmen (Hinweis auf der Startseite, Schalter im
Konto), und ohne Namen, E-Mail- und IP-Adressen, Gesundheitsdaten, Bildschirmfotos und Netzwerkdaten
(`src/data/crash.native.ts`). Später möglich: lesbare Fehlerstellen durch hochgeladene Source Maps (Expo-Plugin von
Sentry und `SENTRY_AUTH_TOKEN` als Secret bei Expo).

## 7. Erste Testversion bauen (einmal am Rechner)

Beim allerersten Build legt EAS die Zertifikate für Apple und den Schlüssel für Android an – dafür fragt es nach
deinem Apple-Konto. Das geht nur einmal interaktiv am Rechner (Windows, Mac oder Linux):

```bash
# Node.js 22 LTS von nodejs.org installieren, dann im Terminal:
git clone https://github.com/nikosouf-coach/trainerbank.git
cd trainerbank
npm ci
npx eas-cli@latest login
npx eas-cli@latest build --platform all --profile production
```

Bei den Fragen jeweils die Vorschläge annehmen (Apple-Anmeldung mit Zwei-Faktor-Code, Zertifikate und Android-Schlüssel
von EAS erzeugen lassen). Danach laufen alle weiteren Builds über GitHub → **Actions → App bauen → Run workflow**
(Plattform, Profil `production`, optional **einreichen**). Ein Build dauert 15–30 Minuten; die Dateien stehen auf
expo.dev unter **Builds**.

## 8. Korrekturen ohne Store-Prüfung (EAS Update)

GitHub → **Actions → App-Update ausliefern → Run workflow** → Kanal `production` (Store und TestFlight) bzw.
`preview` (interne Testversion), kurze Beschreibung. Die Apps laden das Update beim nächsten Start und nutzen es ab dem
Start danach; im Konto zeigt die App die Version mit Datum des Updates und kann von Hand nach Updates suchen.

Das gilt nur für JavaScript und Bilder. Kommt ein neues natives Paket dazu oder ändert sich die native Konfiguration
(Berechtigungen, Plugins), die Version in `app.config.ts` erhöhen (z. B. 1.1.0) und neu bauen – Updates gelten immer
nur für Builds mit derselben Version.

## 9. In die Stores bringen

Alle Texte, Screenshots-Motive, Datenschutz-Angaben und Review-Notizen stehen in [`docs/STORE.md`](docs/STORE.md).

**Vorher:**
1. Datenschutzerklärung ([`docs/DATENSCHUTZERKLAERUNG.md`](docs/DATENSCHUTZERKLAERUNG.md)) und Impressum
   ([`docs/IMPRESSUM-VORLAGE.md`](docs/IMPRESSUM-VORLAGE.md)) ausfüllen – die Platzhalter in eckigen Klammern – und
   auf deiner Website veröffentlichen. Beides von einer Fachperson für Datenschutz prüfen lassen. Google verlangt die
   Datenschutzerklärung schon für den geschlossenen Test.
2. Auftragsverarbeitungsverträge abschließen: Supabase (DPA im Dashboard), Expo (DPA auf expo.dev), Sentry (DPA in der
   Organisation), Anthropic (DPA in der Console, erst mit KI-Coach).
3. Die Datenschutz-Folgenabschätzung ([`docs/DSFA.md`](docs/DSFA.md)) durchgehen und unterschreiben.

**Apple:** App Store Connect → **Apps → +** → Name „Trainerbank“ (falls vergeben: mit Zusatz, z. B. „Trainerbank –
Teamplaner“), Bundle-ID wie oben, SKU `trainerbank`. Die App-ID (Zahl) in `eas.json` bei `ascAppId` eintragen. Dann
GitHub → **App bauen** → Plattform `ios`, Profil `production`, **einreichen** anhaken. Die Version erscheint in
TestFlight. Für den Piloten unter **TestFlight → Externe Tests** eine Gruppe anlegen, den **öffentlichen Link**
einschalten (die erste Version braucht eine kurze Beta-Prüfung durch Apple) und den Link als
`EXPO_PUBLIC_INSTALL_IOS` eintragen. Nach dem Test unter „App Store“ einreichen.

**Google:** Play Console → **App erstellen**. Für das automatische Hochladen ein Dienstkonto anlegen (Anleitung:
expo.dev → Docs → „Submit to Google Play“), die JSON-Datei **nicht** ins Repository legen, sondern bei Expo unter
**Credentials** hochladen. Die erste Version einmal von Hand hochladen, danach geht es über GitHub (`android`,
`production`, einreichen). Für den Piloten unter **Test → Geschlossener Test** eine Testergruppe anlegen, die Tester
über den **Link zur Teilnahme** einladen und ihn als `EXPO_PUBLIC_INSTALL_ANDROID` eintragen.

Für die Prüfung durch Apple und Google: In der App gibt es den Demo-Modus ohne Anmeldung. In den Review-Notizen
(Vorlage in `docs/STORE.md`) zusätzlich ein Testkonto angeben.

## 10. Was automatisch läuft

| Workflow | Wann | Was |
|---|---|---|
| CI | bei jedem Push und Pull Request | Kernlogik-Tests, Datenbank und Zugriffsregeln, TypeScript |
| Backend deployen | bei Änderungen in `supabase/` auf `main` und manuell | Tests, dann Migrationen, Secrets, Server-Funktionen |
| App bauen | manuell | Testversion oder Store-Version, optional mit Einreichung |
| App-Update ausliefern | manuell | Korrekturen ohne Store-Prüfung (Schritt 8) |
| Dependabot | wöchentlich | Vorschläge für Paket-Updates als Pull Request |
| Datenbank (pg_cron) | täglich | Löschfristen (`purge-stale-health-data`, `purge-old-feedback`), Push-Erinnerungen |

Expo-Pakete werden einmal pro SDK-Version gemeinsam aktualisiert, nicht einzeln durch Dependabot. Dafür gibt es den
Workflow **Werkzeug** (Actions → Werkzeug → SDK-Nummer eingeben): Er schreibt die neuen Paketversionen samt
Prüfberichten (TypeScript, expo-doctor, Tests) in einen eigenen Branch, aus dem ein Pull Request wird. Mit „pakete“
fügt er einzelne Expo-Pakete in der passenden Version hinzu (Branch `werkzeug/pakete`, Bericht in
`reports/pakete.txt`). Expo bringt etwa dreimal im Jahr ein neues SDK heraus; ältere SDKs bekommen nur noch eine Zeit
lang Fehlerkorrekturen.

## 11. Checkliste vor dem ersten Release

- [ ] Backend-Workflow grün, `cron.job` zeigt alle drei Jobs
- [ ] Registrierung mit Bestätigungsmail klappt, Team anlegen, Spieler per Team-Code und per QR-Code beitreten
- [ ] Spieler: Einwilligungen, RPE und Morgen-Check eintragen, Push-Erinnerung kommt an
- [ ] Rückmeldung mit Bildschirmfoto senden, unter Mehr → Rückmeldungen erledigen und löschen
- [ ] Absturzberichte einschalten, Testfehler erscheint bei Sentry (ohne Namen und IP-Adresse)
- [ ] Update über „App-Update ausliefern“ kommt nach zwei Starts an (Version im Konto)
- [ ] KI-Coach antwortet, Befund-Auswertung mit Einwilligung funktioniert (erst wenn eingeschaltet)
- [ ] Datenexport und Konto löschen im Bereich Konto getestet
- [ ] Datenschutzerklärung und Impressum online, Adressen in den EAS-Umgebungsvariablen
- [ ] Screenshots erstellt (Motive in `docs/STORE.md`)
- [ ] App-Symbol: Platzhalter in `assets/` durch ein gestaltetes Symbol ersetzen (gleiche Dateinamen und Größen)
