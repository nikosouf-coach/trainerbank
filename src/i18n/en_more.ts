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

  // Inactive players
  in_title: "Inactive players ({n})", in_info: "Inactive players are not part of any calculation and no longer see team data. Their previous data is kept.",
  in_reactivate: "Reactivate", in_done: "{n} is back in the squad", in_show: "Show", in_hide: "Hide",
};
