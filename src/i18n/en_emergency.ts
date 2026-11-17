// Texts: emergency contacts – en
import type { Dict } from "./types";

export const en_emergency: Dict = {
  nf_title: "Emergency contacts", nvb_notfall: "Emergency", nf_menuSub: "Who to call in an emergency – per player",
  nf_info: "For each player one or two people you call in an emergency – with a phone number. Players enter the contact themselves when joining (required); for players without an account you enter it. The contacts are available offline too. Important notes for an emergency (e.g. allergy, asthma inhaler) are health data – only people with the “Health data” permission see them. Teammates see none of this.",
  nf_my: "Emergency contact", nf_myMissing: "Missing – please add",
  nf_missingT: "Emergency contact missing", nf_missingD: "So your coaching staff can reach someone in an emergency, please add a person with a phone number – for example your mother or father.", nf_enter: "Add now",
  nf_contactN: "Contact {n}", nf_name: "Name", nf_namePh: "e.g. Sarah Miller", nf_rel: "Relationship", nf_phone: "Phone", nf_phonePh: "e.g. 07700 900123",
  nf_add: "Add a second contact", nf_remove: "Remove contact {n}",
  nf_rel_mother: "Mother", nf_rel_father: "Father", nf_rel_guardian: "Guardian", nf_rel_partner: "Partner", nf_rel_sibling: "Sibling", nf_rel_grandparent: "Grandparent", nf_rel_other: "Other",
  nf_med: "Important notes for an emergency (optional)", nf_medPh: "e.g. Asthma – inhaler is in the sports bag", nf_medT: "Notes for an emergency",
  nf_medD: "Health information: only the coaching staff with the “Health data” permission sees it. Please only what matters in an emergency.",
  nf_tell: "Let the person know that you're naming them as your emergency contact.", nf_saved: "Emergency contact saved",
  nf_errNone: "Please add at least one person with a phone number.", nf_errName: "Contact {n}: please enter a name.",
  nf_errPhone: "Contact {n}: please enter a valid phone number (at least 6 digits).", nf_errSame: "Contact {n}: this number has already been entered.",
  nf_call: "Call {n}", nf_callDemo: "The demo doesn't place calls.",
  nf_none: "No emergency contact", nf_missingN: "{n} players without an emergency contact", nf_missing1: "1 player without an emergency contact", nf_allSet: "All players have an emergency contact.",
  nf_countN: "{n} of {m} players with an emergency contact", nf_filterAll: "All", nf_filterMissing: "Missing",
  nf_remind: "Remind the missing ({n})", nf_remindMsg: "Please add your emergency contact in the app: Me → Emergency contact. Thanks!", nf_reminded: "Reminder sent",
  nf_noAccount: "Without their own account: {n} – you enter the contact yourselves.",
  nf_editT: "Emergency contact", nf_enterCoach: "Add", nf_allLink: "All players", nf_offline: "Available offline too.",
  jn_emergency: "Emergency contact", jn_emergencyD: "Who should your coaching staff call in an emergency? This is required – at least one person with a phone number.",
  jn_doneNoEm: "Welcome to the team! Your emergency contact wasn't saved – please add it again on the home screen.",
  pf_emergency: "Emergency contact", pf_emergencyD: "Optional here – the player can also add it. If it's missing, the squad shows it.",
};
