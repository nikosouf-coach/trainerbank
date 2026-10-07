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
}
export interface Principle { kind: Kind; rpe: number }
export type Principles = Record<string, Principle>;
export interface Modules {
  beteiligung: boolean; planung: boolean; belastung: boolean; regeneration: boolean;
  wachstum: boolean; ki: boolean; matchplan: boolean; kaderplanung: boolean;
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
}
export interface Match { id: string; date: string; zeit: string; gegner: string; heim: boolean; comp: "liga" | "pokal" | "test" }
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
export interface Extra { id: string; date: string; art: ExtraType; min: number; rpe: number }
export interface Growth { date: string; cm: number }
export interface CustomKind { id: string; name: string; rpe: number; inhalt: string }
export interface Potential { id: string; cat: PotCat; text: string; vis: boolean; src: "trainer" | "daten" | "ki" }
export interface CoachMsg { id: string; date: string; typ: MsgType; text: string; bis: string | null }

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
}

export function emptyTeamData(team: Team): TeamData {
  return {
    team, players: [], matches: [], events: [], cal: {}, over: {}, wkMode: {}, absences: [], sessions: [],
    rpe: {}, well: {}, att: {}, extra: {}, growth: {}, kinds: [], pot: {}, msgs: {}, notes: {},
  };
}
