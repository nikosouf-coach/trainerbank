// Demo-Mannschaft: für den Demo-Modus, für Tests und für „Beispieldaten laden“ (App-Review).
import { classDef, defaultPrinciples, defaultSettings, groupOf, isGrowthAge, modsFor, sleepTarget } from "./classes";
import { addDays, ageOn, diff, iso, monday, parse, rng } from "./dates";
import { createEngine } from "./engine";
import { translator } from "./i18n";
import { artOf, defaultProgram, phaseWeeks, weekItems } from "./prep";
import type { Contact, Phase, PhaseKind, TeamGroup, AttStatus, BoardItem, ClassKey, Depth, Drawing, Exercise, Lang, Team, TeamData, TestResult, Modules, TeamSettings, Principles } from "./types";
import { emptyTeamData } from "./types";

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
  D.absences.push({ id: nid(), pid: "p15", typ: "verletzung", von: addDays(TODAY, -9), bis: null, stufe: 2, notiz: en ? "Hamstring" : "Oberschenkel hinten" });
  D.absences.push({ id: nid(), pid: "p3", typ: "verletzung", von: addDays(TODAY, -30), bis: addDays(TODAY, -10), stufe: 4, notiz: en ? "Ankle" : "Sprunggelenk" });
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
  const sw = D.well[sore]?.[TODAY]; if (sw) { sw.areas = ["hams:r"]; sw.ort = en ? "after a sprint" : "nach Sprint"; }
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
  const lastTr = D.sessions.filter(s => s.typ === "Training" && s.date < TODAY).at(-1);
  if (lastTr) for (const pid of ["p1", "p8", "p12"]) D.ratings.push({ id: "r" + (rid++), pid, date: lastTr.date, kind: "training", rating: Math.round((6.5 + r() * 2) * 10) / 10, text: texts[Math.floor(r() * texts.length)], vis: true });
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
  demoBlocks(D, lang, now);
  const tw = D.players.filter(p => (p.groups || []).includes("g1")).map(p => p.id);
  if (tw.length) D.videos.push({ id: "v" + (vid++), title: en ? "Goalkeepers: build-up under pressure – 6 clips" : "Torhüter: Spieleröffnung unter Druck – 6 Clips", url: "https://example.com/video/tw-aufbau", date: addDays(TODAY, -2), matchId: null, pids: tw, groupIds: ["g1"], note: en ? "Watch before Thursday's goalkeeper session." : "Bitte bis zum TW-Training am Donnerstag anschauen.", vis: true });
  D.videos.push({ id: "v" + (vid++), title: en ? "Pressing triggers – clips for the back line" : "Pressing-Auslöser – Clips für die Abwehrkette", url: "https://example.com/video/pressing", date: null, matchId: null, pids: ["p2", "p3", "p4"], note: "", vis: true });
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
