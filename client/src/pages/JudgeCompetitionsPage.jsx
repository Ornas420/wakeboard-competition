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
    <div className="min-h-screen bg-navy-50">
      <div className="-mt-16 bg-navy-900 pt-20 pb-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-white">My Competitions</h1>
          <p className="text-sm text-white/50">Competitions you are assigned to as a judge</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}

        {competitions.length === 0 ? (
          <div className="rounded-xl border border-navy-200 bg-white p-12 text-center text-gray-400">
            You are not assigned to any competitions yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {competitions.map(comp => (
              <Link
                key={comp.id}
                to={`/judge/competitions/${comp.id}`}
                className="group overflow-hidden rounded-xl border border-navy-200 bg-white shadow-sm transition hover:shadow-lg"
              >
                <div className="border-b border-navy-100 bg-navy-900 px-5 py-4">
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-bold text-white group-hover:text-accent transition">{comp.name}</h2>
                    <StatusBadge status={comp.status} />
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    {new Date(comp.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {comp.end_date && comp.end_date !== comp.start_date && ` – ${new Date(comp.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
                <div className="p-5">
                  {comp.location && <p className="mb-2 text-sm text-gray-500">{comp.location}</p>}
                  {comp.divisions && <p className="mb-3 text-xs text-gray-400">{comp.divisions}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-navy-900">{comp.athlete_count} athletes</span>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                      comp.staff_role === 'HEAD_JUDGE'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-navy-100 text-navy-600'
                    }`}>
                      {comp.staff_role === 'HEAD_JUDGE' ? 'Head Judge' : 'Judge'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
