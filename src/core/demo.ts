// Demo-Mannschaft: für den Demo-Modus, für Tests und für „Beispieldaten laden“ (App-Review).
import { classDef, defaultPrinciples, defaultSettings, groupOf, isGrowthAge, modsFor, sleepTarget } from "./classes";
import { addDays, ageOn, diff, iso, parse, rng } from "./dates";
import { createEngine } from "./engine";
import { translator } from "./i18n";
import type { AttStatus, ClassKey, Depth, Lang, Team, TeamData, TestResult } from "./types";
import { emptyTeamData } from "./types";

export const DEMO_NAMES: [string, string, string][] = [["Luca", "Brenner", "TW"], ["Jonas", "Albers", "IV"], ["Elias", "Kraft", "IV"], ["Mats", "Ehlert", "IV"], ["Noah", "Petersen", "RV"], ["Leon", "Yildiz", "LV"], ["Finn", "Hartmann", "RV"], ["Ben", "Okafor", "DM"], ["Paul", "Wiese", "ZM"], ["Tim", "Sander", "ZM"], ["Emil", "Rasch", "DM"], ["Milan", "Kovač", "OM"], ["Arda", "Demir", "OM"], ["Nico", "Lindner", "LM"], ["Samuel", "Asante", "RM"], ["Jan", "Vogt", "LM"], ["Henry", "Böhm", "ST"], ["Malik", "Haddad", "ST"], ["Ole", "Brandt", "ST"], ["Kian", "Weber", "TW"], ["Lennard", "Fuchs", "IV"], ["David", "Neumann", "ZM"]];
const OPP = ["SV Nordheim", "TuS Rheinblick", "FC Eintracht Waldau", "SpVgg Ostfeld", "VfR Lindenhof", "DJK Sonnenberg", "BV Hafenstadt", "SC Bergtal", "Rot-Weiß Auenfeld", "TSV Mühlbach", "SG Kirchdorf", "1. FC Talheim", "SV Grünwiese"];

export function demoTeam(cls: ClassKey = "u19", depth: Depth = "basis", lang: Lang = "de"): Team {
  const c = classDef(cls);
  return {
    id: "demo", club: lang === "en" ? "My Club" : "Mein Verein", name: c.team ? c.team[lang] : cls.toUpperCase(), accent: "#0b3d91",
    cls, depth, settings: defaultSettings(), principles: defaultPrinciples(groupOf(cls)), modules: modsFor(depth, cls), joinCode: "DEMO-U19K", staffCode: "DEMO-STAF",
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
  D.videos.push({ id: "v" + (vid++), title: en ? "Pressing triggers – clips for the back line" : "Pressing-Auslöser – Clips für die Abwehrkette", url: "https://example.com/video/pressing", date: null, matchId: null, pids: ["p2", "p3", "p4"], note: "", vis: true });
}
