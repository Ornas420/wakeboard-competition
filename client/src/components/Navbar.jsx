import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileOpen(false);
  };

  const navBg = isHome && !isScrolled
    ? 'bg-transparent'
    : 'bg-navy-900 shadow-lg';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBg}`}>
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold uppercase tracking-wider text-white">
          WakeScore
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm font-medium uppercase tracking-wide text-white/70 hover:text-white">
            Competitions
          </Link>

          {(user?.role === 'JUDGE' || user?.role === 'HEAD_JUDGE') && (
            <Link to="/judge/competitions" className="text-sm font-medium uppercase tracking-wide text-white/70 hover:text-white">
              Judge
            </Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="text-sm font-medium uppercase tracking-wide text-white/70 hover:text-white">
              Admin
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <span className="rounded bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="rounded border border-white/20 px-3 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="rounded border border-white/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/10"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="rounded bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-accent-dark"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex flex-col gap-1 md:hidden"
        >
          <span className={`h-0.5 w-5 bg-white transition-all ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
          <span className={`h-0.5 w-5 bg-white transition-all ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`h-0.5 w-5 bg-white transition-all ${mobileOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-navy-900 px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-3 pt-3">
            <Link to="/" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 hover:text-white">Competitions</Link>
            {(user?.role === 'JUDGE' || user?.role === 'HEAD_JUDGE') && (
              <Link to="/judge/competitions" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 hover:text-white">Judge</Link>
            )}
            {user?.role === 'ADMIN' && (
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 hover:text-white">Admin</Link>
            )}
            {user ? (
              <>
                <span className="text-xs text-white/50">{user.name} ({user.role})</span>
                <button onClick={handleLogout} className="text-left text-sm text-white/80 hover:text-white">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="text-sm text-white/80 hover:text-white">Login</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="text-sm text-accent hover:text-accent-light">Register</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
