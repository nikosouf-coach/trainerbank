// Test phase and operations: feedback, feedback inbox (operator), crash reports, updates, QR invite, usage.
import type { Dict } from "./types";

export const en_pilot: Dict = {
  // Feedback / report a bug
  fb_menu: "Feedback / report a bug", fb_menuSub: "Bugs, unclear things or wishes for the developer",
  fb_title: "Feedback / report a bug",
  fb_intro: "Your message goes straight to the developer of the app. Thanks for helping to make it better!",
  fb_kindQ: "What is it about?",
  fb_k_bug: "Bug", fb_k_unclear: "Unclear", fb_k_wish: "Wish", fb_k_praise: "Praise",
  fb_l_bug: "What happened?", fb_ph_bug: "What did you do? What happened? What did you expect?",
  fb_l_unclear: "What was unclear or awkward?", fb_ph_unclear: "For example: I could not find where …",
  fb_l_wish: "What would you like?", fb_ph_wish: "What should the app do – and what do you need it for?",
  fb_l_praise: "What do you like?", fb_ph_praise: "What works especially well for you?",
  fb_privacy: "Please do not enter health information or names of other people.",
  fb_shot: "Attach a screenshot", fb_shotChange: "Other picture", fb_shotRemove: "Remove",
  fb_shotHint: "Tip: take a screenshot of the page first and attach it here. Cover health data and names of others first.",
  fb_meta: "Sent along",
  fb_metaText: "Page {p} · app {v} · {d}",
  fb_metaAccount: "Plus your account (for questions) and the active team.",
  fb_send: "Send",
  fb_need: "Please describe briefly what it is about.",
  fb_thanks: "Thank you! Your feedback has arrived.",
  fb_offline: "No connection – please send again later. Your text stays here.",
  fb_demo: "Nothing is sent in demo mode – the feedback stays on this device.",
  err_feedback_rate: "We have received a lot of feedback from you today – please continue tomorrow. Thank you!",

  // Feedback inbox (operator of the app)
  fbl_title: "Feedback", fbl_menuSub: "Messages from all users – only for you as the operator",
  fbl_open: "Open", fbl_done: "Done", fbl_all: "All",
  fbl_none: "No feedback.",
  fbl_markDone: "Done", fbl_reopen: "Reopen", fbl_shot: "Screenshot", fbl_share: "Share", fbl_shareAll: "Share all",
  fbl_delete: "Delete", fbl_deleteQ: "Delete feedback?", fbl_deleteText: "Text and screenshot are deleted permanently.",
  fbl_onlyAdmin: "Only the operators of the app can see this page.",
  fbl_shareHint: "“Share” passes messages on without names – for example to Claude or into a task list.",
  fbl_player: "Player", fbl_from: "from {n}", fbl_doneAt: "done on {d}",
  fbl_nOpen: "{n} open", fbl_nDone: "{n} done", fbl_nAll: "{n} in total",

  // Crash reports
  cr_toggle: "Send crash reports",
  cr_desc: "Helps to find bugs quickly. Only technical details are sent – where the error happened, app version, device and the pages opened last – to Sentry with storage in the EU. No names, no health data, no screenshots. Applies to this device.",
  cr_webOnly: "Crash reports are available in the mobile app.",
  cr_askTitle: "Help us find bugs faster",
  cr_askText: "May the app send a technical report when it crashes – without names and without health data? You can change this at any time in your account.",
  cr_yes: "Yes, turn on", cr_no: "No thanks", cr_on: "Thank you! Crash reports are on.",

  // Updates
  up_build: "build {b}", up_update: "update of {d}",
  up_check: "Check for updates", up_checking: "Checking …",
  up_none: "The app is up to date.",
  up_ready: "Update loaded – it is active after the next start.",
  up_restart: "Restart now",

  // Invite with QR code
  inv_show: "Show QR code",
  inv_title: "Invite players", inv_titleStaff: "Invite coaching staff",
  inv_scan: "Scan with the phone camera – the app opens with the code.",
  inv_steps: ["Install the app", "Register and confirm your email", "Scan the QR code or enter the code in the app"],
  inv_stepsStaff: ["Install the app", "Register and confirm your email", "Scan the QR code or enter the code under “Join as coach or official”"],
  inv_install: "Install the app", inv_ios: "iPhone", inv_android: "Android",
  inv_installHint: "Test version: iPhone via TestFlight, Android via the Google Play test.",
  inv_share: "Share invitation",
  inv_shareText: "Join our team “{t}” in the Trainerbank app: {l} – or enter the code {c} in the app.",
  inv_shareInstall: "Get the app – iPhone: {i} · Android: {a}",
  inv_saved: "Invitation saved (code {c}). Sign in or register – you continue right after.",
  inv_found: "You have an invitation: code {c}.",
  inv_join: "Join team", inv_joinStaff: "Join coaching staff", inv_forget: "Discard",

  // Usage in the team
  nu_title: "Usage in the team", nu_menuSub: "Registrations, entries and planning per week",
  nu_sub: "Figures for the whole team – no names.",
  nu_reg: "Registered", nu_regText: "{n} of {of} players have the app", nu_regInvite: "Invite missing players",
  nu_rpe: "RPE entered", nu_rpeD: "by those present at team training",
  nu_well: "Morning check", nu_wellD: "players with the app, per day",
  nu_att: "Attendance taken", nu_attD: "team trainings",
  nu_plan: "Training planned", nu_planD: "planned by you: content, type, RPE or schedule",
  nu_goal: "Goal {v}", nu_now: "This week", nu_thisWeek: "this week", nu_kw: "Wk {n}", nu_weeks: "The last four weeks",
  nu_goals: "Goals of the pilot",
  nu_goalsText: [
    "After the first week at least 90% of the players have the app.",
    "From the second week at least 75% of those present enter their RPE.",
    "Those who use the morning check do it at least every other day.",
    "The coaching staff takes attendance every week and plans the trainings in the app – without Google Forms.",
  ],
  nu_noHealth: "RPE and morning check are only visible with the “Health” permission.",
  nu_sentry: "Crashes and the share of crash-free sessions are shown in Sentry.",
};
