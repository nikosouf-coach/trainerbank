// Trainer – Kontaktliste: Koordinator, Vorstand, Physio, Arztpraxen, Trainerteam. Freigabe für Spieler je Kontakt.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import type { Contact } from "../../src/core/types";
import { tmpId, useEngine, useStore } from "../../src/data/store";
import { ContactGroups, ContactSheet, EmergencyNote, newContact } from "../../src/ui/contacts";
import { Btn, Card, Header, Info, Muted, Row, Screen } from "../../src/ui/kit";

export default function Kontakte() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const router = useRouter();
  const [edit, setEdit] = useState<Contact | null>(null);
  const L = E.D.contacts;
  const fromStaff = async () => {
    const add = E.D.staff.filter(x => !L.some(y => y.name.trim().toLowerCase() === x.name.trim().toLowerCase()));
    if (!add.length) { s.toast(t("ct_fromStaffNone")); return; }
    for (const x of add) await s.saveContact({ id: tmpId(), name: x.name, role: x.role === "physio" ? "physio" : x.role === "betreuer" ? "betreuer" : "trainer", org: t("sr_" + x.role), phone: x.phone, email: x.email, address: "", note: "", vis: true });
    s.toast(tf("ct_fromStaffDone", { n: add.length }));
  };
  return (
    <Screen testID="coach-kontakte">
      <Header title={t("ct_title")} onBack={() => router.back()} backLabel={t("mo_title")} info={<Info title={t("ct_title")} text={t("ct_visD")} />}
        right={<Btn testID="ct-add" kind="primary" icon="plus" label={t("ct_new")} onPress={() => setEdit(newContact())} />} />
      {E.mods.archiv && E.D.staff.length ? <Row><Btn small testID="ct-from-staff" label={t("ct_fromStaff")} onPress={fromStaff} /></Row> : null}
      {L.length ? <ContactGroups list={L} staff onEdit={setEdit} /> : <Card><Muted>{t("ct_none")}</Muted></Card>}
      <EmergencyNote />
      <ContactSheet x={edit} onClose={() => setEdit(null)} />
    </Screen>
  );
}
