import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const STAGE_LABELS = {
  QUALIFICATION: 'Qualification',
  LCQ: 'LCQ',
  QUARTERFINAL: 'Quarter-finals',
  SEMIFINAL: 'Semi-finals',
  FINAL: 'Final',
};

// ── Shared Scoring Interface ─────────────────────────────────────────────
function ScoringInterface({ currentAthlete, currentAthleteIdx, athletes, currentRun, currentMyScore,
  scoreInput, setScoreInput, isValidScore, submitting, submitStatus, submitError, handleSubmit,
  getMyScore, setCurrentAthleteIdx, setSubmitStatus, inputRef, heatLabel, userName, divisionName, runsPerAthlete, setCurrentRun }) {
  return (
    <div className="mx-auto max-w-md">
      {/* Header */}
      <div className="mb-4 rounded-lg bg-blue-600 px-4 py-3 text-white">
        <div className="flex items-center justify-between text-sm">
          <span>{heatLabel}</span>
          <span className="rounded bg-blue-500 px-2 py-0.5 text-xs">{userName}</span>
        </div>
        <div className="text-xs text-blue-200">{divisionName} | Run {currentRun}</div>
      </div>

      {/* Progress */}
      <div className="mb-1 text-xs text-gray-500">Athlete {currentAthleteIdx + 1} of {athletes.length}</div>
      <div className="mb-4 h-1.5 rounded-full bg-gray-200">
        <div className="h-1.5 rounded-full bg-blue-500 transition-all"
             style={{ width: `${((currentAthleteIdx + 1) / athletes.length) * 100}%` }} />
      </div>

      {/* Athlete */}
      <div className="mb-4 text-center">
        <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
          {currentAthlete.name.split(' ').map(n => n[0]).join('')}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{currentAthlete.name}</h2>
        <p className="text-sm text-gray-500">Run {currentRun}</p>
      </div>

      {/* Score input */}
      <form onSubmit={handleSubmit} className="mb-4">
        <input
          ref={inputRef} type="number" min="0" max="100" step="0.5" inputMode="decimal"
          value={scoreInput} onChange={e => setScoreInput(e.target.value)} placeholder="0 - 100"
          className={`mb-3 w-full rounded-lg border-2 px-4 py-4 text-center text-2xl font-bold outline-none transition ${
            submitStatus === 'success' ? 'border-green-500 bg-green-50' :
            submitStatus === 'error' ? 'border-red-500 bg-red-50' :
            'border-gray-300 focus:border-blue-500'
          }`}
          style={{ fontSize: '24px' }} disabled={submitting}
        />
        {submitStatus === 'error' && <p className="mb-2 text-center text-sm text-red-600">{submitError}</p>}
        <button type="submit" disabled={!isValidScore || submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          style={{ minHeight: '48px' }}>
          {submitting ? 'Saving...' : currentMyScore !== null ? 'Update Score' : 'Submit Score'}
        </button>
      </form>

      {/* Nav dots */}
      <div className="mb-4 flex justify-center gap-2">
        {athletes.map((a, i) => {
          const scored = getMyScore(a.athlete_id, currentRun) !== null;
          return (
            <button key={a.athlete_id}
              onClick={() => { setCurrentAthleteIdx(i); setSubmitStatus(null); }}
              className={`h-3 w-3 rounded-full transition ${
                i === currentAthleteIdx ? 'scale-125 bg-blue-800' : scored ? 'bg-green-500' : 'bg-gray-300'
              }`} title={a.name} />
          );
        })}
      </div>

      {/* Run tabs */}
      {runsPerAthlete > 1 && (
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2].slice(0, runsPerAthlete).map(run => (
            <button key={run} onClick={() => setCurrentRun(run)}
              className={`rounded px-4 py-1 text-sm font-medium ${
                currentRun === run ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
              Run {run}
            </button>
          ))}
        </div>
      )}

      {/* Submitted list */}
      <div className="rounded border bg-gray-50 p-3">
        <h3 className="mb-2 text-xs font-semibold text-gray-500">Your Scores (Run {currentRun})</h3>
        {athletes.map((a, i) => {
          const myScore = getMyScore(a.athlete_id, currentRun);
          return (
            <div key={a.athlete_id} className={`flex items-center justify-between py-1 text-sm ${i === currentAthleteIdx ? 'font-bold' : ''}`}>
              <span className="text-gray-700">{a.name}</span>
              <span className={myScore !== null ? 'text-green-600' : 'text-gray-300'}>{myScore !== null ? myScore : '--'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Review Table (Head Judge, during HEAD_REVIEW) ──────────────────
function ScoreReviewTable({ athletes, athleteRuns, onFlag }) {
  // Get unique judge names from first run that has scores
  const firstWithScores = athleteRuns.find(r => r.scores && r.scores.length > 0);
  const judges = (firstWithScores?.scores || []).map(s => ({ id: s.judge_id, name: s.judge_name || 'Judge' }));

  return (
    <div className="mb-4 overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2 text-gray-600">Athlete</th>
            <th className="px-2 py-2 text-center text-gray-600">Run</th>
            {judges.map(j => (
              <th key={j.id} className="px-2 py-2 text-center text-gray-600">{j.name}</th>
            ))}
            <th className="px-2 py-2 text-center font-bold text-gray-700">Avg</th>
          </tr>
        </thead>
        <tbody>
          {athletes.flatMap(a =>
            athleteRuns
              .filter(r => r.athlete_id === a.athlete_id)
              .sort((x, y) => x.run_number - y.run_number)
              .map(run => (
                <tr key={run.athlete_run_id} className="border-b">
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {run.run_number === 1 ? a.name : ''}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-400">R{run.run_number}</td>
                  {judges.map(j => {
                    const s = (run.scores || []).find(sc => sc.judge_id === j.id);
                    if (!s) return <td key={j.id} className="px-2 py-2 text-center text-gray-300">--</td>;
                    return (
                      <td key={j.id} className="px-2 py-2 text-center">
                        <div className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                          s.correction_requested ? 'bg-orange-100 text-orange-700' : ''
                        }`}>
                          <span className="font-medium">{s.score?.toFixed(1)}</span>
                          {onFlag && (
                            <button
                              onClick={() => onFlag(s.judge_score_id, s.score, j.name, j.id, run.athlete_run_id, run.run_number, a.name)}
                              className={`ml-1 rounded px-1 py-0.5 text-xs ${
                                s.correction_requested
                                  ? 'bg-orange-300 text-orange-900'
                                  : 'text-gray-400 hover:bg-red-100 hover:text-red-600'
                              }`}
                            >
                              {s.correction_requested ? '⚠' : 'Flag'}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center font-bold text-gray-900">
                    {run.computed_score?.toFixed(2) ?? '--'}
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function JudgeScoringPage() {
  const { id: competitionId } = useParams();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const isHeadJudge = user?.role === 'HEAD_JUDGE';

  const [competition, setCompetition] = useState(null);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [scoreRefetchKey, setScoreRefetchKey] = useState(0);
  const [athleteRuns, setAthleteRuns] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [currentAthleteIdx, setCurrentAthleteIdx] = useState(0);
  const [currentRun, setCurrentRun] = useState(1);
  const [scoreInput, setScoreInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [correctionModal, setCorrectionModal] = useState(null);
  const [correctionInput, setCorrectionInput] = useState(''); // separate from scoreInput
  const [hjSelfCorrection, setHjSelfCorrection] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [rankingOrder, setRankingOrder] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);

  const [divisions, setDivisions] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedHeatId, setSelectedHeatId] = useState(null);

  const inputRef = useRef(null);
  const athleteRunsRef = useRef(athleteRuns);
  const athletesRef = useRef(athletes);
  athleteRunsRef.current = athleteRuns;
  athletesRef.current = athletes;
  const advanceTimer = useRef(null);

  // ── Fetch data ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [compData, heatData] = await Promise.all([
        api.get(`/competitions/${competitionId}`),
        api.get(`/heats/competition/${competitionId}`),
      ]);
      setCompetition(compData);
      setStages(heatData.stages);
      const divMap = new Map();
      for (const stage of heatData.stages) {
        if (!divMap.has(stage.division_id)) divMap.set(stage.division_id, stage.division_name);
      }
      setDivisions(Array.from(divMap, ([id, name]) => ({ id, name })));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [competitionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Socket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socket && connected) socket.emit('join:competition', competitionId);
  }, [socket, connected, competitionId]);

  useEffect(() => {
    if (!socket) return;

    const handleScoreComputed = (data) => {
      setAthleteRuns(prev => prev.map(run =>
        run.athlete_run_id === data.athlete_run_id
          ? { ...run, computed_score: data.computed_score, scores_submitted: 999 }
          : run
      ));
    };

    const handleCorrectionRequested = (data) => {
      setScoreRefetchKey(k => k + 1);
      // Use refs to read latest state
      const runs = athleteRunsRef.current;
      const aths = athletesRef.current;
      const targetRun = runs.find(r => r.athlete_run_id === data.athlete_run_id);
      const targetAthlete = aths.find(a => a.athlete_id === targetRun?.athlete_id);
      setCorrectionModal({
        athlete_run_id: data.athlete_run_id,
        note: data.note || 'Please correct your score',
        athleteName: targetAthlete?.name || 'Unknown',
        runNumber: targetRun?.run_number || 1,
        currentScore: targetRun?.scores?.find(s => s.judge_id === user.id)?.score,
      });
    };

    const handleRefresh = () => { fetchData(); setScoreRefetchKey(k => k + 1); };
    const handleScoreSubmitted = () => { setScoreRefetchKey(k => k + 1); };

    socket.on('score:computed', handleScoreComputed);
    socket.on('score:submitted', handleScoreSubmitted);
    socket.on('correction:requested', handleCorrectionRequested);
    socket.on('heat:approved', handleRefresh);
    socket.on('heat:closed', handleRefresh);
    socket.on('heat:opened', handleRefresh);
    socket.on('heat:status_changed', handleRefresh);

    return () => {
      socket.off('score:computed', handleScoreComputed);
      socket.off('score:submitted', handleScoreSubmitted);
      socket.off('correction:requested', handleCorrectionRequested);
      socket.off('heat:approved', handleRefresh);
      socket.off('heat:closed', handleRefresh);
      socket.off('heat:opened', handleRefresh);
      socket.off('heat:status_changed', handleRefresh);
    };
  }, [socket, fetchData]);

  // ── Derive heats ──────────────────────────────────────────────────────
  const allHeatsGlobal = stages.flatMap(s =>
    s.heats.map(h => ({ ...h, stage_type: s.stage_type, stage_id: s.id, runs_per_athlete: s.runs_per_athlete, division_id: s.division_id, division_name: s.division_name }))
  );
  const activeHeat = allHeatsGlobal.find(h => h.status === 'OPEN' || h.status === 'HEAD_REVIEW');
  const divisionStages = stages.filter(s => s.division_id === selectedDivision);
  const divisionHeats = divisionStages.flatMap(s =>
    s.heats.map(h => ({ ...h, stage_type: s.stage_type, stage_id: s.id, runs_per_athlete: s.runs_per_athlete }))
  );
  const nextScheduledHeat = allHeatsGlobal
    .filter(h => h.status === 'PENDING' && h.schedule_order != null)
    .sort((a, b) => a.schedule_order - b.schedule_order)[0] || null;

  const currentHeatId = isHeadJudge ? selectedHeatId : activeHeat?.id;
  const currentHeat = allHeatsGlobal.find(h => h.id === currentHeatId);

  // HJ auto-select
  useEffect(() => {
    if (!isHeadJudge || divisions.length === 0 || selectedDivision) return;
    setSelectedDivision(divisions[0].id);
  }, [isHeadJudge, divisions, selectedDivision]);

  useEffect(() => {
    if (!isHeadJudge || divisionHeats.length === 0 || selectedHeatId) return;
    const open = divisionHeats.find(h => h.status === 'OPEN');
    setSelectedHeatId(open ? open.id : divisionHeats[0].id);
  }, [isHeadJudge, divisionHeats.length, selectedHeatId]);

  useEffect(() => { if (isHeadJudge) setSelectedHeatId(null); }, [selectedDivision]);

  // ── Fetch scores ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentHeatId) { setAthleteRuns([]); setAthletes([]); return; }
    api.get(`/scores/heat/${currentHeatId}`)
      .then(data => {
        setAthleteRuns(data);
        const seen = new Map();
        for (const run of data) {
          if (!seen.has(run.athlete_id)) seen.set(run.athlete_id, { athlete_id: run.athlete_id, name: run.name });
        }
        setAthletes(Array.from(seen.values()));
      })
      .catch(() => {});
  }, [currentHeatId, scoreRefetchKey]);

  // Always reset to Athlete 1, Run 1 when heat changes
  useEffect(() => {
    setCurrentAthleteIdx(0);
    setCurrentRun(1);
    setScoreInput('');
    setSubmitStatus(null);
  }, [currentHeatId]);

  // ── Helpers ───────────────────────────────────────────────────────────
  function findNextUnscored(runs, list, startRun, judgeId, maxRuns) {
    for (let run = startRun; run <= maxRuns; run++) {
      for (let i = 0; i < list.length; i++) {
        const ar = runs.find(r => r.athlete_id === list[i].athlete_id && r.run_number === run);
        if (ar && !ar.scores?.find(s => s.judge_id === judgeId)) return { idx: i, run };
      }
    }
    return null;
  }

  function getMyScore(athleteId, runNumber) {
    return athleteRuns.find(r => r.athlete_id === athleteId && r.run_number === runNumber)
      ?.scores?.find(s => s.judge_id === user.id)?.score ?? null;
  }

  function getAthleteRunId(athleteId, runNumber) {
    return athleteRuns.find(r => r.athlete_id === athleteId && r.run_number === runNumber)?.athlete_run_id;
  }

  const currentAthlete = athletes[currentAthleteIdx];
  const currentMyScore = currentAthlete ? getMyScore(currentAthlete.athlete_id, currentRun) : null;

  useEffect(() => {
    setScoreInput(currentMyScore !== null ? String(currentMyScore) : '');
    setSubmitStatus(null);
    setSubmitError('');
    if (inputRef.current) inputRef.current.focus();
  }, [currentAthleteIdx, currentRun, currentMyScore]);

  // ── Submit score ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0 || score > 100) return;
    const runId = getAthleteRunId(currentAthlete.athlete_id, currentRun);
    if (!runId) return;

    setSubmitting(true); setSubmitStatus(null); setSubmitError('');
    try {
      await api.post('/scores', { athlete_run_id: runId, score });
      setSubmitStatus('success');
      setCorrectionModal(null);
      // Don't update local state — the score:submitted socket event will trigger a refetch

      advanceTimer.current = setTimeout(() => {
        setScoreRefetchKey(k => k + 1); // refetch to get fresh data
        const next = findNextUnscored(
          athleteRuns.map(r => r.athlete_run_id === runId
            ? { ...r, scores: [...(r.scores || []).filter(s => s.judge_id !== user.id), { judge_id: user.id, score }] }
            : r),
          athletes, currentRun, user.id, currentHeat?.runs_per_athlete || 2
        );
        if (next) { setCurrentAthleteIdx(next.idx); setCurrentRun(next.run); }
        setSubmitStatus(null);
      }, 400);
    } catch (err) {
      setSubmitStatus('error');
      setSubmitError(err.message || 'Not saved - tap to retry');
    } finally { setSubmitting(false); }
  };

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  // ── HJ actions ────────────────────────────────────────────────────────
  const allScoresComplete = athleteRuns.length > 0 &&
    athleteRuns.every(r => r.computed_score !== null && r.computed_score !== undefined);

  const hjAction = async (fn) => {
    setActionLoading(true); setActionError('');
    try { await fn(); await fetchData(); setScoreRefetchKey(k => k + 1); }
    catch (err) { setActionError(err.message); }
    finally { setActionLoading(false); }
  };

  const handleFlag = async (judgeScoreId, score, judgeName, judgeId, athleteRunId, runNumber, athleteName) => {
    // Self-correction: Head Judge flagging their own score
    if (judgeId === user.id) {
      // Flag it first so backend allows the update during HEAD_REVIEW
      try {
        await api.post('/scores/correction-request', { judge_score_id: judgeScoreId, note: 'Self-correction' });
        setScoreRefetchKey(k => k + 1);
      } catch (err) { setActionError(err.message); return; }
      setHjSelfCorrection({ athlete_run_id: athleteRunId, athleteName, runNumber, currentScore: score });
      setCorrectionInput(String(score));
      return;
    }
    const note = prompt(`Flag ${judgeName}'s score (${score?.toFixed(1)}) for correction?\nEnter note:`);
    if (note === null) return;
    await hjAction(() => api.post('/scores/correction-request', { judge_score_id: judgeScoreId, note }));
  };

  useEffect(() => {
    if (!allScoresComplete || athletes.length === 0) return;
    const ranked = athletes.map(a => {
      const r1 = athleteRuns.find(r => r.athlete_id === a.athlete_id && r.run_number === 1)?.computed_score ?? 0;
      const r2 = athleteRuns.find(r => r.athlete_id === a.athlete_id && r.run_number === 2)?.computed_score ?? 0;
      return { ...a, best_score: Math.max(r1, r2), second_score: Math.min(r1, r2) };
    });
    ranked.sort((a, b) => b.best_score !== a.best_score ? b.best_score - a.best_score : b.second_score - a.second_score);
    setRankingOrder(ranked);
  }, [allScoresComplete, athletes, athleteRuns]);

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const items = [...rankingOrder];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, moved);
    setRankingOrder(items);
    setDragIdx(null);
  };

  const scoreVal = parseFloat(scoreInput);
  const isValidScore = scoreInput !== '' && !isNaN(scoreVal) && scoreVal >= 0 && scoreVal <= 100;

  // ═══════════════ RENDER ═══════════════════════════════════════════════
  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="rounded bg-red-50 p-4 text-red-700">
      <Link to="/judge/competitions" className="text-blue-600 hover:underline">Back</Link>
      <p className="mt-2">{error}</p>
    </div>
  );

  // ── CORRECTION MODAL ──────────────────────────────────────────────────
  if (correctionModal && !isHeadJudge) {
    return (
      <div className="mx-auto max-w-md pt-8">
        <div className="rounded-lg border-2 border-orange-400 bg-orange-50 p-6 shadow-lg">
          <div className="mb-4 text-center">
            <span className="text-3xl">⚠</span>
            <h2 className="mt-2 text-xl font-bold text-orange-800">Correction Requested</h2>
            <p className="mt-1 text-sm text-orange-700">{correctionModal.note}</p>
          </div>
          <div className="mb-4 rounded bg-white p-3 text-center">
            <p className="text-sm text-gray-500">Athlete</p>
            <p className="text-lg font-bold">{correctionModal.athleteName}</p>
            <p className="text-sm text-gray-500">Run {correctionModal.runNumber}</p>
            {correctionModal.currentScore != null && (
              <p className="mt-1 text-sm text-gray-400">Current score: {correctionModal.currentScore}</p>
            )}
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const score = parseFloat(correctionInput);
            if (isNaN(score) || score < 0 || score > 100) return;
            setSubmitting(true);
            try {
              await api.post('/scores', { athlete_run_id: correctionModal.athlete_run_id, score });
              setCorrectionModal(null);
              setCorrectionInput('');
              setScoreRefetchKey(k => k + 1);
            } catch (err) { setSubmitError(err.message); }
            finally { setSubmitting(false); }
          }}>
            <input type="number" min="0" max="100" step="0.5" inputMode="decimal"
              value={correctionInput} onChange={e => setCorrectionInput(e.target.value)}
              placeholder="Enter corrected score"
              className="mb-3 w-full rounded-lg border-2 border-orange-300 px-4 py-4 text-center text-2xl font-bold outline-none focus:border-orange-500"
              style={{ fontSize: '24px' }} autoFocus />
            {submitError && <p className="mb-2 text-center text-sm text-red-600">{submitError}</p>}
            <button type="submit" disabled={(() => { const v = parseFloat(correctionInput); return correctionInput === '' || isNaN(v) || v < 0 || v > 100; })() || submitting}
              className="w-full rounded-lg bg-orange-600 px-4 py-3 text-lg font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
              style={{ minHeight: '48px' }}>
              {submitting ? 'Saving...' : 'Submit Correction'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── JUDGE VIEW ────────────────────────────────────────────────────────
  if (!isHeadJudge) {
    if (!activeHeat || activeHeat.status !== 'OPEN') {
      return (
        <div className="mx-auto max-w-md pt-16 text-center">
          <div className="mb-4 text-5xl text-gray-300">⏳</div>
          <h1 className="mb-2 text-xl font-bold text-gray-700">{competition?.name}</h1>
          <p className="text-gray-500">Waiting for the Head Judge to open the next heat...</p>
          {connected && <p className="mt-4 text-xs text-green-500">Connected — you'll see it automatically</p>}
        </div>
      );
    }

    if (!currentAthlete) return <LoadingSpinner />;

    return (
      <ScoringInterface
        currentAthlete={currentAthlete} currentAthleteIdx={currentAthleteIdx} athletes={athletes}
        currentRun={currentRun} currentMyScore={currentMyScore} scoreInput={scoreInput} setScoreInput={setScoreInput}
        isValidScore={isValidScore} submitting={submitting} submitStatus={submitStatus} submitError={submitError}
        handleSubmit={handleSubmit} getMyScore={getMyScore} setCurrentAthleteIdx={setCurrentAthleteIdx}
        setSubmitStatus={setSubmitStatus} inputRef={inputRef} setCurrentRun={setCurrentRun}
        heatLabel={`${STAGE_LABELS[activeHeat.stage_type]} - Heat ${activeHeat.heat_number}`}
        userName={user.name} divisionName={activeHeat.division_name}
        runsPerAthlete={activeHeat.runs_per_athlete || 2}
      />
    );
  }

  // ── HEAD JUDGE VIEW ───────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/judge/competitions" className="mb-4 inline-block text-sm text-blue-600 hover:underline">
        &larr; Back to competitions
      </Link>
      <h1 className="mb-4 text-xl font-bold text-gray-900">{competition?.name}</h1>

      {/* Division tabs */}
      {divisions.length > 1 && (
        <div className="mb-3 flex gap-2">
          {divisions.map(div => (
            <button key={div.id} onClick={() => setSelectedDivision(div.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                selectedDivision === div.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              {div.name}
              {div.id === nextScheduledHeat?.division_id && div.id !== selectedDivision && (
                <span className="ml-1.5 rounded bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-yellow-900">NEXT</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Heat tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {divisionHeats.map(h => (
          <button key={h.id} onClick={() => setSelectedHeatId(h.id)}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
              selectedHeatId === h.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}>
            <span className={`inline-block h-2 w-2 rounded-full ${
              h.status === 'OPEN' ? 'animate-pulse bg-green-400' :
              h.status === 'APPROVED' || h.status === 'CLOSED' ? 'bg-blue-400' :
              h.status === 'HEAD_REVIEW' ? 'bg-orange-400' : 'bg-gray-400'
            }`} />
            {STAGE_LABELS[h.stage_type]} - Heat {h.heat_number}
            {h.id === nextScheduledHeat?.id && (
              <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-yellow-900">NEXT</span>
            )}
          </button>
        ))}
      </div>

      {/* Heat content */}
      {currentHeat && (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <span className="text-sm font-medium text-gray-700">
              {STAGE_LABELS[currentHeat.stage_type]} - Heat {currentHeat.heat_number}
            </span>
            <StatusBadge status={currentHeat.status} />
          </div>

          {/* PENDING */}
          {currentHeat.status === 'PENDING' && (
            <div className="p-6 text-center">
              <p className="mb-3 text-gray-500">{athletes.length > 0 ? `${athletes.length} athletes` : 'No athletes assigned yet'}</p>
              <button onClick={() => hjAction(() => api.patch(`/heats/${selectedHeatId}/status`, { status: 'OPEN' }))}
                disabled={actionLoading}
                className="rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? 'Opening...' : 'Open Heat for Scoring'}
              </button>
            </div>
          )}

          {/* OPEN — same scoring UI as judges */}
          {currentHeat.status === 'OPEN' && currentAthlete && (
            <div className="p-4">
              <ScoringInterface
                currentAthlete={currentAthlete} currentAthleteIdx={currentAthleteIdx} athletes={athletes}
                currentRun={currentRun} currentMyScore={currentMyScore} scoreInput={scoreInput} setScoreInput={setScoreInput}
                isValidScore={isValidScore} submitting={submitting} submitStatus={submitStatus} submitError={submitError}
                handleSubmit={handleSubmit} getMyScore={getMyScore} setCurrentAthleteIdx={setCurrentAthleteIdx}
                setSubmitStatus={setSubmitStatus} inputRef={inputRef} setCurrentRun={setCurrentRun}
                heatLabel={`${STAGE_LABELS[currentHeat.stage_type]} - Heat ${currentHeat.heat_number}`}
                userName={user.name} divisionName={currentHeat.division_name || ''}
                runsPerAthlete={currentHeat.runs_per_athlete || 2}
              />
            </div>
          )}

          {/* HJ action panel */}
          {(currentHeat.status === 'OPEN' || currentHeat.status === 'HEAD_REVIEW' || currentHeat.status === 'APPROVED') && (
            <div className="border-t bg-gray-50 p-4">
              {actionError && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{actionError}</div>}

              {/* Score summary (read-only) during OPEN */}
              {allScoresComplete && currentHeat.status === 'OPEN' && (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Score Summary</h3>
                  <ScoreReviewTable athletes={athletes} athleteRuns={athleteRuns} onFlag={null} />
                </>
              )}

              {/* Score review with Flag during HEAD_REVIEW */}
              {currentHeat.status === 'HEAD_REVIEW' && (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Score Review — click Flag to request correction</h3>
                  <ScoreReviewTable athletes={athletes} athleteRuns={athleteRuns} onFlag={handleFlag} />

                  {/* Self-correction editor */}
                  {hjSelfCorrection && (
                    <div className="mb-4 rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
                      <div className="mb-2 text-center">
                        <p className="text-sm font-semibold text-orange-800">Edit your score</p>
                        <p className="text-sm text-gray-700">{hjSelfCorrection.athleteName} — Run {hjSelfCorrection.runNumber}</p>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const score = parseFloat(correctionInput);
                        if (isNaN(score) || score < 0 || score > 100) return;
                        setSubmitting(true);
                        try {
                          await api.post('/scores', { athlete_run_id: hjSelfCorrection.athlete_run_id, score });
                          setHjSelfCorrection(null);
                          setCorrectionInput('');
                          setScoreRefetchKey(k => k + 1);
                        } catch (err) { setActionError(err.message); }
                        finally { setSubmitting(false); }
                      }}>
                        <input type="number" min="0" max="100" step="0.5" inputMode="decimal"
                          value={correctionInput} onChange={e => setCorrectionInput(e.target.value)}
                          className="mb-2 w-full rounded border-2 border-orange-300 px-3 py-2 text-center text-xl font-bold outline-none focus:border-orange-500"
                          autoFocus />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setHjSelfCorrection(null); setCorrectionInput(''); }}
                            className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                            Cancel
                          </button>
                          <button type="submit" disabled={(() => { const v = parseFloat(correctionInput); return correctionInput === '' || isNaN(v) || v < 0 || v > 100; })() || submitting}
                            className="flex-1 rounded bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50">
                            {submitting ? 'Saving...' : 'Update Score'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              )}

              {/* Submit for Review */}
              {currentHeat.status === 'OPEN' && (
                <div className="space-y-2">
                  <button onClick={() => hjAction(() => api.post(`/heats/${selectedHeatId}/review`))}
                    disabled={!allScoresComplete || actionLoading}
                    className="w-full rounded-lg bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    {actionLoading ? 'Submitting...' : 'Submit for Review'}
                  </button>
                  <button onClick={() => {
                      if (!confirm('Reset this heat? All scores will be deleted and the heat will return to PENDING.')) return;
                      hjAction(() => api.post(`/heats/${selectedHeatId}/reset`));
                    }}
                    disabled={actionLoading}
                    className="w-full rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reset Heat (clear all scores)
                  </button>
                </div>
              )}

              {/* HEAD_REVIEW: Ranking + Approve */}
              {currentHeat.status === 'HEAD_REVIEW' && (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Ranking (drag to reorder)</h3>
                  <div className="mb-3 space-y-1">
                    {rankingOrder.map((a, i) => (
                      <div key={a.athlete_id} draggable onDragStart={() => handleDragStart(i)} onDragOver={handleDragOver} onDrop={() => handleDrop(i)}
                        className={`flex cursor-grab items-center justify-between rounded border bg-white px-3 py-2 text-sm ${
                          dragIdx === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>
                          <span>{a.name}</span>
                        </div>
                        <span className="font-medium">{a.best_score.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => hjAction(() => api.patch(`/heats/${selectedHeatId}/ranking`, {
                      ranking: rankingOrder.map((a, i) => ({ athlete_id: a.athlete_id, final_rank: i + 1 }))
                    }))} disabled={actionLoading}
                      className="flex-1 rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50">
                      Save Ranking
                    </button>
                    <button onClick={() => hjAction(() => api.post(`/heats/${selectedHeatId}/approve`))}
                      disabled={!allScoresComplete || actionLoading}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {actionLoading ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </>
              )}

              {/* APPROVED: Close + Reset */}
              {currentHeat.status === 'APPROVED' && (
                <div className="space-y-2">
                  <button onClick={() => hjAction(() => api.post(`/heats/${selectedHeatId}/close`))}
                    disabled={actionLoading}
                    className="w-full rounded-lg bg-gray-700 px-4 py-3 font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                    {actionLoading ? 'Closing...' : 'Close Heat'}
                  </button>
                  <button onClick={() => {
                      if (!confirm('Reset this heat? All scores will be deleted and the heat will return to PENDING.')) return;
                      hjAction(() => api.post(`/heats/${selectedHeatId}/reset`));
                    }}
                    disabled={actionLoading}
                    className="w-full rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Reset Heat (clear all scores)
                  </button>
                </div>
              )}

              {/* HEAD_REVIEW: Reset option */}
              {currentHeat.status === 'HEAD_REVIEW' && (
                <button onClick={() => {
                    if (!confirm('Reset this heat? All scores will be deleted and the heat will return to PENDING.')) return;
                    hjAction(() => api.post(`/heats/${selectedHeatId}/reset`));
                  }}
                  disabled={actionLoading}
                  className="mt-2 w-full rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                  Reset Heat (clear all scores)
                </button>
              )}
            </div>
          )}

          {currentHeat.status === 'CLOSED' && (
            <div className="p-6 text-center text-gray-500">Heat closed and finalized.</div>
          )}
        </div>
      )}
    </div>
  );
}
