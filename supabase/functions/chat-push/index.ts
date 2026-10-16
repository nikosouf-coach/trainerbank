// Edge Function "chat-push" – Push-Nachricht bei neuen Chat-Nachrichten.
//
// Aufruf: per pg_net aus dem Trigger chat_messages_after (Migration *_chat.sql), POST { message_id } mit
// Header x-cron-secret = Secret CRON_SECRET (wie push-reminders; verify_jwt ist in config.toml aus).
// Empfänger bestimmt die Datenbank (chat_push_targets): Teilnehmer des Chats ohne Absender, nicht stumm
// geschaltet, noch nicht gelesen, höchstens eine Nachricht je Chat und Minute. Mitlesende (Kinderschutz)
// bekommen keine Push-Nachricht. Der Nachrichtentext wird nie verschickt (Datenschutz, Sperrbildschirm).
// Ungültige Tokens werden gelöscht.
//
// Secrets: CRON_SECRET (Pflicht), EXPO_ACCESS_TOKEN (optional)
import { chatPushData, chatPushText, type ChatPushTarget } from '../_shared/chat.ts';
import { type ExpoMessage, sendExpo } from '../_shared/expo.ts';
import { json, readJson, safeEqual } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!secret || !safeEqual(given, secret)) return json({ error: 'unauthorized' }, 401);

  const body = await readJson<{ message_id?: unknown }>(req);
  const id = typeof body?.message_id === 'string' ? body.message_id : '';
  if (!UUID_RE.test(id)) return json({ error: 'invalid_request' }, 400);

  try {
    const admin = adminClient();
    const { data, error } = await admin.rpc('chat_push_targets', { p_message: id });
    if (error) throw error;
    const targets = (data ?? []) as ChatPushTarget[];
    const messages: ExpoMessage[] = targets.map((t) => ({
      to: t.token,
      ...chatPushText(t),
      sound: 'default',
      priority: 'high',
      data: chatPushData(t),
    }));
    if (!messages.length) return json({ ok: true, sent: 0 });
    const { sent, invalidTokens } = await sendExpo(messages);
    if (invalidTokens.length) {
      const { error: delError } = await admin.from('push_tokens').delete().in('token', invalidTokens);
      if (delError) console.error('could not delete invalid push tokens', delError);
    }
    return json({ ok: true, sent, invalid_tokens: invalidTokens.length });
  } catch (err) {
    console.error('chat-push failed', err);
    return json({ error: 'internal' }, 500);
  }
});
