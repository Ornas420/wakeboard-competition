import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import CompetitionForm from '../../components/admin/CompetitionForm';
import StaffSection from '../../components/admin/StaffSection';
import DivisionsSection from '../../components/admin/DivisionsSection';
import RegistrationsSection from '../../components/admin/RegistrationsSection';
import HeatsSection from '../../components/admin/HeatsSection';
import ScheduleSection from '../../components/admin/ScheduleSection';

export default function AdminCompetitionDetail() {
  const { id } = useParams();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchComp = () => {
    api.get(`/competitions/${id}`)
      .then((data) => setComp(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchComp();
  }, [id]);

  const handleUpdate = async (form) => {
    await api.patch(`/competitions/${id}`, form);
    setEditing(false);
    fetchComp();
  };

  const handleStatusChange = async (newStatus) => {
    setError('');
    setStatusLoading(true);
    try {
      await api.patch(`/competitions/${id}/status`, { status: newStatus });
      fetchComp();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!comp) return <div className="text-gray-500">Competition not found.</div>;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link to="/admin" className="mb-4 inline-block text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {/* Section A: Competition Info */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{comp.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={comp.status} />
              <span className="text-sm text-gray-500">
                {comp.athlete_count} athlete{comp.athlete_count !== 1 ? 's' : ''} · {comp.judge_count} judges
              </span>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <CompetitionForm
            competition={comp}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium text-gray-700">Date:</span> {new Date(comp.start_date).toLocaleDateString('lt-LT')}{comp.end_date && comp.end_date !== comp.start_date && ` – ${new Date(comp.end_date).toLocaleDateString('lt-LT')}`}</p>
            {comp.location && <p><span className="font-medium text-gray-700">Location:</span> {comp.location}</p>}
            {comp.description && <p><span className="font-medium text-gray-700">Description:</span> {comp.description}</p>}
            {comp.timetable && (
              <div>
                <span className="font-medium text-gray-700">Timetable:</span>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">{comp.timetable}</pre>
              </div>
            )}
            {comp.video_url && <p><span className="font-medium text-gray-700">Video:</span> <a href={comp.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{comp.video_url}</a></p>}
          </div>
        )}

        {/* Status transition buttons */}
        <div className="mt-4 border-t pt-4">
          {comp.status === 'DRAFT' && (
            <button
              onClick={() => handleStatusChange('ACTIVE')}
              disabled={statusLoading}
              className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {statusLoading ? 'Starting...' : 'Start Competition'}
            </button>
          )}
          {comp.status === 'ACTIVE' && (
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              disabled={statusLoading}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {statusLoading ? 'Completing...' : 'Complete Competition'}
            </button>
          )}
          {comp.status === 'COMPLETED' && (
            <p className="text-sm text-gray-500">This competition is completed.</p>
          )}
        </div>
      </div>

      {/* Section B: Staff Management */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <StaffSection competitionId={id} />
      </div>

      {/* Section C: Divisions */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <DivisionsSection competitionId={id} />
      </div>

      {/* Section D: Registrations */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <RegistrationsSection competitionId={id} />
      </div>

      {/* Section E: Heats */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <HeatsSection competitionId={id} divisions={comp?.divisions || []} />
      </div>

      {/* Section F: Schedule */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <ScheduleSection competitionId={id} />
      </div>
    </div>
  );
}
