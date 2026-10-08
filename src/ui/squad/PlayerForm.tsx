// Spieler anlegen/bearbeiten (Trainer) und doppelte Einträge zusammenführen.
import React, { useState } from "react";
import { POS } from "../../core/classes";
import type { Player } from "../../core/types";
import { tmpId, useEngine, useStore } from "../../data/store";
import { Banner, Btn, Check, ChoiceChips, Col, DateField, Field, ListItem, Muted, NumField, Row, Sheet, T, ToggleRow } from "../kit";
import { PlayerAvatar } from "../playerAvatar";
import { useTheme } from "../theme";

export function PlayerForm({ player, onDone }: { player: Player | null; onDone: (saved?: Player) => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme();
  const [vn, setVn] = useState(player?.vn || "");
  const [nn, setNn] = useState(player?.nn || "");
  const [geb, setGeb] = useState<string | null>(player?.geb || null);
  const [pos, setPos] = useState(player?.pos && POS.includes(player.pos) ? player.pos : player?.pos ? "" : "ZM");
  const [nr, setNr] = useState<number | null>(player?.nr ?? null);
  const [kg, setKg] = useState<number | null>(player?.kg ?? null);
  const [groups, setGroups] = useState<string[]>(player?.groups || []);
  const [active, setActive] = useState(player ? player.active !== false : true);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");
  const [ask, setAsk] = useState(false);
  const own = E.D.groups;
  const save = async () => {
    if (!vn.trim() || !nn.trim()) { setMsg(t("pf_need")); return; }
    setBusy(true);
    try {
      const p: Player = { ...(player || { id: tmpId(), photo: null, userId: null, neu: false }), vn: vn.trim(), nn: nn.trim(), geb: geb || player?.geb || "", pos: pos || player?.pos || "ZM", nr, kg, groups, active } as Player;
      const saved = await s.savePlayer(p);
      // Gruppen getrennt speichern (eigene Tabelle): nur Änderungen
      const before = player?.groups || [];
      for (const g of own) { const on = groups.includes(g.id); if (on !== before.includes(g.id)) await s.setGroupMember(g.id, saved.id, on); }
      s.toast(t("pf_saved")); onDone(saved);
    } catch (e) { setMsg(s.errText(e)); } finally { setBusy(false); }
  };
  return (
    <Col gap={12}>
      <Row wrap gap={10}>
        <Field testID="pf-vn" label={t("pf_vn")} value={vn} onChangeText={setVn} autoCapitalize="words" style={{ flex: 1, minWidth: 150 }} />
        <Field testID="pf-nn" label={t("pf_nn")} value={nn} onChangeText={setNn} autoCapitalize="words" style={{ flex: 1, minWidth: 150 }} />
      </Row>
      <Col gap={6}>
        <T v="small" bold color={c.muted}>{t("pf_pos")}{pos ? " · " + t("pos_" + pos) : ""}</T>
        <ChoiceChips testID="pf-pos" value={pos || null} onChange={setPos} options={POS.map(k => ({ key: k, label: k }))} />
      </Col>
      <Row wrap gap={10}>
        <DateField testID="pf-geb" label={t("pf_geb")} value={geb} onChange={setGeb} lang={E.tr.lang} style={{ flex: 1, minWidth: 150 }} />
        <NumField testID="pf-nr" label={t("pf_nr")} value={nr} onChange={setNr} min={0} max={99} step={1} style={{ width: 120 }} />
        <NumField testID="pf-kg" label={t("pf_kg")} value={kg} onChange={setKg} min={20} max={150} style={{ width: 120 }} />
      </Row>
      {own.length ? <Col gap={6}>
        <T v="small" bold color={c.muted}>{t("pf_groups")}</T>
        <Row wrap gap={12}>{own.map(g => <Check key={g.id} testID={"pf-group-" + g.id} label={g.name} value={groups.includes(g.id)} onChange={v => setGroups(v ? [...groups, g.id] : groups.filter(x => x !== g.id))} />)}</Row>
      </Col> : null}
      {player ? <ToggleRow testID="pf-active" label={t("pf_active")} desc={t("pf_activeD")} value={active} onChange={setActive} /> : null}
      {msg ? <Muted>{msg}</Muted> : null}
      <Row gap={8} wrap>
        <Btn testID="pf-save" kind="primary" label={t("save")} disabled={busy} onPress={save} />
        {player ? <Btn testID="pf-del" kind="ghost" label={t("pf_del")} onPress={() => setAsk(true)} /> : null}
      </Row>
      {ask && player ? <Banner color={c.crit}>
        <Col gap={8}>
          <T bold>{t("pf_delQ")}</T><T v="small">{t("pf_delD")}</T>
          <Row gap={8}><Btn small label={t("no")} onPress={() => setAsk(false)} /><Btn small kind="danger" testID="pf-del-confirm" label={t("pf_del")} onPress={() => { s.deletePlayer(player); s.toast(t("t_del")); onDone(); }} /></Row>
        </Col>
      </Banner> : null}
    </Col>
  );
}

/** Blatt: Spieler anlegen / bearbeiten. `player` = undefined → geschlossen, null → neu. */
export function PlayerSheet({ player, onClose }: { player: Player | null | undefined; onClose: (saved?: Player) => void }) {
  const s = useStore(); const { t } = s.tr;
  return (
    <Sheet visible={player !== undefined} onClose={() => onClose()} title={player ? t("pf_edit") : t("pf_new")} testID="pf-sheet" closeLabel={t("cancel")}>
      {player !== undefined ? <PlayerForm key={player?.id || "new"} player={player} onDone={onClose} /> : null}
    </Sheet>
  );
}

/** Blatt: neuen App-Spieler mit vorhandenem Eintrag zusammenführen. */
export function MergeSheet({ newPlayer, onClose }: { newPlayer: Player | null; onClose: () => void }) {
  const s = useStore(); const E = useEngine(); const { t } = E;
  const [busy, setBusy] = useState(false);
  const candidates = newPlayer ? E.D.players.filter(p => p.id !== newPlayer.id && !p.userId && !p.neu)
    .sort((a, b) => score(b, newPlayer) - score(a, newPlayer)) : [];
  return (
    <Sheet visible={!!newPlayer} onClose={onClose} title={t("kd_mergeT")} testID="merge-sheet" closeLabel={t("cancel")}>
      {newPlayer ? <Col gap={10}>
        <ListItem title={E.name(newPlayer)} sub={`${newPlayer.pos} · ${newPlayer.geb ? E.de(newPlayer.geb) + newPlayer.geb.slice(0, 4) : ""}`} left={<PlayerAvatar p={newPlayer} size={36} />} />
        <Muted small>{t("kd_mergeD")}</Muted>
        {candidates.map(p => (
          <ListItem key={p.id} testID={"merge-" + p.id} title={E.name(p)} sub={`${p.pos}${p.nr ? " · #" + p.nr : ""}`} left={<PlayerAvatar p={p} size={36} />}
            right={<Btn small kind="primary" disabled={busy} label={t("kd_mergeGo")} onPress={async () => {
              setBusy(true); try { await s.mergePlayers(newPlayer.id, p.id); s.toast(t("kd_merged")); onClose(); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); }
            }} />} />
        ))}
      </Col> : null}
    </Sheet>
  );
}
/** Namensähnlichkeit für die Sortierung der Vorschläge. */
function score(a: Player, b: Player): number {
  const n = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return (n(a.nn) === n(b.nn) ? 2 : 0) + (n(a.vn) === n(b.vn) ? 1 : 0) + (a.geb && a.geb === b.geb ? 2 : 0);
}
