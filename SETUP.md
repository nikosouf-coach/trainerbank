# Trainerbank einrichten und veröffentlichen

Diese Anleitung führt dich vom Code im GitHub-Repository bis zur App im App Store und bei Google Play.
Alles, was sich automatisieren lässt, ist vorbereitet. Du legst die Konten an, trägst Schlüssel ein und klickst die
Workflows an. Rechne für den ersten Durchgang mit zwei bis drei Stunden, verteilt auf ein paar Tage (Apple und Google
prüfen Konten und Apps).

> Preise und Bedingungen ändern sich. Die Angaben unten sind ein Richtwert – auf den jeweiligen Seiten prüfen.

---

## 1. Konten anlegen

| Konto | Wofür | Kosten (Richtwert) |
|---|---|---|
| GitHub | Code, automatische Tests und Deploys | vorhanden |
| [Supabase](https://supabase.com) | Datenbank, Anmeldung, Dateien, Server-Funktionen | kostenlos zum Testen; für den echten Betrieb Pro-Tarif (ca. 25 US-$/Monat, mit täglichen Backups) |
| [Expo](https://expo.dev) | App-Builds in der Cloud (EAS), Push-Versand | kostenloser Tarif reicht für den Start (begrenzte Builds pro Monat) |
| [Anthropic Console](https://console.anthropic.com) | KI-Coach und Befund-Auswertung | nach Verbrauch; Tageslimit pro Nutzer ist eingebaut |
| [Apple Developer Program](https://developer.apple.com/programs/) | App Store, TestFlight | 99 €/Jahr |
| [Google Play Console](https://play.google.com/console) | Google Play | 25 US-$ einmalig |

**Als Firma (GOAT Soccer Academy) oder als Person?** Für ein Firmenkonto brauchen Apple und Google eine
D-U-N-S-Nummer (kostenlos, Beantragung dauert einige Tage). Im Store steht dann der Firmenname als Anbieter – das
wirkt für Vereine seriöser. Ein persönliches Konto geht schneller, im Store steht dann dein Name.

---

## 2. Supabase-Projekt anlegen

1. Auf supabase.com **New project** → Name `trainerbank`, Region **Central EU (Frankfurt)**, sicheres
   Datenbank-Passwort erzeugen und im Passwort-Manager speichern.
2. Unter **Project Settings → General** die **Project ID** (Reference ID) notieren.
3. Unter **Project Settings → API** die **Project URL** und den **anon public key** notieren.
4. Unter **Account → Access Tokens** einen Token erzeugen (für GitHub).
5. Unter **Authentication → URL Configuration**:
   - Site URL: deine Website, z. B. `https://www.goatsocceracademy.de/trainerbank`
   - Redirect URLs: `trainerbank://` hinzufügen
6. Unter **Authentication → Emails** die Absenderadresse und die Texte (Bestätigung, Passwort zurücksetzen) auf
   Deutsch anpassen. Für den echten Betrieb einen eigenen SMTP-Server eintragen (z. B. das Postfach der Academy),
   sonst gilt ein niedriges Versandlimit.

## 3. Schlüssel in GitHub hinterlegen

GitHub → Repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Wert |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token aus 2.4 |
| `SUPABASE_PROJECT_REF` | Project ID aus 2.2 |
| `SUPABASE_DB_PASSWORD` | Datenbank-Passwort aus 2.1 |
| `ANTHROPIC_API_KEY` | API-Schlüssel aus der Anthropic Console |
| `CRON_SECRET` | eine lange Zufallszeichenkette (z. B. aus dem Passwort-Manager, 40+ Zeichen) |
| `EXPO_TOKEN` | expo.dev → Account settings → Access tokens |

Zusätzlich unter dem Reiter **Variables** (nicht Secrets): `EAS_PROJECT_ID` = Projekt-ID aus Schritt 5.

Unter **Settings → Environments** eine Umgebung `production` anlegen (der Backend-Deploy nutzt sie; dort kannst du
eine Freigabe durch dich verlangen).

## 4. Backend einspielen

GitHub → **Actions → Backend deployen → Run workflow**. Der Workflow testet zuerst alle Zugriffsregeln, spielt dann
die Datenbank ein, setzt die Server-Schlüssel und lädt die vier Server-Funktionen hoch. Danach läuft er bei jeder
Änderung im Ordner `supabase/` automatisch.

Einmalig im Supabase-Dashboard → **SQL Editor** (für die Push-Erinnerungen):

```sql
select vault.create_secret('https://DEINE-PROJECT-ID.supabase.co', 'project_url');
select vault.create_secret('DEIN-CRON-SECRET', 'cron_secret');
```

Prüfen: `select jobname, schedule, active from cron.job;` zeigt `push-reminders` und `purge-stale-health-data`.

## 5. App mit Expo verbinden

Einmal auf deinem Rechner (Node.js 22 LTS installieren, dann im Terminal):

```bash
git clone https://github.com/nikosouf-coach/trainerbank.git
cd trainerbank
npm install
npx expo install --fix      # prüft, ob alle Pakete zur Expo-SDK-Version passen
npm install -g eas-cli
eas login
eas init                    # legt das Projekt bei Expo an und zeigt die Projekt-ID
```

Danach `package.json` und die neu entstandene `package-lock.json` committen und pushen (`git add package*.json`,
`git commit -m "Paketversionen festschreiben"`, `git push`) – damit bauen GitHub und Expo immer mit denselben Versionen.
`eas init` meldet, dass es die Projekt-ID nicht in `app.config.ts` schreiben kann – das ist richtig so: Die ID kommt
aus der Umgebungsvariable `EAS_PROJECT_ID` (in `.env`, bei Expo und als GitHub-Variable, siehe 3).

Auf expo.dev → Projekt **trainerbank** → **Environment variables** für die Umgebungen `preview` und `production`
anlegen:

| Name | Wert | Sichtbarkeit |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key | Plain text (ist öffentlich, Schutz kommt aus den Zugriffsregeln) |
| `EXPO_PUBLIC_PRIVACY_URL` | Adresse der Datenschutzerklärung | Plain text |
| `EXPO_PUBLIC_IMPRINT_URL` | Adresse des Impressums | Plain text |
| `EAS_PROJECT_ID` | Projekt-ID aus `eas init` | Plain text |

Für die Entwicklung auf deinem Rechner dieselben Werte in eine Datei `.env` schreiben (Vorlage: `.env.example`).
Dann `npx expo start` und den QR-Code mit der App **Expo Go** scannen. Push-Mitteilungen funktionieren erst in einer
richtigen App-Version (Schritt 6).

**Bundle-ID:** voreingestellt ist `de.goatsocceracademy.trainerbank`. Sie lässt sich nach der ersten Einreichung nicht
mehr ändern. Wenn du eine andere willst, vorher in `eas.json` (`APP_BUNDLE_ID`) ändern.

## 6. Testversion bauen

GitHub → **Actions → App bauen → Run workflow** → Plattform `all`, Profil `preview`.
Der Build läuft in der Expo-Cloud (15–30 Minuten). Den Link zur Installation findest du auf expo.dev unter **Builds**.

- **Android:** die APK direkt aufs Handy laden und installieren.
- **iPhone:** Testversionen für iPhones gehen über TestFlight (Profil `production`, siehe 7). Für einzelne Geräte
  ohne TestFlight: `eas device:create` und dann ein `preview`-Build.

Beim ersten iOS-Build fragt EAS nach deinem Apple-Konto und legt Zertifikate und Profile selbst an. Diesen ersten
iOS-Build einmal auf deinem Rechner starten (`eas build --platform ios --profile production`), danach geht es über
GitHub.

## 7. In die Stores bringen

Alle Texte, Screenshots-Motive, Datenschutz-Angaben und Review-Notizen stehen in [`docs/STORE.md`](docs/STORE.md).

**Vorher:**
1. Datenschutzerklärung ([`docs/DATENSCHUTZERKLAERUNG.md`](docs/DATENSCHUTZERKLAERUNG.md)) und Impressum
   ([`docs/IMPRESSUM-VORLAGE.md`](docs/IMPRESSUM-VORLAGE.md)) ausfüllen – die Platzhalter in eckigen Klammern – und
   auf deiner Website veröffentlichen. Beides von einer Fachperson für Datenschutz prüfen lassen.
2. Auftragsverarbeitungsverträge abschließen: Supabase (DPA im Dashboard), Anthropic (DPA in der Console),
   Expo (DPA auf expo.dev).
3. Die Datenschutz-Folgenabschätzung ([`docs/DSFA.md`](docs/DSFA.md)) durchgehen und unterschreiben.

**Apple:** App Store Connect → **Apps → +** → Name „Trainerbank“, Bundle-ID wie oben, SKU `trainerbank`. Die App-ID
(Zahl) in `eas.json` bei `ascAppId` eintragen. Dann GitHub → **App bauen** → Plattform `ios`, Profil `production`,
**einreichen** anhaken. Die Version erscheint in TestFlight; nach dem Test unter „App Store“ einreichen.

**Google:** Play Console → **App erstellen**. Für das automatische Hochladen ein Dienstkonto anlegen (Anleitung:
expo.dev → Docs → „Submit to Google Play“), die JSON-Datei **nicht** ins Repository legen, sondern bei Expo unter
**Credentials** hochladen. Die erste Version einmal von Hand in den internen Test hochladen, danach geht es über
GitHub (`android`, `production`, einreichen).

Für die Prüfung durch Apple und Google: In der App gibt es den Demo-Modus ohne Anmeldung. In den Review-Notizen
(Vorlage in `docs/STORE.md`) zusätzlich ein Testkonto angeben.

## 8. Was automatisch läuft

| Workflow | Wann | Was |
|---|---|---|
| CI | bei jedem Push und Pull Request | Kernlogik-Tests, Datenbank und Zugriffsregeln, TypeScript |
| Backend deployen | bei Änderungen in `supabase/` auf `main` und manuell | Tests, dann Migrationen, Secrets, Server-Funktionen |
| App bauen | manuell | Testversion oder Store-Version, optional mit Einreichung |
| Dependabot | wöchentlich | Vorschläge für Paket-Updates als Pull Request |

Expo-Pakete werden einmal pro SDK-Version gemeinsam aktualisiert, nicht einzeln durch Dependabot. Dafür gibt es den
Workflow **Werkzeug** (Actions → Werkzeug → SDK-Nummer eingeben): Er schreibt die neuen Paketversionen samt
Prüfberichten (TypeScript, expo-doctor, Tests) in einen eigenen Branch, aus dem ein Pull Request wird. Expo bringt
etwa dreimal im Jahr ein neues SDK heraus; ältere SDKs bekommen nur noch eine Zeit lang Fehlerkorrekturen.

## 9. Checkliste vor dem ersten Release

- [ ] Backend-Workflow grün, `cron.job` zeigt beide Jobs
- [ ] Registrierung mit Bestätigungsmail klappt, Team anlegen, Spieler per Team-Code beitreten
- [ ] Spieler: Einwilligungen, RPE und Morgen-Check eintragen, Push-Erinnerung kommt an
- [ ] KI-Coach antwortet, Befund-Auswertung mit Einwilligung funktioniert
- [ ] Datenexport und Konto löschen im Bereich Konto getestet
- [ ] Datenschutzerklärung und Impressum online, Adressen in den EAS-Umgebungsvariablen
- [ ] Screenshots erstellt (Motive in `docs/STORE.md`)
- [ ] App-Symbol: Platzhalter in `assets/` durch ein gestaltetes Symbol ersetzen (gleiche Dateinamen und Größen)
