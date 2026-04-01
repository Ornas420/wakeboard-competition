import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RoleRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import CompetitionDetailPage from './pages/CompetitionDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompetitionDetail from './pages/admin/AdminCompetitionDetail';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="container mx-auto p-4">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/competitions/:id" element={<CompetitionDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/competitions/:id"
              element={
                <RoleRoute allowedRoles={['ADMIN']}>
                  <AdminCompetitionDetail />
                </RoleRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}

export default App;
