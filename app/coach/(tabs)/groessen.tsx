// Trainer – Größen & Ausrüstung: wer hat seine Größen eingetragen (Erinnerung an Spieler mit Konto), Bestellliste mit
// Summen je Größe (Artikel und Spieler wählbar, Beflockung mit Nummer und Name) als CSV oder Text zum Teilen, je Spieler
// die Größen mit Bearbeiten (z. B. für Spieler ohne Konto).
import React, { useState } from "react";
import { Text, View } from "react-native";
import { ORDER_ITEMS, hasSizes, missingSizes, orderCsv, orderOf, orderText, remindableSizes, type OrderItem } from "../../../src/core/sizes";
import { fileSafe, shareOrCopy, shareTextFile } from "../../../src/data/files";
import { useEngine, useStore } from "../../../src/data/store";
import { Bar, Btn, Card, CardTitle, ChoiceChips, Col, Header, Info, Muted, MultiChips, Row, Screen, Seg, T, ToggleRow } from "../../../src/ui/kit";
import { useNavBack } from "../../../src/ui/nav";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { SizesSheet, sizesLine } from "../../../src/ui/sizes";
import { radius, useTheme, withAlpha } from "../../../src/ui/theme";

export default function Groessen() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const nb = useNavBack("groessen");
  const [filter, setFilter] = useState<"all" | "missing">("all");
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<OrderItem[]>(["top", "bottom", "socks"]);
  const [who, setWho] = useState("all");
  const [print, setPrint] = useState(true);
  const header = <Header title={t("gr_title")} onBack={nb.onBack} backLabel={nb.backLabel} info={<Info title={t("gr_title")} text={t("gr_info")} />} />;
  if (!s.can("squad")) return <Screen testID="coach-sizes">{header}<Muted>{tf("pm_denied", { p: t("pm_squad") })}</Muted></Screen>;
  const P = E.D.players.filter(p => p.active !== false);
  const miss = missingSizes(E.D), rem = remindableSizes(E.D), done = P.length - miss.length;
  const L = filter === "missing" ? P.filter(p => !hasSizes(E.D, p.id)) : P;
  // Bestellliste: alle aktiven Spieler oder eine Gruppe
  const groups = E.D.groups.filter(g => P.some(p => (p.groups || []).includes(g.id)));
  const whoNow = who === "all" || groups.some(g => g.id === who) ? who : "all";
  const sel = whoNow === "all" ? P : P.filter(p => (p.groups || []).includes(whoNow));
  const order = orderOf(E.D, sel, items, { lang: E.tr.lang, name: p => E.name(p) });
  const groupName = whoNow === "all" ? "" : groups.find(g => g.id === whoNow)?.name || "";
  const title = tf("gr_orderTitle", { t: [E.team.name, groupName].filter(Boolean).join(" · "), d: E.de(E.TODAY) + E.TODAY.slice(0, 4) });
  const fileName = (ext: string) => `${fileSafe(t("gr_orderFile"))}_${fileSafe(E.team.name) || "Team"}${groupName ? "_" + fileSafe(groupName) : ""}_${E.TODAY}.${ext}`;
  const remind = async () => { setBusy(true); try { await s.remindSizes(rem.map(p => p.id)); } finally { setBusy(false); } };
  const exportCsv = async () => {
    try { await shareTextFile(fileName("csv"), orderCsv(order, { print }, E.tr), "text/csv"); s.toast(t("gr_exported")); }
    catch (e) { s.toast(s.errText(e)); }
  };
  const share = async () => {
    try { const r = await shareOrCopy(orderText(order, { print, title }, E.tr), fileName("txt")); if (r !== "shared") s.toast(t(r === "copied" ? "gr_copied" : "gr_exported")); }
    catch (e) { s.toast(s.errText(e)); }
  };
  const ready = items.length > 0 && sel.length > 0;
  return (
    <Screen testID="coach-sizes">
      {header}
      {E.D.sizesOk ? (
        <Card testID="gr-summary">
          <T v="h3">{tf("gr_countN", { n: done, m: P.length })}</T>
          <Bar value={P.length ? done / P.length : 0} color={miss.length ? c.warn : c.ok} />
          {miss.length ? <Muted small>{miss.map(p => E.name(p)).join(", ")}</Muted> : <Muted small>{t("gr_allSet")}</Muted>}
          {rem.length && s.can("messages") ? <Btn small icon="send" testID="gr-remind" label={tf("gr_remind", { n: rem.length })} disabled={busy} onPress={remind} style={{ alignSelf: "flex-start" }} /> : null}
          {miss.length > rem.length ? <Muted small>{tf("gr_noAccount", { n: miss.length - rem.length })}</Muted> : null}
        </Card>
      ) : null}

      <Card testID="gr-order">
        <CardTitle title={t("gr_order")} />
        <Muted small>{t("gr_orderD")}</Muted>
        <Col gap={6}>
          <T v="small" bold color={c.muted}>{t("gr_what")}</T>
          <MultiChips testID="gr-items" value={items} onChange={v => setItems(ORDER_ITEMS.filter(i => v.includes(i)))} options={ORDER_ITEMS.map(k => ({ key: k, label: t("gr_item_" + k) }))} />
        </Col>
        {groups.length ? (
          <Col gap={6}>
            <T v="small" bold color={c.muted}>{t("gr_who")}</T>
            <ChoiceChips testID="gr-who" value={whoNow} onChange={setWho} options={[{ key: "all", label: t("gr_whoAll") }, ...groups.map(g => ({ key: g.id, label: g.name }))]} />
          </Col>
        ) : null}
        <ToggleRow testID="gr-print" label={t("gr_printOn")} desc={t("gr_printOnD")} value={print} onChange={setPrint} />
        {!items.length ? <Muted>{t("gr_nothing")}</Muted> : !sel.length ? <Muted>{t("gr_noPlayers")}</Muted> : (
          <Col gap={12} testID="gr-totals">
            {order.totals.map(x => (
              <Col key={x.item} gap={6} testID={"gr-total-" + x.item}>
                <Row between gap={8}>
                  <T bold>{t("gr_item_" + x.item)}</T>
                  <Muted small>{x.n}</Muted>
                </Row>
                <Row wrap gap={6}>
                  {x.counts.map(cn => (
                    <View key={cn.size} style={{ flexDirection: "row", alignItems: "baseline", gap: 5, backgroundColor: c.sunk, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>{cn.size}</Text>
                      <Text style={{ fontSize: 14, color: c.muted, fontVariant: ["tabular-nums"] }}>{`× ${cn.n}`}</Text>
                    </View>
                  ))}
                  {x.missing ? (
                    <View style={{ backgroundColor: withAlpha(c.warn, 0.14), borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: c.warn }}>{tf("gr_missingShort", { n: x.missing })}</Text>
                    </View>
                  ) : null}
                </Row>
              </Col>
            ))}
          </Col>
        )}
        <Row gap={10} wrap>
          <Btn kind="primary" icon="export" testID="gr-csv" label={t("gr_csv")} disabled={!ready} onPress={exportCsv} />
          <Btn kind="ghost" icon="send" testID="gr-share" label={t("gr_share")} disabled={!ready} onPress={share} />
        </Row>
      </Card>

      <Seg testID="gr-filter" value={filter} onChange={setFilter}
        options={[{ key: "all", label: t("gr_filterAll") }, { key: "missing", label: `${t("gr_filterMissing")} (${miss.length})` }]} />
      {L.map(p => {
        const sz = E.D.sizes[p.id], line = sizesLine(sz, E.tr), complete = hasSizes(E.D, p.id);
        return (
          <Card key={p.id} testID={"gr-p-" + p.id}>
            <Row between gap={10}>
              <Row gap={10} style={{ flex: 1, minWidth: 0 }}>
                <PlayerAvatar p={p} size={34} />
                <Col gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <T bold numberOfLines={1}>{E.name(p)}</T>
                  <Muted small>{[p.nr != null ? "#" + p.nr : "", p.pos, sz?.print ? `„${sz.print}“` : ""].filter(Boolean).join(" · ")}</Muted>
                </Col>
              </Row>
              <Btn small kind="ghost" icon="pen" testID={"gr-edit-" + p.id} label={sz ? t("edit") : t("gr_enterCoach")} onPress={() => setEdit(p.id)} />
            </Row>
            {line ? <T v="small">{line}</T> : null}
            {sz?.note ? <Muted small>{sz.note}</Muted> : null}
            {!complete && E.D.sizesOk ? <Text style={{ color: c.warn, fontWeight: "700", fontSize: 14 }}>{sz ? t("gr_partial") : t("gr_none")}</Text> : null}
          </Card>
        );
      })}
      {!L.length ? <Muted>{t("gr_allSet")}</Muted> : null}
      <SizesSheet pid={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}
