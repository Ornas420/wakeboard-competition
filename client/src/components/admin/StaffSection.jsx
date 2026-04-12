import { useState, useEffect } from 'react';
import api from '../../api';

export default function StaffSection({ competitionId }) {
  const [staff, setStaff] = useState([]);
  const [judges, setJudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assign existing judge
  const [selectedJudgeId, setSelectedJudgeId] = useState('');
  const [staffRole, setStaffRole] = useState('JUDGE');
  const [adding, setAdding] = useState(false);

  // Create new judge
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('JUDGE');
  const [creating, setCreating] = useState(false);

  const fetchStaff = () => {
    api.get(`/competitions/${competitionId}/staff`)
      .then(data => setStaff(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const fetchJudges = () => {
    api.get('/auth/judges')
      .then(data => setJudges(data))
      .catch(err => setError(err.message));
  };

  useEffect(() => {
    fetchStaff();
    fetchJudges();
  }, [competitionId]);

  // Filter out already assigned judges
  const assignedIds = new Set(staff.map(s => s.user_id));
  const availableJudges = judges.filter(j => !assignedIds.has(j.id));

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedJudgeId) return;
    setError('');
    setAdding(true);
    try {
      await api.post(`/competitions/${competitionId}/staff`, {
        user_id: selectedJudgeId,
        staff_role: staffRole,
      });
      setSelectedJudgeId('');
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api.post('/auth/create-staff', {
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setShowCreate(false);
      fetchJudges();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-gray-800">Staff</h3>

      {error && (
        <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {/* Assign existing judge */}
      <form onSubmit={handleAssign} className="mb-3 flex gap-2">
        <select
          value={selectedJudgeId}
          onChange={e => setSelectedJudgeId(e.target.value)}
          className="flex-1 rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a judge...</option>
          {availableJudges.map(j => (
            <option key={j.id} value={j.id}>
              {j.name} ({j.email}) — {j.role}
            </option>
          ))}
        </select>
        <select
          value={staffRole}
          onChange={e => setStaffRole(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
        >
          <option value="JUDGE">Judge</option>
          <option value="HEAD_JUDGE">Head Judge</option>
        </select>
        <button
          type="submit"
          disabled={adding || !selectedJudgeId}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Assign'}
        </button>
      </form>

      {/* Create new judge toggle */}
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="mb-3 text-sm text-blue-600 hover:underline"
      >
        {showCreate ? 'Cancel' : '+ Create new judge account'}
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-4 rounded border bg-gray-50 p-3">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name"
              required
              className="rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email"
              required
              className="rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Password"
              required
              className="rounded border px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="JUDGE">Judge</option>
              <option value="HEAD_JUDGE">Head Judge</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      )}

      {/* Staff list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading staff...</p>
      ) : staff.length === 0 ? (
        <p className="text-sm text-gray-500">No staff assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {staff.map(member => (
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
                  {member.staff_role === 'HEAD_JUDGE' ? 'Head Judge' : 'Judge'}
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
