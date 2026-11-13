// Texts: privacy in the player profile (data access report, delete health data) – en
import type { Dict } from "./types";

export const en_privacy: Dict = {
  dsp_title: "Privacy",
  dsp_sub: "Access report, delete health data",
  dsp_intro: "Fulfil the player's rights here: a report of all stored data, and deleting health data when consent is withdrawn.",
  dsp_exportT: "Create access report",
  dsp_exportD: "All data your team has stored in the app about {n} – including internal notes – as a file. For access requests (Art. 15 GDPR), also for players without an account. Before passing it on, black out details about other people in free texts.",
  dsp_export: "Create report",
  dsp_exportOwner: "Only the team owner can create an access report.",
  dsp_exportDone: "Access report created",
  dsp_eraseT: "Delete health data",
  dsp_eraseD: "When {n} or the parents withdraw consent, e.g. on paper. Deletes load, morning check, extra sessions, height and weight, emergency notes, rehab, build-up and growth groups and recommendations such as rest or recovery. Absences remain as \"Other\" without details; accident reports remain (separate legal basis).",
  dsp_eraseFind: "Medical reports ({k}) are deleted as well.",
  dsp_eraseFindNo: "Medical reports ({k}) remain – you lack the \"Medical reports\" permission.",
  dsp_eraseApp: "If a player withdraws in the app, the app deletes their health data automatically after 30 days.",
  dsp_erase: "Delete health data",
  dsp_eraseQ: "Permanently delete the health data of {n}? This cannot be undone.",
  dsp_eraseYes: "Delete permanently",
  dsp_erased: "Health data deleted",
  dsp_eraseNoPerm: "Deleting requires the \"Health data\" permission.",
  cs_withdrawParental: "For players under 16 this removes the basis for health data. It will be deleted after 30 days unless new consent is given by then.",
  cs_withdrawFindings: "Medical reports stored in the app with your consent will be deleted after 30 days (file and entry) unless you consent again. Reports with written consent remain.",
  cs_withdrawAi: "The AI coach will be locked for you, and your coaching team will no longer include your data in questions to the AI.",
  pot_kiNoConsent: "AI suggestions are only available if the player (under 16 together with their parents) has consented to the AI coach.",
  bf_redact: "Before uploading, cover name, address, date of birth and insurance number on the report – training and analysis don't need them.",
};
