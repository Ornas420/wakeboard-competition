import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold hover:text-blue-100">
          🏄 WakeBoard
        </Link>

        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-blue-200">Competitions</Link>

          {(user?.role === 'JUDGE' || user?.role === 'HEAD_JUDGE') && (
            <Link to="/judge/competitions" className="hover:text-blue-200">Judge</Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="hover:text-blue-200">Admin</Link>
          )}

          {user ? (
            <>
              <span className="rounded bg-blue-500 px-2 py-1 text-sm">
                {user.name} ({user.role})
              </span>
              <button
                onClick={handleLogout}
                className="rounded bg-blue-700 px-3 py-1 text-sm hover:bg-blue-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded bg-blue-700 px-3 py-1 text-sm hover:bg-blue-800">
                Login
              </Link>
              <Link to="/register" className="rounded bg-white px-3 py-1 text-sm text-blue-600 hover:bg-blue-50">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
