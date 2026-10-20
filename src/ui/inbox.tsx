// Startseite (Trainer): Posteingang – Anfragen für Individualtraining, Chat-Meldungen, ungelesene Nachrichten,
// neue Selbsteinschätzungen und fällige Entwicklungsgespräche. Ohne Einträge unsichtbar. Die Einträge nutzt auch
// „Heute wichtig“ (kurzer Titel + Anzahl).
import { useRouter } from "expo-router";
import React from "react";
import { addDays } from "../core/dates";
import { assessmentsOf, openRequests } from "../core/dev";
import { useEngine, useStore } from "../data/store";
import { useChatBadge } from "./chat";
import { Icon, type IconName } from "./icons";
import { Card, CardTitle, ListItem } from "./kit";
import { useTheme } from "./theme";

export interface InboxItem { k: string; icon: IconName; title: string; short: string; n: number; sub?: string; color: string; go: string }

/** Einträge des Posteingangs (leer = nichts zu tun) */
export function useInboxItems(): InboxItem[] {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const unread = useChatBadge();
  const items: InboxItem[] = [];
  if (E.mods.entwicklung) {
    const iq = openRequests(E.D);
    const toMe = iq.filter(r => !!s.myStaff && r.ask === s.myStaff.id).length;
    if (iq.length) items.push({ k: "iq", icon: "target", title: `${t("iq_open")}: ${iq.length}${toMe ? ` (${toMe} ${t("iq_toMe")})` : ""}`, short: t("fc_iq"), n: iq.length,
      sub: iq.slice(0, 3).map(r => E.P(r.pid)?.vn).filter(Boolean).join(", "), color: c.warn, go: "/coach/individual" });
    const self = E.D.players.filter(p => { const sa = assessmentsOf(E.D, p.id, "self")[0], ca = assessmentsOf(E.D, p.id, "coach")[0]; return !!sa && sa.date >= addDays(E.TODAY, -14) && (!ca || sa.date > ca.date); });
    if (self.length) items.push({ k: "self", icon: "eintragen", title: `${t("dv_ovSelfNew")}: ${self.length}`, short: t("fc_self"), n: self.length,
      sub: self.slice(0, 4).map(p => p.vn).join(", "), color: c.low, go: "/coach/entwicklung" });
    const due = E.D.players.filter(p => { const x = E.D.talks.filter(y => y.pid === p.id).sort((a, b) => a.date < b.date ? 1 : -1)[0]; return !!x?.next && x.next <= addDays(E.TODAY, 7); });
    if (due.length) items.push({ k: "talks", icon: "calendar", title: `${t("dv_talks")} · ${t("dv_ovDue")}: ${due.length}`, short: t("fc_talks"), n: due.length,
      sub: due.slice(0, 4).map(p => p.vn).join(", "), color: c.event, go: "/coach/entwicklung" });
  }
  if (E.mods.chat) {
    const rep = s.chatMod ? E.D.chatReports.filter(r => r.status === "open").length : 0;
    if (rep) items.push({ k: "reports", icon: "flag", title: tf("ch_reportsN", { n: rep }), short: t("fc_reports"), n: rep, color: c.crit, go: "/coach/meldungen" });
    if (unread) items.push({ k: "chat", icon: "chat", title: `${t("ch_title")}: ${unread}`, short: t("fc_chat"), n: unread, sub: t("ch_newMsgs"), color: c.accentTx, go: "/coach/chat" });
  }
  return items;
}

export function InboxCard() {
  const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const items = useInboxItems();
  if (!items.length) return null;
  return (
    <Card testID="today-inbox">
      <CardTitle title={t("db_inbox")} />
      {items.map(x => <ListItem key={x.k} testID={"inbox-" + x.k} left={<Icon name={x.icon} size={20} color={x.color} />} title={x.title} sub={x.sub}
        right={<Icon name="chevron" size={18} color={c.muted} />} onPress={() => router.push(x.go)} />)}
    </Card>
  );
}
