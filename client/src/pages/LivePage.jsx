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

  // ── Fetch data ────────────────────────────────────────────────────────
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

  // ── Socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socket && connected) {
      socket.emit('join:competition', competitionId);
      return () => socket.emit('leave:competition', competitionId);
    }
  }, [socket, connected, competitionId]);

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

  // ── Navigate to live heat ─────────────────────────────────────────────
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

  const hasInitialized = useRef(false);
  const skipAutoSelect = useRef(false);
  useEffect(() => {
    if (divisions.length === 0 || hasInitialized.current) return;
    hasInitialized.current = true;
    if (navigateToLiveHeat()) {
      skipAutoSelect.current = true;
    } else {
      if (!selectedDivision) setSelectedDivision(divisions[0].id);
    }
  }, [divisions]);

  // ── Derived state ─────────────────────────────────────────────────────
  const currentDiv = divisions.find(d => d.id === selectedDivision);
  const divStages = currentDiv?.stages || [];

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

  useEffect(() => {
    if (stageHeats.length === 0) { setSelectedHeatId(null); return; }
    if (selectedHeatId && stageHeats.find(h => h.id === selectedHeatId)) return;
    const openHeat = stageHeats.find(h => h.status === 'OPEN');
    setSelectedHeatId(openHeat ? openHeat.id : stageHeats[0].id);
  }, [stageHeats.length, selectedStageId]);

  const currentHeat = stageHeats.find(h => h.id === selectedHeatId);

  // ── Heat ranking computation ──────────────────────────────────────────
  const heatRanking = currentHeat?.athletes
    ?.map(a => {
      const s1 = a.runs.find(r => r.run_number === 1)?.computed_score;
      const s2 = a.runs.find(r => r.run_number === 2)?.computed_score;
      const hr = a.heat_result;
      const best = hr ? hr.best_score : (s1 != null || s2 != null ? Math.max(s1 ?? 0, s2 ?? 0) : null);
      return { ...a, best, finalRank: hr?.final_rank, hasScore: s1 != null || s2 != null };
    })
    .filter(a => a.hasScore)
    .sort((a, b) => {
      if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank;
      return (b.best ?? 0) - (a.best ?? 0);
    }) || [];

  // ── Live heat info ────────────────────────────────────────────────────
  const allHeatsFlat = divisions.flatMap(d =>
    d.stages.flatMap(s => s.heats.map(h => ({ ...h, divId: d.id, divName: d.name, stageType: s.stage_type, stageId: s.id })))
  );
  const liveHeat = allHeatsFlat.find(h => h.status === 'OPEN');

  // ═══════════════ RENDER ═══════════════════════════════════════════════
  if (loading) return <LoadingSpinner />;
  if (error) return <div className="container mx-auto px-4 py-6 text-red-600">{error}</div>;
  if (!competition) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ HEADER ═══ */}
      <div className="-mt-16 bg-navy-900 pt-20 pb-6">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <Link to={`/competitions/${competitionId}`} className="mb-1 inline-block text-xs text-white/40 hover:text-white/60">
                ← Back to competition
              </Link>
              <h1 className="text-2xl font-bold text-white md:text-3xl">{competition.name}</h1>
              <p className="mt-1 text-sm text-white/50">
                {(() => {
                  const s = new Date(competition.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  if (!competition.end_date || competition.start_date === competition.end_date) return s;
                  const sd = new Date(competition.start_date), ed = new Date(competition.end_date);
                  if (sd.getMonth() === ed.getMonth()) return `${sd.toLocaleDateString('en-US', { month: 'long' })} ${sd.getDate()}–${ed.getDate()}, ${sd.getFullYear()}`;
                  return `${s} – ${new Date(competition.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                })()}
                {competition.location && ` · ${competition.location}`}
              </p>
            </div>
            {competition.status === 'ACTIVE' && (
              <span className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-1.5 text-sm font-semibold text-red-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                LIVE
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* ═══ NOW SCORING BANNER ═══ */}
        {liveHeat && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 animate-pulse rounded-full bg-green-500" />
              <span className="text-sm font-semibold text-green-800">
                NOW SCORING: {liveHeat.divName} — {STAGE_LABELS[liveHeat.stageType] || liveHeat.stageType} Heat {liveHeat.heat_number}
              </span>
            </div>
            {selectedHeatId !== liveHeat.id && (
              <button onClick={() => {
                skipAutoSelect.current = true;
                setSelectedDivision(liveHeat.divId);
                setSelectedStageId(liveHeat.stageId);
                setSelectedHeatId(liveHeat.id);
              }} className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                Watch Now
              </button>
            )}
          </div>
        )}

        {/* ═══ NAVIGATION TABS ═══ */}
        <div className="mb-6 space-y-3">
          {/* Division tabs */}
          {divisions.length > 1 && (
            <div className="flex gap-2">
              {divisions.map(div => (
                <button key={div.id} onClick={() => setSelectedDivision(div.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    selectedDivision === div.id
                      ? 'bg-navy-900 text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}>
                  {div.name}
                </button>
              ))}
            </div>
          )}

          {/* Stage + Heat tabs in one row */}
          <div className="flex flex-wrap items-center gap-2">
            {divStages.filter(s => s.heats.length > 0).map(stage => (
              <button key={stage.id}
                onClick={() => { setSelectedStageId(stage.id); setSelectedHeatId(null); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  selectedStageId === stage.id
                    ? 'bg-accent text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                }`}>
                {STAGE_LABELS[stage.stage_type] || stage.stage_type}
              </button>
            ))}

            {stageHeats.length > 1 && (
              <>
                <span className="mx-1 text-gray-300">|</span>
                {stageHeats.map(heat => (
                  <button key={heat.id} onClick={() => setSelectedHeatId(heat.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedHeatId === heat.id
                        ? 'bg-navy-900 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                    }`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      heat.status === 'OPEN' ? 'animate-pulse bg-green-400' :
                      heat.status === 'APPROVED' || heat.status === 'CLOSED' ? 'bg-blue-400' :
                      heat.status === 'HEAD_REVIEW' ? 'bg-orange-400' : 'bg-gray-300'
                    }`} />
                    Heat {heat.heat_number}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ═══ CONTENT: Scorecard + Heat Ranking ═══ */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main — Scorecard Table */}
          <div className="lg:col-span-2">
            {currentHeat ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-3">
                  <div>
                    <h2 className="text-lg font-bold text-navy-900">
                      {STAGE_LABELS[currentStage?.stage_type]} — Heat {currentHeat.heat_number}
                    </h2>
                    <p className="text-xs text-gray-400">{currentDiv?.name}</p>
                  </div>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                    currentHeat.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                    currentHeat.status === 'APPROVED' || currentHeat.status === 'CLOSED' ? 'bg-blue-100 text-blue-700' :
                    currentHeat.status === 'HEAD_REVIEW' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {currentHeat.status === 'OPEN' ? 'LIVE' : currentHeat.status}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50/50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                        <th className="px-5 py-3 text-center w-16">Order</th>
                        <th className="px-5 py-3">Athlete</th>
                        <th className="px-5 py-3 text-right">Run 1</th>
                        {(currentStage?.runs_per_athlete || 2) > 1 && (
                          <th className="px-5 py-3 text-right">Run 2</th>
                        )}
                        <th className="px-5 py-3 text-right">Best Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...currentHeat.athletes].sort((a, b) => a.run_order - b.run_order).map((athlete, idx) => {
                        const run1 = athlete.runs.find(r => r.run_number === 1);
                        const run2 = athlete.runs.find(r => r.run_number === 2);
                        const s1 = run1?.computed_score;
                        const s2 = run2?.computed_score;
                        const best = (s1 != null || s2 != null) ? Math.max(s1 ?? 0, s2 ?? 0) : null;
                        const isFRS = (s1 ?? 0) >= (s2 ?? 0);
                        const hasAnyScore = s1 != null || s2 != null;

                        return (
                          <tr key={athlete.athlete_id}
                            className={`border-b last:border-0 transition ${!hasAnyScore ? 'opacity-40' : 'hover:bg-gray-50'}`}>
                            <td className="px-5 py-3.5 text-center">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                                {athlete.run_order}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-700">
                                  {athlete.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <span className="font-medium text-navy-900">{athlete.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-medium text-gray-700">
                              {s1 != null ? s1.toFixed(2) : <span className="text-gray-300">--</span>}
                            </td>
                            {(currentStage?.runs_per_athlete || 2) > 1 && (
                              <td className="px-5 py-3.5 text-right font-medium text-gray-700">
                                {s2 != null ? s2.toFixed(2) : <span className="text-gray-300">--</span>}
                              </td>
                            )}
                            <td className="px-5 py-3.5 text-right">
                              {best != null ? (
                                <span className="text-lg font-bold text-accent">
                                  {best.toFixed(2)}
                                  <span className="ml-1 text-xs font-normal text-gray-400">
                                    {isFRS ? 'FRS' : 'SRS'}
                                  </span>
                                </span>
                              ) : <span className="text-gray-300">--</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
                No published heats for this stage yet.
              </div>
            )}

            {/* Video below scorecard */}
            {competition.video_url && (
              <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={competition.video_url}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Heat Ranking */}
          <div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h3 className="text-sm font-bold text-navy-900">Heat Ranking</h3>
                {currentHeat?.status === 'OPEN' && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Real-time</span>
                )}
              </div>

              {heatRanking.length > 0 ? (
                <div className="p-3">
                  {heatRanking.map((r, i) => {
                    const rank = r.finalRank || i + 1;
                    return (
                      <div key={r.athlete_id}
                        className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${i === 0 ? 'bg-accent/5' : i % 2 === 0 ? 'bg-gray-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                            rank === 2 ? 'bg-gray-200 text-gray-700' :
                            rank === 3 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {rank}
                          </span>
                          <span className="text-sm font-medium text-navy-900">{r.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${rank === 1 ? 'text-accent' : 'text-navy-900'}`}>
                          {r.best?.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400">
                  No scores yet
                </div>
              )}
            </div>

            {/* Competition Schedule */}
            {(() => {
              const schedule = allHeatsFlat
                .filter(h => h.schedule_order != null)
                .sort((a, b) => a.schedule_order - b.schedule_order);
              if (schedule.length === 0) return null;
              return (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b px-5 py-3">
                    <h3 className="text-sm font-bold text-navy-900">Competition Schedule</h3>
                  </div>
                  <div className="p-3">
                    {schedule.map((h, i) => {
                      const isActive = h.status === 'OPEN';
                      const isDone = h.status === 'CLOSED' || h.status === 'APPROVED';
                      const isCurrent = h.id === selectedHeatId;
                      return (
                        <button
                          key={h.id}
                          onClick={() => {
                            skipAutoSelect.current = true;
                            const div = divisions.find(d => d.id === h.divId);
                            const stage = div?.stages.find(s => s.id === h.stageId);
                            if (div && stage) {
                              setSelectedDivision(div.id);
                              setSelectedStageId(stage.id);
                              setSelectedHeatId(h.id);
                            }
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${
                            isCurrent ? 'bg-accent/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isActive ? 'bg-green-500 text-white' :
                            isDone ? 'bg-gray-300 text-white' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {isDone ? '✓' : h.schedule_order}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className={`font-medium ${isDone ? 'text-gray-400 line-through' : isActive ? 'text-green-700' : 'text-navy-900'}`}>
                              {h.divName}
                            </span>
                            <span className={`ml-1 ${isDone ? 'text-gray-300' : 'text-gray-400'}`}>
                              {STAGE_LABELS[h.stageType] || h.stageType} H{h.heat_number}
                            </span>
                          </div>
                          {isActive && (
                            <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-green-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
