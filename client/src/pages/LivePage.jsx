import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';

const STAGE_LABELS = {
  QUALIFICATION: 'Qualification',
  LCQ: 'LCQ',
  QUARTERFINAL: 'Quarter-finals',
  SEMIFINAL: 'Semi-finals',
  FINAL: 'Final',
};

export default function LivePage() {
  const { id: competitionId } = useParams();
  const { socket, connected } = useSocket();

  const [competition, setCompetition] = useState(null);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [selectedHeatId, setSelectedHeatId] = useState(null);

  // ── Fetch data (public endpoint, no auth) ─────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitions/${competitionId}/live-data`);
      if (!res.ok) throw new Error('Failed to load competition');
      const data = await res.json();
      setCompetition(data.competition);
      setDivisions(data.divisions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Socket room ───────────────────────────────────────────────────────
  useEffect(() => {
    if (socket && connected) {
      socket.emit('join:competition', competitionId);
      return () => socket.emit('leave:competition', competitionId);
    }
  }, [socket, connected, competitionId]);

  // ── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => fetchData();

    socket.on('score:computed', handleRefresh);
    socket.on('score:submitted', handleRefresh);
    socket.on('heat:approved', handleRefresh);
    socket.on('heat:closed', handleRefresh);
    socket.on('heat:opened', handleRefresh);
    socket.on('heat:status_changed', handleRefresh);
    socket.on('leaderboard:updated', handleRefresh);

    return () => {
      socket.off('score:computed', handleRefresh);
      socket.off('score:submitted', handleRefresh);
      socket.off('heat:approved', handleRefresh);
      socket.off('heat:closed', handleRefresh);
      socket.off('heat:opened', handleRefresh);
      socket.off('heat:status_changed', handleRefresh);
      socket.off('leaderboard:updated', handleRefresh);
    };
  }, [socket, fetchData]);

  // ── Navigate to live heat (callable) ────────────────────────────────
  const navigateToLiveHeat = useCallback(() => {
    for (const div of divisions) {
      for (const stage of div.stages) {
        const openHeat = stage.heats.find(h => h.status === 'OPEN');
        if (openHeat) {
          setSelectedDivision(div.id);
          setSelectedStageId(stage.id);
          setSelectedHeatId(openHeat.id);
          return true;
        }
      }
    }
    return false;
  }, [divisions]);

  // Auto-navigate on initial load only (once)
  const hasInitialized = useRef(false);
  const skipAutoSelect = useRef(false);
  useEffect(() => {
    if (divisions.length === 0 || hasInitialized.current) return;
    hasInitialized.current = true;
    if (navigateToLiveHeat()) {
      // We set division/stage/heat — skip the auto-select effects this cycle
      skipAutoSelect.current = true;
    } else {
      if (!selectedDivision) setSelectedDivision(divisions[0].id);
    }
  }, [divisions]);

  // ── Derived state ─────────────────────────────────────────────────────
  const currentDiv = divisions.find(d => d.id === selectedDivision);
  const divStages = currentDiv?.stages || [];

  // Auto-select stage when division changes (skip if navigateToLiveHeat just ran)
  useEffect(() => {
    if (skipAutoSelect.current) { skipAutoSelect.current = false; return; }
    if (divStages.length === 0) return;
    const activeStage = divStages.find(s => s.status === 'ACTIVE');
    const stageWithHeats = [...divStages].reverse().find(s => s.heats.length > 0);
    const target = activeStage || stageWithHeats || divStages[0];
    setSelectedStageId(target.id);
    setSelectedHeatId(null);
  }, [selectedDivision, divStages.length]);

  const currentStage = divStages.find(s => s.id === selectedStageId);
  const stageHeats = currentStage?.heats || [];

  // Auto-select heat within stage
  useEffect(() => {
    if (stageHeats.length === 0) { setSelectedHeatId(null); return; }
    if (selectedHeatId && stageHeats.find(h => h.id === selectedHeatId)) return;
    const openHeat = stageHeats.find(h => h.status === 'OPEN');
    setSelectedHeatId(openHeat ? openHeat.id : stageHeats[0].id);
  }, [stageHeats.length, selectedStageId]);

  const currentHeat = stageHeats.find(h => h.id === selectedHeatId);

  // ── Render ────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>;
  if (!competition) return null;

  return (
    <div>
      {/* Banner */}
      <div className="mb-4 rounded-lg bg-blue-600 px-6 py-4 text-white shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{competition.name}</h1>
            <p className="text-blue-100">
              {new Date(competition.date).toLocaleDateString('lt-LT')} &middot; {competition.location}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {competition.status === 'ACTIVE' && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-sm font-medium">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                LIVE
              </span>
            )}
            <Link to={`/competitions/${competitionId}`} className="text-sm text-blue-200 hover:text-white">
              Info &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Video embed (only if URL set) */}
      {competition.video_url && (
        <div className="relative mb-4 overflow-hidden rounded-lg" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={competition.video_url}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Now Scoring banner */}
      {(() => {
        const allHeatsFlat = divisions.flatMap(d =>
          d.stages.flatMap(s => s.heats.map(h => ({ ...h, divId: d.id, divName: d.name, stageType: s.stage_type, stageId: s.id })))
        );
        const liveHeat = allHeatsFlat.find(h => h.status === 'OPEN');
        if (!liveHeat) return null;
        const isViewing = selectedHeatId === liveHeat.id;
        return (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
              <span className="text-sm font-semibold text-green-800">
                NOW SCORING: {liveHeat.divName} — {STAGE_LABELS[liveHeat.stageType] || liveHeat.stageType} Heat {liveHeat.heat_number}
              </span>
            </div>
            {!isViewing && (
              <button
                onClick={() => {
                  skipAutoSelect.current = true;
                  setSelectedDivision(liveHeat.divId);
                  setSelectedStageId(liveHeat.stageId);
                  setSelectedHeatId(liveHeat.id);
                }}
                className="rounded bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700"
              >
                Watch Now
              </button>
            )}
          </div>
        );
      })()}

      {/* Division selector */}
      {divisions.length > 1 && (
        <div className="mb-4 flex gap-2">
          {divisions.map(div => (
            <button
              key={div.id}
              onClick={() => setSelectedDivision(div.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                selectedDivision === div.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {div.name}
            </button>
          ))}
        </div>
      )}

      {/* Stage tabs */}
      {divStages.length > 0 && (
        <div className="mb-3 flex gap-2">
          {divStages.filter(s => s.heats.length > 0).map(stage => (
            <button
              key={stage.id}
              onClick={() => { setSelectedStageId(stage.id); setSelectedHeatId(null); }}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                selectedStageId === stage.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {STAGE_LABELS[stage.stage_type] || stage.stage_type}
            </button>
          ))}
        </div>
      )}

      {/* Heat tabs */}
      {stageHeats.length > 1 && (
        <div className="mb-3 flex gap-2">
          {stageHeats.map(heat => (
            <button
              key={heat.id}
              onClick={() => setSelectedHeatId(heat.id)}
              className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm font-medium transition ${
                selectedHeatId === heat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  heat.status === 'OPEN' ? 'animate-pulse bg-green-400' :
                  heat.status === 'APPROVED' || heat.status === 'CLOSED' ? 'bg-blue-400' :
                  heat.status === 'HEAD_REVIEW' ? 'bg-orange-400' :
                  'bg-gray-400'
                }`}
              />
              Heat {heat.heat_number}
            </button>
          ))}
        </div>
      )}

      {/* Content: Scorecard + Leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Scorecard */}
        <div className="lg:col-span-2">
          {currentHeat ? (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="border-b bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                {STAGE_LABELS[currentStage?.stage_type]} - Heat {currentHeat.heat_number}
                <span className="ml-2 text-gray-400">({currentHeat.status})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-gray-500">
                      <th className="px-4 py-2 text-center">Order</th>
                      <th className="px-4 py-2">Athlete</th>
                      <th className="px-4 py-2 text-right">Run 1</th>
                      {(currentStage?.runs_per_athlete || 2) > 1 && (
                        <th className="px-4 py-2 text-right">Run 2</th>
                      )}
                      <th className="px-4 py-2 text-right">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...currentHeat.athletes].sort((a, b) => a.run_order - b.run_order).map(athlete => {
                      const run1 = athlete.runs.find(r => r.run_number === 1);
                      const run2 = athlete.runs.find(r => r.run_number === 2);
                      const s1 = run1?.computed_score;
                      const s2 = run2?.computed_score;
                      const best = (s1 != null || s2 != null) ? Math.max(s1 ?? 0, s2 ?? 0) : null;
                      const isFRS = (s1 ?? 0) >= (s2 ?? 0);
                      const hasAnyScore = s1 != null || s2 != null;

                      return (
                        <tr
                          key={athlete.athlete_id}
                          className={`border-b ${!hasAnyScore ? 'opacity-40' : ''}`}
                        >
                          <td className="px-4 py-2 text-center font-medium">
                            {athlete.run_order}
                          </td>
                          <td className="px-4 py-2 font-medium">{athlete.name}</td>
                          <td className="px-4 py-2 text-right">
                            {s1 != null ? s1.toFixed(2) : '--'}
                          </td>
                          {(currentStage?.runs_per_athlete || 2) > 1 && (
                            <td className="px-4 py-2 text-right">
                              {s2 != null ? s2.toFixed(2) : '--'}
                            </td>
                          )}
                          <td className="px-4 py-2 text-right font-bold">
                            {best != null ? (
                              <>
                                {best.toFixed(2)}
                                {s1 != null && (
                                  <span className="ml-1 text-xs font-normal text-gray-400">
                                    {isFRS ? 'FRS' : 'SRS'}
                                  </span>
                                )}
                              </>
                            ) : '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
              No published heats for this stage yet.
            </div>
          )}
        </div>

        {/* Stage Leaderboard */}
        <div>
          {/* Heat Leaderboard — live ranking based on scores */}
          <div className="mb-4 rounded-lg border bg-white shadow-sm">
            <div className="border-b bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
              Heat Ranking
            </div>
            {currentHeat && currentHeat.athletes.some(a => a.runs.some(r => r.computed_score != null)) ? (
              <div className="p-2">
                {(() => {
                  const ranked = currentHeat.athletes
                    .map(a => {
                      const hr = a.heat_result;
                      const s1 = a.runs.find(r => r.run_number === 1)?.computed_score;
                      const s2 = a.runs.find(r => r.run_number === 2)?.computed_score;
                      const best = hr ? hr.best_score : Math.max(s1 ?? 0, s2 ?? 0);
                      const hasScore = s1 != null || s2 != null;
                      const finalRank = hr?.final_rank;
                      return { ...a, best, hasScore, finalRank };
                    })
                    .filter(a => a.hasScore)
                    .sort((a, b) => {
                      if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank;
                      return b.best - a.best;
                    });

                  return ranked.map((r, i) => (
                    <div
                      key={r.athlete_id}
                      className="flex items-center justify-between rounded px-3 py-1.5 text-sm odd:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          (r.finalRank || i + 1) === 1 ? 'bg-yellow-100 text-yellow-800' :
                          (r.finalRank || i + 1) === 2 ? 'bg-gray-200 text-gray-700' :
                          (r.finalRank || i + 1) === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {r.finalRank || i + 1}
                        </span>
                        <span>{r.name}</span>
                      </div>
                      <span className="font-medium">{r.best.toFixed(2)}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-gray-400">
                No scores yet
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
