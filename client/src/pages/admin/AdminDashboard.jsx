import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import CompetitionForm from '../../components/admin/CompetitionForm';

export default function AdminDashboard() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchCompetitions = () => {
    api.get('/competitions')
      .then((data) => setCompetitions(data.competitions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleCreate = async (form) => {
    await api.post('/competitions', form);
    setShowCreate(false);
    fetchCompetitions();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {showCreate ? 'Cancel' : '+ Create Competition'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</div>
      )}

      {showCreate && (
        <div className="mb-6 rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">New Competition</h2>
          <CompetitionForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {competitions.length === 0 ? (
        <p className="text-gray-500">No competitions yet. Create one to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Divisions</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Athletes</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {competitions.map((comp) => (
                <tr key={comp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{comp.name}</td>
                  <td className="px-4 py-3">
                    {new Date(comp.start_date).toLocaleDateString('lt-LT')}
                    {comp.end_date && comp.end_date !== comp.start_date && ` – ${new Date(comp.end_date).toLocaleDateString('lt-LT')}`}
                  </td>
                  <td className="px-4 py-3">{comp.location || '—'}</td>
                  <td className="px-4 py-3">{comp.divisions || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={comp.status} /></td>
                  <td className="px-4 py-3">{comp.athlete_count}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/competitions/${comp.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
