import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDateRange, GRADIENTS } from '../utils/format';

export default function HomePage() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const sliderRef = useRef(null);

  useEffect(() => {
    api.get('/competitions')
      .then((data) => setCompetitions(data.competitions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeComps = competitions.filter(c => c.status === 'ACTIVE');
  const upcomingComps = competitions.filter(c => c.status === 'DRAFT');
  const completedComps = competitions.filter(c => c.status === 'COMPLETED');
  const liveAndUpcoming = [...activeComps, ...upcomingComps];

  const scrollSlider = (dir) => {
    if (!sliderRef.current) return;
    const amount = sliderRef.current.offsetWidth * 0.8;
    sliderRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative -mt-16 flex min-h-[85vh] items-center overflow-hidden bg-navy-950">
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
              <Link
                to="/browse"
                className="rounded bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-navy-900 transition hover:bg-gray-100"
              >
                Browse Competitions
              </Link>
              {activeComps.length > 0 && (
                <Link
                  to={`/competitions/${activeComps[0].id}/live`}
                  className="rounded border-2 border-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
                >
                  Watch Live Results
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CURRENTLY ACTIVE — Horizontal Scroll Slider ═══ */}
      {activeComps.length > 0 && (
        <section className="bg-white py-20">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-accent">
                  Currently Active
                </span>
                <h2 className="text-3xl font-bold text-navy-900">Live Competitions</h2>
              </div>
              {activeComps.length > 1 && (
                <div className="flex gap-2">
                  <button onClick={() => scrollSlider('left')}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:bg-gray-100">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => scrollSlider('right')}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 transition hover:bg-gray-100">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>

            <div ref={sliderRef} className="flex gap-6 overflow-x-auto scroll-smooth pb-4" style={{ scrollbarWidth: 'none' }}>
              {activeComps.map((comp, i) => (
                <div key={comp.id} className="min-w-[350px] max-w-[500px] flex-shrink-0 lg:min-w-[450px]">
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                    {/* Image */}
                    <Link to={`/competitions/${comp.id}`} className="block">
                      <div className="relative h-48 overflow-hidden">
                        {comp.image_url ? (
                          <div className="h-full w-full bg-cover bg-center transition-transform duration-300 hover:scale-105" style={{ backgroundImage: `url('${comp.image_url}')` }} />
                        ) : (
                          <div className={`h-full w-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                          <span className="text-xs font-semibold text-white">LIVE</span>
                        </div>
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="p-5">
                      <Link to={`/competitions/${comp.id}`} className="group">
                        <h3 className="mb-1 text-xl font-bold text-navy-900 group-hover:text-accent transition">{comp.name}</h3>
                      </Link>
                      <p className="mb-4 text-sm text-gray-500">
                        {comp.location && `${comp.location} · `}
                        {formatDateRange(comp.start_date, comp.end_date)}
                      </p>

                      <div className="mb-4 flex gap-6">
                        <div>
                          <p className="text-xl font-bold text-navy-900">{comp.athlete_count}</p>
                          <p className="text-xs text-gray-400">Athletes</p>
                        </div>
                        {comp.divisions && (
                          <div>
                            <p className="text-xl font-bold text-navy-900">{comp.divisions.split(',').length}</p>
                            <p className="text-xs text-gray-400">Divisions</p>
                          </div>
                        )}
                        {comp.prize_pool && (
                          <div>
                            <p className="text-xl font-bold text-navy-900">{comp.prize_pool}</p>
                            <p className="text-xs text-gray-400">Prize Pool</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <Link to={`/competitions/${comp.id}/live`}
                          className="flex items-center gap-2 rounded bg-navy-900 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-navy-800">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          Watch Live Results
                        </Link>
                        <Link to={`/competitions/${comp.id}`}
                          className="rounded border border-gray-300 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-navy-900 transition hover:bg-gray-50">
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
            <Link to="/browse" className="text-sm font-medium uppercase tracking-wide text-accent hover:text-accent-dark">
              View All →
            </Link>
          </div>

          {liveAndUpcoming.length === 0 ? (
            <p className="py-12 text-center text-gray-400">No upcoming competitions at this time.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {liveAndUpcoming.slice(0, 4).map((comp, i) => (
                <Link key={comp.id} to={`/competitions/${comp.id}`} className="group relative h-64 overflow-hidden rounded-xl">
                  {comp.image_url ? (
                    <div className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105" style={{ backgroundImage: `url('${comp.image_url}')` }} />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} transition-transform duration-300 group-hover:scale-105`} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    {comp.status === 'ACTIVE' ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-red-400">Live</span>
                      </div>
                    ) : (
                      <p className="mb-2 text-xs text-white/50">
                        {formatDateRange(comp.start_date, comp.end_date)}
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
            <div className="mb-10 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold text-navy-900">Results</h2>
                <p className="mt-1 text-gray-500">Past competition results</p>
              </div>
              <Link to="/browse" className="text-sm font-medium uppercase tracking-wide text-accent hover:text-accent-dark">
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {completedComps.slice(0, 3).map(comp => (
                <Link key={comp.id} to={`/competitions/${comp.id}`}
                  className="rounded-xl border border-gray-200 p-6 transition hover:border-navy-200 hover:shadow-md">
                  <h3 className="mb-1 text-lg font-semibold text-navy-900">{comp.name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDateRange(comp.start_date, comp.end_date)}
                    {comp.location && ` · ${comp.location}`}
                  </p>
                  <div className="mt-4 flex items-center gap-4">
                    <span className="text-sm font-medium text-navy-700">{comp.athlete_count} athletes</span>
                    {comp.level && <span className="text-sm text-gray-400">{comp.level}</span>}
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
