// Einladung mit QR-Code (Seite „Spieler-App & Trainerteam“): Code zum Scannen, Schritte, Installationslinks, Teilen.
import React from "react";
import { Share, Text } from "react-native";
import { inviteUrl, installLinks, type InviteKind } from "../data/invite";
import { useStore } from "../data/store";
import { Btn, Col, Muted, Row, Sheet, T } from "./kit";
import { QrCode } from "./qr";
import { useTheme } from "./theme";

export function InviteSheet({ kind, code, team, visible, onClose }: { kind: InviteKind; code: string; team: string; visible: boolean; onClose: () => void }) {
  const s = useStore(); const { t, tf, tl } = s.tr; const { c } = useTheme();
  const url = inviteUrl(kind, code), inst = installLinks();
  const share = () => {
    const lines = [tf("inv_shareText", { t: team, l: url, c: code })];
    if (inst.ios || inst.android) lines.push(tf("inv_shareInstall", { i: inst.ios || "–", a: inst.android || "–" }));
    Share.share({ message: lines.join("\n\n") }).catch(() => undefined);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t(kind === "staff" ? "inv_titleStaff" : "inv_title")} testID="invite-sheet" closeLabel={t("cancel")}>
      <Col gap={10} style={{ alignItems: "center" }}>
        <QrCode value={url} size={232} label={`${t("inv_scan")} ${code}`} testID="invite-qr" />
        <Text selectable testID="invite-code" style={{ fontSize: 26, fontWeight: "800", letterSpacing: 2, color: c.ink, fontVariant: ["tabular-nums"] }}>{code}</Text>
        <Muted small style={{ textAlign: "center" }}>{t("inv_scan")}</Muted>
      </Col>
      <Col gap={6} testID="invite-steps">
        {tl(kind === "staff" ? "inv_stepsStaff" : "inv_steps").map((x, i) => (
          <Row key={i} gap={8} align="flex-start"><T bold style={{ width: 18 }}>{i + 1}.</T><T style={{ flex: 1 }}>{x}</T></Row>
        ))}
      </Col>
      {inst.ios || inst.android ? <Col gap={8} testID="invite-install">
        <T v="h3">{t("inv_install")}</T>
        <Row gap={20} wrap style={{ justifyContent: "center" }}>
          {inst.ios ? <Col gap={4} style={{ alignItems: "center" }}><QrCode value={inst.ios} size={136} label={t("inv_ios")} /><Muted small>{t("inv_ios")}</Muted></Col> : null}
          {inst.android ? <Col gap={4} style={{ alignItems: "center" }}><QrCode value={inst.android} size={136} label={t("inv_android")} /><Muted small>{t("inv_android")}</Muted></Col> : null}
        </Row>
        <Muted small>{t("inv_installHint")}</Muted>
      </Col> : null}
      <Btn testID="invite-share" kind="primary" icon="send" label={t("inv_share")} onPress={share} style={{ alignSelf: "flex-start" }} />
    </Sheet>
  );
}
