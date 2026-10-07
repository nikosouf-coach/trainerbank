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
  rpe_coachQ: "How hard was the session for the player? (1 = very easy, 10 = maximal) – for players who don't use the app.",
  abs_order: "The end date is before the start date.",
};
