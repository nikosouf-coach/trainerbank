// Zeitlogik für die Push-Erinnerungen. Reine Funktionen ohne Abhängigkeiten
// (laufen unter Deno und Node; Tests: supabase/tests/schedule.test.ts).

export interface LocalNow {
  /** Lokales Datum 'YYYY-MM-DD' in der Team-Zeitzone */
  date: string;
  /** Minuten seit lokaler Mitternacht (0–1439) */
  minutes: number;
  /** Wochentag wie Date.getDay(): 0 = Sonntag … 6 = Samstag */
  weekday: number;
}

export interface TrainingDay {
  /** Startzeit in Minuten seit Mitternacht */
  start: number;
  /** Dauer in Minuten */
  duration: number;
}

export interface PlannedSession extends TrainingDay {
  kind: 'match' | 'training' | 'extra';
}

export interface MatchRow {
  time: string | null;
}

export interface OverrideRow {
  cancel: boolean | null;
  extra: boolean | null;
  time: string | null;
  duration: number | null;
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_TIMEZONE = 'Europe/Berlin';
const DEFAULT_TRAINING_MINUTES = 90;

/** Fenster der Session-Erinnerung: Ende der Einheit liegt 30 bis < 45 Minuten zurück (Standard). */
export const RPE_WINDOW = { from: 30, to: 45 } as const;
/** Fenster des Morgen-Checks: 08:00–08:14 Ortszeit (Standard). */
export const MORNING_WINDOW = { from: 8 * 60, to: 8 * 60 + 15 } as const;
/** Erinnerung ans Pausenprogramm: montags und donnerstags um 17:00 Ortszeit. */
export const PROGRAM_REMINDER = { weekdays: [1, 4], at: 17 * 60 } as const;

/** Vom Trainer eingestellte Erinnerungen (teams.settings.reminders). */
export interface ReminderSettings {
  /** Morgen-Check an/aus und Uhrzeit (Minuten seit Mitternacht) */
  well: boolean;
  wellAt: number;
  /** RPE-Erinnerung an/aus und Abstand zum Ende der Einheit in Minuten */
  rpe: boolean;
  rpeDelay: number;
  /** Erinnerung ans Pausenprogramm */
  program: boolean;
}

/** Liest settings.reminders mit Standardwerten; Uhrzeit auf Viertelstunden, Abstand 15–180 Minuten. */
export function reminderSettings(settings: unknown): ReminderSettings {
  const r = (settings && typeof settings === 'object' ? (settings as Record<string, unknown>).reminders : null) as Record<string, unknown> | null;
  const at = parseTime(typeof r?.wellAt === 'string' ? r.wellAt : null);
  const delay = Number(r?.rpeDelay);
  return {
    well: r?.well !== false,
    wellAt: at === null ? MORNING_WINDOW.from : Math.floor(at / 15) * 15,
    rpe: r?.rpe !== false,
    rpeDelay: Number.isFinite(delay) ? Math.min(180, Math.max(15, Math.round(delay / 15) * 15)) : RPE_WINDOW.from,
    program: r?.program !== false,
  };
}

/** Lokales Datum, Uhrzeit und Wochentag in einer IANA-Zeitzone (ungültige Zone → Europe/Berlin). */
export function localNow(now: Date, timeZone: string | null | undefined): LocalNow {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = makeFormatter(timeZone || DEFAULT_TIMEZONE);
  } catch {
    fmt = makeFormatter(DEFAULT_TIMEZONE);
  }
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  const hour = Number(parts.hour) % 24; // manche Engines liefern "24" für Mitternacht
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + Number(parts.minute),
    weekday: WEEKDAYS_EN.indexOf(parts.weekday),
  };
}

function makeFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
}

/** 'HH:MM' → Minuten seit Mitternacht, sonst null. */
export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function positiveMinutes(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Spieldauer (Minuten) nach Altersklasse. */
export function matchDuration(ageClass: string | null | undefined): number {
  switch ((ageClass ?? '').toLowerCase()) {
    case 'sen':
    case 'u19':
    case 'u18':
      return 90;
    case 'ue32':
    case 'u17':
    case 'u16':
      return 80;
    case 'u15':
    case 'u14':
      return 70;
    case 'u13':
    case 'u12':
      return 60;
    case 'u11':
    case 'u10':
      return 50;
    default:
      return 40;
  }
}

const DAY_KEYS: string[][] = [
  ['so', 'sun', 'sunday', 'sonntag'],
  ['mo', 'mon', 'monday', 'montag'],
  ['di', 'tue', 'tuesday', 'dienstag'],
  ['mi', 'wed', 'wednesday', 'mittwoch'],
  ['do', 'thu', 'thursday', 'donnerstag'],
  ['fr', 'fri', 'friday', 'freitag'],
  ['sa', 'sat', 'saturday', 'samstag'],
];

/**
 * Regulärer Trainingstag aus teams.settings.days[weekday].
 * Erwartetes Format: settings.days ist ein Array (Index = Date.getDay(), 0 = Sonntag)
 * oder ein Objekt mit denselben Zahlen als Schlüssel; zusätzlich werden die Schlüssel
 * 'mo'…'so' bzw. 'mon'…'sun' akzeptiert. Ein Eintrag ist ein Objekt mit zeit 'HH:MM'
 * und dauer (Minuten). null/false bzw. aktiv: false = kein Training.
 */
export function trainingForWeekday(settings: unknown, weekday: number): TrainingDay | null {
  const s = (settings ?? {}) as Record<string, unknown>;
  const days = s.days as unknown;
  if (!days || typeof days !== 'object') return null;

  let entry: unknown;
  if (Array.isArray(days)) {
    entry = days[weekday];
  } else {
    const obj = days as Record<string, unknown>;
    for (const key of [String(weekday), ...DAY_KEYS[weekday]]) {
      if (key in obj) {
        entry = obj[key];
        break;
      }
    }
  }
  if (!entry) return null;

  // "true" = Trainingstag mit Standardzeit aus settings.zeit / settings.dauer
  const e = (entry === true ? { zeit: s.zeit, dauer: s.dauer } : entry) as Record<string, unknown>;
  if (typeof e !== 'object' || e === null) return null;
  if (e.aktiv === false || e.active === false || e.on === false) return null;

  const start = parseTime(e.zeit ?? e.time);
  if (start === null) return null;
  const duration = positiveMinutes(e.dauer ?? e.duration) ?? positiveMinutes(s.dauer) ?? DEFAULT_TRAINING_MINUTES;
  return { start, duration };
}

/**
 * Alle Einheiten eines Teams an einem Tag:
 *  - Spiele (Dauer nach Altersklasse); an Spieltagen entfällt das reguläre Training
 *  - reguläres Training laut settings.days, außer abgesagt (calendar_overrides.cancel)
 *    oder durch einen Termin mit replaces_training ersetzt
 *  - Override ohne cancel/extra mit Zeit/Dauer = verlegtes reguläres Training
 *  - Zusatztraining (calendar_overrides.extra) mit eigener Zeit/Dauer
 */
export function sessionsForDay(input: {
  settings: unknown;
  ageClass: string | null | undefined;
  weekday: number;
  matches: MatchRow[];
  override: OverrideRow | null;
  replacesTraining: boolean;
  /** Tag liegt in einer geplanten Pause: kein reguläres Training (Spiele und Zusatztraining bleiben) */
  inBreak?: boolean;
}): PlannedSession[] {
  const out: PlannedSession[] = [];
  const matchMinutes = matchDuration(input.ageClass);
  for (const m of input.matches) {
    const start = parseTime(m.time);
    if (start !== null) out.push({ kind: 'match', start, duration: matchMinutes });
  }

  const regularBase = trainingForWeekday(input.settings, input.weekday);
  const ov = input.override;
  let regular = input.matches.length === 0 && !input.replacesTraining && !input.inBreak ? regularBase : null;

  if (ov?.cancel) {
    regular = null;
  } else if (ov && !ov.extra && regular) {
    regular = {
      start: parseTime(ov.time) ?? regular.start,
      duration: positiveMinutes(ov.duration) ?? regular.duration,
    };
  }
  if (regular) out.push({ kind: 'training', ...regular });

  if (ov?.extra) {
    const start = parseTime(ov.time) ?? regularBase?.start ?? null;
    if (start !== null) {
      out.push({
        kind: 'extra',
        start,
        duration: positiveMinutes(ov.duration) ?? regularBase?.duration ?? DEFAULT_TRAINING_MINUTES,
      });
    }
  }
  return out;
}

/** true, wenn eine Einheit vor 30 bis < 45 Minuten geendet hat (ein Cron-Lauf alle 15 Minuten trifft genau einmal). */
export function rpeReminderDue(sessions: PlannedSession[], nowMinutes: number, delay: number = RPE_WINDOW.from): boolean {
  return sessions.some((s) => {
    const sinceEnd = nowMinutes - (s.start + s.duration);
    return sinceEnd >= delay && sinceEnd < delay + 15;
  });
}

/** true zwischen 08:00 und 08:14 Ortszeit. */
export function morningCheckDue(nowMinutes: number, at: number = MORNING_WINDOW.from): boolean {
  return nowMinutes >= at && nowMinutes < at + 15;
}

/** true montags und donnerstags 17:00–17:14 Ortszeit. */
export function programReminderDue(nowMinutes: number, weekday: number): boolean {
  return (PROGRAM_REMINDER.weekdays as readonly number[]).includes(weekday) && nowMinutes >= PROGRAM_REMINDER.at && nowMinutes < PROGRAM_REMINDER.at + 15;
}

/** true, wenn eine Abwesenheit (to_date null = offen) den Tag abdeckt. */
export function absenceCovers(a: { from_date: string; to_date: string | null }, day: string): boolean {
  return a.from_date <= day && (a.to_date === null || a.to_date >= day);
}

/** Push-Texte nach Profilsprache. */
export const PUSH_TEXT = {
  rpe: {
    de: { title: "Wie hart war's heute?", body: 'Trag kurz deine RPE ein – dauert 10 Sekunden.' },
    en: { title: 'How hard was today?', body: 'Log your RPE quickly – it takes 10 seconds.' },
  },
  wellness: {
    de: { title: 'Guten Morgen!', body: 'Morgen-Check: Wie hast du geschlafen?' },
    en: { title: 'Good morning!', body: 'Morning check: How did you sleep?' },
  },
  program: {
    de: { title: 'Dein Pausenprogramm', body: 'Schon trainiert? Hak deine Einheiten ab – jede bringt XP.' },
    en: { title: 'Your break programme', body: 'Trained already? Tick off your sessions – each one earns XP.' },
  },
} as const;

export type ReminderKind = keyof typeof PUSH_TEXT;

export function pushText(kind: ReminderKind, lang: string | null | undefined): { title: string; body: string } {
  return PUSH_TEXT[kind][lang === 'en' ? 'en' : 'de'];
}
