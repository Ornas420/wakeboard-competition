// Sprint 4: Score aggregation + ranking logic
// - Upsert judge_score (unique on athlete_run_id + judge_id)
// - Increment scores_submitted on INSERT, not UPDATE
// - When scores_submitted == judge_count: SET computed_score = ROUND(AVG(score), 2) in SQL
// - Emit score:computed via Socket.IO
// - best_score = MAX(run1, run2), second_score = the other run
// - Ranking: ORDER BY best_score DESC, second_score DESC
