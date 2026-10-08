// Startseite selbst gestalten: welche Karten in welcher Reihenfolge (pro Konto gespeichert).
import React from "react";
import { Pressable, View } from "react-native";
import { useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Col, Muted, Row, Sheet, ToggleRow } from "./kit";
import { radius, useTheme } from "./theme";

/** Karten der Trainer-Startseite (Standard-Reihenfolge). */
export const DASH_COACH = ["next", "tasks", "phase", "status", "attn", "absent", "week", "events", "last", "load", "ai"] as const;
export type DashKey = typeof DASH_COACH[number];
/** Standardmäßig aus (wirken eher als Detail) */
const DEF_OFF: string[] = [];

export interface DashItem { k: string; on: boolean }
/** Gespeicherte Auswahl mit neuen Karten zusammenführen. */
export function dashItems(saved: DashItem[] | undefined, keys: readonly string[] = DASH_COACH): DashItem[] {
  const out: DashItem[] = (saved || []).filter(x => keys.includes(x.k));
  for (const k of keys) if (!out.some(x => x.k === k)) out.push({ k, on: !DEF_OFF.includes(k) });
  return out;
}

export function useDash(): { items: DashItem[]; on: (k: string) => boolean; order: string[] } {
  const s = useStore(); const items = dashItems(s.prefs.dash);
  return { items, on: k => !!items.find(x => x.k === k)?.on, order: items.filter(x => x.on).map(x => x.k) };
}

/** Blatt „Startseite anpassen“: Karten an/aus, nach oben/unten. */
export function DashEditor({ visible, onClose, available }: { visible: boolean; onClose: () => void; available: (k: string) => boolean }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const items = dashItems(s.prefs.dash);
  const save = (L: DashItem[]) => s.setPrefs({ dash: L });
  const move = (i: number, d: number) => { const L = [...items]; const j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(L); };
  return (
    <Sheet visible={visible} onClose={onClose} title={t("db_title")} testID="dash-sheet" closeLabel={t("cancel")}>
      <Muted small>{t("db_hint")}</Muted>
      <Col gap={6}>
        {items.map((x, i) => {
          const avail = available(x.k);
          return (
            <View key={x.k} testID={"dash-" + x.k} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line, opacity: avail ? 1 : 0.5 }}>
              <View style={{ flex: 1 }}>
                <ToggleRow testID={"dash-on-" + x.k} label={t("db_" + x.k)} desc={avail ? undefined : t("db_na")} value={x.on} onChange={v => save(items.map(y => y.k === x.k ? { ...y, on: v } : y))} />
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
        <Btn kind="ghost" testID="dash-reset" label={t("db_reset")} onPress={() => save(dashItems(undefined))} />
      </Row>
    </Sheet>
  );
}
