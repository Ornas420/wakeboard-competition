import { useState, useEffect } from 'react';
import api from '../../api';

export default function DivisionsSection({ competitionId }) {
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchDivisions = () => {
    api.get(`/competitions/${competitionId}/divisions`)
      .then((data) => setDivisions(data.divisions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDivisions();
  }, [competitionId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    setAdding(true);
    try {
      await api.post(`/competitions/${competitionId}/divisions`, {
        name: newName.trim(),
        display_order: divisions.length + 1,
      });
      setNewName('');
      fetchDivisions();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (divisionId) => {
    setError('');
    try {
      await api.del(`/competitions/${competitionId}/divisions/${divisionId}`);
      fetchDivisions();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-gray-800">Divisions</h3>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {/* Add division form */}
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Open Men, U19 Junior, Veterans"
          required
          className="flex-1 rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add Division'}
        </button>
      </form>

      {/* Division list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading divisions...</p>
      ) : divisions.length === 0 ? (
        <p className="text-sm text-gray-500">No divisions yet. Add one to enable athlete registration.</p>
      ) : (
        <div className="space-y-2">
          {divisions.map((div) => (
            <div
              key={div.id}
              className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
            >
              <div>
                <span className="font-medium">{div.name}</span>
                <span className="ml-2 text-sm text-gray-500">
                  {div.athlete_count} athlete{div.athlete_count !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={() => handleRemove(div.id)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
