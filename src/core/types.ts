// Fachliche Typen der Trainerbank. Unabhängig von React und Supabase.

export type Lang = "de" | "en";
export type Depth = "org" | "basis" | "pro";
export type ClassKey =
  | "sen" | "ue32" | "u19" | "u18" | "u17" | "u16" | "u15" | "u14" | "u13" | "u12"
  | "u11" | "u10" | "u9" | "u8" | "u7";
export type Group = "akt" | "u19" | "u15" | "u11";
export type BuiltinKind = "regen" | "frei" | "aktiv" | "schnell" | "taktik" | "extensiv" | "intensiv" | "aufbau" | "kids" | "spiel";
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
  /** Eigene Gruppen (z. B. „Reha-Gruppe“, „Kapitänsrat“); Zuordnung in Player.groups. */
  groups?: TeamGroup[];
  /** Was Spieler in ihrer App sehen (Baukasten). Fehlender Schlüssel = Standard aus PLAYER_VIEW. */
  playerView?: Partial<Record<PlayerViewKey, boolean>>;
  /** Push-Erinnerungen für Spieler (Server: supabase/functions/_shared/schedule.ts → reminderSettings). */
  reminders?: Reminders;
  /** Testbatterie des Teams (Leistungsdiagnostik); leer/fehlend = alle für die Altersgruppe empfohlenen */
  tests?: TestKey[];
}
export interface Reminders {
  /** Morgen-Check an/aus und Uhrzeit "HH:MM" (Standard 08:00) */
  well?: boolean; wellAt?: string;
  /** RPE-Erinnerung an/aus und Minuten nach Ende der Einheit (Standard 30) */
  rpe?: boolean; rpeDelay?: number;
  /** Erinnerung ans Pausenprogramm (Mo und Do 17:00) */
  program?: boolean;
}
export interface TeamGroup { id: string; name: string }
export type PlayerViewKey = "plan" | "load" | "tips" | "ai" | "goals" | "att" | "ratings" | "stats" | "tests" | "videos" | "contacts" | "program";
export interface Principle { kind: Kind; rpe: number }
export type Principles = Record<string, Principle>;
export interface Modules {
  beteiligung: boolean; planung: boolean; belastung: boolean; regeneration: boolean;
  wachstum: boolean; ki: boolean; matchplan: boolean; kaderplanung: boolean;
  /** Neue Bausteine (Pakete) */
  leistung: boolean; befunde: boolean; spielanalyse: boolean; videos: boolean;
  archiv: boolean; vorbereitung: boolean; kontakte: boolean;
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
  /** IDs eigener Gruppen (TeamSettings.groups). */
  groups?: string[];
}
export interface Match { id: string; date: string; zeit: string; gegner: string; heim: boolean; comp: "liga" | "pokal" | "test"; /** Ergebnis aus eigener Sicht */ result?: { own: number; opp: number } | null }
export interface TeamEvent { id: string; date: string; zeit: string; titel: string; typ: string; ersetzt: boolean }
export interface CalOverride { cancel?: boolean; extra?: boolean; zeit?: string; dauer?: number }
export interface PlanOverride { kind?: Kind; rpe?: number; dauer?: number; inhalt?: string; keepRest?: boolean }
export interface Absence {
  id: string; pid: string; typ: AbsenceType; von: string; bis: string | null;
  stufe: number | null; notiz: string; by?: "player" | "coach";
}
export interface Session { date: string; typ: "Training" | "Spiel"; dauer: number; zeit: string; md: string; ziel: number; kind?: Kind }
export interface RpeEntry { rpe: number; min: number }
export interface WellnessItems { sq: number; fat: number; doms: number; stress: number }
export interface Wellness { sum: number; schlaf: number; beschw: Complaint; ort?: string; items?: WellnessItems }
export interface Extra { id: string; date: string; art: ExtraType; min: number; rpe: number; /** freie Bezeichnung bei „Sonstiges“ */ label?: string; /** erledigter Programm-Baustein (ProgItem.id) aus Pause/Vorbereitung */ prog?: string }
export interface Growth { date: string; cm: number }
export interface CustomKind { id: string; name: string; rpe: number; inhalt: string }
export interface Potential { id: string; cat: PotCat; text: string; vis: boolean; src: "trainer" | "daten" | "ki" }
export interface CoachMsg { id: string; date: string; typ: MsgType; text: string; bis: string | null }
/** Spieldaten eines Spielers in einem Spiel (vom Trainerteam erfasst). */
export interface MatchStat { min: number; goals: number; assists: number; start: boolean }
/** Note (1–10, eine Nachkommastelle) und Feedback des Trainers zu Spiel oder Training. */
export interface Rating { id: string; pid: string; date: string; kind: "spiel" | "training"; rating: number | null; text: string; vis: boolean }
/** Medizinischer Befund (Foto oder PDF) zu einem Spieler, optional mit KI-Auswertung. */
export interface Finding {
  id: string; pid: string; absenceId: string | null; date: string; title: string;
  path: string; mime: string; consent: "app" | "schriftlich"; ai: string | null; aiAt: string | null; note: string;
}
/** Taktik-/Übungszeichnung. Koordinaten in Metern innerhalb des gewählten Spielfelds. */
export type BoardKind = "a" | "b" | "gk" | "cone" | "ball" | "goal" | "pass" | "run" | "drib" | "zone";
export interface BoardItem { id: string; t: BoardKind; x: number; y: number; x2?: number; y2?: number; n?: number }
export interface Drawing { pitch: "full" | "half" | "box" | "free"; items: BoardItem[] }
/** Übungsarchiv */
export type ExerciseCat = "warmup" | "technik" | "pass" | "abschluss" | "spielform" | "taktik" | "athletik" | "torwart" | "cooldown";
export interface CoachPoint { text: string; staffId?: string | null }
export interface Exercise {
  id: string; title: string; cat: ExerciseCat; themes: string[]; dur: number; players: string; area: string;
  rpe: number | null; desc: string; points: CoachPoint[]; drawing: Drawing | null; video: string;
}
export interface TemplateBlock { exId: string | null; text: string; min: number; staffId?: string | null }
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
export type TestKey = "sprint10" | "sprint30" | "cmj" | "ift" | "yoyo" | "agility505" | "slalom" | "standweit";
export interface TestResult { id: string; pid: string; test: TestKey; date: string; value: number; note?: string }
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

export interface Video { id: string; title: string; url: string; date: string | null; matchId: string | null; pids: string[]; note: string; vis: boolean }

/** Alles, was die Fachlogik über ein Team wissen muss. */
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
  rpe: Record<string, Record<string, RpeEntry>>;
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
  /** Inaktive Spieler (nur für das Trainerteam; nicht in Berechnungen) */
  inactive: Player[];
}

export function emptyTeamData(team: Team): TeamData {
  return {
    team, players: [], matches: [], events: [], cal: {}, over: {}, wkMode: {}, absences: [], sessions: [],
    rpe: {}, well: {}, att: {}, extra: {}, growth: {}, kinds: [], pot: {}, msgs: {}, notes: {},
    stats: {}, ratings: [], videos: [], tests: [], findings: [], exercises: [], templates: [], staff: [], phases: [], contacts: [], inactive: [],
  };
}
