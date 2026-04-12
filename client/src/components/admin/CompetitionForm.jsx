import { useState } from 'react';

const emptyForm = {
  name: '',
  start_date: '',
  end_date: '',
  location: '',
  description: '',
  timetable: '',
  video_url: '',
  image_url: '',
  prize_pool: '',
  level: '',
  judge_count: 3,
};

export default function CompetitionForm({ competition = null, onSubmit, onCancel }) {
  const [form, setForm] = useState(
    competition
      ? {
          name: competition.name || '',
          start_date: competition.start_date || '',
          end_date: competition.end_date || '',
          location: competition.location || '',
          description: competition.description || '',
          timetable: competition.timetable || '',
          video_url: competition.video_url || '',
          image_url: competition.image_url || '',
          prize_pool: competition.prize_pool || '',
          level: competition.level || '',
          judge_count: competition.judge_count || 3,
        }
      : { ...emptyForm }
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'judge_count' ? parseInt(value, 10) || 3 : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.end_date && new Date(form.end_date) < new Date(form.start_date)) {
      setError('End date cannot be before start date');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Start Date *</label>
          <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
          <input type="date" name="end_date" value={form.end_date} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
          <input type="text" name="location" value={form.location} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Level</label>
          <input type="text" name="level" value={form.level} onChange={handleChange} placeholder="e.g. National, International" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Prize Pool</label>
          <input type="text" name="prize_pool" value={form.prize_pool} onChange={handleChange} placeholder="e.g. €5,000" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Judge Count (3-5)</label>
          <input type="number" name="judge_count" value={form.judge_count} onChange={handleChange} min={1} max={5} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
          <input type="url" name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://images.unsplash.com/..." className={inputClass} />
          {form.image_url && (
            <img src={form.image_url} alt="Preview" className="mt-2 h-32 w-full rounded object-cover" />
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Video URL</label>
          <input type="url" name="video_url" value={form.video_url} onChange={handleChange} placeholder="https://youtube.com/..." className={inputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
        <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={inputClass} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Timetable / Schedule</label>
        <textarea name="timetable" value={form.timetable} onChange={handleChange} rows={4} placeholder="DAY 1 — July 15&#10;09:00 — Men Qualification Heat 1&#10;10:00 — Women Qualification Heat 1&#10;..." className={inputClass} />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Saving...' : competition ? 'Update' : 'Create'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="rounded border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
