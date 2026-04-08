import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { RoleRoute } from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import CompetitionDetailPage from './pages/CompetitionDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCompetitionDetail from './pages/admin/AdminCompetitionDetail';
import JudgeCompetitionsPage from './pages/JudgeCompetitionsPage';
import JudgeScoringPage from './pages/JudgeScoringPage';
import LivePage from './pages/LivePage';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-white">
          <Navbar />
          <main className="min-h-screen">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/competitions/:id" element={<CompetitionDetailPage />} />
              <Route path="/competitions/:id/live" element={<LivePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Judge routes */}
              <Route
                path="/judge/competitions"
                element={
                  <RoleRoute allowedRoles={['JUDGE', 'HEAD_JUDGE']}>
                    <JudgeCompetitionsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/judge/competitions/:id"
                element={
                  <RoleRoute allowedRoles={['JUDGE', 'HEAD_JUDGE']}>
                    <JudgeScoringPage />
                  </RoleRoute>
                }
              />

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
          <Footer />
        </div>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
