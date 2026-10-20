// Startseite Trainer: „Heute wichtig“ – alles, was jetzt Aufmerksamkeit braucht, gebündelt und nach Dringlichkeit
// sortiert: überlastete Spieler, offene Punkte vor dem nächsten Spiel, fehlende RPE der letzten Einheit, Anfragen und
// Nachrichten, eigene Aufgaben und Blöcke. Je Punkt eine Zeile mit Anzahl – Antippen führt direkt hin. Ohne offene
// Punkte: „Alles erledigt“.
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { addDays } from "../core/dates";
import { myBlocks, myTask } from "../core/day";
import { useEngine, useStore } from "../data/store";
import { Icon, type IconName } from "./icons";
import { useInboxItems } from "./inbox";
import { Card, CardTitle } from "./kit";
import { useMatchdayChecks } from "./matchday";
import { radius, useTheme, withAlpha } from "./theme";

export interface FocusItem { k: string; icon: IconName; title: string; n?: number; color: string; go: string }

/** Offene Punkte für heute, dringlichste zuerst */
export function useFocusItems(): FocusItem[] {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const { m, checks } = useMatchdayChecks();
  const inbox = useInboxItems();
  const base = useMemo(() => {
    const L: FocusItem[] = [];
    // 1. Überlastete Spieler
    if (E.mods.belastung) {
      const crit = E.D.players.filter(p => E.profile(p.id).st === "crit").length;
      if (crit) L.push({ k: "crit", icon: "bolt", title: crit === 1 ? t("fc_crit1") : tf("fc_crit", { n: crit }), color: c.crit, go: "/coach/kader?filter=crit" });
    }
    // 2. Offene Punkte vor dem nächsten Spiel (ohne Belastung – steht oben – und ohne reine Hinweise)
    if (m) for (const x of checks) if ((x.state === "todo" || x.state === "warn") && x.k !== "load" && x.href)
      L.push({ k: "md-" + x.k, icon: x.k === "plan" || x.k === "lineup" ? "board" : x.k === "duties" ? "checklist" : "flag", title: x.title, color: x.state === "warn" ? c.warn : c.accentTx, go: x.href });
    // 3. Fehlende RPE der letzten Einheit (bis 2 Tage danach)
    const last = E.D.sessions.filter(x => x.date <= E.TODAY && x.date >= addDays(E.TODAY, -2)).at(-1);
    if (last && E.mods.belastung) {
      const miss = E.D.players.filter(p => E.attStatus(last.date, p.id) === "da" && !E.D.rpe[p.id]?.[last.date]).length;
      if (miss) L.push({ k: "rpe", icon: "eintragen", title: tf("fc_rpe", { n: miss }), color: c.warn, go: "/coach/einheit/" + last.date });
    }
    return L;
  }, [E, m, checks]); // eslint-disable-line react-hooks/exhaustive-deps
  const me = s.myStaff;
  const rest: FocusItem[] = [];
  // 4. Anfragen, Meldungen, Nachrichten, Selbsteinschätzungen, Gespräche
  for (const x of inbox) rest.push({ k: "in-" + x.k, icon: x.icon, title: x.short, n: x.n, color: x.color, go: x.go });
  // 5. Eigene Aufgaben bis morgen
  const todos = E.D.tasks.filter(x => !x.pid && !x.done && !!x.due && x.due <= addDays(E.TODAY, 1) && (!x.staffId || (!!me && x.staffId === me.id))).length;
  if (todos) rest.push({ k: "todos", icon: "checklist", title: t("fc_todos"), n: todos, color: c.accentTx, go: "/coach/aufgaben" });
  // 6. Eigene Blöcke heute (mit Aufgabe)
  if (me) {
    const today = myBlocks(E.D, me.id, E.TODAY, 0).filter(b => b.date === E.TODAY), task = today.map(b => myTask(b, me.id)).find(Boolean);
    if (today.length) rest.push({ k: "blocks", icon: "whistle", title: task ? tf("fc_myTask", { t: task }) : tf("fc_myBlocks", { n: today.length }), color: c.accentTx, go: "/coach/tag/" + E.TODAY });
  }
  return [...base, ...rest];
}

/** Karte „Heute wichtig“: höchstens 4 Punkte, weitere aufklappbar */
export function FocusCard() {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const items = useFocusItems();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 4);
  return (
    <Card testID="today-focus">
      <CardTitle title={t("fc_title")} />
      {!items.length ? (
        <View testID="focus-none" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(c.ok, 0.14), alignItems: "center", justifyContent: "center" }}><Icon name="check" size={16} color={c.ok} strokeWidth={2.6} /></View>
          <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.ink }}>{t("fc_none")}</Text>
        </View>
      ) : (
        <View>
          {shown.map((x, i) => (
            <Pressable key={x.k} testID={"focus-" + x.k} accessibilityRole="button" accessibilityLabel={x.title + (x.n ? `: ${x.n}` : "")} onPress={() => router.push(x.go)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: withAlpha(x.color.startsWith("#") ? x.color : "#888888", 0.13), alignItems: "center", justifyContent: "center" }}>
                <Icon name={x.icon} size={17} color={x.color} strokeWidth={2} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: "600", color: c.ink }}>{x.title}</Text>
              {x.n ? <View style={{ minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: c.ink, fontVariant: ["tabular-nums"] }}>{x.n}</Text></View> : null}
              <Icon name="chevron" size={16} color={c.muted} />
            </Pressable>
          ))}
          {items.length > 4 ? (
            <Pressable testID="focus-more" accessibilityRole="button" onPress={() => setAll(!all)} style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.accentTx }}>{all ? t("fc_less") : tf("fc_more", { n: items.length - 4 })}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  );
}
