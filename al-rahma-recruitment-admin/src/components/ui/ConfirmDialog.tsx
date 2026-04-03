type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  keyword?: string;
  keywordValue?: string;
  onKeywordChange?: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  keyword,
  keywordValue = '',
  onKeywordChange,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  const requiresKeyword = Boolean(keyword);
  const isDisabled = requiresKeyword && keywordValue.trim() !== keyword;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(111,200,255,0.14)] px-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#4d8fff]">2-Step Confirmation</p>
            <h3 className="mt-2 text-2xl font-display font-bold text-slate-800">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <p className="text-sm leading-7 text-slate-600">{description}</p>
        {requiresKeyword && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-[#f7fbff] p-4">
            <p className="text-sm font-bold text-[#1e40af]">
              اكتب <span className="rounded-md bg-white px-2 py-1 text-slate-900">{keyword}</span> للتأكيد.
            </p>
            <input
              value={keywordValue}
              onChange={(event) => onKeywordChange?.(event.target.value)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              placeholder={keyword}
            />
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDisabled}
            className="rounded-xl bg-gradient-to-r from-[#59a9ff] to-[#45d6bf] px-5 py-2.5 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
