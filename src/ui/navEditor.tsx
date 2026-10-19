// Menü anpassen (Trainer): Bereiche der unteren Leiste wählen und ordnen (bis zu fünf, „Mehr“ immer rechts) und
// Menüpunkte aus- und einblenden. Änderungen gelten sofort und werden im Konto gespeichert.
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Col, Muted, Row, Sheet, T } from "./kit";
import { MAX_BAR, NAV_GROUPS, useNav, type NavGroup, type NavItem } from "./nav";
import { radius, useTheme, withAlpha, type Colors } from "./theme";

/** Farbe je Gruppe (Icons im Menü) */
export const groupCol = (c: Colors, g: NavGroup): string =>
  ({ team: c.event, training: c.ok, spiel: c.accentTx, orga: c.hot, setup: c.build } as Record<NavGroup, string>)[g];

function SmallBtn({ icon, label, onPress, disabled, testID, danger }: { icon: "up" | "down" | "close"; label: string; onPress: () => void; disabled?: boolean; testID: string; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4}
      style={{ width: 34, height: 34, borderRadius: radius.s, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size={16} color={danger ? c.crit : c.ink} />
    </Pressable>
  );
}

export function MenuEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStore(); const { t, tf } = s.tr; const { c } = useTheme();
  const nav = useNav();
  const bar = nav.bar, hide = [...nav.hidden];
  const save = (nb: string[], nh: string[] = hide) => nav.save(nb, nh);
  const move = (k: string, d: number) => { const L = [...bar], i = L.indexOf(k), j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(L); };
  const label = (n: NavItem) => t(n.short);
  const tabItems = nav.items.filter(n => n.tab);
  const full = bar.length >= MAX_BAR;
  return (
    <Sheet visible={visible} onClose={onClose} title={t("nv_editT")} testID="nav-sheet" closeLabel={t("close")}>
      <Col gap={14}>
        {/* Vorschau der Leiste */}
        <View testID="nav-preview" style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, borderRadius: radius.m, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
          {[...bar, "mehr"].map(k => {
            const n = nav.items.find(x => x.k === k);
            return (
              <View key={k} style={{ alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
                <Icon name={n ? n.icon : "mehr"} size={20} color={c.accentTx} />
                <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "700", color: c.muted }}>{n ? label(n) : t("nav_module")}</Text>
              </View>
            );
          })}
        </View>
        <Col gap={6}>
          <T bold>{t("nv_bar")}</T>
          <Muted small>{tf("nv_barD", { n: MAX_BAR })}</Muted>
          {bar.map((k, i) => {
            const n = nav.items.find(x => x.k === k)!;
            return (
              <Row key={k} gap={8} testID={"nav-bar-" + k} style={{ paddingVertical: 4 }}>
                <Text style={{ width: 18, textAlign: "center", fontWeight: "900", color: c.muted }}>{i + 1}</Text>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: withAlpha(groupCol(c, n.group), 0.14), alignItems: "center", justifyContent: "center" }}>
                  <Icon name={n.icon} size={18} color={groupCol(c, n.group)} />
                </View>
                <T style={{ flex: 1 }} numberOfLines={1}>{t(n.title)}</T>
                <SmallBtn icon="up" label={t("sk_up")} testID={"nav-bar-" + k + "-up"} disabled={i === 0} onPress={() => move(k, -1)} />
                <SmallBtn icon="down" label={t("sk_down")} testID={"nav-bar-" + k + "-down"} disabled={i === bar.length - 1} onPress={() => move(k, 1)} />
                <SmallBtn icon="close" danger label={t("nv_remove")} testID={"nav-bar-" + k + "-x"} disabled={bar.length <= 1} onPress={() => save(bar.filter(x => x !== k))} />
              </Row>
            );
          })}
          <Muted small>{t("nv_moreFix")}</Muted>
        </Col>
        <Col gap={6}>
          <T v="small" bold color={c.muted}>{full ? t("nv_barFull") : t("nv_barAdd")}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {tabItems.filter(n => !bar.includes(n.k)).map(n => (
              <Pressable key={n.k} testID={"nav-add-" + n.k} accessibilityRole="button" accessibilityLabel={t(n.title)} disabled={full} onPress={() => save([...bar, n.k], hide.filter(x => x !== n.k))}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.surface, opacity: full ? 0.45 : 1 }}>
                <Icon name={n.icon} size={15} color={groupCol(c, n.group)} />
                <Text style={{ fontWeight: "700", fontSize: 13, color: c.ink }}>{label(n)}</Text>
                <Icon name="plus" size={13} color={c.muted} />
              </Pressable>
            ))}
          </View>
        </Col>
        <View style={{ height: 1, backgroundColor: c.line }} />
        <Col gap={6}>
          <T bold>{t("nv_menu")}</T>
          <Muted small>{t("nv_menuD")}</Muted>
          {NAV_GROUPS.map(g => {
            const L = nav.items.filter(n => n.group === g && !bar.includes(n.k));
            return L.length ? <Col key={g} gap={2}>
              <T v="eyebrow" color={c.muted} style={{ marginTop: 6 }}>{t("nvg_" + g)}</T>
              {L.map(n => {
                const on = !nav.hidden.has(n.k);
                return (
                  <Pressable key={n.k} testID={"nav-show-" + n.k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={t(n.title)}
                    onPress={() => save(bar, on ? [...hide, n.k] : hide.filter(x => x !== n.k))}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {on ? <Icon name="check" size={15} color={c.accentInk} strokeWidth={2.6} /> : null}
                    </View>
                    <Icon name={n.icon} size={18} color={on ? groupCol(c, n.group) : c.muted} />
                    <Text style={{ flex: 1, fontSize: 15, color: on ? c.ink : c.muted }}>{t(n.title)}</Text>
                  </Pressable>
                );
              })}
            </Col> : null;
          })}
        </Col>
        <Row gap={8} wrap>
          <Btn kind="primary" testID="nav-done" label={t("done")} onPress={onClose} />
          {nav.custom ? <Btn kind="ghost" testID="nav-reset" label={t("nv_reset")} onPress={nav.reset} /> : null}
        </Row>
      </Col>
    </Sheet>
  );
}
