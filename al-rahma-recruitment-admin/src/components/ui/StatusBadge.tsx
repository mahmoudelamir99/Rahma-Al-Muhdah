import { getStatusLabel, getStatusTone } from '../../lib/admin-store';

export default function StatusBadge({ status }: { status: string }) {
  const tone = getStatusTone(status);

  const classes: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${classes[tone] || classes.slate}`}>{getStatusLabel(status)}</span>;
}
