import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

export default function JudgeCompetitionsPage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/competitions/my-assignments')
      .then(data => setCompetitions(data.competitions))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">My Competitions</h1>
      <p className="mb-6 text-gray-600">Competitions you are assigned to as a judge</p>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</div>}

      {competitions.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          You are not assigned to any competitions yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map(comp => (
            <Link
              key={comp.id}
              to={`/judge/competitions/${comp.id}`}
              className="block rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{comp.name}</h2>
                <StatusBadge status={comp.status} />
              </div>
              <p className="mb-1 text-sm text-gray-600">
                {new Date(comp.date).toLocaleDateString('lt-LT')}
              </p>
              {comp.location && (
                <p className="mb-1 text-sm text-gray-600">{comp.location}</p>
              )}
              {comp.divisions && (
                <p className="mb-2 text-sm text-gray-500">{comp.divisions}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-600">{comp.athlete_count} athletes</span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {comp.staff_role === 'HEAD_JUDGE' ? 'Head Judge' : 'Judge'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
