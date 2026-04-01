import { useState, useEffect } from 'react';
import api from '../../api';

export default function StaffSection({ competitionId }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [staffRole, setStaffRole] = useState('JUDGE');
  const [adding, setAdding] = useState(false);

  const fetchStaff = () => {
    api.get(`/competitions/${competitionId}/staff`)
      .then((data) => setStaff(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStaff();
  }, [competitionId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      await api.post(`/competitions/${competitionId}/staff`, {
        user_id: userId.trim(),
        staff_role: staffRole,
      });
      setUserId('');
      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (staffUserId) => {
    setError('');
    try {
      await api.del(`/competitions/${competitionId}/staff/${staffUserId}`);
      fetchStaff();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-gray-800">Staff</h3>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {/* Add staff form */}
      <form onSubmit={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User ID (UUID)"
          required
          className="flex-1 rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={staffRole}
          onChange={(e) => setStaffRole(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="JUDGE">Judge</option>
          <option value="HEAD_JUDGE">Head Judge</option>
        </select>
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* Staff list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading staff...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-gray-500">No staff assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded bg-gray-50 px-3 py-2"
            >
              <div>
                <span className="font-medium">{member.name}</span>
                <span className="ml-2 text-sm text-gray-500">{member.email}</span>
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                  member.staff_role === 'HEAD_JUDGE'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {member.staff_role}
                </span>
              </div>
              <button
                onClick={() => handleRemove(member.user_id)}
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
