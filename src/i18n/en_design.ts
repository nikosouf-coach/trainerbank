// Texts: design (detail pages, sections, new overviews) – en
import type { Dict } from "./types";

export const en_design: Dict = {
  wdl: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  // Detail page building blocks
  ix_explain: "What does it mean?", ix_tips: "Suggestions", ix_bg: "Background & sources",
  // Team load
  tl_leadCrit1: "1 player overloaded, {ok} in the sweet spot", tl_leadCrit: "{n} players overloaded, {ok} in the sweet spot",
  tl_leadWarn1: "1 player at the limit, {ok} in the sweet spot", tl_leadWarn: "{n} players at the limit, {ok} in the sweet spot",
  tl_leadOk: "{ok} of {all} players in the sweet spot", tl_leadBuild: "Not enough entries for an assessment yet",
  tl_toPlan: "Adjust the week in planning", tl_showAll: "Show all {n}", tl_week: "7 days {a} AU, average {b} AU",
  tl_off: "The load module is switched off.",
  // Squad
  yrs: "yrs", sts_crit: "Overloaded", sts_warn: "At the limit", sts_low: "Underloaded", sts_inj: "Out",
  // Player profile: areas
  ps_areas: "Areas", ps_load: "Load & recovery", ps_health: "Health", ps_lastTest: "Last test on {d}", ps_noTests: "No tests yet",
  ps_games: "{g} matches, {m} min", ps_goals: "{n} active goals", ps_noGoals: "No goals yet", ps_noNote: "No note yet",
  ps_injSince: "{n} since {d}", ps_recSub: "Check the app's suggestion, adjust it and send it to the player.",
  k_wellSub: "4 to 28, lower is better",
  kt_att: "Attendance", kt_attSub: "Last 28 days", kt_sleep: "Sleep",
  // Player: body today and my data
  pk_why: "Reason", pk_helps: "What helps you now", pk_moreTips: "All tips", pk_moreTipsSub: "Recovery, strength, nutrition, sleep",
  pdx_week: "Week & badges", pdx_season: "Season & feedback", pdx_tests: "My tests", pdx_att: "Attendance & absences",
  pdx_none: "Your coach hasn't shared any data with you yet.",
  gm_relS: "Reliability",
  ps_due: "Due", ps_notAssessed: "Not assessed yet",
  nvs_belastung: "Zones, players, suggestions, background",
  notReady1: "1 player not recovered by then",
};
