import { useState, useEffect } from 'react';
import api from '../../api';

export default function RegistrationsSection({ competitionId }) {
  const [registrations, setRegistrations] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [filterDivision, setFilterDivision] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDivisions = () => {
    api.get(`/competitions/${competitionId}/divisions`)
      .then((data) => setDivisions(data.divisions || []))
      .catch(() => {});
  };

  const fetchRegistrations = () => {
    let url = `/registrations/competition/${competitionId}`;
    if (filterDivision) url += `?division_id=${filterDivision}`;
    api.get(url)
      .then((data) => setRegistrations(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDivisions();
  }, [competitionId]);

  useEffect(() => {
    fetchRegistrations();
  }, [competitionId, filterDivision]);

  const handleStatusChange = async (regId, newStatus) => {
    setError('');
    try {
      await api.patch(`/registrations/${regId}`, { status: newStatus });
      fetchRegistrations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSeedChange = async (regId, seed) => {
    setError('');
    try {
      await api.patch(`/registrations/${regId}/seed`, { seed: parseInt(seed, 10) });
      fetchRegistrations();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (regId) => {
    setError('');
    try {
      await api.del(`/registrations/${regId}`);
      fetchRegistrations();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">
          Registrations ({registrations.length})
        </h3>
        {divisions.length > 0 && (
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="">All divisions</option>
            {divisions.map((div) => (
              <option key={div.id} value={div.id}>{div.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading registrations...</p>
      ) : registrations.length === 0 ? (
        <p className="text-sm text-gray-500">No athletes registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="py-2 pr-4">Athlete</th>
                <th className="py-2 pr-4">Division</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Seed</th>
                <th className="py-2 pr-4">Registered</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrations.map((reg) => (
                <tr key={reg.id}>
                  <td className="py-2 pr-4 font-medium">{reg.name}</td>
                  <td className="py-2 pr-4">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                      {reg.division_name}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{reg.email}</td>
                  <td className="py-2 pr-4">
                    <select
                      value={reg.status}
                      onChange={(e) => handleStatusChange(reg.id, e.target.value)}
                      className="rounded border px-1.5 py-0.5 text-xs"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="WITHDRAWN">WITHDRAWN</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      defaultValue={reg.seed ?? ''}
                      min={0}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== '' && val !== String(reg.seed)) {
                          handleSeedChange(reg.id, val);
                        }
                      }}
                      placeholder="—"
                      className="w-16 rounded border px-2 py-0.5 text-xs"
                    />
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {new Date(reg.registered_at).toLocaleDateString('lt-LT')}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleRemove(reg.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
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
