import StatusBadge from '../StatusBadge';

export default function HeatCard({ heat }) {
  return (
    <div className="rounded border bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">Heat {heat.heat_number}</span>
        <div className="flex items-center gap-2">
          {heat.published ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">Published</span>
          ) : (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">Draft</span>
          )}
          <StatusBadge status={heat.status} />
        </div>
      </div>

      {heat.athletes.length > 0 ? (
        <ol className="space-y-1">
          {heat.athletes.map((a) => (
            <li key={a.athlete_id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-center text-xs text-gray-400">{a.run_order}</span>
              <span className="text-gray-800">{a.name}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs italic text-gray-400">No athletes assigned yet</p>
      )}

      {heat.run2_reorder === 1 && (
        <p className="mt-2 text-xs text-blue-600">Run 2: reorder by Run 1 scores</p>
      )}
    </div>
  );
}
