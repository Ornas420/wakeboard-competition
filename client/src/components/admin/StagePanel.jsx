import HeatCard from './HeatCard';

const STAGE_LABELS = {
  QUALIFICATION: 'Qualification',
  LCQ: 'Last Chance Qualifier',
  QUARTERFINAL: 'Quarter-Finals',
  SEMIFINAL: 'Semi-Finals',
  FINAL: 'Finals',
};

export default function StagePanel({ stage }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-gray-900">
            {STAGE_LABELS[stage.stage_type] || stage.stage_type}
          </h4>
          <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
            <span>{stage.distribution}</span>
            <span>{stage.runs_per_athlete} run{stage.runs_per_athlete > 1 ? 's' : ''}</span>
            {stage.athletes_advance && <span>Top {stage.athletes_advance} advance</span>}
            {stage.reversed === 1 && <span className="text-blue-600">Reversed order</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stage.heats.map((heat) => (
          <HeatCard key={heat.id} heat={heat} />
        ))}
      </div>
    </div>
  );
}
