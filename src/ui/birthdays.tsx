// Geburtstage – Oberfläche: Karte auf der Startseite des Trainerteams (heute und die nächsten 7 Tage, „Gratulieren“
// öffnet den Teamchat mit einem Vorschlag), Seite mit allen Geburtstagen nach Monat und fehlenden Geburtsdaten,
// Glückwunsch für den Spieler auf „Heute“. Logik: core/birthdays.
import { useRouter } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { birthdayList, missingBirthdays, upcomingBirthdays, type Birthday } from "../core/birthdays";
import { useEngine, useStore } from "../data/store";
import { Btn, Card, CardTitle, Col, Header, Info, ListItem, Muted, Row, Screen, T } from "./kit";
import { useNavBack } from "./nav";
import { PlayerAvatar } from "./playerAvatar";
import { useTheme } from "./theme";

type E_ = ReturnType<typeof useEngine>;

/** „heute“, „morgen“ bzw. „Do 12.11.“ */
const whenText = (E: E_, b: Birthday): string => b.days === 0 ? E.t("gb_today") : b.days === 1 ? E.t("gb_tomorrow") : `${E.wt(b.date)} ${E.de(b.date)}`;

/** Teamchat zum Gratulieren (nur mit Chat-Modul) */
function useCongrats() {
  const s = useStore(); const E = useEngine(); const router = useRouter();
  const chat = E.mods.chat !== false ? s.chats.find(c => c.kind === "team") : undefined;
  if (!chat) return null;
  return (pid: string) => {
    const p = E.P(pid);
    router.push({ pathname: "/coach/chat/[id]", params: { id: chat.id, draft: E.tf("gb_chatDraft", { n: p?.vn || "" }) } });
  };
}

function BirthdayRow({ b, i, congrats }: { b: Birthday; i: number; congrats: ((pid: string) => void) | null }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const p = E.P(b.pid);
  if (!p) return null;
  const today = b.days === 0;
  return (
    <View testID={"gb-row-" + b.pid} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <PlayerAvatar p={p} size={34} />
      <Col gap={1} style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} onPress={() => router.push("/coach/spieler/" + p.id)} style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{E.name(p)}</Text>
        <Text style={{ fontSize: 13, color: today ? c.accentTx : c.muted, fontWeight: today ? "700" : "400" }}>{`${whenText(E, b)} · ${tf("gb_turns", { n: b.age })}`}</Text>
      </Col>
      {today && congrats ? <Btn small kind="primary" testID={"gb-congrats-" + b.pid} icon="chat" label={t("gb_congrats")} onPress={() => congrats(b.pid)} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Startseite (Trainerteam): heute und in den nächsten 7 Tagen – ohne Geburtstage keine Karte
// ---------------------------------------------------------------------
export function CoachBirthdaysCard() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const congrats = useCongrats();
  if (E.mods.geburtstage === false) return null;
  const L = upcomingBirthdays(E.D, E.TODAY, 7);
  if (!L.length) return null;
  return (
    <Card testID="gb-card">
      <CardTitle title={t("gb_title")} right={<Btn small kind="ghost" testID="gb-all" label={t("gb_all")} onPress={() => router.push("/coach/geburtstage")} />} />
      {L.map((b, i) => <BirthdayRow key={b.pid} b={b} i={i} congrats={congrats} />)}
    </Card>
  );
}

// ---------------------------------------------------------------------
// Seite: alle Geburtstage nach Monat, fehlende Geburtsdaten
// ---------------------------------------------------------------------
export function BirthdaysPage() {
  const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const nb = useNavBack("geburtstage");
  const congrats = useCongrats();
  if (E.mods.geburtstage === false) return <Screen testID="coach-geburtstage"><Header title={t("gb_title")} onBack={nb.onBack} backLabel={nb.backLabel} /><Muted>{t("gb_modOff")}</Muted></Screen>;
  const L = birthdayList(E.D, E.TODAY), miss = missingBirthdays(E.D, E.TODAY);
  const months: { key: string; items: Birthday[] }[] = [];
  for (const b of L) {
    const k = b.date.slice(0, 7), last = months[months.length - 1];
    if (last && last.key === k) last.items.push(b); else months.push({ key: k, items: [b] });
  }
  const monthName = (k: string) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(E.tr.lang === "en" ? "en-GB" : "de-DE", { month: "long", year: "numeric" });
  return (
    <Screen testID="coach-geburtstage">
      <Header title={t("gb_title")} sub={tf("gb_sub", { n: L.length })} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("gb_title")} text={t("gb_info")} />} />
      {!L.length ? <Card><Muted>{t("gb_none")}</Muted></Card> : months.map(m => (
        <Card key={m.key} testID={"gb-m-" + m.key}>
          <CardTitle title={monthName(m.key)} />
          {m.items.map((b, i) => <BirthdayRow key={b.pid} b={b} i={i} congrats={congrats} />)}
        </Card>
      ))}
      {miss.length ? (
        <Card testID="gb-missing">
          <CardTitle title={tf("gb_missing", { n: miss.length })} />
          <Muted small>{t("gb_missingHint")}</Muted>
          {miss.map(pid => { const p = E.P(pid); return p ? <ListItem key={pid} testID={"gb-miss-" + pid} title={E.name(p)} left={<PlayerAvatar p={p} size={30} />} onPress={() => router.push("/coach/spieler/" + pid)} /> : null; })}
        </Card>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------
// Spieler: Glückwunsch am eigenen Geburtstag
// ---------------------------------------------------------------------
export function PlayerBirthdayCard() {
  const s = useStore(); const E = useEngine(); const { tf, t } = E; const { c } = useTheme();
  const p = s.mePid ? E.P(s.mePid) : undefined;
  if (!p || E.mods.geburtstage === false) return null;
  const b = upcomingBirthdays({ players: [p] }, E.TODAY, 0)[0];
  if (!b) return null;
  return (
    <Card testID="p-birthday" tone={c.accent}>
      <Row gap={12}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <T bold style={{ color: c.accentTx, fontSize: 17 }}>{String(b.age)}</T>
        </View>
        <Col gap={2} style={{ flex: 1 }}>
          <T bold style={{ fontSize: 16 }}>{tf("gb_happy", { n: p.vn })}</T>
          <Muted small>{t("gb_happySub")}</Muted>
        </Col>
      </Row>
    </Card>
  );
}
