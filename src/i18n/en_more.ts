// Texts: contact list, reminders, inactive players – en
import type { Dict } from "./types";

export const en_more: Dict = {
  // Contact list
  ct_title: "Contacts", ct_sub: "Coordinator, board, physio, doctors, coaching staff",
  ct_new: "Contact", ct_edit: "Edit contact", ct_none: "No contacts yet. Add who players and coaches should be able to reach – e.g. youth coordinator, physio or sports doctor.",
  ct_name: "Name", ct_role: "Role", ct_org: "Function / practice / club", ct_phone: "Phone", ct_email: "Email", ct_address: "Address", ct_note: "Note (e.g. opening hours)",
  ct_vis: "Visible to players", ct_visD: "Players see this contact in their app (Me → Contacts).",
  ct_hidden: "coaching staff only", ct_call: "Call", ct_mail: "Email", ct_del: "Delete contact", ct_saved: "Contact saved", ct_deleted: "Contact deleted",
  ct_fromStaff: "Add coach profiles", ct_fromStaffDone: "{n} coaches added", ct_fromStaffNone: "All coach profiles are already in the list.",
  ct_emergency: "Emergency 112 · On-call medical service 116 117 (Germany)",
  ct_r_trainer: "Coaching staff", ct_r_koordinator: "Coordination", ct_r_vorstand: "Board", ct_r_physio: "Physiotherapy", ct_r_arzt: "Doctors & practices", ct_r_betreuer: "Team management", ct_r_sonst: "Other",
  ct_playerNone: "Your coach hasn't shared any contacts yet.", ct_off: "The contact list is switched off for players.",

  // Reminders
  rm_title: "Reminders for players",
  rm_info: "Push notifications to the players' phones. Only players who haven't logged yet get one – at most one per type and day. Players need to allow notifications in their app (Me → Account).",
  rm_well: "Morning check", rm_wellD: "Daily at the chosen time. Not during breaks.", rm_wellAt: "Time",
  rm_rpe: "RPE after training and matches", rm_rpeD: "After the session ends. During breaks only for scheduled sessions.", rm_rpeDelay: "Delay after the end",
  rm_min: "{m} min",
  rm_program: "Break programme", rm_programD: "Mondays and Thursdays at 5 pm while a break with a programme is running.",
  rm_needs: "Needs the “{m}” package.",

  // Setup: modules and training times
  su_preset: "Preset", su_presetHint: "The level preselects suitable modules. Afterwards you can switch each module on or off.",
  su_mods: "Your modules", su_modsCount: "{n} of {m} modules active", su_modsLater: "You can change this any time under More → Modules.",
  su_allOn: "All on", su_allOff: "All off", su_reset: "Restore preset",
  dur_all: "Length of a training session", dur_allHint: "Applies to all training days – adjust single days below.",
  days_pick: "Training days", su_noDays: "Choose at least one training day.",
  su_daysT: "Training days and length", su_daysB: "On which days do you train, when and for how long? Match day and kick-off drive the weekly plan.",

  // Setup (steps)
  su_s_me: "About you", su_s_meB: "Your coach profile – how the app addresses you and how players and staff see you.",
  su_s_team: "Your team", su_s_teamB: "Age group, club, team and logo.",
  su_logo: "Club logo", su_color: "Club colour",
  su_s_mods: "Features", su_infoT: "Show info buttons (i)", su_infoD: "Small (i) buttons explain terms like ACWR or RPE right where they appear. Change any time under More → Account.",
  su_s_orga: "Players & staff", su_s_orgaB: "What players see and may do in their app – and who coaches with you.",
  su_pvT: "Player app", su_staffT: "More coaches", su_staffD: "Assistant, goalkeeper and fitness coaches, physio. They get their own access with their tasks later.", su_addStaff: "Add coach",
  su_s_load: "Reminders", su_s_loadB: "Push messages so players log their data.",
  su_s_science: "Sports science", su_s_scienceB: "How precisely the app calculates and which tests your team does.",
  su_testsT: "Test battery", su_testsD: "These tests appear in performance testing. Recommended: at the start and end of pre-season and in the winter break.",
  su_fixD: "Off: in build-up and deload weeks the app may also adjust duration, not only intensity.",
  su_s_sum: "All set", su_meT: "Coach", su_info: "Info buttons",
  su_demoNote: "Demo: your entries stay on this device only and disappear when you leave the demo.",
  su_needName: "Please enter first and last name.", su_needClub: "Please enter the club name.",
  // Coach profile
  pf_photo: "Photo", pf_role: "Your role", pf_license: "Coaching licence", pf_birth: "Date of birth (optional)", pf_phone: "Phone (optional)",
  pf_privacy: "Phone and photo are only visible where you share them (contact list). Only the coaching staff sees the date of birth.",
  pf_title: "My coach profile", pf_saved: "Profile saved",
  ko_display: "Display", sf_edit: "Edit",
  lic_none: "None yet", lic_kinder: "Children's coach certificate", lic_c: "C licence", lic_b: "B licence", lic_bplus: "B+ / elite youth licence",
  lic_a: "A licence", lic_pro: "UEFA Pro", lic_tw: "Goalkeeper coach licence", lic_athletik: "Fitness coach licence", lic_other: "Other qualification",
  ph_coachN: "From {n}", pl_newRatingN: "New rating from {n}",
  hi_morning: "Good morning", hi_day: "Hello", hi_evening: "Good evening", coach_from: "{n}",

  // Home
  db_title: "Customise home", db_hint: "Choose which cards you see on the home screen and their order. Applies to your account on all devices.",
  db_next: "Next session", db_tasks: "My tasks", db_phase: "Pre-season & breaks", db_status: "Traffic light overview", db_attn: "Needs attention",
  db_absent: "Absent next session", db_week: "This week", db_events: "Events", db_last: "Last session", db_load: "Team load", db_ai: "AI coach",
  db_na: "Not available with your modules", db_up: "Move up", db_down: "Move down", db_reset: "Restore default", db_edit: "Customise home",
  db_attnNone: "Everyone in the green zone.", db_absNone: "Everyone available.", db_more: "+{n} more",

  // Wiki
  wk_title: "Terms explained", wk_sub: "All technical terms of the app – short and clear. Tap a term for details and sources.",
  wk_search: "Search", wk_searchPh: "e.g. ACWR, RPE, taper", wk_none: "Nothing found.", wk_src: "Sources", wk_open: "Open in wiki", wk_menu: "Terms explained (wiki)", wk_menuSub: "RPE, ACWR, tests, growth, planning …",
  wk_c_belastung: "Load", wk_c_erholung: "Recovery", wk_c_planung: "Planning", wk_c_leistung: "Performance", wk_c_wachstum: "Growth", wk_c_gesundheit: "Health", wk_c_app: "App",

  // Inactive players
  in_title: "Inactive players ({n})", in_info: "Inactive players are not part of any calculation and no longer see team data. Their previous data is kept.",
  in_reactivate: "Reactivate", in_done: "{n} is back in the squad", in_show: "Show", in_hide: "Hide",
};
