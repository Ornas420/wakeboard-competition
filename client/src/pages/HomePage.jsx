import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const GRADIENTS = [
  'from-navy-800 to-blue-900',
  'from-navy-900 to-indigo-900',
  'from-slate-800 to-navy-800',
  'from-navy-700 to-cyan-900',
];

export default function HomePage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/competitions')
      .then((data) => setCompetitions(data.competitions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeComps = competitions.filter(c => c.status === 'ACTIVE');
  const upcomingComps = competitions.filter(c => c.status === 'DRAFT');
  const completedComps = competitions.filter(c => c.status === 'COMPLETED');
  const featuredComp = activeComps[0] || null;
  const liveAndUpcoming = [...activeComps, ...upcomingComps];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-[85vh] items-center overflow-hidden bg-navy-950">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1621988935681-e8d4b8c9314e?w=1920&q=80')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />

        <div className="relative z-10 container mx-auto px-4 pt-32 pb-20">
          <div className="max-w-2xl">
            <span className="mb-4 inline-block rounded-full bg-accent/20 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-accent">
              Competition Platform
            </span>
            <h1 className="mb-6 text-4xl font-black uppercase leading-tight text-white md:text-6xl lg:text-7xl">
              The Future of Wakeboarding is{' '}
              <span className="text-accent">Here.</span>
            </h1>
            <p className="mb-8 max-w-lg text-lg text-white/60">
              Track live scores, follow competitions in real-time, and experience the thrill of professional wakeboarding.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#competitions"
                className="rounded bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-navy-900 transition hover:bg-gray-100"
              >
                Browse Competitions
              </a>
              {featuredComp && (
                <Link
                  to={`/competitions/${featuredComp.id}/live`}
                  className="rounded border-2 border-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Watch Live
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FEATURED COMPETITION ═══ */}
      {featuredComp && (
        <section className="bg-white py-20">
          <div className="container mx-auto px-4">
            <span className="mb-6 block text-xs font-semibold uppercase tracking-widest text-accent">
              Currently Active
            </span>
            <div className="grid items-center gap-12 lg:grid-cols-2">
              {/* Left: Video/Image */}
              <div className="overflow-hidden rounded-xl bg-navy-100 shadow-2xl" style={{ aspectRatio: '16/9' }}>
                {featuredComp.video_url ? (
                  <iframe
                    src={featuredComp.video_url}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : featuredComp.image_url ? (
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url('${featuredComp.image_url}')` }} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-600">
                    <div className="text-center">
                      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                        <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <p className="text-sm text-white/60">Live stream available during competition</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Info */}
              <div>
                <h2 className="mb-3 text-3xl font-bold text-navy-900">{featuredComp.name}</h2>
                <p className="text-gray-600">
                  {featuredComp.location && `${featuredComp.location} · `}
                  {new Date(featuredComp.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>

                <div className="mt-6 flex gap-8">
                  <div>
                    <p className="text-2xl font-bold text-navy-900">{featuredComp.athlete_count}</p>
                    <p className="text-sm text-gray-500">Athletes</p>
                  </div>
                  {featuredComp.divisions && (
                    <div>
                      <p className="text-2xl font-bold text-navy-900">{featuredComp.divisions.split(',').length}</p>
                      <p className="text-sm text-gray-500">Divisions</p>
                    </div>
                  )}
                </div>

                <Link
                  to={`/competitions/${featuredComp.id}/live`}
                  className="mt-8 inline-flex items-center gap-2 rounded bg-navy-900 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-navy-800"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Watch Live Now
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ LIVE & UPCOMING ═══ */}
      <section id="competitions" className="bg-gray-50 py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold text-navy-900">Live & Upcoming</h2>
              <p className="mt-1 text-gray-500">Don't miss the action</p>
            </div>
          </div>

          {liveAndUpcoming.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No upcoming competitions at this time.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {liveAndUpcoming.map((comp, i) => (
                <Link
                  key={comp.id}
                  to={`/competitions/${comp.id}`}
                  className="group relative h-64 overflow-hidden rounded-xl"
                >
                  {/* Background — image or gradient fallback */}
                  {comp.image_url ? (
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url('${comp.image_url}')` }} />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} transition-transform duration-300 group-hover:scale-105`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    {comp.status === 'ACTIVE' ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-red-400">Live</span>
                      </div>
                    ) : (
                      <p className="mb-2 text-xs text-white/50">
                        {new Date(comp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    <h3 className="text-lg font-bold text-white">{comp.name}</h3>
                    {comp.divisions && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {comp.divisions.split(', ').map(div => (
                          <span key={div} className="rounded bg-white/15 px-2 py-0.5 text-xs text-white/80">{div}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ RESULTS ═══ */}
      {completedComps.length > 0 && (
        <section className="bg-white py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-2 text-3xl font-bold text-navy-900">Results</h2>
            <p className="mb-10 text-gray-500">Past competition results</p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {completedComps.map(comp => (
                <Link
                  key={comp.id}
                  to={`/competitions/${comp.id}`}
                  className="rounded-xl border border-gray-200 p-6 transition hover:border-navy-200 hover:shadow-md"
                >
                  <h3 className="mb-1 text-lg font-semibold text-navy-900">{comp.name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(comp.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {comp.location && ` · ${comp.location}`}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="text-sm font-medium text-navy-700">{comp.athlete_count} athletes</span>
                    {comp.divisions && (
                      <span className="text-sm text-gray-400">{comp.divisions}</span>
                    )}
                  </div>
                  <span className="mt-4 inline-block text-sm font-medium text-accent">View Results →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
