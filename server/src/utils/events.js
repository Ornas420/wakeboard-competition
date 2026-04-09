/**
 * Socket.IO event name constants.
 * Used in scoringEngine.js and route handlers to avoid string duplication.
 */
export const EVENTS = {
  SCORE_COMPUTED: 'score:computed',
  SCORE_SUBMITTED: 'score:submitted',
  HEAT_APPROVED: 'heat:approved',
  HEAT_CLOSED: 'heat:closed',
  HEAT_OPENED: 'heat:opened',
  HEAT_STATUS_CHANGED: 'heat:status_changed',
  LEADERBOARD_UPDATED: 'leaderboard:updated',
  CORRECTION_REQUESTED: 'correction:requested',
};
