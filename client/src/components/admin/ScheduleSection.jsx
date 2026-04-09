import { useState, useEffect } from 'react';
import api from '../../api';
import StatusBadge from '../StatusBadge';
import { STAGE_LABELS } from '../../utils/format';

export default function ScheduleSection({ competitionId }) {
  const [schedule, setSchedule] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    api.get(`/heats/competition/${competitionId}`)
      .then(data => {
        const heats = [];
        for (const stage of data.stages || []) {
          for (const heat of stage.heats) {
            heats.push({
              heat_id: heat.id,
              division_name: stage.division_name,
              stage_type: stage.stage_type,
              heat_number: heat.heat_number,
              status: heat.status,
              athlete_count: heat.athletes?.length || 0,
              schedule_order: heat.schedule_order,
            });
          }
        }
        heats.sort((a, b) => {
          if (a.schedule_order != null && b.schedule_order != null) return a.schedule_order - b.schedule_order;
          if (a.schedule_order != null) return -1;
          if (b.schedule_order != null) return 1;
          return 0;
        });
        setSchedule(heats);
      })
      .catch(err => setError(err.message));
  }, [competitionId]);

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (dropIdx) => {
    if (dragIdx === null || dragIdx === dropIdx) return;
    const items = [...schedule];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(dropIdx, 0, moved);
    setSchedule(items);
    setDragIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = schedule.map((h, i) => ({
        heat_id: h.heat_id,
        schedule_order: i + 1,
      }));
      await api.patch('/heats/schedule', { schedule: payload });
      setSuccess('Schedule saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (schedule.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Competition Schedule</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>

      {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded bg-green-50 p-2 text-sm text-green-700">{success}</div>}

      <p className="mb-3 text-xs text-gray-500">Drag to reorder heats across all divisions.</p>

      <div className="space-y-1">
        {schedule.map((heat, i) => (
          <div
            key={heat.heat_id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
            className={`flex cursor-grab items-center justify-between rounded border px-3 py-2 text-sm ${
              dragIdx === i ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600">
                {i + 1}
              </span>
              <span className="font-medium text-gray-700">{heat.division_name}</span>
              <span className="text-gray-500">
                {STAGE_LABELS[heat.stage_type] || heat.stage_type} - Heat {heat.heat_number}
              </span>
              <span className="text-xs text-gray-400">({heat.athlete_count} athletes)</span>
            </div>
            <StatusBadge status={heat.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
