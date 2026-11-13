// Tests: Unfallmeldung – Bereinigen (Längen, Uhrzeit, Tätigkeit, Spiel nur bei Spiel/Weg, Körperregion), Pflichtangaben
// und Meldedaten, Stand, Erinnerung nach drei Tagen, Sortierung, Vorlage aus einer Verletzung, Text zum Teilen, Demo, Texte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { accidentErrors, accidentFromAbsence, accidentsSorted, accidentText, accOverdue, accStatus, ACC_ACTIVITIES, cleanAccident, openAccidents } from "../accidents";
import { buildDemo, demoExtras, demoTeam } from "../demo";
import { DICTS, translator } from "../i18n";
import type { Accident, TeamData } from "../types";

const A = (x: Partial<Accident> = {}): Accident => cleanAccident({ id: "a1", pid: "p1", date: "2026-11-02", how: "Zweikampf", injury: "Prellung Knie", ...x });

test("Bereinigen: Längen, Uhrzeit, Tätigkeit, Spiel nur bei Spiel oder Weg, Körperregion", () => {
  const a = cleanAccident({ id: "x", pid: "p1", date: "2026-11-02", time: "25:00", activity: "kneipe" as never, matchId: "m1", how: " a\r\n\r\n\r\n b ", place: "x".repeat(200), area: "knee:r" });
  assert.deepEqual([a.time, a.activity, a.matchId, a.how, a.place.length, a.area], [null, "training", null, "a\n\nb", 120, "knee:r"]);
  const m = cleanAccident({ id: "x", pid: "p1", date: "2026-11-02", time: "15:30", activity: "match", matchId: "m1", area: "quatsch", clubOn: "02.11.2026" });
  assert.deepEqual([m.time, m.matchId, m.area, m.clubOn], ["15:30", "m1", null, null]);
  assert.equal(cleanAccident({ id: "x", pid: "p1", activity: "travel", matchId: "m1" }).matchId, "m1");
  assert.equal(cleanAccident({ id: "x", pid: "p1", how: "y".repeat(2000) }).how.length, 1000);
  assert.deepEqual(ACC_ACTIVITIES, ["training", "match", "travel", "other"]);
});

test("Pflichtangaben und Meldedaten", () => {
  assert.deepEqual(accidentErrors(A(), "2026-11-06"), []);
  assert.deepEqual(accidentErrors(A({ pid: "", date: "2026-11-07", how: "", injury: "" }), "2026-11-06"), ["player", "date", "how", "injury"]);
  assert.deepEqual(accidentErrors(A({ clubOn: "2026-11-01", insurerOn: "2026-11-07" }), "2026-11-06"), ["clubOn", "insurerOn"]);
  assert.deepEqual(accidentErrors(A({ clubOn: "2026-11-02", insurerOn: "2026-11-06" }), "2026-11-06"), []);
});

test("Stand, Erinnerung nach drei Tagen, Sortierung, offene", () => {
  assert.equal(accStatus(A()), "open"); assert.equal(accStatus(A({ clubOn: "2026-11-03" })), "club");
  assert.equal(accStatus(A({ clubOn: "2026-11-03", insurerOn: "2026-11-04" })), "insurer"); assert.equal(accStatus(A({ clubOn: "2026-11-03", closed: true })), "closed");
  assert.equal(accOverdue(A(), "2026-11-04"), false); assert.equal(accOverdue(A(), "2026-11-05"), true);
  assert.equal(accOverdue(A({ clubOn: "2026-11-03" }), "2026-11-20"), false); assert.equal(accOverdue(A({ insurerOn: "2026-11-03" }), "2026-11-20"), false);
  assert.equal(accOverdue(A({ closed: true }), "2026-11-20"), false);
  const D = { accidents: [A({ id: "1", date: "2026-10-01", closed: true }), A({ id: "2", date: "2026-11-01" }), A({ id: "3", date: "2026-11-01", time: "19:00" }), A({ id: "4", date: "2026-10-20" })] } as TeamData;
  assert.deepEqual(accidentsSorted(D).map(a => a.id), ["3", "2", "4", "1"]);
  assert.deepEqual(openAccidents(D).map(a => a.id), ["3", "2", "4"]);
  assert.deepEqual(accidentFromAbsence({ id: "ab1", pid: "p9", typ: "verletzung", von: "2026-11-01", bis: null, stufe: 2, notiz: "", area: "hams:r" }), { pid: "p9", date: "2026-11-01", area: "hams:r", absenceId: "ab1" });
});

test("Text zum Teilen: alle Angaben, leere fehlen", () => {
  const tr = translator("de");
  const txt = accidentText(A({ time: "19:20", place: "Heimplatz", activity: "match", firstAid: "Kühlen", clubOn: "2026-11-03", claimNo: "SV-1", area: "knee:r" }), {
    t: tr.t, tf: tr.tf, de: (s: string) => `${s.slice(8)}.${s.slice(5, 7)}.${s.slice(0, 4)}`, areaText: () => "Knie rechts",
    player: { vn: "Max", nn: "Muster", geb: "2008-03-12" }, club: "SG Essen-Schönebeck", team: "U19",
    match: { id: "m1", date: "2026-11-02", zeit: "15:00", gegner: "SC Bergtal", heim: false, comp: "liga" },
  });
  const L = txt.split("\n");
  assert.equal(L[0], "Unfallmeldung – Sportunfall");
  for (const x of ["Verein / Team: SG Essen-Schönebeck · U19", "Verletzte Person: Max Muster (geb. 12.03.2008)", "Unfalltag: 02.11.2026 · 19:20", "Tätigkeit: Spiel · gegen SC Bergtal (Auswärts)",
    "Ort: Heimplatz", "Hergang: Zweikampf", "Verletzung: Prellung Knie – Knie rechts", "Erste Hilfe: Kühlen", "An den Verein gemeldet am: 03.11.2026", "Schadennummer: SV-1"])
    assert.ok(L.includes(x), x + "\n" + txt);
  assert.ok(!txt.includes("Zeugen") && !txt.includes("Behandlung") && !txt.includes("Versicherung"), "leere Angaben fehlen");
});

test("Demo: gemeldet, noch nicht gemeldet (Erinnerung), abgeschlossen", () => {
  const NOW = new Date(2026, 10, 6, 10), TODAY = "2026-11-06";
  const D = buildDemo(demoTeam("u19", "pro", "de"), "de", NOW); demoExtras(D, "de", NOW);
  const st = D.accidents.map(a => accStatus(a));
  assert.deepEqual([...st].sort(), ["closed", "club", "open"]);
  assert.ok(D.accidents.every(a => accidentErrors(a, TODAY).length === 0), "Demo-Meldungen vollständig");
  assert.equal(openAccidents(D).filter(a => accOverdue(a, TODAY)).length, 1);
  const m = D.accidents.find(a => a.activity === "match")!;
  assert.ok(D.matches.some(x => x.id === m.matchId && x.date === m.date) && (D.stats[m.matchId!]?.[m.pid]?.min || 0) > 0, "Spiel mit Einsatz");
  assert.ok(D.accidents.filter(a => a.absenceId).every(a => D.absences.some(ab => ab.id === a.absenceId && ab.pid === a.pid)));
});

test("Texte: Schlüssel in beiden Sprachen", () => {
  const keys = ["m_unfall", "md_unfall", "ac_title", "ac_menuSub", "nvb_unfaelle", "ac_sub", "ac_info", "ac_add", "ac_new", "ac_sheet", "ac_open", "ac_openN", "ac_doneN", "ac_none", "ac_privacy",
    "ac_late", "ac_st_open", "ac_st_club", "ac_st_insurer", "ac_st_closed", "ac_claimShort", "ac_from", "ac_fromNone", "ac_fromSub", "ac_player", "ac_date", "ac_time", "ac_activity", "ac_matchOf",
    "ac_place", "ac_placePh", "ac_how", "ac_howPh", "ac_injury", "ac_injuryPh", "ac_area", "ac_areaRemove", "ac_firstAid", "ac_firstAidPh", "ac_treatment", "ac_treatmentPh", "ac_witnesses",
    "ac_witnessesPh", "ac_report", "ac_clubOn", "ac_insurerOn", "ac_claimNo", "ac_note", "ac_closed", "ac_reportHint", "ac_share", "ac_delSure", "ac_saved", "ac_deleted", "ac_my", "ac_myOpen",
    "ac_myDone", "ac_myHint", "ac_noPerm", "ac_modOff", "fc_accidents", ...ACC_ACTIVITIES.map(k => "ac_act_" + k),
    ...["player", "date", "how", "injury", "clubOn", "insurerOn"].map(k => "ac_err_" + k),
    ...["Title", "Team", "Person", "Born", "When", "Activity", "Place", "How", "Injury", "FirstAid", "Treatment", "Witnesses", "Club", "Insurer", "Claim", "Note"].map(k => "ac_txt" + k)];
  for (const lang of ["de", "en"] as const) for (const k of keys) assert.ok(DICTS[lang][k], `${lang}: ${k}`);
});
