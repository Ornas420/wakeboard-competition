import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const GRADIENTS = [
  'from-navy-800 to-blue-900',
  'from-navy-900 to-indigo-900',
  'from-slate-800 to-navy-800',
  'from-navy-700 to-cyan-900',
];

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'DRAFT', label: 'Upcoming' },
  { key: 'COMPLETED', label: 'Past' },
];

export default function BrowseCompetitionsPage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    api.get('/competitions')
      .then(data => setCompetitions(data.competitions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Get unique levels for the dropdown
  const levels = [...new Set(competitions.map(c => c.level).filter(Boolean))];

  // Apply filters
  const filtered = competitions.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (levelFilter && c.level !== levelFilter) return false;
    if (dateFrom && c.date < dateFrom) return false;
    if (dateTo && c.date > dateTo) return false;
    return true;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-navy-900 pt-24 pb-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white md:text-4xl">Browse Competitions</h1>
          <p className="mt-2 text-white/60">Find wakeboard competitions past, present, and upcoming</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Status tabs */}
          <div className="mb-4 flex gap-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === tab.key
                    ? 'bg-navy-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">
                  ({tab.key === 'all' ? competitions.length : competitions.filter(c => c.status === tab.key).length})
                </span>
              </button>
            ))}
          </div>

          {/* Date + Level filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            {levels.length > 0 && (
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="rounded border px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              >
                <option value="">All Levels</option>
                {levels.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            )}
            {(dateFrom || dateTo || levelFilter) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setLevelFilter(''); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            No competitions match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((comp, i) => (
              <Link
                key={comp.id}
                to={`/competitions/${comp.id}`}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-lg"
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  {comp.image_url ? (
                    <div className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                         style={{ backgroundImage: `url('${comp.image_url}')` }} />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} transition-transform duration-300 group-hover:scale-105`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    {comp.status === 'ACTIVE' ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
                      </span>
                    ) : (
                      <StatusBadge status={comp.status} />
                    )}
                  </div>

                  {/* Level badge */}
                  {comp.level && (
                    <div className="absolute top-3 right-3">
                      <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-medium text-white">
                        {comp.level}
                      </span>
                    </div>
                  )}

                  {/* Name overlay */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white">{comp.name}</h3>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="mb-3 text-sm text-gray-500">
                    {new Date(comp.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {comp.location && ` · ${comp.location}`}
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-navy-900">{comp.athlete_count} athletes</span>
                    {comp.prize_pool && (
                      <span className="text-accent font-medium">{comp.prize_pool}</span>
                    )}
                  </div>

                  {comp.divisions && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {comp.divisions.split(', ').map(div => (
                        <span key={div} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{div}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
