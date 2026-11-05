// Texts: polls (quick polls and surveys) – en
import type { Dict } from "./types";

export const en_polls: Dict = {
  um_title: "Polls", nvb_umfragen: "Polls", um_menuSub: "Quick polls and surveys for the team", um_meSub: "Quick polls and surveys from your team",
  db_polls: "Running polls", dp_polls: "Polls",
  um_info: "Ask your team something quickly (quick poll) or get honest feedback with a survey. With names you see who picked what – handy for travel or dates. Anonymous means nobody sees who answered what, not even you; results then only appear from three answers. Only the coaching staff sees free-text answers.",
  um_kind_quick: "Quick poll", um_kind_survey: "Survey",
  um_newQuick: "New quick poll", um_newSurvey: "New survey", um_templates: "Templates", um_templatesD: "Ready-made polls for common questions – you can adjust everything before starting.",
  um_running: "Running", um_ended: "Ended", um_none: "No polls yet", um_noneD: "Ask your team who's taking the bus – or get honest, anonymous feedback on the training week.",
  um_answeredN: "{n} of {m} have answered", um_answered1: "1 of {m} has answered",
  um_answersN: "{n} answers", um_answers1: "1 answer", um_answers0: "No answers yet",
  um_until: "until {d}", um_noEnd: "no end date", um_endsToday: "ends today", um_endedOn: "ended",
  um_named: "With names", um_anon: "Anonymous", um_resAll: "Results for everyone", um_resStaff: "Results for the coaching staff only",
  um_toTeam: "Whole team", um_toGroup: "To: {g}", um_toGroupHidden: "To a group",
  um_by: "by {n}", um_byMe: "by you", um_fromPlayer: "From a player",
  um_playersMay: "Players may start quick polls", um_playersMayD: "Always with names and for the whole team, at most two at a time per player. You see all of them and can end or delete any.",
  um_playersOn: "Players can now start quick polls", um_playersOff: "Players can no longer start quick polls",

  // Results
  um_participation: "Participation", um_results: "Result",
  um_hiddenAnon: "Anonymous: results appear from {n} answers – so nobody can guess who answered what.",
  um_resultsStaffOnly: "Only the coaching staff sees the results.", um_resultsAfter: "You'll see the result once you've voted.",
  um_avg: "Ø {v}", um_scaleOf: "of 5", um_texts: "Free-text answers", um_textsNone: "No free-text answers yet.", um_textOnlyStaff: "Only the coaching staff sees free-text answers.",
  um_votersN: "{n} votes", um_voters1: "1 vote", um_myPick: "your pick",
  um_missing: "Not answered yet", um_allDone: "Everyone has answered.",
  um_remind: "Remind ({n})", um_remindAll: "Remind everyone", um_reminded: "Reminder sent",
  um_remindMsg: "Please still vote: “{t}” – you'll find the poll on your home screen.",
  um_remindMsgAll: "In case you haven't taken part yet: “{t}” – you'll find the poll on your home screen.",
  um_remindAnonD: "Anonymous: you don't know who has answered – the reminder goes to everyone it's addressed to.",

  // Manage
  um_close: "End", um_closedT: "Poll ended", um_reopen: "Reopen", um_reopenedT: "Poll reopened",
  um_editT: "Edit poll", um_locked: "Once someone has answered, questions and settings stay fixed – you can only change the end date.",
  um_changeEnd: "Change end date", um_endSaved: "End date changed",
  um_delete: "Delete poll", um_deleteQ: "Delete the poll with all answers?", um_deleteYes: "Yes, delete", um_deleted: "Poll deleted",
  um_share: "Announce in the chat", um_shareD: "Short message in the team chat or the group's chat.", um_shareMsg: "📊 New poll: “{t}” – please vote in the app (home screen).",
  um_state_open: "running", um_state_closed: "ended",

  // Edit
  um_question: "Question", um_questionPh: "e.g. How are you getting to the away game?",
  um_titleF: "Title", um_titlePh: "e.g. Feedback on the training week",
  um_intro: "Introduction (optional)", um_introPh: "e.g. Takes one minute. Your answers are anonymous.",
  um_options: "Answers", um_option: "Answer {n}", um_optionAdd: "Add answer", um_optionDel: "Remove answer {n}",
  um_multi: "Allow several answers",
  um_qtype_single: "Choice", um_qtype_multi: "Multiple choice", um_qtype_scale: "Scale 1–5", um_qtype_text: "Free text",
  um_qN: "Question {n}", um_qAdd: "Add question", um_qDel: "Remove question {n}", um_qUp: "Move question {n} up", um_qDown: "Move question {n} down",
  um_required: "Required", um_lo: "Label at 1", um_hi: "Label at 5", um_loPh: "e.g. not at all", um_hiPh: "e.g. a lot",
  um_who: "Who answers?", um_groupHidden: "The players in this group see the poll, but not the group's name.",
  um_mode: "Answers", um_modeNamedAll: "After answering, everyone sees who picked what.", um_modeNamedStaff: "Only the coaching staff sees who picked what.",
  um_modeAnon: "Nobody sees who answered what – not even the coaching staff. Results from three answers.",
  um_resWho: "Who sees the result", um_resAllOpt: "Everyone", um_resStaffOpt: "Coaching staff only",
  um_resAllD: "Players see the result after answering and after the end.", um_resStaffD: "Players only see their own answer.",
  um_end: "End date (optional)", um_endD: "Answers are possible up to and including this day. Without a date the poll runs until you end it.",
  um_start: "Start poll", um_started: "Poll started", um_saved: "Poll saved",
  um_errTitle: "Please enter a question.", um_errTitleS: "Please enter a title.", um_errOptions: "Please enter at least two different answers.",
  um_errQ: "Question {n} is incomplete: the text is missing or there are fewer than two answers.", um_errNoQ: "Please add at least one question.",
  um_cancel: "Cancel", um_errPast: "The end date is in the past.", um_end2: "2 days", um_end7: "1 week", um_lastDay: "Last day", um_shared: "Announced in the chat",
  um_tplPick: "Choose a template", um_questionsN: "{n} questions", um_questions1: "1 question", um_minutes: "about {n} min",

  // Player
  um_vote: "Vote", um_send: "Send", um_thanks: "Thanks! Your answer has been saved.",
  um_change: "Change answer", um_withdraw: "Withdraw answer", um_withdrawn: "Answer withdrawn",
  um_yourAnswer: "Your answer", um_youVoted: "You've voted", um_open: "Open", um_seeAll: "All polls",
  um_privNamedAll: "With names – everyone sees what you picked.", um_privNamedStaff: "With names – only the coaching staff sees your answer.",
  um_privAnon: "Anonymous – nobody sees what you answered.", um_privText: "Only the coaching staff sees free text.",
  um_needRequired: "Please answer all required questions.", um_optional: "optional",
  um_toAnswer: "Open for you", um_answeredList: "Answered", um_mine: "Started by you",
  um_startOwn: "Start a quick poll", um_ownMax: "You already have {n} running quick polls. End one to start a new one.",
  um_ownInfo: "Your own quick polls are always with names and go to the whole team. Your coaching staff sees them and can end them.",
  um_playerNone: "No polls right now.", um_cardMore: "See all polls",

  // Server errors
  err_polls_off: "Players can't start quick polls right now.", err_poll_closed: "This poll has ended.",
  err_poll_answered: "There are answers already – questions and settings can no longer be changed.",
  err_invalid_answer: "The answer doesn't match the poll. Please reload.", err_open_polls: "You already have two running quick polls.",
  err_polls: "Too many polls in the team – please delete old ones.",
};
