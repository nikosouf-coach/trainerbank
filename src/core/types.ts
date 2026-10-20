// Fachliche Typen der Trainerbank. Unabhängig von React und Supabase.

export type Lang = "de" | "en";
export type Depth = "org" | "basis" | "pro";
export type ClassKey =
  | "sen" | "ue32" | "u19" | "u18" | "u17" | "u16" | "u15" | "u14" | "u13" | "u12"
  | "u11" | "u10" | "u9" | "u8" | "u7";
export type Group = "akt" | "u19" | "u15" | "u11";
/** Eingebaute Trainingsarten ("aufbau" = Kraft; "kids" nur Kinderfußball, "spiel" nur MD) */
export type BuiltinKind = "regen" | "frei" | "aktiv" | "schnell" | "taktik" | "extensiv" | "intensiv" | "aufbau" | "technik" | "kids" | "spiel";
/** Eigene Trainingsarten haben die Form "c:<id>". */
export type Kind = BuiltinKind | `c:${string}`;
export type Pitch = "ganz" | "halb" | "viertel" | "halle";
export type WeekMode = "normal" | "aufbau" | "entlastung";
export type AttStatus = "da" | "ent" | "unent";
export type Complaint = "none" | "light" | "clear";
export type AbsenceType = "urlaub" | "krank" | "verletzung" | "schule" | "arbeit" | "sonst";
export type ExtraType = "gym" | "schule" | "lauf" | "verein" | "sonst";
export type PotCat = "ath" | "tech" | "takt" | "ment" | "verf";
export type MsgType = "pause" | "regen" | "zusatz" | "prog" | "info";
export type Status = "crit" | "warn" | "ok" | "low" | "build" | "none" | "inj";

export interface DayCfg { zeit: string; platz: Pitch; dauer: number }
/** Art einer weiteren Einheit am Tag (das Mannschaftstraining ist Einheit 0) */
export type UnitArt = "athletik" | "kraft" | "tw" | "technik" | "taktik" | "praev" | "reha" | "sonst";
/**
 * Weitere Einheit eines Tages (Nummer 1–9) neben dem Mannschaftstraining, z. B. 30 Min. Athletik vor dem Training
 * oder Torwarttraining. Wiederkehrend je Wochentag (TeamSettings.units) oder für ein Datum (TeamData.units).
 */
export interface DayUnit {
  slot: number; art: UnitArt;
  /** eigene Bezeichnung (leer = Name der Art) */ title: string;
  zeit: string; dauer: number;
  /** Ziel-RPE (null = Richtwert der Art) */ rpe: number | null;
  /** nur diese Gruppe (z. B. Torhüter); null = ganzes Team – Torwarttraining ohne Gruppe = alle Torhüter */ groupId: string | null;
  /** zuständiger Trainer (StaffProfile.id) */ staffId: string | null;
  inhalt: string;
  /** Schwerpunkte (Torwart: core/units → TW_THEMES) */ themes?: string[];
  /** nur für ein Datum: diese (wiederkehrende) Einheit fällt an diesem Tag aus */ cancel?: boolean;
  /** nur wiederkehrend: gilt ab diesem Tag (ältere Tage bleiben unverändert) */ from?: string | null;
  /** nur diese Spieler (Individualtraining); leer = Gruppe bzw. alle */ pids?: string[];
}
export interface TeamSettings {
  /** Schlüssel = Wochentag wie Date.getDay() (0 = Sonntag). */
  days: Record<number, DayCfg>;
  /** Standarddauer für neue Trainingstage. */
  dauer: number;
  /** true: die App verändert nur die Intensität, nicht die Dauer. */
  fix: boolean;
  /** Üblicher Spieltag (Date.getDay()). */
  spieltag: number;
  anstoss: string;
  /** Spieler dürfen Trainings selbst absagen / Abwesenheiten eintragen (Standard: ja). */
  playerAbs?: boolean;
  /** Was Spieler in ihrer App sehen (Baukasten). Fehlender Schlüssel = Standard aus PLAYER_VIEW. */
  playerView?: Partial<Record<PlayerViewKey, boolean>>;
  /** Dienste (Materialdienst, Leibchen …), reihum verteilt */
  duties?: DutyDef[];
  /** Strafenkatalog mit optionalen Automatiken */
  fines?: FineRule[];
  /** Push-Erinnerungen für Spieler (Server: supabase/functions/_shared/schedule.ts → reminderSettings). */
  reminders?: Reminders;
  /** Tests der Leistungsdiagnostik des Teams; leer/fehlend = alle für die Altersgruppe empfohlenen */
  tests?: TestKey[];
  /** Platzierung in Tests für Spieler: aus, nur eigener Platz (Standard), Platz + Teambestwert (ohne Namen) */
  testRank?: "off" | "rank" | "best";
  /** Mannschaftskasse (Beiträge, Geldstrafen, Kassenbuch) */
  kasse?: KasseSettings;
  /** Weitere Einheiten je Wochentag (Schlüssel wie days) – z. B. Athletik vor dem Training, Torwarttraining */
  units?: Record<number, DayUnit[]>;
  /** Chat im Team (Kinderschutz-Einstellungen: core/chat → chatSettings) */
  chat?: ChatSettings;
  /** Spieler dürfen Individualtraining anfragen (Standard: ja) */
  indivReq?: boolean;
  /** Wochenchallenge: Bestenliste anzeigen (Standard: aus – persönliche Bestleistung und Teamziel statt Vergleich) */
  challengeRank?: boolean;
}
/**
 * Chat: wer Einzelchats starten darf (aus / nur mit dem Trainerteam / auch Spieler untereinander), ob das ganze Trainerteam
 * Einzelchats zwischen Trainer und Spieler lesen kann (Kinderschutz, Standard in Jugendteams) und ob im Teamchat nur das
 * Trainerteam schreibt (Ankündigungen).
 */
export interface ChatSettings { on: boolean; dm: "off" | "staff" | "all"; transparent: boolean; teamReadOnly: boolean }
/** Beitrag: einmalig, monatlich (Zeitraum „JJJJ-MM“) oder je Saison Juli–Juni („JJJJ/JJ“) */
export type FeeEvery = "once" | "month" | "season";
export interface FeeDef { id: string; name: string; amount: number; every: FeeEvery; from: string; to?: string | null;
  /** nur diese Spieler (leer/fehlend = alle aktiven Spieler) */ pids?: string[] | null }
export interface KasseSettings {
  on: boolean;
  /** ISO-Währung (EUR, CHF, GBP, USD …) */
  currency: string;
  /** Geldbeträge im Strafenkatalog (Senioren); aus = nur Dienste (Jugend) */
  money: boolean;
  /** Spieler sehen den Kassenstand */
  showBalance: boolean;
  /** Kassenwart: Spieler-ID mit Zugriff auf die Kasse */
  treasurer?: string | null;
  /** Hinweis für Spieler, wie bezahlt wird (z. B. bar beim Training, PayPal-Name) */
  payInfo?: string;
  fees: FeeDef[];
}
export type CashCat = "fee" | "fine" | "donation" | "event" | "drinks" | "material" | "other";
/** Kassenbuch-Eintrag (Einnahme/Ausgabe); Zahlung eines Beitrags (feeId + period) oder einer Strafe (fineId) */
export interface CashEntry { id: string; date: string; amount: number; kind: "in" | "out"; cat: CashCat; pid: string | null;
  feeId: string | null; period: string | null; fineId: string | null; note: string }
/** Erlassener Beitrag (period „*“ = ganzer Beitrag) */
export interface CashWaiver { pid: string; feeId: string; period: string }
export interface Reminders {
  /** Morgen-Check an/aus und Uhrzeit "HH:MM" (Standard 08:00) */
  well?: boolean; wellAt?: string;
  /** RPE-Erinnerung an/aus und Minuten nach Ende der Einheit (Standard 30) */
  rpe?: boolean; rpeDelay?: number;
  /** Erinnerung ans Pausenprogramm (Mo und Do 17:00) */
  program?: boolean;
}
/** Gruppenart: bestimmt, ob und wie die Gruppe die Belastungssteuerung beeinflusst. */
export type GroupKind = "reha" | "tw" | "growth" | "build" | "lead" | "talent" | "custom";
export interface TeamGroup {
  id: string; name: string;
  /** Art (Standard: custom = nur Organisation) */
  kind?: GroupKind;
  /** Spieler sehen in ihrer App, dass sie in dieser Gruppe sind */
  vis?: boolean;
}
export type PlayerViewKey = "plan" | "load" | "tips" | "ai" | "goals" | "att" | "ratings" | "stats" | "tests" | "videos" | "contacts" | "program" | "dev";
export interface Principle { kind: Kind; rpe: number;
  /** eigene Beschreibung des Trainers (wird Standard-Inhalt der Einheit an diesem Tag) */ note?: string }
export type Principles = Record<string, Principle>;
export interface Modules {
  beteiligung: boolean; planung: boolean; belastung: boolean; regeneration: boolean;
  wachstum: boolean; ki: boolean; matchplan: boolean; kaderplanung: boolean;
  /** Neue Bausteine (Pakete) */
  leistung: boolean; befunde: boolean; spielanalyse: boolean; videos: boolean;
  archiv: boolean; vorbereitung: boolean; kontakte: boolean;
  /** Spielerentwicklung (Ziele, Kompetenzprofil, Selbsteinschätzung, Gespräche), Wochenchallenge, Chat */
  entwicklung: boolean; challenge: boolean; chat: boolean;
}
export interface Team {
  id: string;
  club: string;
  name: string;
  accent: string;
  cls: ClassKey;
  depth: Depth;
  settings: TeamSettings;
  principles: Principles;
  modules: Modules;
  joinCode?: string;
  staffCode?: string;
  timezone?: string;
  /** Vereinslogo (Speicherpfad bzw. lokale Adresse in der Demo) */
  logo?: string | null;
  /** Verbunden mit einem Verein (Vereinsabo, core/club) */
  clubId?: string | null;
}
export interface Player {
  id: string;
  vn: string;
  nn: string;
  pos: string;
  nr: number | null;
  geb: string;
  kg?: number | null;
  photo?: string | null;
  userId?: string | null;
  neu?: boolean;
  active?: boolean;
  /** IDs eigener Gruppen (TeamData.groups); Spieler sehen nur freigegebene. */
  groups?: string[];
  /** Aus einem anderen Team des Vereins übernommen (Hochziehen/Wechsel): Name dieses Teams */
  origin?: string | null;
  /** Spielerzeile im Herkunftsteam */
  linkedFrom?: string | null;
}
export interface Match { id: string; date: string; zeit: string; gegner: string; heim: boolean; comp: "liga" | "pokal" | "test"; /** Ergebnis aus eigener Sicht */ result?: { own: number; opp: number } | null }
export interface TeamEvent { id: string; date: string; zeit: string; titel: string; typ: string; ersetzt: boolean }
export interface CalOverride { cancel?: boolean; extra?: boolean; zeit?: string; dauer?: number }
export interface PlanOverride { kind?: Kind; rpe?: number; dauer?: number; inhalt?: string; keepRest?: boolean }
export interface Absence {
  id: string; pid: string; typ: AbsenceType; von: string; bis: string | null;
  stufe: number | null; notiz: string; by?: "player" | "coach";
  /** Körperregion der Verletzung (core/body, z. B. „hams:l“) – steuert den Reha-Plan */
  area?: string | null;
}
export interface Session { date: string; typ: "Training" | "Spiel"; dauer: number; zeit: string; md: string; ziel: number; kind?: Kind }
export interface RpeEntry { rpe: number; min: number; /** Zeitpunkt der Eingabe auf dem Gerät (auch offline) – zählt für Fristen */ at?: string | null;
  /** Torwart: Sprünge/Hechtsprünge in der Einheit (ca.) */ dives?: number | null }
export interface WellnessItems { sq: number; fat: number; doms: number; stress: number }
export interface Wellness { sum: number; schlaf: number; beschw: Complaint; ort?: string; items?: WellnessItems;
  /** Körperregionen der Beschwerde (core/body: „hams:l“, „knee:r“, „ill_up“) */
  areas?: string[];
  /** Angaben zum Schmerz je Region (Schlüssel = Region ohne Seite, z. B. „hams“) – core/pain */
  pain?: Record<string, PainInfo> }
/** Schmerzart (Mehrfachauswahl) */
export type PainQuality = "stab" | "pull" | "dull" | "burn" | "throb" | "cramp" | "radiate" | "numb" | "stiff";
/** Wann tut es weh? (Mehrfachauswahl) */
export type PainWhen = "rest" | "run" | "sprint" | "shot" | "jump" | "cut" | "after" | "morning" | "night";
/** Zeichen: Schwellung, Bluterguss, instabil/gibt nach, kann nicht normal auftreten/belasten, blockiert */
export type PainSign = "swelling" | "bruise" | "unstable" | "weight" | "locked";
/** Angaben zum Schmerz (alle optional; Kinder bekommen eine vereinfachte Auswahl) */
export interface PainInfo {
  /** Stärke 0–10 (NRS) */ nrs?: number | null;
  q?: PainQuality[];
  /** plötzlich (in einer Aktion) oder schleichend */ onset?: "sudden" | "gradual" | null;
  /** seit heute, 2–3 Tagen, ≥ 1 Woche, länger/immer wieder */ since?: "today" | "days" | "week" | "long" | null;
  when?: PainWhen[];
  /** Zusammenprall, ohne Kontakt, kein bestimmter Moment */ cause?: "contact" | "noncontact" | "none" | null;
  signs?: PainSign[];
  /** Selbsteinschätzung: voll, eingeschränkt, gar nicht trainierbar */ train?: "full" | "limited" | "no" | null;
}
export interface Extra { id: string; date: string; art: ExtraType; min: number; rpe: number; /** freie Bezeichnung bei „Sonstiges“ */ label?: string; /** erledigter Programm-Baustein (ProgItem.id) aus Pause/Vorbereitung */ prog?: string }
export interface Growth { date: string; cm: number }
export interface CustomKind { id: string; name: string; rpe: number; inhalt: string }
export interface Potential { id: string; cat: PotCat; text: string; vis: boolean; src: "trainer" | "daten" | "ki" }
export interface CoachMsg { id: string; date: string; typ: MsgType; text: string; bis: string | null }
/** Spieldaten eines Spielers in einem Spiel (vom Trainerteam erfasst). */
export interface MatchStat { min: number; goals: number; assists: number; start: boolean;
  /** Torhüter: Gegentore in seiner Spielzeit und Paraden */ conceded?: number | null; saves?: number | null }
/** Note (1–10, eine Nachkommastelle) und Feedback des Trainers zu Spiel oder Training. */
export interface Rating { id: string; pid: string; date: string; kind: "spiel" | "training"; rating: number | null; text: string; vis: boolean;
  /** Training: nur Abweichungen vom Durchschnitt – besonders gut oder besonders schwach (Standard = Durchschnitt, nicht gespeichert) */
  mark?: "good" | "poor" | null;
  /** Gründe (core/units → MARK_TAGS) */ tags?: string[];
  /** Einheit des Tages (0 = Mannschaftstraining, 1–9 = weitere Einheit wie Torwarttraining) */ slot?: number }
/** Medizinischer Befund (Foto oder PDF) zu einem Spieler, optional mit KI-Auswertung. */
export interface Finding {
  id: string; pid: string; absenceId: string | null; date: string; title: string;
  path: string; mime: string; consent: "app" | "schriftlich"; ai: string | null; aiAt: string | null; note: string;
}
/** Übungsskizze im alten Format (bis Oktober 2026): Koordinaten in Metern innerhalb des gewählten Spielfelds. */
export type BoardKind = "a" | "b" | "gk" | "cone" | "ball" | "goal" | "pass" | "run" | "drib" | "zone";
export interface BoardItem { id: string; t: BoardKind; x: number; y: number; x2?: number; y2?: number; n?: number }
export interface DrawingV1 { pitch: "full" | "half" | "box" | "free"; items: BoardItem[] }
/**
 * Übungsskizze (Version 2): dieselbe Tafel wie im Matchplan – Spielfeld hochkant in Metern, Ausschnitt, Design,
 * auf Wunsch ohne Feldlinien (freie Fläche), Elemente inkl. Trainingsmaterial.
 */
export interface Sketch { v: 2; view: MpView; frame?: MpFrame | null; look?: MpLook | null; plain?: boolean; items: MpItem[] }
/** Gespeicherte Skizze: neues oder altes Format (wird beim Anzeigen umgerechnet, siehe core/sketch) */
export type Drawing = Sketch | DrawingV1;
/** Übungsarchiv */
export type ExerciseCat = "warmup" | "technik" | "pass" | "abschluss" | "spielform" | "taktik" | "athletik" | "torwart" | "cooldown";
export interface CoachPoint { text: string; staffId?: string | null }
export interface Exercise {
  id: string; title: string; cat: ExerciseCat; themes: string[]; dur: number; players: string; area: string;
  rpe: number | null; desc: string; points: CoachPoint[]; drawing: Drawing | null; video: string;
}
export interface TemplateBlock { exId: string | null; text: string; min: number; staffId?: string | null }
/** Platz im Team in einem Test (bester = 1), Anzahl Spieler mit Wert, optional Teambestwert */
export interface TestRank { rank: number; n: number; best: number | null }
/** Dienst (z. B. Materialdienst): wann und wie viele Spieler */
export type DutyWhen = "training" | "match" | "both";
/** Wechsel: jedes Mal neu, oder dieselben Spieler für alle Termine einer Woche / zwei Wochen / eines Monats */
export type DutyEvery = "each" | "week" | "2weeks" | "month";
export interface DutyDef { id: string; name: string; when: DutyWhen; count: number; on: boolean; /** fehlt = jedes Mal */ every?: DutyEvery }
/** Strafe im Katalog. Automatik: RPE nicht binnen 24 h (nur mit Einwilligung) bzw. unentschuldigt gefehlt. */
export type FineTrigger = "manual" | "late_rpe" | "unexcused";
export interface FineRule { id: string; name: string; trigger: FineTrigger; duty: string | null; amount: number | null; note: string; on: boolean;
  /** Automatik gilt erst für Einheiten ab diesem Tag (Einschalten) */
  since?: string }
export type EntryStatus = "open" | "done" | "waived";
/** Eingeteilter Dienst an einem Tag */
export interface DutyEntry { id: string; date: string; duty: string; pid: string; source: "rotation" | "fine" | "manual"; fineId: string | null; status: EntryStatus }
/** Vergebene Strafe */
export interface FineEntry { id: string; pid: string; rule: string; date: string; ref: string | null; amount: number | null; note: string; status: EntryStatus; auto: boolean; dutyDate: string | null }
/** Aufgabe für einen Trainer (staffId), alle Trainer (beides null) oder einen Spieler (pid) */
export interface TeamTask { id: string; title: string; note: string; due: string | null; staffId: string | null; pid: string | null; groupId: string | null; done: boolean; doneAt: string | null }
/** Ablauf eines Trainingstags: ein Block (Aufwärmen, Passform …) mit Zuständigkeit, Coachingpunkten und Skizze. */
export interface DayBlock {
  id: string; date: string; sort: number; title: string; min: number;
  /** zuständiger Trainer (StaffProfile.id) */
  staffId: string | null;
  /** Übung aus dem Archiv (Titel, Beschreibung und Skizze werden beim Übernehmen kopiert) */
  exId: string | null;
  text: string; points: string[];
  /** Skizze mit dem Zeichentool */
  drawing: Drawing | null;
  /** hochgeladenes Foto einer Skizze (Speicherpfad im Bucket „sketches“) */
  photo: string | null;
  /** nur für eine Gruppe (z. B. Torhüter); null = alle */
  groupId: string | null;
  /** Einheit des Tages (0 = Mannschaftstraining, 1–9 = weitere Einheit) */
  slot?: number;
  /** Zuständigkeiten: mehrere Trainer mit eigener Aufgabe (erster = staffId, Hauptverantwortlicher) */
  crew?: CrewRole[];
}
/** Trainer und seine Aufgabe in einem Block, z. B. „ballbesitzende Mannschaft“ */
export interface CrewRole { staffId: string; task: string }
/** Gespeicherte Einheit (Vorlage) aus Übungen oder freien Blöcken. */
export interface SessionTemplate { id: string; title: string; theme: string; blocks: TemplateBlock[]; notes: string }
/** Trainerprofil mit Aufgabenbereichen (auch für Personen ohne App-Konto). */
export type StaffRoleKey = "chef" | "co" | "tw" | "athletik" | "physio" | "betreuer" | "analyst";
export interface StaffProfile {
  id: string; name: string; role: StaffRoleKey; areas: string[]; phone: string; email: string; note: string;
  /** verknüpftes Konto (eigenes Profil bzw. Co-Trainer mit App-Zugang) */
  userId?: string | null;
  birth?: string | null;
  /** Trainerlizenz (LICENSES) */
  license?: string;
  photo?: string | null;
}
/** Leistungstests (Katalog in perf.ts) */
export type TestKey = "sprint10" | "sprint30" | "cmj" | "ift" | "yoyo" | "agility505" | "slalom" | "standweit" | "tw_lateral" | "tw_kick";
export interface TestResult { id: string; pid: string; test: TestKey; date: string; value: number; note?: string }
// ---------- Spielerentwicklung (Paket C) ----------
/** Kompetenzbereiche: Technik, Taktik, Athletik, Persönlichkeit (Mentales & Soziales) */
export type DevArea = "tech" | "takt" | "ath" | "ment";
/** Einschätzung im Kompetenzprofil (1–5 je Kompetenz) – vom Trainerteam oder Selbsteinschätzung des Spielers */
export interface Assessment { id: string; pid: string; date: string; by: "coach" | "self"; scores: Record<string, number>; note: string;
  /** Trainereinschätzung für den Spieler freigegeben (Selbsteinschätzung sieht der Spieler immer) */ vis: boolean }
/** Messung eines Ziels: Test, Spielstatistik, Beteiligung, Zähler, eigener Messwert oder Meilenstein */
export type GoalMetric = "test" | "stat" | "att" | "count" | "value" | "check";
export type GoalStat = "goals" | "assists" | "minutes" | "games" | "starts" | "clean";
/** Zielart nach Sportpsychologie: Prozess (Verhalten), Leistung (Messwert), Ergebnis */
export type GoalKind = "process" | "perf" | "outcome";
export interface Goal {
  id: string; pid: string; title: string; area: DevArea; kind: GoalKind; metric: GoalMetric;
  unit: string; start: number | null; target: number | null;
  /** kleiner ist besser (z. B. Zeiten) */ lower: boolean;
  test: TestKey | null; stat: GoalStat | null;
  /** Beginn und Ziel-Datum */ from: string; due: string | null;
  /** Warum ist das Ziel wichtig? */ why: string;
  /** Schritte/Maßnahmen (bei Meilenstein-Zielen abhakbar) */ steps: { text: string; done: boolean }[];
  status: "active" | "done" | "missed" | "dropped";
  /** für den Spieler sichtbar */ vis: boolean; by: "coach" | "player";
  /** aus einem Entwicklungsgespräch */ talkId: string | null;
}
/** Fortschritt eines Ziels (Zähler: Menge, Messwert: Wert) */
export interface GoalEntry { id: string; goalId: string; pid: string; date: string; value: number; note: string; by: "coach" | "player" }
export interface Agreement { id: string; text: string; who: "player" | "coach" | "both"; due: string | null; done: boolean }
/** Entwicklungsgespräch mit Protokoll und Vereinbarungen */
export interface DevTalk {
  id: string; pid: string; date: string; kind: "start" | "mid" | "end" | "event";
  /** Sicht des Spielers */ player: string; strengths: string; focus: string;
  agreements: Agreement[];
  /** interne Notiz (nur Trainerteam) */ notes: string;
  next: string | null;
  /** Protokoll (ohne interne Notiz) für den Spieler freigegeben */ vis: boolean;
}
/** Wochenchallenge (optional, z. B. Jonglier-Rekord, Wandpässe, Ball-Mastery an 5 Tagen) */
export type ChallengeKind = "best" | "count" | "days" | "check";
export interface Challenge {
  id: string; ws: string; title: string; text: string; kind: ChallengeKind; unit: string;
  /** persönliches Ziel (z. B. 5 Tage, 30 Kontakte) */ target: number | null;
  /** gemeinsames Teamziel (Summe aller Werte) */ teamTarget: number | null;
  lower: boolean; groupId: string | null; key: string | null;
}
export interface ChallengeEntry { cid: string; pid: string; value: number | null; days: string[]; done: boolean; at: string }
/** Zusammenfassung einer Challenge für Spieler (vom Server, ohne Werte einzelner – außer Bestenliste ist an) */
export interface ChallengeTotals { cid: string; players: number; done: number; sum: number; top: { name: string; value: number }[] }
/** Anfrage eines Spielers für ein Individualtraining */
export type IndivTopic = "technik" | "schuss" | "kopf" | "schwach" | "athletik" | "tw" | "taktik" | "video" | "reha" | "mental" | "sonst";
export interface IndivRequest {
  id: string; pid: string; topic: IndivTopic; note: string; wish: string;
  status: "open" | "accepted" | "declined" | "cancelled";
  /** staffId: wer die Einheit leitet (bei Zusage); ask: bei wem der Spieler angefragt hat (null = Trainerteam) */
  answer: string; date: string | null; slot: number | null; staffId: string | null; created: string; ask?: string | null;
}

// ---------- Chat ----------
export type ChatKind = "team" | "staff" | "group" | "direct" | "custom";
export interface Chat {
  id: string; kind: ChatKind; title: string; groupId: string | null;
  /** Mitglieder (Konten) bei Einzel- und eigenen Chats */ members: string[];
  /** nur das Trainerteam schreibt */ readOnly: boolean;
  /** Trainerteam liest mit (Kinderschutz) */ transparent: boolean;
  createdBy: string | null; lastAt: string | null;
  /** eigene Einstellung: stumm (keine Push-Nachrichten) */ muted: boolean;
}
export interface ChatMsg { id: string; chatId: string; uid: string | null; name: string; body: string; at: string; replyTo: string | null; deleted: boolean;
  /** Emoji → Konten */ reactions: Record<string, string[]>;
  /** nur auf dem Gerät: wird gesendet bzw. Senden fehlgeschlagen */ pending?: boolean; failed?: boolean }
export type ChatReportReason = "mean" | "bully" | "private" | "other";
/** Gemeldete Nachricht (Trainerteam mit Recht „messages“; Spieler: eigene Meldungen) */
export interface ChatReport { id: string; msgId: string | null; chatId: string | null; reason: ChatReportReason; note: string;
  /** Kopie des Textes zum Zeitpunkt der Meldung */ snapshot: string; sender: string; sentAt: string | null;
  status: "open" | "done"; reporter: string; at: string }
/** Person, mit der man im Team chatten kann (Konto) */
export interface ChatPerson { uid: string; name: string; kind: "staff" | "player"; pid: string | null; role: string | null }

/** Video-Link (YouTube, Veo, Hudl, Vimeo, Cloud …) zu Spiel, Spielern oder Übung. */
export type ContactRole = "trainer" | "koordinator" | "vorstand" | "physio" | "arzt" | "betreuer" | "sonst";
/** Eintrag der Kontaktliste; vis = für Spieler sichtbar. */
export interface Contact { id: string; name: string; role: ContactRole; org: string; phone: string; email: string; address: string; note: string; vis: boolean }

/** Vorbereitung (prep) oder längere Pause (break, z. B. Sommer-/Winterpause). */
export type PhaseKind = "prep" | "break";
export type FreeKey = "andere" | "mobility" | "locker" | "fahrtspiel" | "intervall" | "kraft" | "sprint" | "ball" | "eigen";
/** Baustein im Spielerprogramm: perWeek-mal pro Woche in den Phasenwochen from..to (1-basiert). */
export interface ProgItem { id: string; key: FreeKey; title?: string; min: number; rpe: number; perWeek: number; from: number; to: number; note?: string }
/** Anpassungen einer Phasenwoche durch den Trainer (Schlüssel = Montag der Woche). */
export interface PhaseWeek { pct?: number; note?: string; test?: boolean }
export interface Phase {
  id: string; kind: PhaseKind; title: string; from: string; to: string;
  /** erstes Pflichtspiel nach der Vorbereitung */
  firstMatch: string | null;
  weeks: Record<string, PhaseWeek>; program: ProgItem[];
  /** Programm für Spieler sichtbar */
  vis: boolean; note: string;
}

export interface Video { id: string; title: string; url: string; date: string | null; matchId: string | null; pids: string[]; note: string; vis: boolean;
  /** an Gruppen geschickt (Anzeige); die Mitglieder stehen beim Speichern in pids */
  groupIds?: string[] }

/** Alles, was die Fachlogik über ein Team wissen muss. */
// ---------- Matchplan (Paket B) ----------
/**
 * Elemente der Taktiktafel: eigene Spieler, Gegner, Joker (neutral), Ball, Hütchen, Text, Pass, Laufweg, Dribbling,
 * Linie, Zone, Kreis, Freihand sowie Trainingsmaterial (Tor, Minitor, Stange, Dummy, Koordinationsleiter, Hürde, Reifen)
 */
export type MpTool = "own" | "opp" | "neu" | "ball" | "cone" | "text" | "pass" | "run" | "drib" | "line" | "zone" | "circle" | "free"
  | "goal" | "mgoal" | "pole" | "dummy" | "ladder" | "hurdle" | "ring";
/** Linienfarben: weiß, gelb, rot, blau, grün, orange, schwarz */
export type MpColor = "w" | "y" | "r" | "b" | "g" | "o" | "k";
/** Linienstil: durchgezogen, lang gestrichelt, kurz gestrichelt, gepunktet */
export type MpDash = "solid" | "long" | "short" | "dot";
/** Element auf dem Spielfeld (Meter, Hochkant 68 × 105, eigenes Tor unten) */
export interface MpItem {
  id: string; t: MpTool; x: number; y: number; x2?: number; y2?: number;
  /** eigener Spieler (leer = freie Position) */
  pid?: string | null;
  /** Rückennummer (Spieler, Gegner) bzw. Schritt eines Ablaufs (Pfeile, Freihand: 1 …) */
  n?: number | null;
  /** Positionskürzel (z. B. IV) bzw. Text */
  label?: string;
  col?: MpColor;
  /** Pfeile: Bogen (−3 … 3, positiv = nach links in Laufrichtung; fehlt = gerade) */
  bend?: number;
  /** Freihand: Punkte [x0, y0, x1, y1, …] in Metern */
  pts?: number[];
  /** Freihand (alt): durchgezogen statt gestrichelt – neu: `ls` */
  solid?: boolean;
  /** Linien, Pfeile, Freihand, Flächen: Linienstil (fehlt = Standard der Art, z. B. Laufweg kurz gestrichelt) */
  ls?: MpDash;
  /** Strichstärke 1 (dünn) … 3 (dick); fehlt = 2 */
  w?: 1 | 2 | 3;
  /** Trainingsmaterial: Drehung in Grad (0 = quer) */
  rot?: number;
  /** hinzugefügt von (Trainerprofil-ID); wird Spielern nicht übermittelt */
  by?: string;
}
/**
 * Voreingestellter Ausschnitt: ganzes Feld, Hälften, Angriffsdrittel, 16er vorne/hinten (gezoomt), Ecken je Seite und
 * Strafraum mit beiden Ecken (breit).
 */
export type MpView = "full" | "att" | "def" | "third" | "pen_att" | "pen_def" | "cor_al" | "cor_ar" | "cor_dl" | "cor_dr" | "box_att" | "box_def";
/** Frei gewählter Ausschnitt in Metern (Hochkant-Koordinaten, wie die Elemente) */
export interface MpFrame { x: number; y: number; w: number; h: number }
/** Spielfeld-Design: Rasen, Taktiktafel dunkel, weiß */
export type MpLook = "grass" | "dark" | "white";
export type MpSlideCat = "grund" | "ball" | "gegen" | "umschalt" | "ecke_off" | "ecke_def" | "frei_off" | "frei_def" | "einwurf" | "anstoss" | "sonst";
export interface MpSlide {
  id: string; cat: MpSlideCat; title: string; view: MpView;
  /** eigener Ausschnitt (Zoom/Verschieben); fehlt = Voreinstellung `view` */
  frame?: MpFrame | null;
  /** Icongröße nur für diese Folie; fehlt = wie im Plan */
  size?: number | null;
  /** Icon-Ansicht nur für diese Folie (z. B. nur Nummern bei Ecken); fehlt = wie im Plan */
  mode?: MpMode | null;
  items: MpItem[]; note: string; vis: boolean;
  /** angelegt von (Trainerprofil-ID; nur Trainerteam, nicht veröffentlicht) */
  by?: string;
}
export type MpSection = "lineup" | "slides" | "idea" | "opp" | "tasks" | "subs";
export type MpFmt = 11 | 9 | 7 | 5;
export interface MpSub { id: string; min: number; out: string | null; in: string | null; note: string }
export interface MpIdea { motto: string; keys: string[]; ball: string; gegen: string; umschalt: string }
export interface MpOppKey { n: number | null; name: string; note: string }
export interface MpOpp { formation: string | null; items: MpItem[]; style: string; strong: string; weak: string; keys: MpOppKey[]; plan: string }
/** Ansicht der Spieler-Icons: Nummer, Nummer + Name, Foto + Name */
export type MpMode = "num" | "name" | "photo";
/** Inhalt eines Matchplans */
export interface MpContent {
  fmt: MpFmt; formation: string; lineup: MpItem[]; bench: string[]; captain: string | null;
  slides: MpSlide[]; idea: MpIdea; opp: MpOpp; tasks: Record<string, string>; subs: MpSub[]; subsNote: string;
  mode: MpMode; size: number;
  /** Spielfeld-Design (fehlt = Rasen) */
  look?: MpLook;
}
/** Freigabe für Spieler: Bereiche, Zeitraum (bis Spielende), nur Kader, Aufgaben nur die eigene */
export interface MpShare { sections: MpSection[]; from: string | null; until: string; squadOnly: boolean; ownTasks: boolean }
/** Veröffentlichter Stand – nur die freigegebenen Bereiche */
export type MpPublished = Partial<MpContent> & { sections: MpSection[] };
export interface MatchPlan {
  id: string; matchId: string | null; title: string; c: MpContent;
  share: MpShare | null; published: MpPublished | null; publishedAt: string | null; updatedAt: string | null;
}
/** Zugriffsprotokoll (Trainerteam): Aufruf bzw. erkannter Screenshot */
export interface MpLog { pid: string; at: string; kind: "open" | "shot"; platform: string | null }
/** Spieler: verfügbarer Matchplan */
export interface MpAvail { id: string; matchId: string | null; title: string; until: string; at: string; seen: boolean }
/** Spieler: geöffneter Matchplan */
export interface MpOpened { id: string; matchId: string | null; title: string; content: MpPublished; pid: string; name: string; until: string; at: string; ownTasks: boolean }

export interface TeamData {
  team: Team;
  players: Player[];
  matches: Match[];
  events: TeamEvent[];
  cal: Record<string, CalOverride>;
  over: Record<string, PlanOverride>;
  wkMode: Record<string, WeekMode>;
  absences: Absence[];
  sessions: Session[];
  /** RPE des Mannschaftstrainings bzw. Spiels (Einheit 0) je Spieler und Tag */
  rpe: Record<string, Record<string, RpeEntry>>;
  /** RPE weiterer Einheiten (1–9) je Spieler, Tag und Einheit */
  rpeU: Record<string, Record<string, Record<number, RpeEntry>>>;
  /** Weitere Einheiten für einzelne Tage (festgehalten, geändert, abgesagt oder zusätzlich) */
  units: Record<string, DayUnit[]>;
  well: Record<string, Record<string, Wellness>>;
  att: Record<string, Record<string, AttStatus>>;
  extra: Record<string, Extra[]>;
  growth: Record<string, Growth[]>;
  kinds: CustomKind[];
  pot: Record<string, Potential[]>;
  msgs: Record<string, CoachMsg[]>;
  notes: Record<string, string>;
  /** Spieldaten je Spiel-ID und Spieler-ID */
  stats: Record<string, Record<string, MatchStat>>;
  ratings: Rating[];
  videos: Video[];
  tests: TestResult[];
  findings: Finding[];
  exercises: Exercise[];
  templates: SessionTemplate[];
  staff: StaffProfile[];
  phases: Phase[];
  contacts: Contact[];
  /** Eigene Gruppen (Reha, Torhüter, Mannschaftsrat …); Mitglieder in Player.groups */
  groups: TeamGroup[];
  /** Ablauf der Trainingstage (nur Trainerteam) */
  blocks: DayBlock[];
  /** Mannschaftskasse: Kassenbuch und Befreiungen (Spieler: nur eigene), Kassenstand für Spieler vom Server */
  cash: CashEntry[];
  waivers: CashWaiver[];
  cashBalance?: number | null;
  /** Nur Spieler-App: eigene Platzierungen in Tests (vom Server berechnet, ohne Werte anderer) */
  ranks?: Partial<Record<TestKey, TestRank>>;
  /** Dienste, Strafen, Aufgaben (Spieler sehen nur eigene) */
  duties: DutyEntry[]; fines: FineEntry[]; tasks: TeamTask[];
  /** Inaktive Spieler (nur für das Trainerteam; nicht in Berechnungen) */
  inactive: Player[];
  /** Spielerentwicklung: Einschätzungen, Ziele mit Fortschritt, Gespräche (Spieler: eigene, freigegebene) */
  assessments: Assessment[]; goals: Goal[]; goalEntries: GoalEntry[]; talks: DevTalk[];
  /** Wochenchallenges, Einträge (Spieler: eigene) und Teamsummen */
  challenges: Challenge[]; chEntries: ChallengeEntry[]; chTotals: Record<string, ChallengeTotals>;
  /** Anfragen für Individualtraining (Spieler: eigene) */
  indiv: IndivRequest[];
  /** Chat: Unterhaltungen, Nachrichten je Chat, eigener Lesestand je Chat, Personen im Team */
  chats: Chat[]; chatMsgs: Record<string, ChatMsg[]>; chatRead: Record<string, string>; chatPeople: ChatPerson[];
  /** Meldungen (Trainerteam) bzw. eigene Meldungen (Spieler) */
  chatReports: ChatReport[];
  /** Chats mit älteren, noch nicht geladenen Nachrichten */
  chatMore: Record<string, boolean>;
  /** Matchpläne (nur Trainerteam), Zugriffsprotokoll je Plan; Spieler: freigegebene Pläne */
  plans: MatchPlan[]; planLogs: Record<string, MpLog[]>; myPlans: MpAvail[];
  /** Kaderplanung & Scouting (nur Trainerteam mit Recht „Scouting“): Kandidaten, Berichte, Merklisten, Saisonplanungen */
  scouts: ScoutPlayer[]; scoutReports: ScoutReport[]; scoutLists: ScoutList[]; squadPlans: SquadPlan[];
}

// ---------- Kaderplanung & Scouting (Paket E) ----------
/** Status eines Kandidaten: Pipeline (Beobachten → Sichtung → Probetraining → Gespräche → Zusage) bzw. abgeschlossen */
export type ScoutStatus = "watch" | "scout" | "trial" | "talks" | "signed" | "declined" | "dropped";
export type ScoutPrio = "a" | "b" | "c";
export type Foot = "r" | "l" | "b";
/** Externer Spieler in der Scouting-Datenbank (kein App-Konto; Art. 14 DSGVO) */
export interface ScoutPlayer {
  id: string; vn: string; nn: string;
  /** Jahrgang (Pflicht für die Planung), Geburtsdatum nur wenn bekannt */
  year: number | null; geb: string | null;
  /** Positionen (Hauptposition zuerst, höchstens 3) */
  pos: string[]; foot: Foot | null; cm: number | null;
  /** Verein und Mannschaft/Liga */
  club: string; clubTeam: string;
  status: ScoutStatus; prio: ScoutPrio | null;
  /** Einschätzung 1–5 bezogen auf das eigene Team: aktuelles Niveau und Potenzial */
  level: number | null; potential: number | null;
  tags: string[]; lists: string[];
  source: string; contact: string; video: string | null; note: string;
  /** Nächster Schritt (z. B. Sichtung am …) */
  next: string | null; nextNote: string;
  /** Über die Datenverarbeitung informiert am (Art. 14 DSGVO) */
  informed: string | null;
  /** Nach der Zusage in den Kader übernommen */
  playerId: string | null;
  createdAt: string; updatedAt: string;
}
export type ReportKind = "match" | "tournament" | "training" | "video" | "trial" | "other";
export type Verdict = "sign" | "watch" | "no";
/** Scouting-Bericht: Bereiche (tech, takt, ath, ment) und optional Kompetenzen der Positionsgruppe, je 1–5 */
export interface ScoutReport {
  id: string; sid: string; date: string; event: string; kind: ReportKind; min: number | null; pos: string | null;
  scores: Record<string, number>; grade: number | null; verdict: Verdict | null;
  strengths: string; weaknesses: string; summary: string;
  author: string | null; authorName: string; createdAt: string;
}
export interface ScoutList { id: string; name: string; color: string; sort: number }
/** Stand eines eigenen Spielers in der Saisonplanung (ohne Eintrag = offen) */
export type PlanStatus = "fix" | "persp" | "unsure" | "leave";
/** Eine Position der Planung: geplanter Kader (Reihenfolge = Stamm, Ersatz …) und Schattenkandidaten (Rang) */
export interface SpSlot { own: string[]; shadow: string[]; target: number; need: string }
/** Inhalt einer Saisonplanung. Verweise: "p:<id>" eigener Spieler, "r:<id>" Aufrücker aus dem Verein, "s:<id>" Kandidat */
export interface SpContent {
  formation: string; slots: Record<string, SpSlot>; status: Record<string, { s: PlanStatus; note: string }>; notes: string;
  /** Angaben zu Aufrückern („r:<id>“: Name, Position, Jahrgang, Team) – falls die Liste aus dem Verein nicht geladen ist */
  ext?: Record<string, { n: string; pos: string; y: number | null; t: string }>;
}
export interface SquadPlan { id: string; season: number; content: SpContent; updatedAt: string }
/** Spieler eines jüngeren Teams im Verein, der in der Saison für dieses Team spielberechtigt wird */
export interface Riser { id: string; vn: string; nn: string; pos: string; year: number; teamId: string; team: string; cls: ClassKey }

export function emptyTeamData(team: Team): TeamData {
  return {
    team, players: [], matches: [], events: [], cal: {}, over: {}, wkMode: {}, absences: [], sessions: [],
    rpe: {}, rpeU: {}, units: {}, well: {}, att: {}, extra: {}, growth: {}, kinds: [], pot: {}, msgs: {}, notes: {},
    stats: {}, ratings: [], videos: [], tests: [], findings: [], exercises: [], templates: [], staff: [], phases: [], contacts: [], groups: [], blocks: [], duties: [], fines: [], tasks: [], cash: [], waivers: [], inactive: [],
    assessments: [], goals: [], goalEntries: [], talks: [], challenges: [], chEntries: [], chTotals: {}, indiv: [],
    chats: [], chatMsgs: {}, chatRead: {}, chatPeople: [], chatReports: [], chatMore: {},
    plans: [], planLogs: {}, myPlans: [],
    scouts: [], scoutReports: [], scoutLists: [], squadPlans: [],
  };
}
