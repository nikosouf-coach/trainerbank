// Trainer – Nutzung im Team (Pilot, später Nutzungsbericht für Vereine): Registrierungen, RPE-Quote, Morgen-Check,
// erfasste Anwesenheit und selbst geplante Trainings je Woche gegen die Ziele des Piloten. Nur Zahlen für das ganze Team.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { kwOf } from "../../src/core/dates";
import { share, toneOf, usageOf, USAGE_GOALS, type UsageKey, type UsageWeek } from "../../src/core/usage";
import { useEngine, useStore } from "../../src/data/store";
import { Background, Bar, Btn, Group, Header, Metric, Metrics, Muted, Row, Screen, Section, T } from "../../src/ui/kit";
import { useNavBack } from "../../src/ui/nav";
import { statusColor, useTheme } from "../../src/ui/theme";

type WeekKey = Exclude<UsageKey, "registered">;
const ROWS: { k: WeekKey; title: string; desc: string }[] = [
  { k: "rpe", title: "nu_rpe", desc: "nu_rpeD" },
  { k: "well", title: "nu_well", desc: "nu_wellD" },
  { k: "att", title: "nu_att", desc: "nu_attD" },
  { k: "plan", title: "nu_plan", desc: "nu_planD" },
];

export default function Nutzung() {
  const nb = useNavBack("nutzung");
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  // Demo: alle Spieler gelten als registriert (die Beispielspieler haben keine echten Konten)
  const u = useMemo(() => usageOf(E, 4, p => s.isDemo || !!p.userId), [E, s.isDemo]);
  const pct = (v: number | null): string => v == null ? "–" : Math.round(v * 100) + "\u00a0%";
  const col = (k: UsageKey, v: number | null): string => { const tone = toneOf(k, v); return tone ? statusColor(c, tone) : c.muted; };
  const reg = u.players ? u.registered / u.players : null, now = u.weeks[0];
  const weekLabel = (w: UsageWeek, i: number): string => i === 0 ? t("nu_thisWeek") : tf("nu_kw", { n: kwOf(w.ws) });
  const cell = { flex: 1, minWidth: 0, alignItems: "flex-end" as const };
  return (
    <Screen testID="coach-nutzung">
      <Header title={t("nu_title")} sub={t("nu_sub")} onBack={nb.onBack} backLabel={nb.backLabel} />
      <Section title={t("nu_reg")} pad testID="nu-reg">
        <Row between gap={10}>
          <T bold style={{ flexShrink: 1 }}>{tf("nu_regText", { n: u.registered, of: u.players })}</T>
          <Text style={{ fontSize: 17, fontWeight: "800", color: col("registered", reg), fontVariant: ["tabular-nums"] }}>{pct(reg)}</Text>
        </Row>
        <Bar value={reg ?? 0} color={col("registered", reg)} />
        <Muted small>{tf("nu_goal", { v: pct(USAGE_GOALS.registered) })}</Muted>
        {u.registered < u.players ? <Btn small icon="key" testID="nu-invite" label={t("nu_regInvite")} onPress={() => router.push("/coach/zugang")} style={{ alignSelf: "flex-start" }} /> : null}
      </Section>
      <Section title={t("nu_now")} plain testID="nu-now">
        <Metrics>
          {ROWS.map(r => {
            const v = share(now[r.k]);
            return <Metric key={r.k} label={t(r.title)} value={pct(v)} color={col(r.k, v)} sub={tf("nu_goal", { v: pct(USAGE_GOALS[r.k]) })} testID={"nu-" + r.k} />;
          })}
        </Metrics>
      </Section>
      <Section title={t("nu_weeks")} testID="nu-weeks" footer={s.can("health") ? undefined : t("nu_noHealth")}>
        <Group pad>
          <Row gap={6}>
            {u.weeks.map((w, i) => <Text key={w.ws} numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 12, fontWeight: "600", color: c.muted }}>{weekLabel(w, i)}</Text>)}
          </Row>
          {ROWS.map(r => (
            <View key={r.k} testID={"nu-row-" + r.k} style={{ gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.line }}>
              <Row between gap={8} align="flex-start">
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: c.ink }}>{t(r.title)}</Text>
                  <Text style={{ fontSize: 12.5, color: c.muted }}>{t(r.desc)}</Text>
                </View>
                <Text style={{ fontSize: 12.5, color: c.muted }}>{tf("nu_goal", { v: pct(USAGE_GOALS[r.k]) })}</Text>
              </Row>
              <Row gap={6}>
                {u.weeks.map(w => {
                  const x = w[r.k], v = share(x);
                  return <View key={w.ws} style={cell}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: col(r.k, v), fontVariant: ["tabular-nums"] }}>{pct(v)}</Text>
                    <Text style={{ fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] }}>{x ? `${x.n}/${x.of}` : " "}</Text>
                  </View>;
                })}
              </Row>
            </View>
          ))}
        </Group>
      </Section>
      <Background title={t("nu_goals")} text={E.tr.tl("nu_goalsText")} testID="nu-goals" />
      {s.appAdmin ? <Muted small>{t("nu_sentry")}</Muted> : null}
    </Screen>
  );
}
