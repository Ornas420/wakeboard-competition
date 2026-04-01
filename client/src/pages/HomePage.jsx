import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function HomePage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/competitions')
      .then((data) => setCompetitions(data.competitions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Competitions</h1>
        <p className="mt-1 text-gray-500">Browse upcoming and past wakeboard competitions</p>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {competitions.length === 0 ? (
        <p className="text-gray-500">No competitions yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {competitions.map((comp) => (
            <Link
              key={comp.id}
              to={`/competitions/${comp.id}`}
              className="block rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{comp.name}</h2>
                <StatusBadge status={comp.status} />
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>📅 {new Date(comp.date).toLocaleDateString('lt-LT')}</p>
                {comp.location && <p>📍 {comp.location}</p>}
                {comp.divisions && <p>🏷️ {comp.divisions}</p>}
                <p className="font-medium text-blue-600">
                  {comp.athlete_count} athlete{comp.athlete_count !== 1 ? 's' : ''} registered
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
