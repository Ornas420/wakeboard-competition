import db from '../db/schema.js';

/**
 * Calculate total score from individual criteria.
 * Weighted average: execution 30%, difficulty 30%, intensity 20%, composition 20%.
 */
export function calculateTotal({ execution, difficulty, intensity, composition }) {
  return Math.round((execution * 0.3 + difficulty * 0.3 + intensity * 0.2 + composition * 0.2) * 100) / 100;
}

/**
 * Get leaderboard for a competition category.
 * Averages each athlete's total scores across all judges and heats.
 */
export function getLeaderboard(competitionId, categoryId) {
  const rows = db.prepare(`
    SELECT
      u.id as user_id,
      u.name as athlete_name,
      ROUND(AVG(s.total), 2) as avg_score,
      COUNT(s.id) as score_count
    FROM scores s
    JOIN heats h ON s.heat_id = h.id
    JOIN users u ON s.user_id = u.id
    WHERE h.competition_id = ? AND h.category_id = ?
    GROUP BY s.user_id
    ORDER BY avg_score DESC
  `).all(competitionId, categoryId);

  return rows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));
}
