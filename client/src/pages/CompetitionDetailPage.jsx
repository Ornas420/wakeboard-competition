import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CompetitionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registeredDivisions, setRegisteredDivisions] = useState(new Set());
  const [regMessages, setRegMessages] = useState({}); // { divisionId: { type, msg } }

  useEffect(() => {
    api.get(`/competitions/${id}`)
      .then((data) => setComp(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRegister = async (divisionId) => {
    setRegMessages((prev) => ({ ...prev, [divisionId]: null }));
    try {
      await api.post('/registrations', { division_id: divisionId });
      setRegisteredDivisions((prev) => new Set(prev).add(divisionId));
      setRegMessages((prev) => ({
        ...prev,
        [divisionId]: { type: 'success', msg: 'Registered!' },
      }));
      // Update athlete count
      setComp((prev) => ({
        ...prev,
        divisions: prev.divisions?.map((d) =>
          d.id === divisionId ? { ...d, athlete_count: d.athlete_count + 1 } : d
        ),
      }));
    } catch (err) {
      if (err.message.includes('Already registered')) {
        setRegisteredDivisions((prev) => new Set(prev).add(divisionId));
      }
      setRegMessages((prev) => ({
        ...prev,
        [divisionId]: { type: 'error', msg: err.message },
      }));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded bg-red-50 p-4 text-red-700">{error}</div>;
  if (!comp) return <div className="text-gray-500">Competition not found.</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-4 inline-block text-blue-600 hover:underline">
        ← Back to competitions
      </Link>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{comp.name}</h1>
          <div className="flex items-center gap-2">
            {comp.status === 'ACTIVE' && (
              <Link
                to={`/competitions/${id}/live`}
                className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Watch Live
              </Link>
            )}
            <StatusBadge status={comp.status} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium text-gray-700">Date:</span>{' '}
            {new Date(comp.date).toLocaleDateString('lt-LT')}
          </div>
          {comp.location && (
            <div>
              <span className="font-medium text-gray-700">Location:</span> {comp.location}
            </div>
          )}
          <div>
            <span className="font-medium text-gray-700">Athletes:</span> {comp.athlete_count}
          </div>
          <div>
            <span className="font-medium text-gray-700">Judges:</span> {comp.judge_count}
          </div>
        </div>

        {comp.description && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Description</h2>
            <p className="whitespace-pre-wrap text-gray-600">{comp.description}</p>
          </div>
        )}

        {comp.timetable && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Timetable</h2>
            <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-600">
              {comp.timetable}
            </pre>
          </div>
        )}

        {comp.video_url && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Live Stream</h2>
            <a href={comp.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {comp.video_url}
            </a>
          </div>
        )}

        {/* Divisions */}
        {comp.divisions && comp.divisions.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Divisions</h2>
            <div className="space-y-2">
              {comp.divisions.map((div) => (
                <div
                  key={div.id}
                  className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{div.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      {div.athlete_count} athlete{div.athlete_count !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Registration button per division */}
                  {user?.role === 'ATHLETE' && comp.status === 'DRAFT' && (
                    <div className="flex items-center gap-2">
                      {registeredDivisions.has(div.id) ? (
                        <span className="text-sm font-medium text-green-600">✓ Registered</span>
                      ) : (
                        <button
                          onClick={() => handleRegister(div.id)}
                          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                        >
                          Register
                        </button>
                      )}
                      {regMessages[div.id] && regMessages[div.id].type === 'error' && (
                        <span className="text-xs text-red-600">{regMessages[div.id].msg}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {comp.stages && comp.stages.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">Stages</h2>
            <div className="space-y-2">
              {comp.stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{stage.stage_type}</span>
                    <span className="ml-2 text-xs text-gray-400">{stage.division_name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {stage.heat_count} heat{stage.heat_count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Login prompt for non-authenticated users */}
        {!user && comp.divisions && comp.divisions.length > 0 && comp.status === 'DRAFT' && (
          <div className="border-t pt-4">
            <Link
              to="/login"
              className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Log in to register
            </Link>
          </div>
        )}

        {user?.role === 'ATHLETE' && comp.status !== 'DRAFT' && (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">Registration is closed.</p>
          </div>
        )}
      </div>
    </div>
  );
}
