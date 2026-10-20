// Startseite selbst gestalten: welche Karten in welcher Reihenfolge (pro Konto gespeichert) – für Trainer und
// Spieler getrennt. Spieler wählen zusätzlich, welche Bereiche unten in der Leiste stehen.
import React from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Card, Col, Muted, Row, Sheet, T, ToggleRow } from "./kit";
import { radius, useTheme } from "./theme";

/** Karten der Trainer-Startseite (Standard-Reihenfolge). */
export const DASH_COACH = ["next", "matchday", "tasks", "inbox", "phase", "status", "attn", "absent", "week", "events", "last", "load", "ai"] as const;
export type DashKey = typeof DASH_COACH[number];
/**
 * Karten der Spieler-Startseite – nach Wichtigkeit: erst was heute zu tun ist (Einträge, Körper, Nachrichten, Reha),
 * dann Termine und Plan, dann Aufgaben, Bewertung, Programm, Challenge und Ziele; Meilensteine zuletzt (standardmäßig aus).
 */
export const DASH_PLAYER = ["todo", "body", "msgs", "reha", "plan", "dates", "tasks", "rating", "program", "challenge", "devgoals", "pot", "rings", "kasse", "badges"] as const;
/** Standardmäßig aus (wirken eher als Detail) */
const DEF_OFF: Record<"coach" | "player", string[]> = { coach: [], player: ["badges"] };
/** Bereiche der Spieler-Leiste, die man ausblenden kann (Heute, Eintragen und Ich bleiben immer) */
export const PLAYER_TABS_OPTIONAL = ["daten", "tipps", "chat"] as const;

export interface DashItem { k: string; on: boolean }
type Who = "coach" | "player";
/** Gespeicherte Auswahl mit neuen Karten zusammenführen – neue Karten an ihrer Standardstelle (hinter dem Vorgänger). */
export function dashItems(saved: DashItem[] | undefined, keys: readonly string[] = DASH_COACH, who: Who = "coach"): DashItem[] {
  const out: DashItem[] = (saved || []).filter((x, i, a) => keys.includes(x.k) && a.findIndex(y => y.k === x.k) === i);
  keys.forEach((k, i) => {
    if (out.some(x => x.k === k)) return;
    const prev = keys.slice(0, i).reverse().find(p => out.some(x => x.k === p)), at = prev ? out.findIndex(x => x.k === prev) + 1 : 0;
    out.splice(at, 0, { k, on: !DEF_OFF[who].includes(k) });
  });
  return out;
}
const keysOf = (who: Who): readonly string[] => who === "player" ? DASH_PLAYER : DASH_COACH;

export function useDash(who: Who = "coach"): { items: DashItem[]; on: (k: string) => boolean; order: string[] } {
  const s = useStore(); const items = dashItems(who === "player" ? s.prefs.dashPlayer : s.prefs.dash, keysOf(who), who);
  return { items, on: k => !!items.find(x => x.k === k)?.on, order: items.filter(x => x.on).map(x => x.k) };
}

/** Blatt „Startseite anpassen“: Karten an/aus, nach oben/unten; extra: z. B. Leiste anpassen */
export function DashEditor({ visible, onClose, available, who = "coach", extra }: { visible: boolean; onClose: () => void; available: (k: string) => boolean; who?: Who; extra?: React.ReactNode }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const keys = keysOf(who), items = dashItems(who === "player" ? s.prefs.dashPlayer : s.prefs.dash, keys, who);
  const save = (L: DashItem[]) => s.setPrefs(who === "player" ? { dashPlayer: L } : { dash: L });
  const move = (i: number, d: number) => { const L = [...items]; const j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(L); };
  const label = (k: string) => t((who === "player" ? "dp_" : "db_") + k);
  return (
    <Sheet visible={visible} onClose={onClose} title={t("db_title")} testID="dash-sheet" closeLabel={t("cancel")}>
      {extra}
      <Muted small>{t("db_hint")}</Muted>
      <Col gap={6}>
        {items.map((x, i) => {
          const avail = available(x.k);
          return (
            <View key={x.k} testID={"dash-" + x.k} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line, opacity: avail ? 1 : 0.5 }}>
              <View style={{ flex: 1 }}>
                <ToggleRow testID={"dash-on-" + x.k} label={label(x.k)} desc={avail ? undefined : t("db_na")} value={x.on} onChange={v => save(items.map(y => y.k === x.k ? { ...y, on: v } : y))} />
              </View>
              <Row gap={4}>
                <Pressable testID={"dash-up-" + x.k} accessibilityRole="button" accessibilityLabel={t("db_up")} disabled={i === 0} onPress={() => move(i, -1)}
                  style={{ width: 36, height: 36, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.35 : 1 }}>
                  <View style={{ transform: [{ rotate: "-90deg" }] }}><Icon name="chevron" size={16} color={c.ink} /></View>
                </Pressable>
                <Pressable testID={"dash-down-" + x.k} accessibilityRole="button" accessibilityLabel={t("db_down")} disabled={i === items.length - 1} onPress={() => move(i, 1)}
                  style={{ width: 36, height: 36, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", opacity: i === items.length - 1 ? 0.35 : 1 }}>
                  <View style={{ transform: [{ rotate: "90deg" }] }}><Icon name="chevron" size={16} color={c.ink} /></View>
                </Pressable>
              </Row>
            </View>
          );
        })}
      </Col>
      <Row gap={10}>
        <Btn kind="primary" label={t("done")} onPress={onClose} />
        <Btn kind="ghost" testID="dash-reset" label={t("db_reset")} onPress={() => save(dashItems(undefined, keys, who))} />
      </Row>
    </Sheet>
  );
}

/** Spieler: Bereiche der unteren Leiste ein-/ausblenden (Heute, Eintragen und Ich bleiben) */
export function PlayerTabsEditor() {
  const s = useStore(); const { t } = s.tr;
  const hide = s.prefs.navPlayer?.hide || [];
  const chatOn = !!s.D && s.D.team.modules.chat !== false;
  return (
    <Col gap={4} testID="ptabs-edit">
      <T v="small" bold>{t("dp_tabs")}</T>
      {PLAYER_TABS_OPTIONAL.filter(k => k !== "chat" || chatOn).map(k => (
        <ToggleRow key={k} testID={"ptab-on-" + k} label={t(k === "chat" ? "nav_chat" : "pn_" + k)} value={!hide.includes(k)}
          onChange={v => s.setPrefs({ navPlayer: { hide: v ? hide.filter(x => x !== k) : [...hide, k] } })} />
      ))}
      <Muted small>{t("dp_tabsD")}</Muted>
    </Col>
  );
}

/**
 * Einmaliger Hinweis auf der Startseite: Leiste und Startseite lassen sich anpassen (verschwindet nach „Ausblenden“
 * oder sobald man eines davon geöffnet hat; gespeichert im Konto).
 */
export function CustomizeTip({ id, onBar, onDash }: { id: string; onBar: () => void; onDash: () => void }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const seen = s.prefs.seen || [];
  if (seen.includes(id)) return null;
  const done = () => s.setPrefs({ seen: [...seen, id].slice(-30) });
  return (
    <Card testID="tip-custom">
      <Row gap={12} align="flex-start">
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }}><Icon name="sliders" size={19} color={c.accentTx} /></View>
        <Col gap={2} style={{ flex: 1 }}>
          <T bold>{t("tip_customT")}</T>
          <Muted small>{t("tip_customD")}</Muted>
        </Col>
        <Pressable testID="tip-custom-close" accessibilityRole="button" accessibilityLabel={t("tip_hide")} onPress={done} hitSlop={10}><Icon name="close" size={18} color={c.muted} /></Pressable>
      </Row>
      <Row gap={8} wrap>
        <Btn small testID="tip-custom-bar" icon="grid" label={t("tip_barS")} onPress={() => { done(); onBar(); }} />
        <Btn small testID="tip-custom-dash" icon="sliders" label={t("tip_dashS")} onPress={() => { done(); onDash(); }} />
      </Row>
    </Card>
  );
}
