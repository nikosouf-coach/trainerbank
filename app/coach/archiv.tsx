// Trainer – Übungsarchiv: Übungen (mit Zeichnung) nach Kategorie und Thema, gespeicherte Einheiten, Trainerprofile.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import type { SessionTemplate, StaffProfile } from "../../src/core/types";
import { useEngine } from "../../src/data/store";
import { CATS, ExerciseRow, StaffSheet, TemplateSheet, templateMin } from "../../src/ui/archive";
import { Btn, Card, ChoiceChips, Field, Header, ListItem, Muted, Row, Screen, Seg, Tag } from "../../src/ui/kit";

type Tab = "ex" | "tpl" | "staff";

export default function Archiv() {
  const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const [tab, setTab] = useState<Tab>("ex");
  const [q, setQ] = useState(""); const [cat, setCat] = useState<string>("all"); const [theme, setTheme] = useState<string | null>(null);
  const [tpl, setTpl] = useState<SessionTemplate | null | undefined>(undefined);
  const [prof, setProf] = useState<StaffProfile | null | undefined>(undefined);
  const themes = [...new Set(E.D.exercises.flatMap(x => x.themes))].slice(0, 14);
  const ql = q.trim().toLowerCase();
  const list = E.D.exercises.filter(x => (cat === "all" || x.cat === cat) && (!theme || x.themes.includes(theme)) &&
    (!ql || x.title.toLowerCase().includes(ql) || x.themes.some(th => th.toLowerCase().includes(ql)) || x.desc.toLowerCase().includes(ql)));
  const add = tab === "ex" ? () => router.push("/coach/uebung/neu") : tab === "tpl" ? () => setTpl(null) : () => setProf(null);
  return (
    <Screen testID="coach-archiv">
      <Header title={t("ar_title")} onBack={() => router.back()} backLabel={t("mo_title")}
        right={<Btn testID="ar-add" kind="primary" icon="plus" label={tab === "ex" ? t("ar_new") : tab === "tpl" ? t("ar_newTpl") : t("sf_new")} onPress={add} />} />
      <Seg testID="ar-tab" value={tab} onChange={setTab} options={[{ key: "ex", label: t("ar_ex") }, { key: "tpl", label: t("ar_tpl") }, { key: "staff", label: t("ar_staff") }]} />
      {tab === "ex" ? <>
        <Field testID="ar-search" label={t("ar_search")} value={q} onChangeText={setQ} placeholder={t("ar_search")} />
        <ChoiceChips testID="ar-cat" value={cat} onChange={setCat} options={[{ key: "all", label: t("ar_all") }, ...CATS.filter(k => E.D.exercises.some(x => x.cat === k)).map(k => ({ key: k, label: t("cat_" + k) }))]} />
        {themes.length ? <Row wrap gap={6}>{themes.map(th => <Btn key={th} small kind={theme === th ? "primary" : "default"} label={"# " + th} onPress={() => setTheme(theme === th ? null : th)} />)}</Row> : null}
        <Card style={{ paddingVertical: 4, gap: 0 }}>{list.length ? list.map(x => <ExerciseRow key={x.id} ex={x} onPress={() => router.push("/coach/uebung/" + x.id)} />) : <Muted>{t("ar_none")}</Muted>}</Card>
      </> : null}
      {tab === "tpl" ? <Card style={{ paddingVertical: 4, gap: 0 }}>
        {E.D.templates.length ? E.D.templates.map(x => <ListItem key={x.id} testID={"tpl-" + x.id} title={x.title} sub={`${x.theme ? x.theme + " · " : ""}${tf("tp_total", { m: templateMin(x) })} · ${x.blocks.length} ${t("tp_blocks")}`} onPress={() => setTpl(x)} />) : <Muted>{t("ar_noTpl")}</Muted>}
      </Card> : null}
      {tab === "staff" ? <Card style={{ paddingVertical: 4, gap: 0 }}>
        {E.D.staff.length ? E.D.staff.map(x => {
          const n = E.D.exercises.reduce((a, ex) => a + ex.points.filter(p => p.staffId === x.id).length, 0);
          return <ListItem key={x.id} testID={"staff-" + x.id} title={x.name} sub={t("sr_" + x.role) + (n ? ` · ${n} ${t("ex_points")}` : "")} onPress={() => setProf(x)}>
            {x.areas.length ? <Row wrap gap={4}>{x.areas.map(a => <Tag key={a} label={a} />)}</Row> : null}
          </ListItem>;
        }) : <Muted>{t("sf_none")}</Muted>}
      </Card> : null}
      <TemplateSheet tpl={tpl} onClose={() => setTpl(undefined)} />
      <StaffSheet prof={prof} onClose={() => setProf(undefined)} />
    </Screen>
  );
}
