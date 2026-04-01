import { useState, useEffect } from 'react';
import api from '../../api';
import StagePanel from './StagePanel';

export default function HeatsSection({ competitionId, divisions }) {
  const [stagesByDivision, setStagesByDivision] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [successMsgs, setSuccessMsgs] = useState({});

  const fetchHeats = async () => {
    try {
      const data = await api.get(`/heats/competition/${competitionId}`);
      const grouped = {};
      for (const stage of data.stages || []) {
        if (!grouped[stage.division_id]) grouped[stage.division_id] = [];
        grouped[stage.division_id].push(stage);
      }
      setStagesByDivision(grouped);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHeats();
  }, [competitionId]);

  const handleGenerate = async (divisionId) => {
    setLoading((p) => ({ ...p, [divisionId]: true }));
    setErrors((p) => ({ ...p, [divisionId]: '' }));
    setSuccessMsgs((p) => ({ ...p, [divisionId]: '' }));

    try {
      const result = await api.post('/heats/generate', { division_id: divisionId });
      setSuccessMsgs((p) => ({ ...p, [divisionId]: result.format }));
      fetchHeats();
    } catch (err) {
      setErrors((p) => ({ ...p, [divisionId]: err.message }));
    } finally {
      setLoading((p) => ({ ...p, [divisionId]: false }));
    }
  };

  const handleDelete = async (divisionId) => {
    if (!confirm('Delete all heats for this division?')) return;
    setErrors((p) => ({ ...p, [divisionId]: '' }));
    try {
      await api.del(`/heats/division/${divisionId}`);
      setSuccessMsgs((p) => ({ ...p, [divisionId]: '' }));
      fetchHeats();
    } catch (err) {
      setErrors((p) => ({ ...p, [divisionId]: err.message }));
    }
  };

  const handlePublishStage = async (stageId, divisionId) => {
    try {
      await api.patch(`/heats/publish-stage/${stageId}`, {});
      fetchHeats();
    } catch (err) {
      setErrors((p) => ({ ...p, [divisionId]: err.message }));
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Heats</h2>

      {divisions.map((div) => {
        const stages = stagesByDivision[div.id] || [];
        const hasHeats = stages.length > 0;
        const isLoading = loading[div.id];

        return (
          <div key={div.id} className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                {div.name}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({div.athlete_count} athlete{div.athlete_count !== 1 ? 's' : ''})
                </span>
              </h3>
              <div className="flex gap-2">
                {hasHeats && (
                  <button
                    onClick={() => handleDelete(div.id)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete Heats
                  </button>
                )}
                <button
                  onClick={() => handleGenerate(div.id)}
                  disabled={isLoading}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Generating...' : hasHeats ? 'Regenerate Heats' : 'Generate Heats'}
                </button>
              </div>
            </div>

            {errors[div.id] && (
              <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{errors[div.id]}</div>
            )}

            {successMsgs[div.id] && (
              <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">{successMsgs[div.id]}</div>
            )}

            {hasHeats ? (
              <div className="space-y-4">
                {stages.map((stage) => (
                  <div key={stage.id}>
                    <StagePanel stage={stage} />
                    {stage.heats.some((h) => !h.published) && (
                      <button
                        onClick={() => handlePublishStage(stage.id, div.id)}
                        className="mt-2 rounded border border-green-300 px-3 py-1 text-xs text-green-700 hover:bg-green-50"
                      >
                        Publish {stage.stage_type} heats
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-gray-400">No heats generated yet.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
