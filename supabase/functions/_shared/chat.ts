// Texte der Chat-Push-Nachrichten (reine Logik, getestet in supabase/tests/functions.test.ts).
// Datenschutz und Kinderschutz: Push-Nachrichten zeigen nie den Nachrichtentext – nur, von wem sie ist und in welchem Chat.
// Sperrbildschirme von Handys (oft auch von Kindern) bleiben so frei von Inhalten.

export interface ChatPushTarget {
  user_id: string;
  token: string;
  lang: string | null;
  chat_id: string;
  team_id: string;
  kind: 'team' | 'staff' | 'group' | 'direct' | 'custom';
  title: string | null;
  sender: string;
  area: 'coach' | 'player';
}

const TEXT = {
  de: { staff: 'Trainerteam', chat: 'Chat', from: 'Neue Nachricht von {name}', direct: 'Neue Nachricht' },
  en: { staff: 'Coaching staff', chat: 'Chat', from: 'New message from {name}', direct: 'New message' },
} as const;

/** Titel und Text einer Push-Nachricht (ohne Nachrichtentext) */
export function chatPushText(t: Pick<ChatPushTarget, 'kind' | 'title' | 'sender' | 'lang'>): { title: string; body: string } {
  const L = TEXT[t.lang === 'en' ? 'en' : 'de'];
  const sender = (t.sender || '').trim().slice(0, 60) || '–';
  if (t.kind === 'direct') return { title: sender, body: L.direct };
  const title = t.kind === 'staff' ? L.staff : ((t.title || '').trim().slice(0, 60) || L.chat);
  return { title, body: L.from.replace('{name}', sender) };
}

/** Daten zum Öffnen des Chats beim Antippen */
export function chatPushData(t: Pick<ChatPushTarget, 'chat_id' | 'team_id' | 'area'>): Record<string, string> {
  return { type: 'chat', chat: t.chat_id, team: t.team_id, area: t.area };
}
