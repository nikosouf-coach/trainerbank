// Demo-Mannschaft: für den Demo-Modus, für Tests und für „Beispieldaten laden“ (App-Review).
import { classDef, defaultPrinciples, defaultSettings, groupOf, isGrowthAge, modsFor, sleepTarget } from "./classes";
import { addDays, ageOn, diff, iso, monday, parse, rng } from "./dates";
import { dutySuggest, fineSuggest } from "./duties";
import { createEngine } from "./engine";
import { duePeriods, periodStart, seasonStart } from "./kasse";
import { translator } from "./i18n";
import { artOf, defaultProgram, phaseWeeks, weekItems } from "./prep";
import type { Chat, ChatMsg, Goal, FeeDef, FineEntry, Wellness, Contact, Phase, PhaseKind, TeamGroup, AttStatus, BoardItem, ClassKey, Depth, Drawing, Exercise, Lang, Team, TeamData, TestResult, Modules, TeamSettings, Principles, DayUnit, UnitArt } from "./types";
import { cleanUnit, freeDateSlot, isGoalkeeper, shiftTime } from "./units";
import { emptyTeamData } from "./types";
import { challengeDefsFor, fromDef } from "./challenge";
import { demoPeople } from "./chat";
import { compsOf, posGroupOf } from "./dev";
import { demoMatchPlans } from "./demoMatch";
import { demoScouting } from "./demoScout";

export const DEMO_NAMES: [string, string, string][] = [["Luca", "Brenner", "TW"], ["Jonas", "Albers", "IV"], ["Elias", "Kraft", "IV"], ["Mats", "Ehlert", "IV"], ["Noah", "Petersen", "RV"], ["Leon", "Yildiz", "LV"], ["Finn", "Hartmann", "RV"], ["Ben", "Okafor", "DM"], ["Paul", "Wiese", "ZM"], ["Tim", "Sander", "ZM"], ["Emil", "Rasch", "DM"], ["Milan", "Kovač", "OM"], ["Arda", "Demir", "OM"], ["Nico", "Lindner", "LM"], ["Samuel", "Asante", "RM"], ["Jan", "Vogt", "LM"], ["Henry", "Böhm", "ST"], ["Malik", "Haddad", "ST"], ["Ole", "Brandt", "ST"], ["Kian", "Weber", "TW"], ["Lennard", "Fuchs", "IV"], ["David", "Neumann", "ZM"]];
const OPP = ["SV Nordheim", "TuS Rheinblick", "FC Eintracht Waldau", "SpVgg Ostfeld", "VfR Lindenhof", "DJK Sonnenberg", "BV Hafenstadt", "SC Bergtal", "Rot-Weiß Auenfeld", "TSV Mühlbach", "SG Kirchdorf", "1. FC Talheim", "SV Grünwiese"];

/** Demo-Team; `over` übernimmt die in der Einrichtung gewählten Module und Trainingstage. */
export function demoTeam(cls: ClassKey = "u19", depth: Depth = "basis", lang: Lang = "de",
  over: { modules?: Modules; settings?: TeamSettings; principles?: Principles; club?: string; team?: string; accent?: string; logo?: string | null } = {}): Team {
  const c = classDef(cls);
  return {
    // Ohne Vereinsnamen zeigt die App nur den Mannschaftsnamen (kein „Mein Verein“)
    id: "demo", club: (over.club || "").trim(), name: (over.team || "").trim() || (c.team ? c.team[lang] : cls.toUpperCase()), accent: over.accent || "#0b3d91",
    cls, depth, settings: over.settings ? { ...defaultSettings(), ...over.settings } : defaultSettings(), principles: over.principles || defaultPrinciples(groupOf(cls)),
    modules: over.modules ? { ...over.modules } : modsFor(depth, cls), joinCode: "DEMO-U19K", staffCode: "DEMO-STAF", logo: over.logo || null,
  };
}

/** Erzeugt eine vollständige Demo-Mannschaft relativ zu `now` (deterministisch). */
export function buildDemo(team: Team, lang: Lang, now: Date = new Date()): TeamData {
  const D = emptyTeamData(team);
  const r = rng(19), c = classDef(team.cls), grp = c.grp, TODAY = iso(now), en = lang === "en";
  const { tf } = translator(lang);
  let uid = 1; const nid = (): string => "d" + (uid++);
  D.players = DEMO_NAMES.map((n, i) => {
    const a = c.ages[0] + Math.floor(r() * (c.ages[1] - c.ages[0] + 1));
    const bd = new Date(now.getFullYear() - a, Math.floor(r() * 12), 1 + Math.floor(r() * 27));
    if (bd > new Date(now.getFullYear() - a, now.getMonth(), now.getDate())) bd.setFullYear(bd.getFullYear() - 1);
    return { id: "p" + (i + 1), vn: n[0], nn: n[1], pos: n[2], nr: i + 1, geb: iso(bd) };
  });
  if (grp === "akt") {
    const o = c.k === "ue32" ? 6 : 0;
    D.players[2].geb = iso(new Date(now.getFullYear() - 36 - o, 2, 4)); D.players[7].geb = iso(new Date(now.getFullYear() - 33 - o, 5, 12)); D.players[16].geb = iso(new Date(now.getFullYear() - 38 - o, 8, 20));
  }
  const sd = team.settings.spieltag, nextMD = addDays(TODAY, ((sd - parse(TODAY).getDay()) + 7) % 7 || 7);
  let oi = 0;
  for (let k = -7; k <= 6; k++) { const d = addDays(nextMD, 7 * k); if (k === 3) continue; D.matches.push({ id: nid(), date: d, zeit: team.settings.anstoss, gegner: OPP[oi++ % OPP.length], heim: k % 2 === 0, comp: "liga" }); }
  D.matches.push({ id: nid(), date: addDays(nextMD, 10), zeit: "19:30", gegner: "SC Bergtal", heim: true, comp: "pokal" });
  D.events.push({ id: nid(), date: addDays(nextMD, 5), zeit: "21:00", titel: en ? "Team night" : "Mannschaftsabend", typ: "abend", ersetzt: false });
  D.events.push({ id: nid(), date: addDays(nextMD, 1), zeit: "19:00", titel: en ? "Team photo" : "Teamfoto", typ: "foto", ersetzt: false });
  D.events.push({ id: nid(), date: addDays(nextMD, 15), zeit: "", titel: en ? "Autumn break – no training" : "Herbstferien – trainingsfrei", typ: "frei", ersetzt: true });
  D.absences.push({ id: nid(), pid: "p15", typ: "verletzung", von: addDays(TODAY, -9), bis: null, stufe: 2, notiz: en ? "Strain after a sprint" : "Zerrung nach Sprint", area: "hams:r" });
  D.absences.push({ id: nid(), pid: "p3", typ: "verletzung", von: addDays(TODAY, -30), bis: addDays(TODAY, -10), stufe: 4, notiz: en ? "Sprained ankle" : "Umgeknickt", area: "ankle:r" });
  D.absences.push({ id: nid(), pid: "p11", typ: "urlaub", von: addDays(TODAY, 2), bis: addDays(TODAY, 10), stufe: null, notiz: "" });
  D.absences.push({ id: nid(), pid: "p19", typ: grp === "akt" ? "arbeit" : "schule", von: addDays(TODAY, -1), bis: addDays(TODAY, 3), stufe: null, notiz: "" });
  D.absences.push({ id: nid(), pid: "p8", typ: "krank", von: addDays(TODAY, -1), bis: addDays(TODAY, 1), stufe: null, notiz: "" });
  const E = createEngine(D, { lang, now });
  for (let k = 42; k >= 1; k--) {
    const d = addDays(TODAY, -k), m = E.matchOn(d);
    if (m) D.sessions.push({ date: d, typ: "Spiel", dauer: E.matchMin(), zeit: m.zeit, md: "MD", ziel: E.matchRpe() });
    else if (E.isTraining(d)) {
      const md = E.mdOf(d).md, pr = team.principles[md] || { kind: "aufbau", rpe: 6 }; if (pr.kind === "frei") continue;
      D.sessions.push({ date: d, typ: "Training", dauer: E.durOf(d), zeit: E.zeitOf(d), md, ziel: Math.min(E.CAP, pr.rpe), kind: pr.kind });
    }
  }
  const spike = "p6", low = "p20", sleepy = "p10", sore = "p17";
  for (const s of D.sessions) {
    D.att[s.date] = {};
    for (const p of D.players) {
      const ab = E.absenceOn(p.id, s.date); const st: AttStatus | null = ab ? null : (r() < 0.9 ? "da" : (r() < 0.6 ? "ent" : "unent"));
      if (st) D.att[s.date][p.id] = st;
      if (st !== "da" || grp === "u11") continue;
      let rpe = s.ziel + Math.round((r() - 0.5) * 2.4); if (p.id === spike && diff(s.date, TODAY) <= 7) rpe += 2; if (p.id === low) rpe -= 3; rpe = Math.max(1, Math.min(10, rpe));
      let min = s.dauer;
      if (s.typ === "Spiel") {
        const MM = E.matchMin(); min = p.pos === "TW" && p.id !== "p1" ? 0 : (r() < 0.7 ? MM : Math.round(15 + r() * 40));
        if (p.id === low) min = 10; if (p.id === spike && diff(s.date, TODAY) <= 7) min = MM; if (grp === "akt" && ["p3", "p8", "p17", "p12"].includes(p.id)) min = MM;
      }
      if (p.id === spike && diff(s.date, TODAY) > 7 && diff(s.date, TODAY) <= 28 && r() < 0.5) continue;
      if (min === 0) continue;
      (D.rpe[p.id] ||= {})[s.date] = { rpe, min };
    }
  }
  if (grp !== "u11") for (const p of D.players) {
    for (let k = 27; k >= 0; k--) {
      const d = addDays(TODAY, -k);
      if (r() < 0.75) {
        const tg = sleepTarget(ageOn(p.geb, now)); let s4 = 8 + Math.round(r() * 4), h = tg[0] + Math.round(r() * 3) * 0.5;
        if (p.id === sleepy && k <= 6) { h = tg[0] - 1.5 + Math.round(r()) * 0.5; s4 += 4; }
        if (p.id === sore && k === 0) s4 += 7;
        (D.well[p.id] ||= {})[d] = { sum: s4, schlaf: h, beschw: p.id === sore && k === 0 ? "clear" : "none" };
      }
    }
  }
  // Beschwerden mit Körperregion: deutlich hinterer Oberschenkel, leicht erkältet (nur oberhalb des Halses)
  const sw = D.well[sore]?.[TODAY]; if (sw) { sw.areas = ["hams:r"]; sw.ort = en ? "after a sprint" : "nach Sprint";
    sw.pain = { hams: { nrs: 6, q: ["pull"], onset: "sudden", since: "today", when: ["sprint"], cause: "noncontact", train: "limited" } }; }
  // Beschwerden der letzten Wochen (für „Beschwerden im Team“): Leiste gehäuft, Sprunggelenk, Knie
  if (grp !== "u11") {
    const past: [number, number, string, Wellness["pain"]][] = [
      [6, 4, "groin:l", { groin: { nrs: 3, q: ["pull"], onset: "gradual", when: ["shot", "after"], since: "days" } }],
      [8, 9, "groin:r", { groin: { nrs: 4, q: ["pull", "dull"], onset: "gradual", when: ["shot"], since: "week" } }],
      [12, 14, "groin:b", { groin: { nrs: 3, q: ["dull"], onset: "gradual", when: ["after", "morning"], since: "week" } }],
      [15, 6, "ankle:r", { ankle: { nrs: 4, q: ["stab"], onset: "sudden", cause: "contact", signs: ["swelling"], since: "days" } }],
      [17, 11, "knee:l", { knee: { nrs: 2, q: ["dull"], onset: "gradual", when: ["jump"], since: "week" } }],
    ];
    for (const [i, ago, area, pain] of past) {
      const pl = D.players[i]; if (!pl || pl.id === sore) continue;
      const d = addDays(TODAY, -ago), w = ((D.well[pl.id] ||= {})[d] ||= { sum: 12, schlaf: 8, beschw: "none" });
      w.beschw = "light"; w.areas = [area]; w.pain = pain;
    }
  }
  const cold = D.players.find(p => p.id !== sore && p.id !== sleepy && D.well[p.id]?.[TODAY]);
  if (cold) { const w = D.well[cold.id][TODAY]; w.beschw = "light"; w.areas = ["ill_up"]; }
  if (isGrowthAge(team.cls)) for (const p of D.players) {
    const spurt = ["p4", "p9", "p13", "p18"].includes(p.id); let h = 145 + Math.round(r() * 25);
    D.growth[p.id] = [-12, -9, -6, -3, 0].map(m => { const d = new Date(now); d.setMonth(d.getMonth() + m); const v = { date: iso(d), cm: Math.round(h * 10) / 10 }; h += spurt ? 2.2 + r() * 0.8 : 0.9 + r() * 0.8; return v; });
  }
  D.notes.p6 = en ? "Has done extra private gym sessions in recent days." : "Hat in den letzten Tagen privat zusätzlich im Gym trainiert.";
  const lastS = D.sessions[D.sessions.length - 1];
  if (lastS) ["p10", "p14", "p21"].forEach(id => { if (D.rpe[id]) delete D.rpe[id][lastS.date]; });
  if (grp !== "u11") {
    D.extra.p6 = [{ id: nid(), date: addDays(TODAY, -2), art: "gym", min: 60, rpe: 7 }, { id: nid(), date: addDays(TODAY, -4), art: "gym", min: 45, rpe: 6 }];
    D.extra.p13 = [{ id: nid(), date: addDays(TODAY, -1), art: "schule", min: 90, rpe: 5 }];
    D.pot.p6 = [{ id: nid(), cat: "ath", text: en ? "Acceleration and top speed are among the best in the team: use them deliberately in transitions." : "Antritt und Endgeschwindigkeit gehören zu den besten im Team: im Umschaltspiel gezielt einsetzen.", vis: true, src: "trainer" }];
    D.pot.p12 = [{ id: nid(), cat: "takt", text: en ? "Turn between the lines instead of laying the ball off." : "Zwischen den Linien aufdrehen statt abprallen lassen.", vis: true, src: "trainer" }];
    D.pot.p2 = [{ id: nid(), cat: "ment", text: en ? "Take on leadership in the back line (communication)." : "Führungsrolle in der Abwehrkette übernehmen (Kommandos).", vis: false, src: "trainer" }];
    const tg = sleepTarget(ageOn(D.players[9].geb, now));
    D.msgs.p10 = [{ id: nid(), date: addDays(TODAY, -1), typ: "info", text: tf("rs_sleep", { a: tg[0], b: tg[1] }), bis: addDays(TODAY, 5) }];
  }
  return D;
}

/** Beispielzeilen für den Spielplan-Import. */
export function sampleFixtures(team: Team, now: Date = new Date()): string {
  const TODAY = iso(now), WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const s = addDays(TODAY, ((team.settings.spieltag - parse(TODAY).getDay()) + 7) % 7 || 7);
  return [6, 7, 8].map((k, i) => {
    const d = parse(addDays(s, 7 * k)), home = i % 2 === 0, opp = ["VfL Weidenau", "FC Blau-Weiß Ostend", "SV Am Hang"][i];
    const own = team.club + " " + team.name;
    return `${WT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} | ${team.settings.anstoss} | ${home ? own + " - " + opp : opp + " - " + own}`;
  }).join("\n");
}

/**
 * Zusätzliche Demo-Daten für neuere Bausteine (Ergebnisse, Spieldaten, Noten, Videos).
 * Getrennt von buildDemo, damit die mit dem Prototyp abgeglichenen Daten unverändert bleiben.
 */
export function demoExtras(D: TeamData, lang: Lang, now: Date = new Date()): void {
  const r = rng(77), TODAY = iso(now), en = lang === "en";
  const past = D.matches.filter(m => m.date < TODAY).sort((a, b) => a.date < b.date ? -1 : 1);
  const attack = (pos: string) => ["ST", "OM", "LM", "RM"].includes(pos) ? 0.35 : ["ZM", "DM"].includes(pos) ? 0.12 : pos === "TW" ? 0 : 0.05;
  const texts = en
    ? ["Strong in duels, keep it up.", "Good runs in behind – finish more calmly.", "Organised the back line well.", "Too passive after losing the ball.", "Very good pressing, great energy.", "Decision-making in the final third can improve."]
    : ["Stark in den Zweikämpfen, weiter so.", "Gute Tiefenläufe – im Abschluss ruhiger bleiben.", "Kette gut organisiert.", "Nach Ballverlust zu passiv.", "Sehr gutes Pressing, tolle Energie.", "Entscheidungen im letzten Drittel verbessern."];
  let vid = 1, rid = 1;
  past.forEach((m, mi) => {
    const st: Record<string, { min: number; goals: number; assists: number; start: boolean }> = {};
    let own = 0;
    for (const p of D.players) {
      const e = D.rpe[p.id]?.[m.date]; const min = e ? e.min : 0; if (!min) continue;
      const g = r() < attack(p.pos) * (min / 90) ? (r() < 0.2 ? 2 : 1) : 0, a = r() < attack(p.pos) * 0.8 * (min / 90) ? 1 : 0;
      own += g; st[p.id] = { min, goals: g, assists: a, start: min >= 60 };
    }
    D.stats[m.id] = st;
    m.result = { own, opp: Math.floor(r() * 3) + (r() < 0.3 ? 1 : 0) };
    if (mi >= past.length - 3) {
      for (const pid of Object.keys(st)) {
        const rating = Math.round((5.6 + r() * 2.9 + Math.min(1, st[pid].goals * 0.6 + st[pid].assists * 0.3)) * 10) / 10;
        D.ratings.push({ id: "r" + (rid++), pid, date: m.date, kind: "spiel", rating: Math.min(10, rating), text: r() < 0.45 ? texts[Math.floor(r() * texts.length)] : "", vis: true });
      }
      D.videos.push({ id: "v" + (vid++), title: (en ? "Highlights vs " : "Highlights gegen ") + m.gegner, url: "https://example.com/video/" + m.date, date: m.date, matchId: m.id, pids: [], note: en ? "Full match and key scenes" : "Gesamtes Spiel und Schlüsselszenen", vis: true });
    }
  });
  // Trainingseindruck: nur Ausreißer (besonders gut/schwach), Standard = Durchschnitt (nicht gespeichert)
  const trs = D.sessions.filter(s => s.typ === "Training" && s.date < TODAY).slice(-4);
  const mk = (pid: string, date: string | undefined, mark: "good" | "poor", tags: string[], text: string, vis: boolean, slot = 0): void => {
    if (!date || (slot === 0 && D.att[date]?.[pid] !== "da")) return;
    D.ratings.push({ id: "r" + (rid++), pid, date, kind: "training", rating: null, text, vis, mark, tags, slot });
  };
  const [q0, , p0, l0] = [trs[0]?.date, trs[1]?.date, trs[2]?.date, trs[3]?.date];
  mk("p8", l0, "good", ["effort", "duels"], en ? "Very present in duels and pulled the others along." : "Sehr präsent in den Zweikämpfen, hat die anderen mitgezogen.", true);
  mk("p12", l0, "good", ["ideas", "quality"], "", true);
  mk("p13", l0, "poor", ["focus"], en ? "Seemed distracted – ask him personally if everything is okay." : "Wirkte unkonzentriert – kurz persönlich nachfragen, ob alles okay ist.", false);
  mk("p8", p0, "good", ["lead"], "", true);
  mk("p6", p0, "good", ["tempo"], "", true);
  mk("p13", q0, "poor", ["effort"], "", false);
  // Torhüter: Gegentore in der eigenen Spielzeit und Paraden (das letzte über volle Spielzeit gehaltene Spiel endet zu null)
  const cleanM = [...past].reverse().find(m => Object.entries(D.stats[m.id] || {}).some(([pid, x]) => x.min >= 85 && D.players.find(q => q.id === pid)?.pos === "TW"));
  if (cleanM?.result) cleanM.result = { own: Math.max(1, cleanM.result.own), opp: 0 };
  for (const m of past) for (const [pid, x] of Object.entries(D.stats[m.id] || {})) {
    const p = D.players.find(q => q.id === pid); if (!p || p.pos !== "TW" || !m.result) continue;
    x.conceded = x.min >= 85 ? m.result.opp : Math.round(m.result.opp * x.min / 90); x.saves = 1 + Math.floor(r() * 6);
  }
  // Leistungstests: zwei Testtage und wöchentlicher CMJ-Check; ein Spieler zeigt heute einen deutlichen Abfall
  const grp = classDef(D.team.cls).grp, base: Record<string, number> = {};
  let tid = 1;
  const add = (pid: string, test: TestResult["test"], date: string, value: number) => D.tests.push({ id: "t" + (tid++), pid, test, date, value });
  const days = [addDays(TODAY, -56), addDays(TODAY, -14)];
  if (grp !== "u11") for (const p of D.players) {
    const k = 0.92 + r() * 0.16; base[p.id] = k;
    days.forEach((d, i) => {
      const imp = i ? 0.985 + r() * 0.02 : 1;
      add(p.id, "sprint10", d, Math.round((grp === "u15" ? 1.98 : 1.82) * k * imp * 100) / 100);
      add(p.id, "sprint30", d, Math.round((grp === "u15" ? 4.85 : 4.35) * k * imp * 100) / 100);
      add(p.id, "ift", d, Math.round((grp === "u15" ? 18 : 19.5) / k * (i ? 1.02 : 1) * 2) / 2);
      add(p.id, "agility505", d, Math.round((grp === "u15" ? 2.65 : 2.42) * k * imp * 100) / 100);
      // Torwartdiagnostik: seitlicher Sprung und Abschlagweite
      if (p.pos === "TW") { add(p.id, "tw_lateral", d, Math.round((grp === "u15" ? 205 : 235) / k * (i ? 1.02 : 1))); add(p.id, "tw_kick", d, Math.round((grp === "u15" ? 42 : 52) / k * (i ? 1.03 : 1))); }
    });
    for (let w = 6; w >= 0; w--) {
      const d = addDays(TODAY, -7 * w - (w ? 0 : 1)), cm = (grp === "u15" ? 31 : 38) / k;
      const drop = p.id === "p6" && w === 0 ? 0.9 : 1;
      add(p.id, "cmj", d, Math.round(cm * (0.97 + r() * 0.06) * drop * 10) / 10);
    }
  } else for (const p of D.players) {
    add(p.id, "sprint10", days[1], Math.round((2.3 + r() * 0.3) * 100) / 100);
    add(p.id, "slalom", days[1], Math.round((13 + r() * 5) * 10) / 10);
    add(p.id, "standweit", days[1], Math.round(130 + r() * 50));
  }
  // Befund mit Beispiel-Auswertung (zeigt die KI-Auswertung im Demo-Modus)
  const inj = D.absences.find(a => a.typ === "verletzung");
  if (inj) D.findings.push({
    id: "demo-bf-1", pid: inj.pid, absenceId: inj.id, date: addDays(inj.von, 2), title: en ? "MRI posterior thigh (example)" : "MRT Oberschenkel hinten (Beispiel)",
    path: "demo:befund", mime: "application/pdf", consent: "schriftlich", aiAt: TODAY, note: "",
    ai: en
      ? "### Summary\nAccording to the report there is a strain / partial tear of the hamstrings (biceps femoris, long head) without tendon involvement.\n\n### What it means for training\n- No sprints, maximal shots or slide tackles for now.\n- Core, upper body and easy cycling are fine if pain-free.\n\n### Possible stage plan\n1. Individual/rehab: pain-free walking, isometric exercises, mobility – progress when daily life and easy jogging are pain-free.\n2. Partial training: technique without sprints, running up to about 70 % – progress when eccentric exercises (e.g. Nordic hamstrings) are pain-free and strength is at least 90 % of the other side.\n3. Full training: build sprints gradually to 100 %, duels – progress after at least two sessions without symptoms and clearance.\n4. Match fit: start with partial match time.\nDepending on severity 2–6 weeks are common; the range is wide.\n\n### Warning signs – stop immediately\n- Sharp pain, pulling during sprints, new swelling or bruising\n\n### Questions for the doctor or physio\n- How large is the injury and is the tendon involved?\n- When are sprints and eccentric training allowed?\n\nThis is not medical advice – the medical staff decides on the return."
      : "### Zusammenfassung\nLaut Befund liegt eine Zerrung bzw. ein Teilfaserriss der hinteren Oberschenkelmuskulatur (M. biceps femoris, langer Kopf) ohne Beteiligung der Sehne vor.\n\n### Bedeutung fürs Training\n- Vorerst keine Sprints, keine maximalen Schüsse, keine Grätschen.\n- Rumpf, Oberkörper und lockeres Radfahren sind möglich, wenn schmerzfrei.\n\n### Möglicher Stufenplan\n1. Individuell/Reha: schmerzfreies Gehen, isometrische Übungen, Beweglichkeit – weiter, wenn Alltag und lockeres Laufen schmerzfrei sind.\n2. Teiltraining: Technik ohne Sprints, Laufen bis ca. 70 % – weiter, wenn exzentrische Übungen (z. B. Nordic Hamstring) schmerzfrei sind und die Kraft im Seitenvergleich bei mindestens 90 % liegt.\n3. Volles Training: Sprints schrittweise bis 100 %, Zweikämpfe – weiter nach mindestens zwei beschwerdefreien Einheiten und Freigabe.\n4. Spielfähig: zunächst Teilzeit-Einsatz.\nJe nach Schwere sind 2–6 Wochen üblich, die Spanne ist groß.\n\n### Warnzeichen – sofort abbrechen\n- Stechender Schmerz, Ziehen beim Sprint, neue Schwellung oder Bluterguss\n\n### Fragen an Arzt oder Physio\n- Wie groß ist die Verletzung und ist die Sehne beteiligt?\n- Ab wann sind Sprints und exzentrisches Training erlaubt?\n\nDies ist keine medizinische Beratung – über die Rückkehr entscheidet das medizinische Personal.",
  });
  demoArchive(D, en);
  demoPhases(D, lang, TODAY);
  demoContacts(D, en);
  demoGroups(D, en, TODAY);
  demoUnits(D, lang, now);
  demoDev(D, lang, now);
  demoBlocks(D, lang, now);
  demoTasks(D, lang, TODAY);
  demoMatchPlans(D, lang, now);
  demoScouting(D, lang, now);
  const tw = D.players.filter(p => (p.groups || []).includes("g1")).map(p => p.id);
  if (tw.length) D.videos.push({ id: "v" + (vid++), title: en ? "Goalkeepers: build-up under pressure – 6 clips" : "Torhüter: Spieleröffnung unter Druck – 6 Clips", url: "https://example.com/video/tw-aufbau", date: addDays(TODAY, -2), matchId: null, pids: tw, groupIds: ["g1"], note: en ? "Watch before Thursday's goalkeeper session." : "Bitte bis zum TW-Training am Donnerstag anschauen.", vis: true });
  D.videos.push({ id: "v" + (vid++), title: en ? "Pressing triggers – clips for the back line" : "Pressing-Auslöser – Clips für die Abwehrkette", url: "https://example.com/video/pressing", date: null, matchId: null, pids: ["p2", "p3", "p4"], note: "", vis: true });
}

/** Dienste, Strafenkatalog (Automatik seit 3 Tagen an) und Beispiel-Aufgaben. */
function demoTasks(D: TeamData, lang: Lang, TODAY: string): void {
  const en = lang === "en", S = D.team.settings;
  if (!S.duties) S.duties = dutySuggest(lang);
  const money = groupOf(D.team.cls) === "akt";
  if (!S.fines) S.fines = fineSuggest(lang, money).map(r => r.trigger !== "manual" ? { ...r, on: true, since: addDays(TODAY, -3) } : r);
  demoKasse(D, lang, TODAY, money);
  let n = 1; const id = (): string => "tk" + (n++);
  const nextMatch = D.matches.filter(m => m.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const task = (title: string, due: string | null, staffId: string | null, pid: string | null, done = false, note = ""): void => {
    D.tasks.push({ id: id(), title, note, due, staffId, pid, groupId: null, done, doneAt: done ? TODAY + "T08:00:00Z" : null });
  };
  task(en ? "Reorder bibs (2 sets)" : "Leibchen nachbestellen (2 Sätze)", addDays(TODAY, 2), "s1", null);
  task(en ? "Cut set-piece clips" : "Standard-Clips schneiden", addDays(TODAY, 1), "s2", null);
  task(en ? "Check goalkeeper gloves" : "TW-Handschuhe prüfen", addDays(TODAY, 3), "s3", null);
  if (nextMatch) task(en ? "Fill in team sheet" : "Spielbericht vorbereiten", nextMatch.date, null, null);
  const ps = D.players.slice(0, 4);
  ps.forEach((p, i) => task(en ? "Bring your player pass" : "Spielerpass mitbringen", nextMatch?.date || addDays(TODAY, 5), null, p.id, i === 0,
    en ? "For the cup match the referee checks passes." : "Beim Pokalspiel kontrolliert der Schiri die Pässe."));
}

/** Mannschaftskasse: Monatsbeitrag seit Saisonbeginn, Zahlungen, Ausgaben; Senioren zusätzlich Geldstrafen. */
function demoKasse(D: TeamData, lang: Lang, TODAY: string, money: boolean): void {
  const en = lang === "en", S = D.team.settings;
  const from = seasonStart(TODAY) < addDays(TODAY, -60) ? seasonStart(TODAY) : addDays(TODAY, -60);
  const fee: FeeDef = { id: "fee1", name: en ? "Team kitty" : "Mannschaftskasse", amount: money ? 10 : 5, every: "month", from: from.slice(0, 8) + "01" };
  S.kasse = { on: true, currency: "EUR", money, showBalance: true, treasurer: null, payInfo: en ? "Cash at training (Daniel) – please bring the exact amount." : "Bar beim Training bei Daniel – bitte passend mitbringen.", fees: [fee] };
  let n = 1; const id = (): string => "ca" + (n++);
  const periods = duePeriods(fee, TODAY);
  D.players.forEach((p, i) => periods.forEach((per, j) => {
    // die meisten zahlen pünktlich, einige hängen 1–2 Monate hinterher
    const late = i % 6 === 2 ? 2 : i % 5 === 4 ? 1 : 0;
    if (j < periods.length - late) D.cash.push({ id: id(), date: periodStart(fee, per) > TODAY ? TODAY : addDays(periodStart(fee, per), 3 + (i % 5)), amount: fee.amount, kind: "in", cat: "fee", pid: p.id, feeId: fee.id, period: per, fineId: null, note: "" });
  }));
  if (D.players[7]) D.waivers.push({ pid: D.players[7].id, feeId: fee.id, period: "*" });
  D.cash.push({ id: id(), date: addDays(TODAY, -40), amount: 50, kind: "in", cat: "donation", pid: null, feeId: null, period: null, fineId: null, note: en ? "Sponsor: bakery Müller" : "Sponsor: Bäckerei Müller" });
  D.cash.push({ id: id(), date: addDays(TODAY, -18), amount: 64.5, kind: "out", cat: "event", pid: null, feeId: null, period: null, fineId: null, note: en ? "Team evening – pizza" : "Mannschaftsabend – Pizza" });
  D.cash.push({ id: id(), date: addDays(TODAY, -9), amount: 23.9, kind: "out", cat: "material", pid: null, feeId: null, period: null, fineId: null, note: en ? "Tape and first-aid spray" : "Tape und Eisspray" });
  if (money) {
    const give = (pid: string, rule: string, days: number, paid: boolean): void => {
      const r = (S.fines || []).find(x => x.id === rule); if (!r?.amount) return;
      const f: FineEntry = { id: "fm" + (n++), pid, rule, date: addDays(TODAY, -days), ref: null, amount: r.amount, note: "", status: paid ? "done" : "open", auto: false, dutyDate: null };
      D.fines.push(f);
      if (paid) D.cash.push({ id: id(), date: addDays(TODAY, -days + 2), amount: r.amount, kind: "in", cat: "fine", pid, feeId: null, period: null, fineId: f.id, note: "" });
    };
    const P = D.players;
    if (P[3]) give(P[3].id, "late", 12, true);
    if (P[9]) give(P[9].id, "yellow_talk", 6, false);
    if (P[2]) give(P[2].id, "kit", 4, false);
    if (P[12]) give(P[12].id, "late_match", 20, true);
  }
}

/**
 * Weitere Einheiten: Athletik & Prävention vor dem ersten Trainingstag der Woche (alle), Torwarttraining vor einem
 * späteren Trainingstag (Torhüter, TW-Trainer), eine Reha-Einheit für die Reha-Gruppe am nächsten Trainingstag.
 * Dazu RPE der vergangenen Einheiten, Sprünge der Torhüter, ein Eindruck aus dem Torwarttraining und ein Ablauf.
 * Hat die Einrichtung schon Einheiten festgelegt, gelten diese statt der Beispiele.
 */
function demoUnits(D: TeamData, lang: Lang, now: Date): void {
  if (groupOf(D.team.cls) === "u11" || !D.players.length) return;
  const en = lang === "en", S = D.team.settings, TODAY = iso(now), r = rng(41);
  const wds = Object.keys(S.days).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (!wds.length) return;
  const tw = D.groups.find(g => g.kind === "tw")?.id || null, reha = D.groups.find(g => g.kind === "reha");
  const sTw = D.staff.find(x => x.role === "tw")?.id || null, sPhy = D.staff.find(x => x.role === "physio")?.id || null;
  const mk = (p: Partial<DayUnit> & { slot: number; art: UnitArt }, from: string | null): DayUnit =>
    ({ ...cleanUnit({ title: "", zeit: "17:30", dauer: 30, rpe: null, groupId: null, staffId: null, inhalt: "", themes: [], ...p }), cancel: undefined, from });
  const since = addDays(TODAY, -70), units: Record<number, DayUnit[]> = {};
  const given = Object.entries(S.units || {}).filter(([, L]) => L?.length);
  if (given.length) {
    // Einheiten aus der Einrichtung übernehmen – seit zehn Wochen, damit Verlauf und Belastung gefüllt sind; Zuständige nach Rolle
    const sAth = D.staff.find(x => x.role === "athletik")?.id || sPhy;
    const who: Partial<Record<UnitArt, string | null>> = { tw: sTw, athletik: sAth, kraft: sAth, praev: sPhy, reha: sPhy };
    for (const [d, L] of given) units[Number(d)] = L.map(u => mk({ ...u, staffId: u.staffId || who[u.art] || null, groupId: u.groupId || (u.art === "reha" ? reha?.id || null : null) }, since));
  } else {
    const d0 = wds[0];
    units[d0] = [mk({ slot: 1, art: "athletik", title: en ? "Athletics & prevention" : "Athletik & Prävention", zeit: shiftTime(S.days[d0].zeit, -30), dauer: 30, rpe: 6, staffId: sPhy,
      inhalt: en ? "Running drills, jumps and landings, Nordic hamstrings (2 × 6)." : "Lauf-ABC, Sprünge und Landungen, Nordic Hamstrings (2 × 6)." }, since)];
    if (wds.length >= 2) {
      const d1 = wds.length >= 3 ? wds[wds.length - 2] : wds[1];
      units[d1] = [...(units[d1] || []), mk({ slot: (units[d1] || []).length + 1, art: "tw", zeit: shiftTime(S.days[d1].zeit, -60), dauer: 60, rpe: 7, groupId: tw, staffId: sTw,
        themes: ["hechten", "flanken", "eins"], inhalt: en ? "Diving sets left/right, crosses under pressure, 1 v 1 in the box." : "Hechtsprung-Serien links/rechts, Flanken unter Gegnerdruck, 1-gegen-1 im Strafraum." }, since)];
    }
  }
  S.units = units;
  let E = createEngine(D, { lang, now });
  const next = [1, 2, 3, 4, 5, 6, 7].map(i => addDays(TODAY, i)).find(d => E.isTraining(d));
  if (next && reha && D.players.some(p => (p.groups || []).includes(reha.id))) {
    const slot = freeDateSlot(D, next);
    if (slot) (D.units[next] ||= []).push(mk({ slot, art: "reha", title: en ? "Rehab group" : "Reha-Gruppe", zeit: shiftTime(E.zeitOf(next), -45), dauer: 45, rpe: 3, groupId: reha.id, staffId: sPhy,
      inhalt: en ? "Isometrics, eccentric hamstring work, running build-up on the side pitch." : "Isometrie, exzentrisches Beinbeuger-Training, Laufaufbau am Nebenplatz." }, null));
  }
  E = createEngine(D, { lang, now });
  // RPE der vergangenen Einheiten: wer beim Mannschaftstraining entschuldigt war, fehlt auch hier; einige vergessen den Eintrag
  for (let k = 42; k >= 1; k--) {
    const d = addDays(TODAY, -k);
    for (const u of E.unitsOn(d)) for (const p of E.unitMembers(u)) {
      if (E.absenceOn(p.id, d)) continue;
      const st = D.att[d]?.[p.id]; if (st && st !== "da") continue;
      if (r() < 0.12) continue;
      const rpe = Math.max(1, Math.min(10, E.unitRpe(u) + Math.round((r() - 0.5) * 2.4)));
      ((D.rpeU[p.id] ||= {})[d] ||= {})[u.slot] = { rpe, min: u.dauer, dives: u.art === "tw" ? 22 + Math.round(r() * 16) : null };
    }
  }
  // Sprünge der Torhüter im Mannschaftstraining und im Spiel
  for (const p of D.players.filter(q => isGoalkeeper(D, q))) for (const [d, e] of Object.entries(D.rpe[p.id] || {})) {
    const s = D.sessions.find(z => z.date === d); if (s) e.dives = s.typ === "Spiel" ? 6 + Math.round(r() * 10) : 8 + Math.round(r() * 12);
  }
  // Eindruck aus dem letzten Torwarttraining und Ablauf des nächsten
  const twPast = [...Array(14)].map((_, i) => addDays(TODAY, -1 - i)).find(d => E.unitsOn(d).some(u => u.art === "tw"));
  const gk = D.players.find(p => p.pos === "TW");
  if (twPast && gk) {
    const u = E.unitsOn(twPast).find(x => x.art === "tw")!;
    if (D.rpeU[gk.id]?.[twPast]?.[u.slot]) D.ratings.push({ id: "r-tw1", pid: gk.id, date: twPast, kind: "training", rating: null, vis: true, mark: "good", tags: ["diving", "crosses"], slot: u.slot,
      text: en ? "Very clean diving technique, commanded the box on crosses." : "Sehr saubere Hechtsprungtechnik, bei Flanken den Strafraum beherrscht." });
  }
  const twNext = [...Array(8)].map((_, i) => addDays(TODAY, i)).find(d => E.unitsOn(d).some(u => u.art === "tw"));
  if (twNext) {
    const u = E.unitsOn(twNext).find(x => x.art === "tw")!;
    const b = (sort: number, title: [string, string], min: number, text: [string, string], points: [string, string][]): void => {
      D.blocks.push({ id: "bltw" + sort, date: twNext, sort, title: en ? title[1] : title[0], min, staffId: sTw, exId: null, text: en ? text[1] : text[0], points: points.map(x => en ? x[1] : x[0]), drawing: null, photo: null, groupId: null, slot: u.slot });
    };
    b(0, ["Aufwärmen & Fangschule", "Warm-up & handling"], 15, ["Mobilisation, Fangen im Stand und in der Bewegung, kurze Reaktionsbälle.", "Mobility, handling standing and on the move, short reaction balls."],
      [["Hände hinter den Ball", "Hands behind the ball"], ["Erst sichern, dann aufstehen", "Secure first, then get up"]]);
    b(1, ["Hechtsprung-Serien", "Diving sets"], 20, ["4 × 6 Hechtsprünge je Seite, volle Pausen (ca. 90 s).", "4 × 6 dives per side, full rest (about 90 s)."],
      [["Abdruck mit dem ballnahen Bein", "Push off with the near leg"], ["Qualität vor Menge – bei Ermüdung abbrechen", "Quality over quantity – stop when tired"]]);
    b(2, ["Flanken unter Druck", "Crosses under pressure"], 25, ["Flanken von beiden Seiten mit 1–2 Gegenspielern, Kommandos laut.", "Crosses from both sides with 1–2 opponents, loud commands."],
      [["Früh entscheiden: kommen oder bleiben", "Decide early: come or stay"], ["Höchster Punkt", "Highest point"]]);
  }
}

/** Ablauf der nächsten zwei Trainingstage mit Zuständigkeiten (Co-Trainer, TW-Trainer, Physio). */
function demoBlocks(D: TeamData, lang: Lang, now: Date): void {
  if (groupOf(D.team.cls) === "u11" || !D.exercises.length) return;
  const E = createEngine(D, { lang, now }), TODAY = iso(now), en = lang === "en", days: string[] = [];
  for (let w = 0; w <= 1 && days.length < 2; w++) for (const x of E.weekPlan(addDays(monday(TODAY), 7 * w)).items)
    if (x.date >= TODAY && x.train && x.train.kind !== "frei" && days.length < 2) days.push(x.date);
  let n = 1;
  const ex = (id: string) => D.exercises.find(e => e.id === id)!;
  const fromEx = (date: string, sort: number, exId: string, staffId: string | null, min?: number, groupId: string | null = null): void => {
    const e = ex(exId);
    D.blocks.push({ id: "bl" + (n++), date, sort, title: e.title, min: min ?? e.dur, staffId, exId, text: e.desc, points: e.points.map(p => p.text), drawing: e.drawing, photo: null, groupId });
  };
  const free = (date: string, sort: number, title: string, min: number, staffId: string | null, text: string, points: string[]): void => {
    D.blocks.push({ id: "bl" + (n++), date, sort, title, min, staffId, exId: null, text, points, drawing: null, photo: null, groupId: null });
  };
  const tw = D.groups.find(g => g.kind === "tw")?.id || null;
  if (days[0]) {
    fromEx(days[0], 0, "e1", "s2");
    fromEx(days[0], 1, "e5", "s4");
    fromEx(days[0], 2, "e3", "s1");
    fromEx(days[0], 3, "e6", "s3", 20, tw);
    free(days[0], 4, en ? "Final game 8 v 8" : "Abschlussspiel 8 gegen 8", 25, "s1", en ? "8 v 8 on two goals with keepers, 2 × 10 min." : "8 gegen 8 auf zwei Tore mit Torhütern, 2 × 10 Min.",
      en ? ["Win the ball back within 6 seconds", "Switch play after winning the ball"] : ["Ballgewinn innerhalb von 6 Sekunden", "Nach Ballgewinn schnell verlagern"]);
    fromEx(days[0], 5, "e7", "s4");
  }
  if (days[1]) {
    fromEx(days[1], 0, "e1", "s2", 10);
    fromEx(days[1], 1, "e2", "s1", 20);
    fromEx(days[1], 2, "e6", "s3", 15, tw);
    fromEx(days[1], 3, "e4", "s1", 15);
    fromEx(days[1], 4, "e7", "s4");
  }
}

/** Gruppen der Demo: Torhüter (alle TW), Reha (verletzt bzw. gerade zurück), Mannschaftsrat (drei Erfahrene). */
function demoGroups(D: TeamData, en: boolean, TODAY: string): void {
  const P = D.players;
  if (!P.length) return;
  const add = (id: string, name: string, kind: TeamGroup["kind"], vis: boolean, pids: string[]): void => {
    D.groups.push({ id, name, kind, vis });
    for (const p of P) if (pids.includes(p.id)) p.groups = [...(p.groups || []), id];
  };
  add("g1", en ? "Goalkeepers" : "Torhüter", "tw", true, P.filter(p => p.pos === "TW").map(p => p.id));
  const reha = D.absences.filter(a => a.typ === "verletzung" && (!a.bis || a.bis >= addDays(TODAY, -21))).map(a => a.pid);
  add("g2", en ? "Rehab group" : "Reha-Gruppe", "reha", true, [...new Set(reha)]);
  const lead = [...P].filter(p => p.pos !== "TW").sort((a, b) => (a.geb || "") < (b.geb || "") ? -1 : 1).slice(0, 3).map(p => p.id);
  add("g3", en ? "Team council" : "Mannschaftsrat", "lead", true, lead);
}

/** Kontaktliste der Demo (erfundene Namen und Nummern; 116 117 = ärztlicher Bereitschaftsdienst). */
function demoContacts(D: TeamData, en: boolean): void {
  const c = (id: string, name: string, role: Contact["role"], org: string, phone: string, email: string, address: string, note: string, vis = true): Contact =>
    ({ id, name, role, org, phone, email, address, note, vis });
  D.contacts = [
    c("c1", "Daniel Kurz", "trainer", en ? "Assistant coach U19" : "Co-Trainer U19", "0171 5550101", "", "", ""),
    c("c2", "Markus Feld", "koordinator", en ? "Youth coordinator" : "Jugendkoordinator", "0171 5550102", "jugend@beispielverein.de", "", en ? "Questions about passes, registrations, tournaments" : "Fragen zu Pässen, Anmeldungen, Turnieren"),
    c("c3", "Petra Hoff", "vorstand", en ? "Board – youth" : "Vorstand Jugend", "", "vorstand@beispielverein.de", "", ""),
    c("c4", "Sarah Meier", "physio", "Physio am Park", "0201 5550103", "", "Parkstraße 12", en ? "Appointments for team players on Tuesdays and Thursdays" : "Termine für Teamspieler dienstags und donnerstags"),
    c("c5", "Dr. Jonas Weber", "arzt", en ? "Sports medicine practice" : "Praxis für Sportmedizin", "0201 5550104", "", "Am Sportpark 3",
      en ? "Mon–Fri 8–18. Evenings/weekends: on-call medical service 116 117, emergency 112." : "Mo–Fr 8–18 Uhr. Abends/Wochenende: ärztlicher Bereitschaftsdienst 116 117, Notfall 112."),
    c("c6", "Uwe Brandt", "betreuer", en ? "Team manager" : "Teambetreuer", "0171 5550105", "", "", en ? "Kit, travel, match day organisation" : "Trikots, Fahrten, Organisation am Spieltag"),
    c("c7", "Heinz Krämer", "sonst", en ? "Groundsman" : "Platzwart", "0171 5550106", "", "", "", false),
  ];
}

/** Saisonphasen für die Demo: vergangene Pause + Vorbereitung (mit Umsetzung), kurze Ferienpause in der
 *  spielfreien Zeit, geplante Winter-/Sommerpause mit anschließender Vorbereitung. */
function demoPhases(D: TeamData, lang: Lang, TODAY: string): void {
  const en = lang === "en", { t } = translator(lang), grp = groupOf(D.team.cls), r = rng(88);
  const liga = D.matches.filter(m => m.comp === "liga").sort((a, b) => a.date < b.date ? -1 : 1);
  if (!liga.length) return;
  let pi = 1, ph = 1; const idf = (): string => "pi" + (pi++);
  const summer = (d: string): boolean => { const m = parse(d).getMonth(); return m >= 4 && m <= 8; };
  const mk = (kind: PhaseKind, from: string, to: string, title: string, firstMatch: string | null = null): Phase =>
    ({ id: "ph" + (ph++), kind, title, from, to, firstMatch, weeks: {}, program: defaultProgram(kind, from, to, grp, idf), vis: true, note: "" });
  const name = (d: string, kind: PhaseKind): string => summer(d)
    ? (kind === "break" ? (en ? "Summer break" : "Sommerpause") : (en ? "Summer pre-season" : "Sommervorbereitung"))
    : (kind === "break" ? (en ? "Winter break" : "Winterpause") : (en ? "Winter pre-season" : "Wintervorbereitung"));
  // 1. Vor dem ersten Spiel: 4 Wochen Pause, 6 Wochen Vorbereitung
  const first = liga[0].date, prepFrom = monday(addDays(first, -42)), brkTo = addDays(prepFrom, -1), brkFrom = addDays(brkTo, -27);
  const past = mk("break", brkFrom, brkTo, name(brkFrom, "break")), prep = mk("prep", prepFrom, addDays(first, -1), name(prepFrom, "prep"), first);
  D.phases.push(past, prep);
  // 2. Kurze Pause in der spielfreien Zeit
  const fut = liga.filter(m => m.date > TODAY);
  for (let i = 0; i + 1 < fut.length; i++) if (diff(fut[i].date, fut[i + 1].date) >= 14) {
    D.phases.push(mk("break", addDays(fut[i].date, 1), addDays(fut[i + 1].date, -4), en ? "Holiday break" : "Ferienpause")); break;
  }
  // 3. Nach dem letzten Spiel: Pause und Vorbereitung
  const last = liga[liga.length - 1].date, b2 = monday(addDays(last, 8)), p2 = addDays(b2, 28), m2 = addDays(p2, 41 + 6);
  D.phases.push(mk("break", b2, addDays(p2, -1), name(b2, "break")), mk("prep", p2, addDays(m2, -1), name(p2, "prep"), m2));
  // Umsetzung der vergangenen Pause: je Spieler unterschiedlich fleißig
  for (const p of D.players) {
    const diligence = 0.25 + r() * 0.8, L = (D.extra[p.id] ||= []);
    for (const ph of [past, prep]) for (const ws of phaseWeeks(ph.from, ph.to)) for (const it of weekItems(ph, ws)) for (let k = 0; k < it.perWeek; k++) {
      if (r() > (ph === past ? diligence : diligence * 0.8)) continue;
      const d = addDays(ws, Math.floor(r() * 7)); if (d < ph.from || d > ph.to) continue;
      L.push({ id: "dx" + p.id + "-" + L.length, date: d, art: artOf(it), min: Math.max(10, it.min + Math.round((r() - 0.5) * 10)), rpe: Math.max(1, Math.min(10, it.rpe + Math.round((r() - 0.5) * 2))), label: t("fl_" + it.key), prog: it.id });
    }
    if (r() < 0.5) L.push({ id: "dx" + p.id + "-" + L.length, date: addDays(past.from, 10 + Math.floor(r() * 10)), art: "sonst", min: 90, rpe: 5, label: en ? "Football with friends" : "Fußball mit Freunden" });
    L.sort((a, b) => a.date < b.date ? -1 : 1);
  }
}

/** Beispiel-Übungen, Einheiten-Vorlagen und Trainerprofile für die Demo. */
function demoArchive(D: TeamData, en: boolean): void {
  let k = 1; const it = (t: BoardItem["t"], x: number, y: number, extra: Partial<BoardItem> = {}): BoardItem => ({ id: "b" + (k++), t, x, y, ...extra });
  const L = (t: "pass" | "run" | "drib", x: number, y: number, x2: number, y2: number) => it(t, x, y, { x2, y2 });
  D.staff = [
    { id: "s1", name: en ? "Demo coach" : "Demo-Trainer", role: "chef", areas: en ? ["Match plan", "Pressing"] : ["Matchplan", "Pressing"], phone: "", email: "", note: "" },
    { id: "s2", name: "Daniel Kurz", role: "co", areas: en ? ["Set pieces", "Video analysis"] : ["Standards", "Videoanalyse"], phone: "", email: "", note: "" },
    { id: "s3", name: "Tobias Lang", role: "tw", areas: en ? ["Goalkeepers"] : ["Torhüter"], phone: "", email: "", note: "" },
    { id: "s4", name: "Sarah Meier", role: "physio", areas: en ? ["Rehab", "Injury prevention"] : ["Reha", "Prävention"], phone: "", email: "", note: "" },
  ];
  const ex = (id: string, title: [string, string], cat: Exercise["cat"], themes: [string[], string[]], dur: number, players: string, area: [string, string], rpe: number | null, desc: [string, string], points: [string, string, string | null][], drawing: Drawing | null): Exercise =>
    ({ id, title: en ? title[1] : title[0], cat, themes: en ? themes[1] : themes[0], dur, players, area: en ? area[1] : area[0], rpe, desc: en ? desc[1] : desc[0], points: points.map(p => ({ text: en ? p[1] : p[0], staffId: p[2] })), drawing, video: "" });
  D.exercises = [
    ex("e1", ["Rondo 5 gegen 2", "Rondo 5 v 2"], "pass", [["Passspiel", "Pressing", "Aufwärmen"], ["Passing", "Pressing", "Warm-up"]], 12, "7", ["12 × 12 m", "12 × 12 m"], 5,
      ["5 Spieler am Rand halten den Ball gegen 2 in der Mitte. Ballgewinn oder Fehlpass: Wechsel mit dem Spieler, der den Fehler gemacht hat. 3 × 3 Min., 1 Min. Pause.", "5 players on the outside keep the ball against 2 in the middle. Ball won or misplaced pass: swap with the player who made the mistake. 3 × 3 min, 1 min rest."],
      [["Offene Körperstellung vor der Ballannahme", "Open body shape before receiving", "s2"], ["Erster Kontakt weg vom Gegner", "First touch away from the opponent", "s1"], ["Immer zwei Anspielstationen anbieten", "Always offer two passing options", null]],
      { pitch: "free", items: [it("cone", 14, 9), it("cone", 26, 9), it("cone", 26, 21), it("cone", 14, 21), it("a", 14, 15, { n: 1 }), it("a", 20, 8, { n: 2 }), it("a", 26, 13, { n: 3 }), it("a", 24, 22, { n: 4 }), it("a", 16, 22, { n: 5 }), it("b", 19, 14, { n: 1 }), it("b", 22, 17, { n: 2 }), it("ball", 15.5, 15), L("pass", 15, 14, 19.5, 9), L("pass", 20.5, 9, 25.5, 12.5)] }),
    ex("e2", ["Passdreieck mit Torabschluss", "Passing triangle with finish"], "abschluss", [["Torabschluss", "Passspiel"], ["Finishing", "Passing"]], 15, "8–12", ["Strafraum + 20 m", "Box + 20 m"], 6,
      ["A spielt auf B, B klatscht auf C, C spielt in den Lauf von A, A schließt ab. Positionen rotieren. Nach 5 Min. Seite wechseln.", "A passes to B, B lays off to C, C plays A into space, A finishes. Rotate positions. Switch sides after 5 min."],
      [["Abschluss mit dem ersten Kontakt vorbereiten", "Set up the shot with the first touch", "s1"], ["Tempo im Pass, flach ins lange Eck", "Pace on the pass, low into the far corner", null]],
      { pitch: "box", items: [it("gk", 25, 1.5), it("goal", 25, -0.5), it("a", 12, 26, { n: 1 }), it("a", 30, 22, { n: 2 }), it("a", 20, 17, { n: 3 }), it("cone", 12, 28), it("ball", 13, 27), L("pass", 12.5, 25.5, 29.5, 22), L("pass", 29.5, 21.5, 21, 17.5), L("run", 12, 25, 18, 12), L("pass", 20, 16.5, 18.5, 12.5), L("pass", 18, 11.5, 27, 1)] }),
    ex("e3", ["Gegenpressing 6 gegen 6 + 2", "Counter-pressing 6 v 6 + 2"], "spielform", [["Pressing", "Umschalten"], ["Pressing", "Transition"]], 20, "14", ["40 × 30 m", "40 × 30 m"], 8,
      ["6 gegen 6 mit 2 neutralen Spielern. Nach Ballverlust hat das Team 6 Sek., um den Ball zurückzugewinnen (Punkt). 4 × 4 Min., 2 Min. Pause.", "6 v 6 with 2 neutral players. After losing the ball the team has 6 s to win it back (point). 4 × 4 min, 2 min rest."],
      [["Sofort nach Ballverlust: nächster Spieler attackiert, die anderen schließen Passwege", "Right after losing the ball: nearest player presses, others close passing lanes", "s1"], ["Kompakt bleiben, Abstände max. 10 m", "Stay compact, distances max. 10 m", "s2"]],
      { pitch: "free", items: [it("a", 10, 8, { n: 1 }), it("a", 16, 15, { n: 2 }), it("a", 12, 23, { n: 3 }), it("a", 24, 10, { n: 4 }), it("a", 28, 20, { n: 5 }), it("a", 33, 14, { n: 6 }), it("b", 14, 10, { n: 1 }), it("b", 20, 13, { n: 2 }), it("b", 17, 21, { n: 3 }), it("b", 27, 8, { n: 4 }), it("b", 25, 17, { n: 5 }), it("b", 31, 24, { n: 6 }), it("gk", 2, 15), it("gk", 38, 15), it("ball", 21, 14), L("run", 16.5, 14.5, 19.5, 13.5), L("run", 24, 10.5, 21.5, 12.5), it("zone", 14, 8, { x2: 28, y2: 20 })] }),
    ex("e4", ["Spielaufbau 4 gegen 3", "Build-up 4 v 3"], "taktik", [["Spielaufbau", "Abwehr"], ["Build-up", "Defence"]], 15, "8", ["Halbes Feld", "Half pitch"], 6,
      ["Torwart und Viererkette bauen gegen 3 Angreifer auf. Ziel: kontrolliert über die Mittellinie dribbeln oder in eine Minitorzone passen.", "Goalkeeper and back four build up against 3 attackers. Aim: dribble over the halfway line or pass into a mini-goal zone."],
      [["Breite und Tiefe geben – Außenverteidiger hoch", "Give width and depth – full-backs high", "s1"], ["Torwart als Anspielstation einbinden", "Use the goalkeeper as a passing option", "s3"]],
      { pitch: "half", items: [it("gk", 34, 2), it("a", 22, 12, { n: 4 }), it("a", 46, 12, { n: 5 }), it("a", 8, 22, { n: 2 }), it("a", 60, 22, { n: 3 }), it("b", 28, 20, { n: 9 }), it("b", 40, 20, { n: 10 }), it("b", 34, 30, { n: 8 }), L("pass", 34, 3, 22, 11), L("pass", 22, 13, 9, 21), L("run", 60, 23, 60, 40), it("goal", 20, 51), it("goal", 48, 51)] }),
    ex("e5", ["Sprint-Staffel mit Richtungswechsel", "Sprint relay with change of direction"], "athletik", [["Schnelligkeit", "Aufwärmen"], ["Speed", "Warm-up"]], 10, "alle", ["20 m", "20 m"], 7,
      ["2–3 Gruppen, Slalom durch 4 Hütchen, Wende, 10 m Sprint zurück. 6 Läufe, volle Pause.", "2–3 groups, slalom through 4 cones, turn, 10 m sprint back. 6 runs, full rest."],
      [["Tief in die Wende, kurze Schritte", "Get low into the turn, short steps", "s4"]],
      { pitch: "free", items: [it("cone", 8, 10), it("cone", 12, 12), it("cone", 16, 10), it("cone", 20, 12), it("cone", 28, 11), it("a", 4, 11, { n: 1 }), L("drib", 5, 11, 21, 11), L("run", 22, 11, 27, 11)] }),
    ex("e6", ["Torwart: Flanken abfangen", "Goalkeeper: claiming crosses"], "torwart", [["Torwart", "Flanken"], ["Goalkeeper", "Crosses"]], 15, "2 + Flankengeber", ["Strafraum", "Box"], 6,
      ["Flanken von beiden Seiten, zunächst ohne, dann mit Gegenspieler. Torwart fängt am höchsten Punkt.", "Crosses from both sides, first without, then with an opponent. Goalkeeper catches at the highest point."],
      [["Startposition je nach Ballposition anpassen", "Adjust the starting position to the ball", "s3"], ["Lautes „Torwart!“ beim Herauslaufen", "Loud “keeper!” when coming out", "s3"]],
      { pitch: "box", items: [it("gk", 25, 2), it("a", 3, 12, { n: 7 }), it("a", 47, 12, { n: 11 }), it("b", 23, 7, { n: 9 }), L("pass", 4, 11.5, 24, 5)] }),
    ex("e7", ["Auslaufen & Mobility", "Cool-down & mobility"], "cooldown", [["Regeneration"], ["Recovery"]], 10, "alle", ["–", "–"], 2,
      ["5 Min. lockeres Traben, danach Mobility für Hüfte, Oberschenkel und Waden.", "5 min easy jogging, then mobility for hips, thighs and calves."], [], null),
  ];
  D.templates = [
    { id: "tp1", title: en ? "Pressing day (MD-4)" : "Pressing-Tag (MD-4)", theme: en ? "Pressing" : "Pressing", notes: "", blocks: [
      { exId: "e1", text: "", min: 12, staffId: "s2" }, { exId: "e5", text: "", min: 10, staffId: "s4" }, { exId: "e3", text: "", min: 20, staffId: "s1" },
      { exId: null, text: en ? "Final game 8 v 8" : "Abschlussspiel 8 gegen 8", min: 25, staffId: "s1" }, { exId: "e7", text: "", min: 10, staffId: null }] },
    { id: "tp2", title: en ? "Finishing day (MD-2)" : "Abschluss-Tag (MD-2)", theme: en ? "Finishing" : "Torabschluss", notes: "", blocks: [
      { exId: "e1", text: "", min: 10, staffId: null }, { exId: "e2", text: "", min: 20, staffId: "s1" }, { exId: "e6", text: "", min: 15, staffId: "s3" }, { exId: "e7", text: "", min: 10, staffId: null }] },
  ];
}

/** Spielerentwicklung, Wochenchallenge und Individualtraining für die Demo (Einschätzungen, Ziele, Gespräche, Anfragen). */
function demoDev(D: TeamData, lang: Lang, now: Date): void {
  const TODAY = iso(now), en = lang === "en", { t } = translator(lang), grp = classDef(D.team.cls).grp, r = rng(311);
  const P = (id: string) => D.players.find(p => p.id === id);
  if (!P("p8") || !P("p6") || !P("p1")) return;
  // Kompetenzprofil: Trainer vor 7 Wochen und vor 1 Woche (freigegeben), Selbsteinschätzung
  const scoresFor = (pid: string, base: number, spread: number): Record<string, number> => {
    const out: Record<string, number> = {}; const p = P(pid)!;
    for (const { key } of compsOf(posGroupOf(D, p, grp))) out[key] = Math.max(1, Math.min(5, Math.round(base + (r() - 0.5) * spread)));
    return out;
  };
  let aid = 1; const A = (pid: string, date: string, by: "coach" | "self", scores: Record<string, number>, note: string, vis: boolean) =>
    D.assessments.push({ id: "da" + (aid++), pid, date, by, scores, note, vis });
  const s8a = scoresFor("p8", 3, 2), s8b = { ...s8a }; for (const k of Object.keys(s8b).slice(0, 4)) s8b[k] = Math.min(5, s8b[k] + 1);
  A("p8", addDays(TODAY, -49), "coach", s8a, en ? "Start of season" : "Saisonstart", true);
  A("p8", addDays(TODAY, -6), "coach", s8b, en ? "Clear progress in passing and duels." : "Deutliche Fortschritte im Passspiel und in den Zweikämpfen.", true);
  const self8 = { ...s8b }; const k8 = Object.keys(self8); if (k8[5]) self8[k8[5]] = Math.min(5, self8[k8[5]] + 2); if (k8[9]) self8[k8[9]] = Math.max(1, self8[k8[9]] - 2);
  A("p8", addDays(TODAY, -4), "self", self8, en ? "My left foot is getting better." : "Mein linker Fuß wird besser.", true);
  A("p6", addDays(TODAY, -21), "coach", scoresFor("p6", 3, 2.5), "", false);
  const self6 = scoresFor("p6", 4, 1.5); A("p6", addDays(TODAY, -2), "self", self6, "", true);
  A("p1", addDays(TODAY, -30), "coach", scoresFor("p1", 3.5, 2), en ? "Very good on crosses." : "Sehr stark bei Flanken.", true);
  for (const pid of ["p2", "p12", "p17"]) if (P(pid)) A(pid, addDays(TODAY, -35 - Math.floor(r() * 20)), "coach", scoresFor(pid, 3, 2), "", r() < 0.5);
  // Ziele
  let gid = 1; const G = (g: Partial<Goal> & Pick<Goal, "pid" | "title">): Goal => {
    const x: Goal = { id: "dg" + (gid++), area: "tech", kind: "process", metric: "count", unit: "", start: null, target: null, lower: false, test: null, stat: null, from: addDays(TODAY, -42), due: addDays(TODAY, 35),
      why: "", steps: [], status: "active", vis: true, by: "coach", talkId: null, ...g };
    D.goals.push(x); return x;
  };
  const sprint = D.tests.filter(x => x.pid === "p8" && x.test === "sprint30").sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const g1 = G({ pid: "p8", title: en ? "Weak foot: 300 passes against the wall" : "Schwacher Fuß: 300 Wandpässe", unit: en ? "passes" : "Pässe", start: 0, target: 300,
    why: en ? "So I can play out under pressure on both sides." : "Damit ich unter Druck zu beiden Seiten aufbauen kann.",
    steps: [{ text: en ? "3× per week 10 min after training" : "3× pro Woche 10 Min. nach dem Training", done: true }, { text: en ? "Film once and watch with the coach" : "Einmal filmen und mit dem Trainer anschauen", done: false }] });
  if (sprint && grp !== "u11") G({ pid: "p8", title: en ? "30 m sprint 2 % faster" : "30-m-Sprint 2 % schneller", area: "ath", kind: "perf", metric: "test", test: "sprint30", start: sprint.value, target: Math.round(sprint.value * 0.98 * 100) / 100, lower: true, due: addDays(TODAY, 49) });
  G({ pid: "p8", title: en ? "Five starts before the winter break" : "Fünf Startelf-Einsätze bis zur Winterpause", area: "takt", kind: "outcome", metric: "stat", stat: "starts", start: 0, target: 5, due: addDays(TODAY, 60) });
  G({ pid: "p8", title: en ? "10 min mobility after every session" : "Nach jedem Training 10 Min. Mobility", area: "ath", metric: "check", by: "player", from: addDays(TODAY, -10), due: addDays(TODAY, 20),
    steps: [{ text: en ? "Week 1" : "Woche 1", done: true }, { text: en ? "Week 2" : "Woche 2", done: false }, { text: en ? "Week 3" : "Woche 3", done: false }, { text: en ? "Week 4" : "Woche 4", done: false }] });
  G({ pid: "p6", title: en ? "Crosses: 6 of 10 reach the far post" : "Flanken: 6 von 10 an den zweiten Pfosten", kind: "perf", metric: "value", unit: en ? "of 10" : "von 10", start: 3, target: 6, from: addDays(TODAY, -28), due: addDays(TODAY, 14) });
  G({ pid: "p6", title: en ? "Attend 90 % of training sessions" : "90 % Trainingsbeteiligung", area: "ment", metric: "att", start: null, target: 90, vis: false });
  const tw = D.tests.filter(x => x.pid === "p1" && x.test === "tw_lateral").sort((a, b) => a.date < b.date ? -1 : 1)[0];
  if (tw) G({ pid: "p1", title: en ? "Lateral jump: +10 cm" : "Seitlicher Sprung: +10 cm", area: "ath", kind: "perf", metric: "test", test: "tw_lateral", start: tw.value, target: tw.value + 10 });
  let eid = 1;
  for (const [d, v] of [[-38, 40], [-30, 60], [-21, 45], [-12, 50], [-3, 35]] as [number, number][]) D.goalEntries.push({ id: "de" + (eid++), goalId: g1.id, pid: "p8", date: addDays(TODAY, d), value: v, note: "", by: "player" });
  const g6 = D.goals.find(g => g.pid === "p6" && g.metric === "value");
  if (g6) for (const [d, v] of [[-20, 4], [-6, 5]] as [number, number][]) D.goalEntries.push({ id: "de" + (eid++), goalId: g6.id, pid: "p6", date: addDays(TODAY, d), value: v, note: "", by: "coach" });
  // Gespräche
  D.talks.push({ id: "dt1", pid: "p8", date: addDays(TODAY, -45), kind: "start", vis: true, next: addDays(TODAY, 9),
    player: en ? "Wants to become a regular starter; feels confident in duels, unsure with the left foot." : "Will Stammspieler werden; fühlt sich in Zweikämpfen sicher, mit links noch unsicher.",
    strengths: en ? "Duels, work rate, leading by example" : "Zweikämpfe, Laufbereitschaft, Vorbild im Training",
    focus: en ? "Weak foot, scanning before receiving" : "Schwacher Fuß, Schulterblick vor der Ballannahme",
    agreements: [{ id: "ag1", text: en ? "3× per week 10 min weak foot after training" : "3× pro Woche 10 Min. schwacher Fuß nach dem Training", who: "player", due: null, done: true },
      { id: "ag2", text: en ? "Coach sends 3 video clips on scanning" : "Trainer schickt 3 Videoclips zum Schulterblick", who: "coach", due: addDays(TODAY, -30), done: true },
      { id: "ag3", text: en ? "Try the 6 position in the friendly" : "Im Testspiel auf der 6 ausprobieren", who: "both", due: addDays(TODAY, 7), done: false }],
    notes: en ? "Parents very supportive. Possibly captain material next season." : "Eltern unterstützen sehr. Perspektivisch Kandidat für den Mannschaftsrat." });
  D.talks.push({ id: "dt2", pid: "p6", date: addDays(TODAY, -60), kind: "start", vis: false, next: addDays(TODAY, -3), player: "", strengths: en ? "Pace, 1 v 1 going forward" : "Tempo, 1 gegen 1 nach vorne",
    focus: en ? "Defensive positioning" : "Defensives Stellungsspiel", agreements: [{ id: "ag4", text: en ? "Extra crossing session on Tuesdays" : "Dienstags Flanken-Zusatzschicht", who: "player", due: null, done: false }], notes: "" });
  // Individualtraining: zwei offene Anfragen, eine zugesagte mit Einheit nur für den Spieler
  D.indiv.push({ id: "di1", pid: "p8", topic: "schwach", note: en ? "I'd like to work on passing with my left foot." : "Ich möchte an meinen Pässen mit links arbeiten.", wish: en ? "Tue or Thu before training" : "Di oder Do vor dem Training",
    status: "open", answer: "", date: null, slot: null, staffId: null, created: new Date(now.getTime() - 26 * 3600e3).toISOString() });
  if (P("p17")) D.indiv.push({ id: "di2", pid: "p17", topic: "schuss", note: en ? "Finishing with the first touch" : "Abschluss mit dem ersten Kontakt", wish: en ? "Any day from 4 pm" : "Ab 16 Uhr an jedem Tag",
    status: "open", answer: "", date: null, slot: null, staffId: null, created: new Date(now.getTime() - 5 * 3600e3).toISOString() });
  const d3 = addDays(TODAY, 3), slot = freeDateSlot(D, d3), s1 = D.staff.find(x => x.role === "co")?.id || D.staff[0]?.id || null;
  if (slot) {
    D.indiv.push({ id: "di3", pid: "p6", topic: "taktik", note: en ? "Positioning as a full-back" : "Stellungsspiel als Außenverteidiger", wish: "", status: "accepted",
      answer: en ? "Let's do 45 min with video, Thursday 5 pm." : "Wir machen 45 Min. mit Video, Donnerstag 17 Uhr.", date: d3, slot, staffId: s1, created: new Date(now.getTime() - 4 * 86400e3).toISOString() });
    (D.units[d3] ||= []).push(cleanUnit({ slot, art: "taktik", title: t("iq_t_taktik"), zeit: "17:00", dauer: 45, rpe: 3, groupId: null, staffId: s1, inhalt: en ? "Positioning as a full-back, video clips" : "Stellungsspiel AV, Videoclips", themes: [], pids: ["p6"] }));
  }
  // Wochenchallenge: diese Woche zwei, letzte Woche eine (mit Einträgen)
  const ws = monday(TODAY), defs = challengeDefsFor(grp);
  const pick = (k: string) => defs.find(d => d.key === k) || defs[0];
  const mk = (id: string, w: string, key: string) => { const d = pick(key); const c = fromDef(d, w, id, t("chk_" + d.key), t("chkd_" + d.key)); D.challenges.push(c); return c; };
  const c1 = mk("dc1", ws, grp === "u11" || grp === "u15" ? "schwach100" : "schwach1000");
  const c2 = mk("dc2", ws, grp === "u11" || grp === "u15" ? "jonglier" : "jonglierSchwach");
  const c0 = mk("dc0", addDays(ws, -7), "mastery");
  const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(c0.ws, i));
  const atNow = now.toISOString();
  D.players.slice(0, 18).forEach((p, i) => {
    if (i % 3 !== 2) { const n = 2 + (i % 4); D.chEntries.push({ cid: c0.id, pid: p.id, value: n + (i % 2), days: days(n + (i % 2)), done: n + (i % 2) >= 5, at: atNow }); }
    if (i % 2 === 0) { const v = Math.round((c1.target || 100) * (0.3 + r() * 0.9)); D.chEntries.push({ cid: c1.id, pid: p.id, value: v, days: [], done: v >= (c1.target || 1), at: atNow }); }
    if (i % 3 === 0) D.chEntries.push({ cid: c2.id, pid: p.id, value: Math.round(5 + r() * (grp === "u11" ? 25 : 40)), days: [], done: true, at: atNow });
  });
}

/** Chat der Demo: Teamchat, Trainerteam, Torhüter-Gruppe, Einzelchats (Jugend: transparent), eigene Gruppe, eine Meldung. */
export function demoChat(D: TeamData, lang: Lang, now: Date, me: string): void {
  const en = lang === "en";
  D.chatPeople = demoPeople(D);
  const uidP = (pid: string) => D.chatPeople.find(x => x.pid === pid)?.uid || "", uidS = (sid: string) => { const s = D.staff.find(x => x.id === sid); return s ? s.userId || "demo-" + s.id : ""; };
  const nameOf = (uid: string) => D.chatPeople.find(x => x.uid === uid)?.name || "–";
  const youth = groupOf(D.team.cls) !== "akt";
  let n = 1;
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60e3).toISOString();
  const chat = (id: string, kind: Chat["kind"], extra: Partial<Chat> = {}): Chat => { const c: Chat = { id, kind, title: "", groupId: null, members: [], readOnly: false, transparent: false, createdBy: null, lastAt: null, muted: false, ...extra }; D.chats.push(c); return c; };
  const msg = (c: Chat, uid: string, minAgo: number, body: string, react: Record<string, string[]> = {}, replyTo: string | null = null): ChatMsg => {
    const m: ChatMsg = { id: "dm" + (n++), chatId: c.id, uid, name: nameOf(uid), body, at: at(minAgo), replyTo, deleted: false, reactions: react };
    (D.chatMsgs[c.id] ||= []).push(m); c.lastAt = m.at; return m;
  };
  const pl = D.players.map(p => uidP(p.id)).filter(Boolean);
  const team = chat("dch-team", "team"), staff = chat("dch-staff", "staff");
  msg(team, me, 60 * 26, en ? "Departure on Saturday 12:45 at the clubhouse – please be on time. Black kit." : "Abfahrt Samstag 12:45 Uhr am Vereinsheim – bitte pünktlich. Schwarzer Trikotsatz.",
    { "✅": pl.slice(0, 15), "👍": pl.slice(15, 18) });
  const q = msg(team, uidP("p10"), 60 * 25, en ? "Can anyone give me a lift? I live near the station." : "Kann mich jemand mitnehmen? Wohne am Bahnhof.");
  msg(team, uidP("p12"), 60 * 24, en ? "I still have a seat 👍" : "Ich hab noch einen Platz frei 👍", { "❤️": [uidP("p10")] }, q.id);
  msg(team, uidP("p19"), 60 * 5, en ? "Ole, you muppet, missed again 🙄" : "Ole, du Flasche, wieder verschossen 🙄");
  msg(team, me, 60 * 3, en ? "Please remember the morning check this week – thanks! 💪" : "Denkt diese Woche an euren Morgen-Check – danke! 💪", { "💪": pl.slice(2, 9) });
  msg(team, uidP("p8"), 25, en ? "Is training at 18:30 today as usual?" : "Ist das Training heute wie immer um 18:30?");
  msg(staff, uidS("s2"), 60 * 20, en ? "Pressing clips are uploaded – 6 scenes for the back line." : "Pressing-Clips sind hochgeladen – 6 Szenen für die Abwehrkette.", { "👏": [me] });
  msg(staff, uidS("s4"), 60 * 4, en ? "Samuel only does the rehab programme today, load according to pain." : "Samuel heute nur Reha-Programm, Belastung nach Schmerz.");
  msg(staff, me, 60 * 3.5, en ? "Thanks! Then I'll plan him in for Thursday." : "Danke! Dann plane ich ihn für Donnerstag ein.", { "👍": [uidS("s4")] });
  const gk = D.groups.find(g => g.kind === "tw" && g.vis);
  if (gk) {
    const g = chat("dch-gk", "group", { groupId: gk.id });
    msg(g, uidS("s3"), 60 * 30, en ? "Thursday 5 pm goalkeeper session – focus on crosses." : "Donnerstag 17 Uhr Torwarttraining – Schwerpunkt Flanken.", { "👍": D.players.filter(p => (p.groups || []).includes(gk.id)).map(p => uidP(p.id)) });
  }
  const d1 = chat("dch-d1", "direct", { members: [me, uidP("p8")], transparent: youth });
  msg(d1, uidP("p8"), 60 * 28, en ? "Coach, could I do an individual session for my left foot next week?" : "Trainer, kann ich nächste Woche ein Individualtraining für meinen linken Fuß machen?");
  msg(d1, me, 60 * 27, en ? "Sure! Just request it in the app (Me → Development) and I'll plan it in." : "Klar! Frag es gern direkt in der App an (Ich → Entwicklung), dann plane ich es ein.");
  const d2 = chat("dch-d2", "direct", { members: [uidS("s2"), uidP("p6")], transparent: youth });
  msg(d2, uidS("s2"), 60 * 8, en ? "Leon, please send me your self-assessment by Friday." : "Leon, schick mir bitte bis Freitag deine Selbsteinschätzung.");
  msg(d2, uidP("p6"), 60 * 7, en ? "Will do!" : "Mach ich!", { "👍": [uidS("s2")] });
  const car = chat("dch-car", "custom", { title: en ? "Car pool Saturday" : "Fahrgemeinschaft Samstag", members: [me, uidP("p10"), uidP("p12"), uidP("p14")].filter(Boolean), createdBy: me, transparent: youth });
  msg(car, me, 60 * 22, en ? "Who is driving from the station? Please coordinate here." : "Wer fährt vom Bahnhof aus? Bitte hier abstimmen.");
  msg(car, uidP("p12"), 60 * 21, en ? "My dad drives, 3 seats." : "Mein Vater fährt, 3 Plätze.", { "👍": [me, uidP("p10")] });
  // Lesestand: Teamchat bis gestern gelesen (heute Neues), Rest gelesen
  for (const c of D.chats) { const L = D.chatMsgs[c.id] || []; D.chatRead[c.id] = L.length ? L[L.length - 1].at : at(0); }
  D.chatRead[team.id] = at(60 * 24);
  D.chatRead[d1.id] = at(60 * 28);
  // Meldung (offen) zur Nachricht von Ole
  const rep = (D.chatMsgs[team.id] || []).find(m => m.uid === uidP("p19"));
  if (rep) D.chatReports.push({ id: "dr1", msgId: rep.id, chatId: team.id, reason: "mean", note: "", snapshot: rep.body, sender: rep.name, sentAt: rep.at, status: "open", reporter: uidP("p13") || pl[0], at: at(60 * 4) });
}
