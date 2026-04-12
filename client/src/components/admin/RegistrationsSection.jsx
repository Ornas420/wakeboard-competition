import { useState, useEffect } from 'react';
import api from '../../api';

export default function RegistrationsSection({ competitionId }) {
  const [registrations, setRegistrations] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [athletes, setAthletes] = useState([]);
  const [filterDivision, setFilterDivision] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add athlete form
  const [showAdd, setShowAdd] = useState(false);
  const [addDivisionId, setAddDivisionId] = useState('');
  const [addAthleteId, setAddAthleteId] = useState('');
  const [addGuestName, setAddGuestName] = useState('');
  const [addMode, setAddMode] = useState('existing'); // 'existing' or 'guest'
  const [adding, setAdding] = useState(false);

  const fetchDivisions = () => {
    api.get(`/competitions/${competitionId}/divisions`)
      .then((data) => setDivisions(data.divisions || []))
      .catch(err => setError(err.message));
  };

  const fetchRegistrations = () => {
    let url = `/registrations/competition/${competitionId}`;
    if (filterDivision) url += `?division_id=${filterDivision}`;
    api.get(url)
      .then((data) => setRegistrations(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const fetchAthletes = () => {
    api.get('/auth/athletes')
      .then(data => setAthletes(data))
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    fetchDivisions();
    fetchAthletes();
  }, [competitionId]);

  useEffect(() => {
    fetchRegistrations();
  }, [competitionId, filterDivision]);

  // Filter out already registered athletes for the selected division
  const registeredAthleteIds = new Set(
    registrations.filter(r => !addDivisionId || r.division_id === addDivisionId).map(r => r.athlete_id)
  );
  const availableAthletes = athletes.filter(a => !registeredAthleteIds.has(a.id));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addDivisionId) return;
    if (addMode === 'existing' && !addAthleteId) return;
    if (addMode === 'guest' && !addGuestName.trim()) return;
    setError('');
    setAdding(true);
    try {
      const body = { division_id: addDivisionId };
      if (addMode === 'existing') {
        body.athlete_id = addAthleteId;
      } else {
        body.name = addGuestName.trim();
      }
      await api.post('/registrations/admin', body);
      setAddAthleteId('');
      setAddGuestName('');
      fetchRegistrations();
      fetchAthletes();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

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
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
          >
            {showAdd ? 'Cancel' : '+ Add Athlete'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {/* Add athlete form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 rounded border bg-gray-50 p-3">
          <div className="mb-2 flex gap-2">
            <select
              value={addDivisionId}
              onChange={e => setAddDivisionId(e.target.value)}
              required
              className="rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select division...</option>
              {divisions.map(div => (
                <option key={div.id} value={div.id}>{div.name}</option>
              ))}
            </select>
            <div className="flex rounded border bg-white text-sm">
              <button type="button" onClick={() => setAddMode('existing')}
                className={`px-3 py-1.5 ${addMode === 'existing' ? 'bg-blue-600 text-white' : 'text-gray-600'} rounded-l`}>
                Existing
              </button>
              <button type="button" onClick={() => setAddMode('guest')}
                className={`px-3 py-1.5 ${addMode === 'guest' ? 'bg-blue-600 text-white' : 'text-gray-600'} rounded-r`}>
                New (Guest)
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            {addMode === 'existing' ? (
              <select
                value={addAthleteId}
                onChange={e => setAddAthleteId(e.target.value)}
                required
                className="flex-1 rounded border px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select athlete...</option>
                {availableAthletes.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={addGuestName}
                onChange={e => setAddGuestName(e.target.value)}
                placeholder="Enter athlete's full name"
                required
                className="flex-1 rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
            <button
              type="submit"
              disabled={adding || !addDivisionId || (addMode === 'existing' ? !addAthleteId : !addGuestName.trim())}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Register'}
            </button>
          </div>
        </form>
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
