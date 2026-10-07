// Unit-Tests für die reinen Hilfsmodule der Edge Functions (ohne Deno/Supabase).
// Ausführen: node --experimental-strip-types --test supabase/tests/functions.test.ts
// (wird von supabase/tests/run.sh automatisch mit ausgeführt, wenn Node ≥ 22.6 vorhanden ist)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  absenceCovers,
  localNow,
  matchDuration,
  morningCheckDue,
  parseTime,
  pushText,
  rpeReminderDue,
  sessionsForDay,
  trainingForWeekday,
} from '../functions/_shared/schedule.ts';
import { AI_MODES, buildSystemPrompt, buildUserMessage } from '../functions/_shared/prompts.ts';

test('localNow: Ortszeit in Europe/Berlin (Sommer- und Winterzeit)', () => {
  // 2026-10-07 16:45 UTC = 18:45 MESZ (Mittwoch)
  assert.deepEqual(localNow(new Date('2026-10-07T16:45:00Z'), 'Europe/Berlin'), {
    date: '2026-10-07',
    minutes: 18 * 60 + 45,
    weekday: 3,
  });
  // 2026-12-31 23:30 UTC = 2027-01-01 00:30 MEZ (Freitag)
  assert.deepEqual(localNow(new Date('2026-12-31T23:30:00Z'), 'Europe/Berlin'), {
    date: '2027-01-01',
    minutes: 30,
    weekday: 5,
  });
});

test('localNow: ungültige Zeitzone fällt auf Europe/Berlin zurück', () => {
  assert.equal(localNow(new Date('2026-10-07T06:05:00Z'), 'Mars/Olympus').minutes, 8 * 60 + 5);
  assert.equal(localNow(new Date('2026-10-07T06:05:00Z'), null).minutes, 8 * 60 + 5);
});

test('parseTime', () => {
  assert.equal(parseTime('18:30'), 1110);
  assert.equal(parseTime('7:05'), 425);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(null), null);
});

test('matchDuration nach Altersklasse', () => {
  assert.equal(matchDuration('sen'), 90);
  assert.equal(matchDuration('ue32'), 80);
  assert.equal(matchDuration('u19'), 90);
  assert.equal(matchDuration('U17'), 80);
  assert.equal(matchDuration('u14'), 70);
  assert.equal(matchDuration('u12'), 60);
  assert.equal(matchDuration('u10'), 50);
  assert.equal(matchDuration('u9'), 40);
  assert.equal(matchDuration(null), 40);
});

test('trainingForWeekday: Array (Index = getDay), Objekt mit Zahlen- und Namensschlüsseln', () => {
  const arr = { days: [null, { zeit: '18:00', dauer: 90 }, null, { zeit: '19:00' }, null, null, null] };
  assert.deepEqual(trainingForWeekday(arr, 1), { start: 1080, duration: 90 });
  assert.deepEqual(trainingForWeekday(arr, 3), { start: 1140, duration: 90 }); // Standarddauer
  assert.equal(trainingForWeekday(arr, 2), null);

  const obj = { days: { '2': { zeit: '18:30', dauer: 75 }, fr: { zeit: '17:00', dauer: 60 }, mo: { zeit: '18:00', aktiv: false } } };
  assert.deepEqual(trainingForWeekday(obj, 2), { start: 1110, duration: 75 });
  assert.deepEqual(trainingForWeekday(obj, 5), { start: 1020, duration: 60 });
  assert.equal(trainingForWeekday(obj, 1), null); // aktiv: false

  const flags = { zeit: '18:15', dauer: 80, days: { '4': true } };
  assert.deepEqual(trainingForWeekday(flags, 4), { start: 1095, duration: 80 });

  assert.equal(trainingForWeekday({}, 1), null);
  assert.equal(trainingForWeekday(null, 1), null);
});

test('sessionsForDay: Spieltag ersetzt Training, Absage, Verlegung, Zusatztraining, Termin', () => {
  const settings = { days: { '2': { zeit: '18:30', dauer: 90 } } };
  const base = { settings, ageClass: 'u17', weekday: 2, matches: [], override: null, replacesTraining: false };

  assert.deepEqual(sessionsForDay(base), [{ kind: 'training', start: 1110, duration: 90 }]);
  assert.deepEqual(sessionsForDay({ ...base, matches: [{ time: '19:00' }] }), [
    { kind: 'match', start: 1140, duration: 80 },
  ]);
  assert.deepEqual(sessionsForDay({ ...base, override: { cancel: true, extra: false, time: null, duration: null } }), []);
  assert.deepEqual(sessionsForDay({ ...base, override: { cancel: false, extra: false, time: '17:00', duration: 60 } }), [
    { kind: 'training', start: 1020, duration: 60 },
  ]);
  assert.deepEqual(sessionsForDay({ ...base, weekday: 3, override: { cancel: false, extra: true, time: '10:00', duration: 45 } }), [
    { kind: 'extra', start: 600, duration: 45 },
  ]);
  assert.deepEqual(sessionsForDay({ ...base, replacesTraining: true }), []);
});

test('rpeReminderDue: Fenster 30 bis < 45 Minuten nach Ende', () => {
  const sessions = [{ kind: 'training' as const, start: 1110, duration: 90 }]; // Ende 20:00
  assert.equal(rpeReminderDue(sessions, 20 * 60 + 29), false);
  assert.equal(rpeReminderDue(sessions, 20 * 60 + 30), true);
  assert.equal(rpeReminderDue(sessions, 20 * 60 + 44), true);
  assert.equal(rpeReminderDue(sessions, 20 * 60 + 45), false);
  // Viertelstunden-Takt trifft jedes Ende genau einmal
  for (const end of [1200, 1207, 1214, 1215]) {
    const s = [{ kind: 'training' as const, start: end - 60, duration: 60 }];
    const hits = [0, 15, 30, 45, 60].map((q) => 20 * 60 + q).filter((t) => rpeReminderDue(s, t)).length;
    assert.equal(hits, 1, `Ende ${end}`);
  }
});

test('morningCheckDue: 08:00–08:14', () => {
  assert.equal(morningCheckDue(479), false);
  assert.equal(morningCheckDue(480), true);
  assert.equal(morningCheckDue(494), true);
  assert.equal(morningCheckDue(495), false);
});

test('absenceCovers', () => {
  assert.equal(absenceCovers({ from_date: '2026-10-01', to_date: null }, '2026-10-07'), true);
  assert.equal(absenceCovers({ from_date: '2026-10-01', to_date: '2026-10-07' }, '2026-10-07'), true);
  assert.equal(absenceCovers({ from_date: '2026-10-08', to_date: null }, '2026-10-07'), false);
  assert.equal(absenceCovers({ from_date: '2026-10-01', to_date: '2026-10-06' }, '2026-10-07'), false);
});

test('pushText nach Sprache', () => {
  assert.equal(pushText('rpe', 'de').title, "Wie hart war's heute?");
  assert.equal(pushText('rpe', 'de').body, 'Trag kurz deine RPE ein – dauert 10 Sekunden.');
  assert.equal(pushText('wellness', 'de').title, 'Guten Morgen!');
  assert.equal(pushText('wellness', 'de').body, 'Morgen-Check: Wie hast du geschlafen?');
  assert.equal(pushText('rpe', 'en').title, 'How hard was today?');
  assert.equal(pushText('wellness', 'fr').title, 'Guten Morgen!'); // Fallback de
});

test('Systemprompts: Sprache und Regeln je Modus', () => {
  for (const mode of AI_MODES) {
    const de = buildSystemPrompt(mode, 'de');
    assert.match(de, /Antworte ausschließlich auf Deutsch/);
    assert.match(de, /Never give medical diagnoses/);
    assert.match(buildSystemPrompt(mode, 'en'), /Answer in English only/);
  }
  assert.match(buildSystemPrompt('coach', 'de'), /UEFA Pro licence/);
  assert.match(buildSystemPrompt('player', 'de'), /150 words/);
  assert.match(buildSystemPrompt('player', 'de'), /supplements/);
  assert.match(buildSystemPrompt('player', 'de'), /weight-loss/);
  assert.match(buildSystemPrompt('player', 'de'), /Never contradict the coach/);
  assert.match(buildSystemPrompt('session', 'en'), /minutes/);
  assert.match(buildSystemPrompt('potentials', 'de'), /- Kategorie: text/);
  assert.match(buildSystemPrompt('potentials', 'de'), /Athletik, Technik, Taktik, Mental, Verfügbarkeit/);
  assert.match(buildSystemPrompt('kind', 'de'), /110 words/);
  assert.equal(buildUserMessage('Kontext', 'Frage'), 'Kontext\n\nFrage');
  assert.equal(buildUserMessage('  ', 'Frage'), 'Frage');
});
