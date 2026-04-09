/**
 * Shared formatting utilities and constants for the WakeScore frontend.
 */

/** IWWF stage type display labels */
export const STAGE_LABELS = {
  QUALIFICATION: 'Qualification',
  LCQ: 'LCQ',
  QUARTERFINAL: 'Quarter-finals',
  SEMIFINAL: 'Semi-finals',
  FINAL: 'Final',
};

/** Gradient backgrounds for competition cards without images */
export const GRADIENTS = [
  'from-navy-800 to-blue-900',
  'from-navy-900 to-indigo-900',
  'from-slate-800 to-navy-800',
  'from-navy-700 to-cyan-900',
];

/**
 * Format a date range for display.
 * - Same day: "Jul 15, 2026"
 * - Same month: "July 15–17, 2026"
 * - Different months: "Jul 15, 2026 – Aug 2, 2026"
 * @param {string} start - ISO date string (YYYY-MM-DD)
 * @param {string} [end] - ISO date string (YYYY-MM-DD), optional
 * @returns {string} Formatted date range
 */
export function formatDateRange(start, end) {
  const opts = { month: 'long', day: 'numeric', year: 'numeric' };
  const s = new Date(start).toLocaleDateString('en-US', opts);
  if (!end || start === end) return s;
  const sd = new Date(start);
  const ed = new Date(end);
  if (sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear()) {
    return `${sd.toLocaleDateString('en-US', { month: 'long' })} ${sd.getDate()}–${ed.getDate()}, ${sd.getFullYear()}`;
  }
  return `${s} – ${new Date(end).toLocaleDateString('en-US', opts)}`;
}

/**
 * Get the Tailwind CSS classes for a heat status indicator dot.
 * @param {string} status - Heat status (PENDING, OPEN, HEAD_REVIEW, APPROVED, CLOSED)
 * @returns {string} Tailwind classes for a small rounded dot
 */
export function getHeatStatusColor(status) {
  switch (status) {
    case 'OPEN': return 'animate-pulse bg-green-400';
    case 'APPROVED':
    case 'CLOSED': return 'bg-blue-400';
    case 'HEAD_REVIEW': return 'bg-orange-400';
    default: return 'bg-gray-300';
  }
}
