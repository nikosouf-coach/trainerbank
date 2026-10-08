// Trainer – Spieler-App & Trainerteam: Team-Codes teilen/erneuern, Co-Trainer-Anfragen annehmen.
import { useRouter } from "expo-router";
import { teamLabel } from "../../src/core/classes";
import React, { useEffect, useState } from "react";
import { Share, Text } from "react-native";
import type { StaffEntry } from "../../src/data/api";
import { useEngine, useStore } from "../../src/data/store";
import { Banner, Btn, Card, CardTitle, Col, Header, Info, ListItem, Muted, Row, Screen, T, Tag } from "../../src/ui/kit";
import { useTheme } from "../../src/ui/theme";

export default function Zugang() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const teamId = s.active?.teamId || "", owner = s.active?.role === "owner";
  const [codes, setCodes] = useState<{ joinCode?: string; staffCode?: string }>({ joinCode: E.team.joinCode, staffCode: E.team.staffCode });
  const [staff, setStaff] = useState<StaffEntry[] | null>(null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadStaff = () => s.api.staffList(teamId).then(setStaff).catch(() => setStaff([]));
  useEffect(() => { loadStaff(); }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); } };
  const share = (code: string) => Share.share({ message: tf("cd_shareText", { t: teamLabel(E.team), c: code }) }).catch(() => undefined);
  const codeBox = (label: string, code: string | undefined, id: string) => (
    <Col gap={6}>
      <T v="small" bold color={c.muted}>{label}</T>
      <Row gap={10} wrap>
        <Text selectable testID={id} style={{ fontSize: 24, fontWeight: "800", letterSpacing: 2, color: c.ink, fontVariant: ["tabular-nums"] }}>{code || "–"}</Text>
        {code ? <Btn small label={t("cd_share")} onPress={() => share(code)} /> : null}
      </Row>
    </Col>
  );
  const pending = (staff || []).filter(x => x.role === "pending"), team = (staff || []).filter(x => x.role !== "pending");
  return (
    <Screen testID="coach-zugang">
      <Header title={t("mh_access")} onBack={() => router.back()} backLabel={t("mo_title")} />
      <Card testID="codes">
        <CardTitle title={t("cd_title")} info={<Info title={t("pa_code")} text={t("pa_codeHint")} />} />
        <Muted small>{t("cd_sub")}</Muted>
        {codeBox(t("cd_join"), codes.joinCode, "code-join")}
        {codeBox(t("cd_staff"), codes.staffCode, "code-staff")}
        {owner ? (ask ? <Banner color={c.warn}><Col gap={8}><T v="small">{t("cd_newQ")}</T><Row gap={8}>
          <Btn small label={t("no")} onPress={() => setAsk(false)} />
          <Btn small kind="primary" testID="codes-new-confirm" label={t("cd_new")} disabled={busy} onPress={() => run(async () => { setCodes(await s.api.regenerateCodes(teamId)); setAsk(false); s.toast(t("t_saved")); })} />
        </Row></Col></Banner> : <Btn small testID="codes-new" label={codes.joinCode ? t("cd_new") : t("cd_show")} onPress={() => codes.joinCode ? setAsk(true) : run(async () => setCodes(await s.api.regenerateCodes(teamId)))} style={{ alignSelf: "flex-start" }} />)
          : <Muted small>{t("cd_ownerOnly")}</Muted>}
      </Card>
      <Card testID="staff">
        <CardTitle title={t("st_title2")} />
        {pending.length ? <Col gap={6}>
          <T v="eyebrow">{t("st_pending")}</T>
          {pending.map(x => (
            <ListItem key={x.userId} title={x.displayName || "–"} sub={t("role_pending")}>
              {owner ? <Row wrap gap={6}>
                <Btn small kind="primary" disabled={busy} label={`${t("st_approve")} ${t("st_asCoach")}`} onPress={() => run(async () => { await s.api.approveStaff(teamId, x.userId, "coach"); await loadStaff(); })} />
                <Btn small disabled={busy} label={`${t("st_approve")} ${t("st_asPhysio")}`} onPress={() => run(async () => { await s.api.approveStaff(teamId, x.userId, "physio"); await loadStaff(); })} />
                <Btn small kind="ghost" disabled={busy} label={t("st_reject")} onPress={() => run(async () => { await s.api.rejectStaff(teamId, x.userId); await loadStaff(); })} />
              </Row> : null}
            </ListItem>
          ))}
        </Col> : null}
        {staff == null ? <Muted>{t("loading")}</Muted> : team.map(x => <ListItem key={x.userId} title={x.displayName || "–"} right={<Tag label={t("role_" + x.role)} />} />)}
        {staff && team.length <= 1 && !pending.length ? <Muted small>{t("st_none")}</Muted> : null}
      </Card>
    </Screen>
  );
}
