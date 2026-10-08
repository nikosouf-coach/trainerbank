// Rechte im Trainerteam: Übersicht (Chips) und Bearbeiten (nur Owner) mit Vorlagen je Funktion.
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { PERM_PRESETS, PERMS, defaultPerms, presetOf, type Perm } from "../core/perms";
import type { StaffRoleKey } from "../core/types";
import type { StaffEntry } from "../data/api";
import { useStore } from "../data/store";
import { ROLES } from "./archive";
import { Banner, Btn, Col, Muted, Row, Sheet, T, Tag, ToggleRow } from "./kit";
import { useTheme } from "./theme";

/** Kurze Übersicht der Rechte (Chips) */
export function PermChips({ perms, testID }: { perms: readonly string[]; testID?: string }) {
  const s = useStore(); const { t } = s.tr;
  const list = PERMS.filter(p => perms.includes(p));
  if (!list.length) return <Muted small testID={testID}>{t("pm_none")}</Muted>;
  return <View testID={testID} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{list.map(p => <Tag key={p} label={t("pm_" + p)} />)}</View>;
}

/** Rechte eines Mitglieds bearbeiten (Owner). Speichern setzt die Auswahl; „Standard“ setzt auf die Rolle zurück. */
export function PermSheet({ entry, visible, onClose, onSaved }: { entry: StaffEntry | null; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const [sel, setSel] = useState<Perm[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (entry) setSel((entry.perms || []) as Perm[]); }, [entry]);
  if (!entry) return null;
  const preset = presetOf(sel);
  const toggle = (p: Perm, on: boolean) => setSel(x => on ? [...new Set([...x, p])] : x.filter(y => y !== p));
  const save = async (perms: string[] | null) => {
    if (!s.active) return;
    setBusy(true);
    try { await s.api.setStaffPerms(s.active.teamId, entry.userId, perms); s.toast(t("pm_saved")); onSaved(); onClose(); }
    catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`${t("pm_title")} · ${entry.displayName || "–"}`} testID="perm-sheet" closeLabel={t("cancel")}>
      <Col gap={12}>
        <Muted small>{t("pm_hint")}</Muted>
        <Col gap={6}>
          <T v="eyebrow">{t("pm_preset")}</T>
          <Row wrap gap={6}>
            {ROLES.filter(r => r !== "chef").map((r: StaffRoleKey) => (
              <Btn key={r} small testID={"perm-preset-" + r} kind={preset === r ? "primary" : "default"} label={t("sr_" + r)} onPress={() => setSel([...PERM_PRESETS[r]])} />
            ))}
          </Row>
          {!preset ? <Muted small>{t("pm_custom")}</Muted> : null}
        </Col>
        <Col gap={2}>
          {PERMS.map(p => <ToggleRow key={p} testID={"perm-" + p} label={t("pm_" + p)} desc={t("pm_" + p + "D")} value={sel.includes(p)} onChange={v => toggle(p, v)} />)}
        </Col>
        {sel.includes("medical") && !sel.includes("health") ? <Banner color={c.warn}><T v="small">{t("pm_medicalOnly")}</T></Banner> : null}
        <Row wrap gap={8}>
          <Btn kind="primary" testID="perm-save" disabled={busy} label={t("save")} onPress={() => save(sel)} />
          <Btn kind="ghost" testID="perm-reset" disabled={busy} label={t("pm_reset")} onPress={() => save(null)} />
        </Row>
        <Muted small>{t("pm_roleDefault")}: {defaultPerms(entry.role).map(p => t("pm_" + p)).join(", ") || "–"}</Muted>
      </Col>
    </Sheet>
  );
}
