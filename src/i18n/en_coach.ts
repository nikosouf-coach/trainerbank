// Zusätzliche Texte (Trainer: Heute, Kalender, Planung, Einheit) – en
import type { Dict } from "./types";

export const en_coach: Dict = {
  // Matches, ratings, videos
  gm_rateT: "Rating & feedback", gm_rating: "Rating (1–10)", gm_feedback: "Feedback to the player", gm_feedbackPh: "What went well, what should he work on?",
  gm_visible: "Visible to the player", gm_visibleD: "Shows in his app if ratings are enabled in the modules.",
  vd_none: "No videos yet.", vd_add: "Add video", vd_edit: "Edit video", vd_title: "Title", vd_titlePh: "e.g. highlights vs SC Bergtal",
  vd_url: "Video link", vd_urlHint: "YouTube (unlisted), Veo, Hudl, Vimeo, Google Drive, Dropbox …", vd_urlBad: "Please enter a complete link starting with https://.",
  vd_all: "For all players", vd_note: "Note", vd_visD: "Players see the video in their app if videos are enabled in the modules.",
  vd_privacy: "Only the link is stored, not the video. Use non-public links and get parental consent for minors.",
  sp_title: "Match report", sp_result: "Result", sp_own: "Us", sp_opp: "Opponent", sp_min: "min", sp_goals: "Goals", sp_assists: "Assists", sp_start: "Starting XI",
  sp_rate: "Rating", sp_none: "Tap a player to enter minutes, goals, assists and rating.", sp_fill: "Take minutes from RPE", sp_filled: "{n} players filled",
  sp_videos: "Match videos", sp_open: "Match report", sp_season: "Season", sp_games: "Games", sp_avg: "Avg rating", sp_list: "Matches & stats", sp_listSub: "Results, scorers, ratings",
  sp_table: "Player stats", sp_results: "Results", sp_noGames: "No matches played yet.", sp_lib: "Videos", sp_libSub: "All video links of the team",
  sp_player: "Match data", sp_played: "played", sp_bench: "did not play", sp_resultSave: "Save result",
  pr_games: "Matches & ratings", pr_ratings: "Ratings & feedback", pr_noRatings: "No ratings yet.", tr_rate: "Rating",
  // Drawing tool, drill library, sessions, coach profiles
  bd_full: "Full pitch", bd_half: "Half pitch", bd_box: "Box", bd_free: "Free area", bd_t_a: "Player team A", bd_t_b: "Player team B", bd_t_gk: "Goalkeeper",
  bd_t_cone: "Cone", bd_t_ball: "Ball", bd_t_goal: "Mini goal", bd_t_pass: "Pass – drag", bd_t_run: "Run – drag", bd_t_drib: "Dribble – drag", bd_t_zone: "Zone – drag",
  bd_t_move: "Move – drag", bd_t_del: "Delete – tap", bd_undo: "Undo", bd_clear: "Clear", bd_draw: "Drawing", bd_add: "Add drawing",
  ar_title: "Drill library", ar_sub: "Drills, sessions, coach profiles", ar_ex: "Drills", ar_tpl: "Sessions", ar_staff: "Coaches", ar_new: "Drill", ar_search: "Search drill or topic", ar_all: "All",
  ar_none: "No drills found.", ar_newTpl: "Session", ar_noTpl: "No saved sessions yet.",
  cat_warmup: "Warm-up", cat_technik: "Technique", cat_pass: "Passing", cat_abschluss: "Finishing", cat_spielform: "Small-sided game", cat_taktik: "Tactics", cat_athletik: "Athletics", cat_torwart: "Goalkeeper", cat_cooldown: "Cool-down",
  ex_title: "Title", ex_cat: "Category", ex_themes: "Topics", ex_themesPh: "Enter topic", ex_dur: "Duration (min)", ex_players: "Players", ex_area: "Area", ex_rpe: "Intensity (RPE)",
  ex_desc: "Procedure & organisation", ex_points: "Coaching points", ex_pointPh: "New coaching point", ex_who: "Responsible", ex_nobody: "all", ex_video: "Video link (optional)", ex_saved: "Drill saved",
  ex_del: "Delete drill", ex_new: "New drill", ex_aiPoints: "AI: suggest coaching points", ex_edit: "Edit drill", ex_need: "Please enter a title.",
  tp_rpeWarn: "Note: this template is more intense (≈ RPE {t}) than planned for this day (RPE {p}). Adjust volume or intensity.", tp_title: "Session name", tp_theme: "Topic", tp_blocks: "Structure", tp_addEx: "Drill from library", tp_addText: "Free block", tp_text: "Content", tp_total: "Total: {m} min", tp_notes: "Notes",
  tp_saved: "Session saved", tp_del: "Delete session", tp_use: "Use in planning", tp_useD: "Choose the training day – content and duration will be replaced.", tp_used: "Applied to {d}",
  tp_pick: "Choose drill", tp_fromArchive: "From library", tp_saveAs: "Save as session", tp_edit: "Edit session", tp_new: "New session", tp_noDays: "There is no training day in the next two weeks.",
  sf_title: "Coach profiles", sf_sub: "Responsibilities and coaching points", sf_new: "Profile", sf_name: "Name", sf_role: "Role", sf_areas: "Responsibilities", sf_areasPh: "e.g. set pieces, goalkeepers, athletics",
  sf_points: "Coaching points in drills", sf_noPoints: "No coaching points assigned yet.", sf_phone: "Phone", sf_email: "E-mail", sf_note: "Note", sf_del: "Delete profile", sf_saved: "Profile saved", sf_none: "No coach profiles yet.",
  sr_chef: "Head coach", sr_co: "Assistant coach", sr_tw: "Goalkeeper coach", sr_athletik: "Athletic coach", sr_physio: "Physio", sr_betreuer: "Team manager", sr_analyst: "Analyst",
  rpe_coachQ: "How hard was the session for the player? (1 = very easy, 10 = maximal) – for players who don't use the app.",
  abs_order: "The end date is before the start date.",
};
