// Versand von Push-Nachrichten über die Expo Push API (gemeinsam für push-reminders und chat-push).
// Secret EXPO_ACCESS_TOKEN (optional, falls Push-Security im Expo-Konto aktiv ist).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, unknown>;
}

/** Sendet Nachrichten an Expo; gibt Tokens zurück, die Expo als nicht registriert meldet. */
export async function sendExpo(messages: ExpoMessage[]): Promise<{ sent: number; invalidTokens: string[] }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const invalidTokens: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.error('Expo push error', res.status, (await res.text()).slice(0, 500));
        continue;
      }
      const result = (await res.json()) as {
        data?: Array<{ status: 'ok' | 'error'; details?: { error?: string } }>;
      };
      (result.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent++;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[idx].to);
      });
    } catch (err) {
      console.error('Expo push request failed', err);
    }
  }
  return { sent, invalidTokens };
}
