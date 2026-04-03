import type { ReactNode } from 'react';

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-blue-700">{eyebrow}</p> : null}
        <h2 className="mt-2 text-[1.65rem] font-black leading-tight text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
