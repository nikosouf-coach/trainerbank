// Umfragen: Abstimmungen (eine Frage mit Antworten) und Fragebögen (mehrere Fragen: Auswahl, Skala 1–5, Freitext) für
// das ganze Team oder eine Gruppe – mit Namen oder anonym. Anonym heißt: niemand sieht, wer was geantwortet hat, und
// Ergebnisse gibt es erst ab drei Antworten (sonst ließe sich erraten, wer was gesagt hat). Freitexte sieht nur das
// Trainerteam. Spieler starten Abstimmungen nur, wenn das Trainerteam es erlaubt – dann immer mit Namen und für das
// ganze Team. Reine Logik ohne UI und ohne Datenbank; die Grenzen gelten genauso in der Datenbank.
import type { Lang, Player, Poll, PollAnswer, PollKind, PollQResult, PollQType, PollQuestion, PollResult, PollResultsVis, PollValue, TeamData, TeamSettings } from "./types";

export const POLL_LIMITS = { title: 120, intro: 600, questions: 15, qtext: 200, options: 10, option: 80, label: 30, text: 500, author: 80 } as const;
export const POLL_QTYPES: PollQType[] = ["single", "multi", "scale", "text"];
export const SCALE_STEPS = [1, 2, 3, 4, 5] as const;
/** Anonyme Umfragen: Ergebnisse erst ab so vielen Antworten */
export const ANON_MIN = 3;
/** Spieler: höchstens so viele eigene Abstimmungen gleichzeitig */
export const PLAYER_OPEN_MAX = 2;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const arr = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
/** Höchstens max Zeichen, ohne ein Emoji (Ersatzpaar) zu zerschneiden – die Datenbank lehnt halbe Zeichen ab */
export function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const r = s.slice(0, max), last = r.charCodeAt(r.length - 1);
  return (last >= 0xd800 && last <= 0xdbff ? r.slice(0, -1) : r).trimEnd();
}
/** eine Zeile (Titel, Frage, Antwort): ohne Steuerzeichen und Zeilenumbrüche */
function line(s: unknown, max: number): string {
  return cut(String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim(), max);
}
/** Absatz (Einleitung, Freitext): Zeilenumbrüche bleiben, höchstens eine Leerzeile */
function para(s: unknown, max: number): string {
  return cut(String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ ]{2,}/g, " ")
    .replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim(), max);
}
const isChoice = (t: PollQType): boolean => t === "single" || t === "multi";

// ---------- Fragen und Umfragen bereinigen ----------
/** Frage bereinigen (null = unbrauchbar: ohne Text oder Auswahl mit weniger als zwei Antworten) */
export function cleanQuestion(q: Partial<PollQuestion>, i: number): PollQuestion | null {
  const type: PollQType = POLL_QTYPES.includes(q.type as PollQType) ? q.type as PollQType : "single";
  const text = line(q.text, POLL_LIMITS.qtext);
  if (!text) return null;
  const seen = new Set<string>(), options: string[] = [];
  if (isChoice(type)) for (const o of arr(q.options)) {
    const v = line(o, POLL_LIMITS.option);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase()); options.push(v);
    if (options.length >= POLL_LIMITS.options) break;
  }
  if (isChoice(type) && options.length < 2) return null;
  const id = typeof q.id === "string" && /^[a-z0-9]{1,8}$/.test(q.id) ? q.id : "q" + (i + 1);
  return { id, type, text, options, required: q.required !== false, lo: type === "scale" ? line(q.lo, POLL_LIMITS.label) : "", hi: type === "scale" ? line(q.hi, POLL_LIMITS.label) : "" };
}
/**
 * Umfrage bereinigen. Abstimmung: genau eine Auswahlfrage, ihr Text ist der Titel. Fragebogen: bis zu 15 Fragen mit
 * eindeutigen IDs (doppelte bekommen eine freie Nummer).
 */
export function cleanPoll(p: Partial<Poll> & { id: string }): Poll {
  const kind: PollKind = p.kind === "survey" ? "survey" : "quick";
  const raw = arr(p.questions).map(q => (q && typeof q === "object" ? q : {}) as Partial<PollQuestion>);
  let title = line(p.title, POLL_LIMITS.title), qs: PollQuestion[];
  if (kind === "quick") {
    // Abstimmung: die erste Auswahlfrage; ihr Text ist der Titel (fehlt der Titel, gilt der Fragetext)
    const first = raw.find(q => q.type === "single" || q.type === "multi") || raw[0] || {};
    if (!title) title = line(first.text, POLL_LIMITS.title);
    const c = cleanQuestion({ ...first, id: "q1", type: first.type === "multi" ? "multi" : "single", text: title, required: true }, 0);
    qs = c ? [c] : [];
  } else {
    qs = raw.map((q, i) => cleanQuestion(q, i)).filter((q): q is PollQuestion => !!q).slice(0, POLL_LIMITS.questions);
    const used = new Set<string>();
    qs = qs.map(q => {
      let id = q.id, n = 1;
      while (used.has(id)) id = "q" + (n++);
      used.add(id);
      return id === q.id ? q : { ...q, id };
    });
  }
  return {
    id: p.id, kind, title, intro: kind === "survey" ? para(p.intro, POLL_LIMITS.intro) : "", questions: qs,
    anonymous: !!p.anonymous, results: p.results === "staff" ? "staff" : "all",
    groupId: typeof p.groupId === "string" && p.groupId ? p.groupId : null,
    until: typeof p.until === "string" && ISO.test(p.until) ? p.until : null,
    closed: !!p.closed, byPlayer: !!p.byPlayer, authorPid: typeof p.authorPid === "string" ? p.authorPid : null,
    author: line(p.author, POLL_LIMITS.author), createdBy: typeof p.createdBy === "string" ? p.createdBy : null,
    created: typeof p.created === "string" ? p.created : "",
    answers: typeof p.answers === "number" && Number.isInteger(p.answers) && p.answers > 0 ? p.answers : 0,
  };
}
/** Kann so gespeichert werden (Titel und mindestens eine Frage) */
export const pollReady = (p: Poll): boolean => !!p.title && p.questions.length > 0 && (p.kind === "survey" || p.questions.length === 1);

/** Leere Frage für den Fragebogen */
export const blankQuestion = (id: string, type: PollQType = "single"): PollQuestion =>
  ({ id, type, text: "", options: isChoice(type) ? ["", ""] : [], required: true, lo: "", hi: "" });
/** Neue Abstimmung bzw. neuer Fragebogen (Standard: Abstimmung mit Namen und Ergebnissen für alle; Fragebogen anonym, Ergebnisse fürs Trainerteam) */
export function newPoll(kind: PollKind, id: string): Poll {
  return {
    id, kind, title: "", intro: "", questions: kind === "quick" ? [blankQuestion("q1")] : [blankQuestion("q1", "scale")],
    anonymous: kind === "survey", results: kind === "survey" ? "staff" : "all", groupId: null, until: null, closed: false,
    byPlayer: false, authorPid: null, author: "", createdBy: null, created: "", answers: 0,
  };
}
/** Nächste freie Frage-ID */
export const nextQuestionId = (qs: Pick<PollQuestion, "id">[]): string => { let n = qs.length + 1; while (qs.some(q => q.id === "q" + n)) n++; return "q" + n; };

// ---------- Antworten ----------
/** Antworten prüfen und bereinigen (null = ungültig, z. B. Pflichtfrage fehlt oder nichts beantwortet) */
export function cleanAnswers(p: Pick<Poll, "questions">, a: Record<string, unknown>): Record<string, PollValue> | null {
  const out: Record<string, PollValue> = {};
  for (const q of p.questions) {
    const v = a[q.id];
    let ok: PollValue | undefined;
    if (q.type === "single") { if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < q.options.length) ok = v; }
    else if (q.type === "multi") {
      const L = [...new Set(arr(v).filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x < q.options.length))].sort((x, y) => x - y);
      if (L.length) ok = L;
    } else if (q.type === "scale") { if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) ok = v; }
    else { const t = para(v, POLL_LIMITS.text); if (t) ok = t; }
    if (ok === undefined) { if (q.required) return null; continue; }
    out[q.id] = ok;
  }
  return Object.keys(out).length ? out : null;
}
export const answerOf = (D: Pick<TeamData, "pollAnswers">, pollId: string, pid: string): PollAnswer | null =>
  D.pollAnswers.find(a => a.pollId === pollId && a.pid === pid) || null;

// ---------- Status, Zielgruppe ----------
export const pollOpen = (p: Pick<Poll, "closed" | "until">, today: string): boolean => !p.closed && (!p.until || today <= p.until);
/** Spieler, an die sich die Umfrage richtet (aktive Spieler des Teams bzw. der Gruppe) */
export const pollTargets = (D: Pick<TeamData, "players">, p: Pick<Poll, "groupId">): Player[] =>
  D.players.filter(x => x.active !== false && (!p.groupId || (x.groups || []).includes(p.groupId)));
export const isPollTarget = (p: Pick<Poll, "groupId">, player: Pick<Player, "groups" | "active">): boolean =>
  player.active !== false && (!p.groupId || (player.groups || []).includes(p.groupId));
/** Umfragen, die ein Spieler sieht: an ihn gerichtet oder von ihm gestartet (neueste zuerst; laufende vor beendeten) */
export function pollsFor(D: Pick<TeamData, "polls" | "players">, pid: string, today: string): Poll[] {
  const me = D.players.find(x => x.id === pid);
  const L = D.polls.filter(p => p.authorPid === pid || (me ? isPollTarget(p, me) : false));
  return sortPolls(L, today);
}
export const sortPolls = (L: Poll[], today: string): Poll[] =>
  [...L].sort((a, b) => Number(pollOpen(b, today)) - Number(pollOpen(a, today)) || (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
/** Laufende Umfragen an den Spieler ohne eigene Antwort (Startseite des Spielers), neueste zuerst */
export function pollsToAnswer(D: Pick<TeamData, "polls" | "players" | "pollAnswers">, pid: string, today: string): Poll[] {
  const me = D.players.find(x => x.id === pid);
  return me ? sortPolls(D.polls.filter(p => isPollTarget(p, me) && pollOpen(p, today) && !answerOf(D, p.id, pid)), today) : [];
}
/** Inhalt (Fragen, Zielgruppe, Anonymität, Sichtbarkeit) lässt sich nur ändern, solange niemand geantwortet hat */
export const pollEditable = (p: Pick<Poll, "answers">): boolean => p.answers === 0;
/** Wieder öffnen: ein abgelaufenes Ende entfällt */
export const reopened = (p: Poll, today: string): Poll => ({ ...p, closed: false, until: p.until && p.until < today ? null : p.until });
/** Dürfen Spieler Abstimmungen starten? (Einstellung des Trainerteams) */
export const playersMayPoll = (S: Pick<TeamSettings, "polls">): boolean => S.polls?.players === true;
/** Laufende eigene Abstimmungen eines Spielers (Grenze PLAYER_OPEN_MAX) */
export const openPollsBy = (D: Pick<TeamData, "polls">, pid: string, today: string): number => D.polls.filter(p => p.authorPid === pid && pollOpen(p, today)).length;
/** Abstimmung eines Spielers: immer mit Namen, fürs ganze Team, Ergebnisse für alle (wie die Datenbank es verlangt) */
export const asPlayerPoll = (p: Poll, pid: string): Poll =>
  ({ ...p, kind: "quick", intro: "", anonymous: false, results: "all", groupId: null, byPlayer: true, authorPid: pid });
/** Darf jemand die Umfrage beenden, ändern oder löschen? Trainerteam mit Recht „Nachrichten“ oder wer sie gestartet hat */
export const canManage = (p: Pick<Poll, "authorPid">, v: { staff: boolean; messages?: boolean; pid?: string | null }): boolean =>
  (v.staff && !!v.messages) || (!v.staff && !!v.pid && p.authorPid === v.pid);

// ---------- Ergebnisse ----------
export interface PollViewer { staff: boolean; pid?: string | null }
/**
 * Darf jemand die Ergebnisse sehen? Trainerteam immer; Spieler nur bei „für alle“ – nach der eigenen Antwort, nach dem
 * Ende oder bei der eigenen Abstimmung
 */
export const resultsVisible = (p: Pick<Poll, "results" | "closed" | "until" | "authorPid">, v: PollViewer, answered: boolean, today: string): boolean =>
  v.staff || (p.results === "all" && (answered || !pollOpen(p, today) || (!!v.pid && p.authorPid === v.pid)));
/** Kurzname wie im Chat: „Vorname N.“ */
const shortName = (x: Pick<Player, "vn" | "nn"> | undefined): string => x ? `${x.vn} ${(x.nn || "").slice(0, 1)}${x.nn ? "." : ""}`.trim() : "–";
/** Feste, vom Inhalt abhängige Reihenfolge (anonyme Freitexte: nicht nach Eingang, nicht nach Person) */
function byContent(a: string, b: string): number {
  const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  return h(a) - h(b) || (a < b ? -1 : a > b ? 1 : 0);
}
/**
 * Ergebnis einer Umfrage (wie poll_results in der Datenbank): Anzahl je Antwort bzw. Stufe, Schnitt der Skalen, bei
 * Umfragen mit Namen auch wer was gewählt hat; Freitexte nur für das Trainerteam (anonym ohne Namen). Anonym und
 * weniger als drei Antworten: keine Einzelergebnisse. Das Trainerteam sieht bei Umfragen mit Namen, wer noch fehlt.
 */
export function pollResult(D: Pick<TeamData, "players" | "pollAnswers">, p: Poll, v: PollViewer): PollResult {
  const targets = pollTargets(D, p), byId = new Map(D.players.map(x => [x.id, x] as const));
  const L = D.pollAnswers.filter(a => a.pollId === p.id && byId.has(a.pid));
  const n = L.length, hidden = p.anonymous && n < ANON_MIN;
  const name = (pid: string) => shortName(byId.get(pid));
  const questions: PollQResult[] = hidden ? [] : p.questions.map(q => {
    const vals = L.map(a => ({ pid: a.pid, v: a.answers[q.id] })).filter(x => x.v !== undefined && x.v !== null);
    if (isChoice(q.type)) {
      const counts = q.options.map(() => 0), voters = q.options.map(() => [] as string[]);
      let answered = 0;
      for (const x of vals) {
        const I = (Array.isArray(x.v) ? x.v : [x.v]).filter((i): i is number => typeof i === "number" && i >= 0 && i < counts.length);
        if (I.length) answered++;
        for (const i of I) { counts[i]++; voters[i].push(name(x.pid)); }
      }
      return p.anonymous ? { id: q.id, answered, counts, avg: null } : { id: q.id, answered, counts, avg: null, voters: voters.map(V => V.sort((a, b) => a.localeCompare(b))) };
    }
    if (q.type === "scale") {
      const counts = [0, 0, 0, 0, 0]; let sum = 0, k = 0;
      for (const x of vals) if (typeof x.v === "number" && Number.isInteger(x.v) && x.v >= 1 && x.v <= 5) { counts[x.v - 1]++; sum += x.v; k++; }
      return { id: q.id, answered: k, counts, avg: k ? Math.round((sum / k) * 10) / 10 : null };
    }
    const T = vals.filter(x => typeof x.v === "string" && x.v);
    if (!v.staff) return { id: q.id, answered: T.length, counts: [], avg: null };
    const texts = T.map(x => p.anonymous ? { text: x.v as string } : { text: x.v as string, name: name(x.pid) });
    return { id: q.id, answered: T.length, counts: [], avg: null, texts: p.anonymous ? texts.sort((a, b) => byContent(a.text, b.text)) : texts };
  });
  const res: PollResult = { pollId: p.id, n, targets: targets.length, hidden, questions };
  if (v.staff && !p.anonymous) {
    const done = new Set(L.map(a => a.pid));
    res.respondents = targets.filter(x => done.has(x.id)).map(x => ({ pid: x.id, name: name(x.id) }));
    res.missing = targets.filter(x => !done.has(x.id)).map(x => ({ pid: x.id, name: name(x.id) }));
  }
  return res;
}
/** Anteil einer Antwort in Prozent (0–100), bezogen auf alle, die die Frage beantwortet haben */
export const pct = (r: Pick<PollQResult, "counts" | "answered">, i: number): number =>
  r.answered > 0 ? Math.round(((r.counts[i] || 0) / r.answered) * 100) : 0;
/** Meistgewählte Antworten (bei Gleichstand mehrere; keine, solange niemand gewählt hat) */
export function leaders(r: Pick<PollQResult, "counts">): number[] {
  const m = Math.max(0, ...r.counts);
  return m > 0 ? r.counts.map((c, i) => c === m ? i : -1).filter(i => i >= 0) : [];
}

// ---------- Vorlagen ----------
export interface PollTemplate { key: string; kind: PollKind; title: string; intro: string; questions: PollQuestion[]; anonymous: boolean; results: PollResultsVis }
const q = (id: string, type: PollQType, text: string, options: string[] = [], required = true, lo = "", hi = ""): PollQuestion => ({ id, type, text, options, required, lo, hi });
/**
 * Vorlagen für häufige Fragen im Team. Abstimmungen mit Namen – Fahrt, Termin und Essen sehen alle, die Saisonplanung
 * nur das Trainerteam; Fragebögen anonym mit Ergebnissen fürs Trainerteam.
 */
export function pollTemplates(lang: Lang): PollTemplate[] {
  const en = lang === "en";
  const quick = (key: string, text: string, options: string[], multi = false, results: PollResultsVis = "all"): PollTemplate =>
    ({ key, kind: "quick", title: text, intro: "", questions: [q("q1", multi ? "multi" : "single", text, options)], anonymous: false, results });
  const survey = (key: string, title: string, intro: string, qs: PollQuestion[]): PollTemplate => ({ key, kind: "survey", title, intro, questions: qs, anonymous: true, results: "staff" });
  return en ? [
    quick("trip", "Away game: how are you getting there?", ["By team bus", "I'll get there myself", "I can't make it"]),
    quick("date", "Which dates work for you?", ["Friday", "Saturday", "Sunday"], true),
    quick("food", "Team night: what shall we eat?", ["Pizza", "Burgers", "Barbecue"]),
    quick("next", "Will you play for us next season?", ["Yes, I'm in", "Not sure yet", "No"], false, "staff"),
    survey("week", "Feedback on the training week", "Takes one minute. Your answers are anonymous.", [
      q("q1", "scale", "How hard was the week for you?", [], true, "very easy", "very hard"),
      q("q2", "scale", "How much did you enjoy training?", [], true, "not at all", "a lot"),
      q("q3", "single", "What was best?", ["Small-sided games", "Finishing", "Athletics", "Tactics"]),
      q("q4", "text", "What should we do better?", [], false),
    ]),
    survey("climate", "Team spirit", "Be honest – nobody sees who answered what.", [
      q("q1", "scale", "I feel comfortable in the team.", [], true, "not true", "very true"),
      q("q2", "scale", "We support each other.", [], true, "not true", "very true"),
      q("q3", "scale", "I know what the coaching staff expects of me.", [], true, "not true", "very true"),
      q("q4", "text", "What would make our team even better?", [], false),
    ]),
    survey("season", "Season feedback", "Your view helps us plan the next season.", [
      q("q1", "scale", "How happy are you with your development?", [], true, "not happy", "very happy"),
      q("q2", "scale", "How happy are you with your playing time?", [], true, "not happy", "very happy"),
      q("q3", "scale", "How well does the coaching staff explain what it expects?", [], true, "badly", "very well"),
      q("q4", "text", "What helped you most?", [], false),
      q("q5", "text", "What should we do differently next season?", [], false),
    ]),
  ] : [
    quick("trip", "Auswärtsspiel: Wie kommst du hin?", ["Mit dem Mannschaftsbus", "Ich komme selbst", "Ich kann nicht"]),
    quick("date", "Welche Termine passen dir?", ["Freitag", "Samstag", "Sonntag"], true),
    quick("food", "Mannschaftsabend: Was essen wir?", ["Pizza", "Burger", "Grillen"]),
    quick("next", "Spielst du nächste Saison bei uns?", ["Ja, ich bin dabei", "Noch unsicher", "Nein"], false, "staff"),
    survey("week", "Feedback zur Trainingswoche", "Dauert eine Minute. Deine Antworten sind anonym.", [
      q("q1", "scale", "Wie anstrengend war die Woche für dich?", [], true, "sehr locker", "sehr hart"),
      q("q2", "scale", "Wie viel Spaß hat dir das Training gemacht?", [], true, "gar keinen", "sehr viel"),
      q("q3", "single", "Was war am besten?", ["Spielformen", "Torschuss", "Athletik", "Taktik"]),
      q("q4", "text", "Was sollen wir besser machen?", [], false),
    ]),
    survey("climate", "Teamklima", "Sei ehrlich – niemand sieht, wer was geantwortet hat.", [
      q("q1", "scale", "Ich fühle mich im Team wohl.", [], true, "stimmt nicht", "stimmt genau"),
      q("q2", "scale", "Wir unterstützen uns gegenseitig.", [], true, "stimmt nicht", "stimmt genau"),
      q("q3", "scale", "Ich weiß, was das Trainerteam von mir erwartet.", [], true, "stimmt nicht", "stimmt genau"),
      q("q4", "text", "Was würde unser Team noch besser machen?", [], false),
    ]),
    survey("season", "Saison-Feedback", "Deine Sicht hilft uns, die nächste Saison zu planen.", [
      q("q1", "scale", "Wie zufrieden bist du mit deiner Entwicklung?", [], true, "unzufrieden", "sehr zufrieden"),
      q("q2", "scale", "Wie zufrieden bist du mit deiner Spielzeit?", [], true, "unzufrieden", "sehr zufrieden"),
      q("q3", "scale", "Wie gut erklärt das Trainerteam, was es von dir erwartet?", [], true, "schlecht", "sehr gut"),
      q("q4", "text", "Was hat dir am meisten geholfen?", [], false),
      q("q5", "text", "Was sollen wir in der nächsten Saison anders machen?", [], false),
    ]),
  ];
}
/** Umfrage aus einer Vorlage */
export const fromTemplate = (t: PollTemplate, id: string): Poll =>
  cleanPoll({ ...newPoll(t.kind, id), title: t.title, intro: t.intro, questions: t.questions.map(x => ({ ...x, options: [...x.options] })), anonymous: t.anonymous, results: t.results });
