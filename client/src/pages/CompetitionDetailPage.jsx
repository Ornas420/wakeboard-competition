import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { formatDateRange } from '../utils/format';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CompetitionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registeredDivisions, setRegisteredDivisions] = useState(new Set());
  const [regMessages, setRegMessages] = useState({});

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
      setRegMessages((prev) => ({ ...prev, [divisionId]: { type: 'success', msg: 'Registered!' } }));
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
      setRegMessages((prev) => ({ ...prev, [divisionId]: { type: 'error', msg: err.message } }));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="container mx-auto px-4 py-6 text-red-600">{error}</div>;
  if (!comp) return null;

  const divisionCount = comp.divisions?.length || 0;

  return (
    <div>
      {/* ═══ HERO BANNER ═══ */}
      <section className="relative -mt-16 flex min-h-[50vh] items-end overflow-hidden bg-navy-950">
        {comp.image_url ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${comp.image_url}')` }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy-800 to-navy-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="relative z-10 container mx-auto px-4 pb-10 pt-32">
          <div className="mb-3 flex items-center gap-3">
            <StatusBadge status={comp.status} />
            {comp.level && (
              <span className="rounded-full bg-accent/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-accent">
                {comp.level}
              </span>
            )}
          </div>
          <h1 className="mb-3 text-3xl font-black text-white md:text-5xl">{comp.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span>
              {formatDateRange(comp.start_date, comp.end_date)}
            </span>
            {comp.location && <span>{comp.location}</span>}
          </div>
        </div>
      </section>

      {/* ═══ CONTENT ═══ */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2">
            {/* Overview */}
            {comp.description && (
              <div className="mb-10">
                <h2 className="mb-4 text-2xl font-bold text-navy-900">Competition Overview</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-600">{comp.description}</p>
              </div>
            )}

            {/* Stats row */}
            <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {comp.level && (
                <div className="rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Level</p>
                  <p className="mt-1 text-lg font-bold text-navy-900">{comp.level}</p>
                </div>
              )}
              {comp.prize_pool && (
                <div className="rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Prize Pool</p>
                  <p className="mt-1 text-lg font-bold text-navy-900">{comp.prize_pool}</p>
                </div>
              )}
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Athletes</p>
                <p className="mt-1 text-lg font-bold text-navy-900">{comp.athlete_count}</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Divisions</p>
                <p className="mt-1 text-lg font-bold text-navy-900">{divisionCount}</p>
              </div>
            </div>

            {/* Divisions */}
            <div className="mb-10">
              <h2 className="mb-4 text-2xl font-bold text-navy-900">Competition Divisions</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {comp.divisions?.map((div) => (
                  <div key={div.id} className="rounded-lg border border-gray-200 p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-2xl font-bold text-navy-900">{div.athlete_count}</span>
                      <span className="text-xs text-gray-400">athletes</span>
                    </div>
                    <h3 className="text-lg font-semibold text-navy-900">{div.name}</h3>

                    {/* Registration */}
                    {user?.role === 'ATHLETE' && comp.status === 'DRAFT' && (
                      <div className="mt-3">
                        {registeredDivisions.has(div.id) ? (
                          <span className="text-sm font-medium text-green-600">Registered</span>
                        ) : (
                          <button
                            onClick={() => handleRegister(div.id)}
                            className="rounded bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                          >
                            Register
                          </button>
                        )}
                        {regMessages[div.id] && (
                          <p className={`mt-1 text-xs ${regMessages[div.id].type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {regMessages[div.id].msg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column (1/3) */}
          <div>
            {/* Schedule */}
            {comp.timetable && (
              <div className="mb-6 rounded-lg border border-gray-200 p-5">
                <h3 className="mb-3 text-lg font-bold text-navy-900">Daily Schedule</h3>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {comp.timetable}
                </div>
              </div>
            )}

            {/* Watch Live */}
            {comp.status === 'ACTIVE' && (
              <Link
                to={`/competitions/${id}/live`}
                className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                Watch Live Results
              </Link>
            )}

            {/* Competition info card */}
            <div className="rounded-lg border border-gray-200 p-5">
              <h3 className="mb-3 text-lg font-bold text-navy-900">Details</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="font-medium text-navy-900">
                    {formatDateRange(comp.start_date, comp.end_date)}
                  </dd>
                </div>
                {comp.location && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Location</dt>
                    <dd className="font-medium text-navy-900">{comp.location}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">Judges</dt>
                  <dd className="font-medium text-navy-900">{comp.judge_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Status</dt>
                  <dd><StatusBadge status={comp.status} /></dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
