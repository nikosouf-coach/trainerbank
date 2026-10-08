// Mannschaftskasse: Übersicht (Kassenstand, offene Beträge je Spieler), Kassenbuch, Beiträge, Einstellungen;
// dazu die Karte „Meine Kasse“ für die Spieler-App. Genutzt vom Trainerteam (Recht „Kasse“) und vom Kassenwart.
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CURRENCIES, balance, duesByPlayer, itemsFor, kasseOf, money, paymentFor, periodLabel, seasonStart, sumOf, type DueItem } from "../core/kasse";
import type { CashCat, CashEntry, FeeDef, FeeEvery, KasseSettings } from "../core/types";
import { tmpId, useEngine, useStore } from "../data/store";
import { Banner, Btn, Card, CardTitle, Check, Col, DateField, Field, Info, ListItem, Muted, NumField, Picker, Row, Seg, Sheet, T, ToggleRow } from "./kit";
import { PlayerAvatar } from "./playerAvatar";
import { ruleName } from "./tasks/widgets";
import { radius, useTheme, withAlpha } from "./theme";

const CATS_IN: CashCat[] = ["fee", "fine", "donation", "event", "drinks", "other"];
const CATS_OUT: CashCat[] = ["event", "drinks", "material", "other"];

/** Gemeinsame Werte: Einstellungen, Formatierung, Rechte */
function useKasse() {
  const s = useStore(); const E = useEngine();
  const k = kasseOf(E.team.settings, E.grp);
  const fmt = (v: number): string => money(v, k.currency, E.tr.lang);
  const staffCash = s.can("cash");
  const treasurer = !!k.treasurer && s.viewAs === "player" && s.mePid === k.treasurer;
  return { s, E, k, fmt, staffCash, treasurer, manage: staffCash || treasurer };
}

type Tab = "overview" | "book" | "fees" | "settings";

/** Hauptansicht der Kasse (Trainer: alle Reiter; Kassenwart: Übersicht und Kassenbuch) */
export function KasseBody() {
  const { E, k, staffCash } = useKasse(); const { t } = E;
  const [tab, setTab] = useState<Tab>(k.on || !staffCash ? "overview" : "settings");
  const tabs: { key: Tab; label: string }[] = [{ key: "overview", label: t("ks_overview") }, { key: "book", label: t("ks_book") },
    ...(staffCash ? [{ key: "fees" as Tab, label: t("ks_fees") }, { key: "settings" as Tab, label: t("ks_settings") }] : [])];
  return (
    <>
      <Seg testID="ks-tab" wrap value={tab} onChange={setTab} options={tabs} />
      {!k.on && tab !== "settings" ? <Banner testID="ks-off">{staffCash ? t("ks_offCoach") : t("ks_off")}</Banner> : null}
      {tab === "overview" ? <Overview /> : tab === "book" ? <CashBook /> : tab === "fees" ? <Fees /> : <KasseSettingsForm onDone={() => setTab("overview")} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Übersicht
// ---------------------------------------------------------------------------------------------
function Overview() {
  const { s, E, k, fmt } = useKasse(); const { t, tf } = E; const { c } = useTheme();
  const [pid, setPid] = useState<string | null>(null);
  const list = useMemo(() => duesByPlayer(E.D, k, E.TODAY, E.tr.lang, r => ruleName(E, r)), [s.version, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = balance(E.D.cash), season = balance(E.D.cash, seasonStart(E.TODAY));
  const openSum = sumOf(list.map(x => ({ amount: x.open }))), openN = list.filter(x => x.open > 0).length;
  return (
    <>
      <Card testID="ks-balance">
        <T v="eyebrow">{t("ks_balance")}</T>
        <Text testID="ks-total" style={{ fontSize: 34, fontWeight: "800", color: b.total < 0 ? c.crit : c.ink, fontVariant: ["tabular-nums"] }}>{fmt(b.total)}</Text>
        <Row gap={16} wrap>
          <Muted small>{t("ks_seasonIn")}: <Text style={{ color: c.ok, fontWeight: "700" }}>{fmt(season.inSum)}</Text></Muted>
          <Muted small>{t("ks_seasonOut")}: <Text style={{ color: c.crit, fontWeight: "700" }}>{fmt(season.outSum)}</Text></Muted>
          <Muted small>{t("ks_openAll")}: <Text style={{ color: openSum ? c.warn : c.ink, fontWeight: "700" }}>{fmt(openSum)}</Text></Muted>
        </Row>
      </Card>
      <Card testID="ks-players">
        <CardTitle title={openN ? tf("ks_openN", { n: openN }) : t("ks_allPaid")} info={<Info title={t("ks_players")} text={t("ks_playersInfo")} />} />
        {list.map(x => {
          const p = E.P(x.pid) || E.D.inactive.find(y => y.id === x.pid); if (!p) return null;
          return (
            <ListItem key={x.pid} testID={"ks-p-" + x.pid} title={E.name(p)} left={<PlayerAvatar p={p} size={34} />} onPress={() => setPid(x.pid)}
              sub={[x.items.length ? `${t("ks_paid")} ${fmt(x.paid)}` : t("ks_noItems"), p.active === false || !E.P(x.pid) ? t("ks_inactive") : p.neu ? t("ks_new") : ""].filter(Boolean).join(" · ")}
              right={x.open > 0 ? <AmountPill text={fmt(x.open)} color={c.warn} /> : <AmountPill text="✓" color={c.ok} />} />
          );
        })}
        {!list.length ? <Muted>{t("ks_noPlayers")}</Muted> : null}
      </Card>
      <DuesSheet pid={pid} onClose={() => setPid(null)} />
    </>
  );
}

function AmountPill({ text, color }: { text: string; color: string }) {
  return <View style={{ backgroundColor: withAlpha(color, 0.14), borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color, fontWeight: "800", fontSize: 13, fontVariant: ["tabular-nums"] }}>{text}</Text></View>;
}

/** Posten eines Spielers: bezahlen, zurücknehmen, erlassen */
function DuesSheet({ pid, onClose }: { pid: string | null; onClose: () => void }) {
  const { s, E, k, fmt, staffCash } = useKasse(); const { t, tf } = E; const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  if (!pid) return null;
  const p = E.P(pid) || E.D.inactive.find(y => y.id === pid);
  const items = itemsFor(E.D, k, pid, E.TODAY, E.tr.lang, r => ruleName(E, r), { active: !!E.P(pid), neu: p?.neu });
  const open = items.filter(i => !i.paid && !i.waived), done = items.filter(i => i.paid || i.waived).reverse();
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const pay = (L: DueItem[]) => run(() => s.payItems(L.map(i => ({ id: tmpId(), ...paymentFor(i, E.TODAY) }))));
  const row = (i: DueItem) => (
    <View key={i.key} testID={"ks-item-" + i.key} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 8, gap: 6 }}>
      <Row between gap={8}>
        <Col gap={2} style={{ flexShrink: 1 }}>
          <T bold>{i.label}</T>
          <Muted small>{i.kind === "fine" ? t("ks_fine") + " · " + E.de(i.date) : t("ks_fee")}{i.waived ? " · " + t("ks_waived") : i.paid ? " · " + t("ks_paidTag") : ""}</Muted>
        </Col>
        <Text style={{ fontWeight: "800", color: i.paid ? c.ok : i.waived ? c.muted : c.ink, fontVariant: ["tabular-nums"], textDecorationLine: i.waived ? "line-through" : "none" }}>{fmt(i.amount)}</Text>
      </Row>
      <Row gap={6} wrap>
        {!i.paid && !i.waived ? <Btn small kind="primary" testID={"ks-pay-" + i.key} disabled={busy} label={t("ks_payBtn")} onPress={() => pay([i])} /> : null}
        {i.paid && i.entryId ? <Btn small kind="ghost" testID={"ks-undo-" + i.key} disabled={busy} label={t("ks_undo")} onPress={() => run(() => s.deleteCash(i.entryId!))} /> : null}
        {staffCash && i.kind === "fee" && !i.paid ? <Btn small kind="ghost" testID={"ks-waive-" + i.key} disabled={busy} label={i.waived ? t("ks_unwaive") : t("ks_waive")}
          onPress={() => run(() => s.setWaiver({ pid, feeId: i.feeId!, period: i.period! }, !i.waived))} /> : null}
      </Row>
    </View>
  );
  return (
    <Sheet visible onClose={onClose} title={p ? E.name(p) : "–"} testID="ks-dues" closeLabel={t("done")}>
      <Row between wrap gap={8}>
        <T v="small">{t("ks_openSum")}: <Text style={{ fontWeight: "800" }}>{fmt(sumOf(open))}</Text></T>
        {open.length > 1 ? <Btn small kind="primary" testID="ks-pay-all" disabled={busy} label={tf("ks_payAll", { v: fmt(sumOf(open)) })} onPress={() => pay(open)} /> : null}
      </Row>
      {open.length ? open.map(row) : <Muted>{t("ks_nothingOpen")}</Muted>}
      {done.length ? <><T v="eyebrow">{t("ks_history")}</T>{done.slice(0, 24).map(row)}</> : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Kassenbuch
// ---------------------------------------------------------------------------------------------
function CashBook() {
  const { E, fmt } = useKasse(); const { t } = E; const { c } = useTheme();
  const [edit, setEdit] = useState<CashEntry | null>(null);
  const L = [...E.D.cash].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const b = balance(E.D.cash);
  const blank = (kind: "in" | "out"): CashEntry => ({ id: tmpId(), date: E.TODAY, amount: 0, kind, cat: kind === "in" ? "donation" : "event", pid: null, feeId: null, period: null, fineId: null, note: "" });
  return (
    <>
      <Card testID="ks-book">
        <CardTitle title={t("ks_book")} right={<Text style={{ fontWeight: "800", color: b.total < 0 ? c.crit : c.ink }}>{fmt(b.total)}</Text>} />
        <Row gap={8} wrap>
          <Btn small kind="primary" icon="plus" testID="ks-add-in" label={t("ks_addIn")} onPress={() => setEdit(blank("in"))} />
          <Btn small icon="plus" testID="ks-add-out" label={t("ks_addOut")} onPress={() => setEdit(blank("out"))} />
        </Row>
        {L.slice(0, 80).map(e => {
          const p = e.pid ? E.P(e.pid) || E.D.inactive.find(y => y.id === e.pid) : null;
          const fee = e.feeId ? kasseOfFee(E, e.feeId) : null;
          const title = [p ? E.name(p) : "", fee ? fee.name : t("ks_cat_" + e.cat)].filter(Boolean).join(" · ");
          return (
            <Pressable key={e.id} testID={"ks-e-" + e.id} accessibilityRole="button" onPress={() => !e.feeId && !e.fineId ? setEdit(e) : undefined}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 8 }}>
              <Col gap={2} style={{ flex: 1, minWidth: 0 }}>
                <T v="small" bold numberOfLines={1}>{title}</T>
                <Muted small>{E.de(e.date)}{e.period && e.period !== "once" ? " · " + periodLabel(e.period, E.tr.lang) : ""}{e.note ? " · " + e.note : ""}</Muted>
              </Col>
              <Text style={{ fontWeight: "800", color: e.kind === "in" ? c.ok : c.crit, fontVariant: ["tabular-nums"] }}>{e.kind === "in" ? "+" : "−"}{fmt(e.amount)}</Text>
            </Pressable>
          );
        })}
        {!L.length ? <Muted>{t("ks_bookEmpty")}</Muted> : null}
      </Card>
      <EntrySheet entry={edit} onClose={() => setEdit(null)} />
    </>
  );
}
const kasseOfFee = (E: ReturnType<typeof useEngine>, id: string): FeeDef | null => kasseOf(E.team.settings, E.grp).fees.find(f => f.id === id) || null;

function EntrySheet({ entry, onClose }: { entry: CashEntry | null; onClose: () => void }) {
  const { s, E } = useKasse(); const { t } = E;
  const [x, setX] = useState<CashEntry | null>(null), [key, setKey] = useState<string | null>(null);
  if ((entry?.id || null) !== key) { setKey(entry?.id || null); setX(entry ? { ...entry } : null); }
  if (!entry || !x) return null;
  const isNew = !E.D.cash.some(e => e.id === entry.id);
  const cats: CashCat[] = (x.kind === "in" ? CATS_IN : CATS_OUT).filter(k => k !== "fee" && k !== "fine");
  const ok = x.amount > 0 && x.amount <= 100000 && !!x.date;
  return (
    <Sheet visible onClose={onClose} title={x.kind === "in" ? t("ks_addIn") : t("ks_addOut")} testID="ks-entry" closeLabel={t("cancel")}>
      <NumField testID="kse-amount" label={t("ks_amount")} value={x.amount || null} min={0} max={100000} step={0.01} onChange={v => setX({ ...x, amount: v || 0 })} style={{ width: 180 }} />
      <DateField testID="kse-date" label={t("ks_date")} value={x.date} lang={E.tr.lang} onChange={v => setX({ ...x, date: v || E.TODAY })} />
      <Picker testID="kse-cat" label={t("ks_cat")} value={cats.includes(x.cat) ? x.cat : cats[0]} onChange={v => setX({ ...x, cat: v })} options={cats.map(k => ({ key: k, label: t("ks_cat_" + k) }))} />
      <Picker testID="kse-player" label={t("ks_player")} value={x.pid || ""} onChange={v => setX({ ...x, pid: v || null })} options={[{ key: "", label: "–" }, ...E.D.players.map(p => ({ key: p.id, label: E.name(p) }))]} />
      <Field testID="kse-note" label={t("tk_note")} value={x.note} onChangeText={v => setX({ ...x, note: v })} maxLength={300} placeholder={t("ks_notePh")} />
      <Row gap={8} wrap>
        <Btn kind="primary" testID="kse-save" label={t("save")} disabled={!ok} onPress={async () => { await s.saveCash({ ...x, cat: cats.includes(x.cat) ? x.cat : cats[0], note: x.note.trim() }); s.toast(t("t_saved")); onClose(); }} />
        {!isNew ? <Btn kind="ghost" testID="kse-del" label={t("del")} onPress={async () => { await s.deleteCash(x.id); onClose(); }} /> : null}
      </Row>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Beiträge
// ---------------------------------------------------------------------------------------------
function Fees() {
  const { s, E, k, fmt } = useKasse(); const { t } = E;
  const [edit, setEdit] = useState<FeeDef | null>(null);
  const save = (fees: FeeDef[]) => s.saveKasse({ ...k, fees });
  return (
    <>
      <Card testID="ks-feelist">
        <CardTitle title={t("ks_fees")} info={<Info title={t("ks_fees")} text={t("ks_feesInfo")} />} />
        {k.fees.map(f => (
          <ListItem key={f.id} testID={"ks-fee-" + f.id} title={f.name} onPress={() => setEdit(f)}
            sub={[`${fmt(f.amount)} ${t("ks_every_" + f.every)}`, `${t("ks_from")} ${E.de(f.from)}${f.to ? " – " + E.de(f.to) : ""}`, f.pids?.length ? `${f.pids.length} ${t("players")}` : t("ks_allPlayers")].join(" · ")} />
        ))}
        {!k.fees.length ? <Muted>{t("ks_noFees")}</Muted> : null}
        <Btn small icon="plus" testID="ks-fee-add" label={t("ks_feeAdd")} onPress={() => setEdit({ id: "fee" + tmpId().slice(4, 12), name: "", amount: 5, every: "month", from: E.TODAY.slice(0, 8) + "01", to: null, pids: null })} style={{ alignSelf: "flex-start" }} />
      </Card>
      <FeeSheet fee={edit} onClose={() => setEdit(null)}
        onSave={f => { save(k.fees.some(x => x.id === f.id) ? k.fees.map(x => x.id === f.id ? f : x) : [...k.fees, f]); setEdit(null); }}
        onDelete={f => { save(k.fees.filter(x => x.id !== f.id)); setEdit(null); }} />
    </>
  );
}

function FeeSheet({ fee, onClose, onSave, onDelete }: { fee: FeeDef | null; onClose: () => void; onSave: (f: FeeDef) => void; onDelete: (f: FeeDef) => void }) {
  const { E, k } = useKasse(); const { t } = E;
  const [x, setX] = useState<FeeDef | null>(null), [key, setKey] = useState<string | null>(null);
  if ((fee?.id || null) !== key) { setKey(fee?.id || null); setX(fee ? { ...fee } : null); }
  if (!fee || !x) return null;
  const isNew = !k.fees.some(f => f.id === fee.id), some = !!x.pids;
  const paidAny = E.D.cash.some(e => e.feeId === fee.id);
  const ok = !!x.name.trim() && x.amount > 0 && !!x.from && (!x.to || x.to >= x.from) && (!some || !!x.pids?.length);
  return (
    <Sheet visible onClose={onClose} title={isNew ? t("ks_feeAdd") : x.name} testID="ks-fee-sheet" closeLabel={t("cancel")}>
      <Field testID="ksf-name" label={t("ks_feeName")} value={x.name} onChangeText={v => setX({ ...x, name: v })} placeholder={t("ks_feeNamePh")} maxLength={60} />
      <NumField testID="ksf-amount" label={t("ks_amount")} value={x.amount} min={0} max={10000} step={0.01} onChange={v => setX({ ...x, amount: v || 0 })} style={{ width: 180 }} />
      <Seg testID="ksf-every" value={x.every} onChange={(v: FeeEvery) => setX({ ...x, every: v })} options={(["once", "month", "season"] as FeeEvery[]).map(e => ({ key: e, label: t("ks_everyL_" + e) }))} />
      <Row gap={10} wrap>
        <DateField testID="ksf-from" label={x.every === "once" ? t("ks_due") : t("ks_from")} value={x.from} lang={E.tr.lang} onChange={v => setX({ ...x, from: v || E.TODAY })} />
        {x.every !== "once" ? <DateField testID="ksf-to" label={t("ks_to")} value={x.to || null} lang={E.tr.lang} onChange={v => setX({ ...x, to: v })} /> : null}
      </Row>
      <ToggleRow testID="ksf-all" label={t("ks_allPlayers")} desc={t("ks_allPlayersD")} value={!some} onChange={v => setX({ ...x, pids: v ? null : [] })} />
      {some ? <Col gap={4}>{E.D.players.map(p => <Check key={p.id} testID={"ksf-p-" + p.id} label={E.name(p)} value={!!x.pids?.includes(p.id)}
        onChange={v => setX({ ...x, pids: v ? [...(x.pids || []), p.id] : (x.pids || []).filter(y => y !== p.id) })} />)}</Col> : null}
      {paidAny && !isNew ? <Muted small>{t("ks_feeEditHint")}</Muted> : null}
      <Row gap={8} wrap>
        <Btn testID="ksf-save" kind="primary" label={t("save")} disabled={!ok} onPress={() => onSave({ ...x, name: x.name.trim(), to: x.every === "once" ? null : x.to || null })} />
        {!isNew ? <Btn kind="ghost" testID="ksf-del" label={t("del")} onPress={() => onDelete(x)} /> : null}
      </Row>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------------------------
function KasseSettingsForm({ onDone }: { onDone: () => void }) {
  const { s, E, k } = useKasse(); const { t } = E; const { c } = useTheme();
  const [x, setX] = useState<KasseSettings>(k);
  const youth = E.grp !== "akt";
  return (
    <Card testID="ks-settings">
      <CardTitle title={t("ks_settings")} info={<Info title={t("ks_title")} text={t("ks_info")} />} />
      <ToggleRow testID="kss-on" label={t("ks_on")} desc={t("ks_onD")} value={x.on} onChange={v => setX({ ...x, on: v })} />
      <Picker testID="kss-cur" label={t("ks_currency")} value={x.currency} onChange={v => setX({ ...x, currency: v })} options={CURRENCIES.map(cur => ({ key: cur, label: cur }))} />
      <ToggleRow testID="kss-money" label={t("ks_money")} desc={t("ks_moneyD")} value={x.money} onChange={v => setX({ ...x, money: v })} />
      {x.money && youth ? <Banner color={c.warn} testID="kss-youth">{t("ks_youthWarn")}</Banner> : null}
      <ToggleRow testID="kss-balance" label={t("ks_showBalance")} desc={t("ks_showBalanceD")} value={x.showBalance} onChange={v => setX({ ...x, showBalance: v })} />
      <Picker testID="kss-treasurer" label={t("ks_treasurer")} value={x.treasurer || ""} onChange={v => setX({ ...x, treasurer: v || null })}
        options={[{ key: "", label: t("ks_noTreasurer") }, ...E.D.players.map(p => ({ key: p.id, label: E.name(p) + (p.userId || s.isDemo ? "" : " · " + t("ks_noAccount")) }))]} />
      <Muted small>{t("ks_treasurerD")}</Muted>
      <Field testID="kss-pay" label={t("ks_payInfo")} value={x.payInfo || ""} onChangeText={v => setX({ ...x, payInfo: v })} placeholder={t("ks_payInfoPh")} maxLength={200} multiline />
      <Btn kind="primary" testID="kss-save" label={t("save")} onPress={async () => { await s.saveKasse({ ...x, payInfo: (x.payInfo || "").trim() }); s.toast(t("t_saved")); onDone(); }} style={{ alignSelf: "flex-start" }} />
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Spieler-App: Meine Kasse
// ---------------------------------------------------------------------------------------------
export function MyKasseCard({ pid, compact, onManage }: { pid: string; compact?: boolean; onManage?: () => void }) {
  const { E, k, fmt, treasurer } = useKasse(); const { t } = E; const { c } = useTheme();
  if (!k.on) return null;
  const items = itemsFor(E.D, k, pid, E.TODAY, E.tr.lang, r => ruleName(E, r));
  const open = items.filter(i => !i.paid && !i.waived), paid = items.filter(i => i.paid).reverse();
  if (compact && !open.length && !treasurer) return null;
  return (
    <Card testID="my-kasse">
      <CardTitle title={t("ks_mine")} right={open.length ? <AmountPill text={fmt(sumOf(open))} color={c.warn} /> : <AmountPill text={"✓ " + t("ks_allPaidShort")} color={c.ok} />} />
      {open.map(i => (
        <Row key={i.key} between gap={8}><T v="small" style={{ flexShrink: 1 }}>{i.label}</T><T v="small" bold>{fmt(i.amount)}</T></Row>
      ))}
      {open.length && k.payInfo ? <Banner testID="my-kasse-pay"><T v="small">💶 {k.payInfo}</T></Banner> : null}
      {!compact && paid.length ? <Col gap={2}><T v="eyebrow">{t("ks_history")}</T>{paid.slice(0, 6).map(i => (
        <Row key={i.key} between gap={8}><Muted small style={{ flexShrink: 1 }}>✓ {i.label}</Muted><Muted small>{fmt(i.amount)}</Muted></Row>
      ))}</Col> : null}
      {E.D.cashBalance != null ? <Muted small testID="my-kasse-balance">{t("ks_balance")}: <Text style={{ fontWeight: "800", color: c.ink }}>{fmt(E.D.cashBalance)}</Text></Muted> : null}
      {treasurer && onManage ? <Btn small kind="primary" testID="my-kasse-manage" label={"🗂 " + t("ks_manage")} onPress={onManage} style={{ alignSelf: "flex-start" }} /> : null}
    </Card>
  );
}

/** Für die Spieler-App: offene Summe (für Hinweise) */
export function useMyOpen(pid: string | null): number {
  const { E, k } = useKasse();
  if (!pid || !k.on) return 0;
  return sumOf(itemsFor(E.D, k, pid, E.TODAY, E.tr.lang, r => ruleName(E, r)).filter(i => !i.paid && !i.waived));
}
