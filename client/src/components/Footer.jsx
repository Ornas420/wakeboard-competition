import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-navy-900 pt-16 pb-8 text-white">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-bold uppercase tracking-wider">WakeScore</h3>
            <p className="mt-3 text-sm text-gray-400">
              Professional wakeboard competition management and live scoring platform.
            </p>
          </div>

          {/* Competitions */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Competitions
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="text-gray-300 hover:text-white">Browse All</Link></li>
              <li><Link to="/" className="text-gray-300 hover:text-white">Live Now</Link></li>
              <li><Link to="/" className="text-gray-300 hover:text-white">Results</Link></li>
            </ul>
          </div>

          {/* Getting Started */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              Getting Started
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/register" className="text-gray-300 hover:text-white">Register</Link></li>
              <li><Link to="/login" className="text-gray-300 hover:text-white">Login</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
              About
            </h4>
            <p className="text-sm text-gray-400">
              Built for IWWF-compliant wakeboard competitions with real-time scoring and live results.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} WakeScore. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
