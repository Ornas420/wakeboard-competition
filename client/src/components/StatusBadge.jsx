const colors = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  WITHDRAWN: 'bg-red-100 text-red-700',
  OPEN: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  HEAD_REVIEW: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-blue-100 text-blue-700',
};

export default function StatusBadge({ status }) {
  const colorClass = colors[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}
