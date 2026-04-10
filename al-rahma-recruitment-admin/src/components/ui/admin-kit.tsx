import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ChevronDown, LoaderCircle, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
type StatTone = 'primary' | 'secondary' | 'accent' | 'success';

export function AdminButton({
  className,
  variant = 'primary',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      'border-transparent bg-[linear-gradient(135deg,#17355b_0%,#234975_100%)] text-white shadow-[0_18px_34px_rgba(23,53,91,0.18)] hover:-translate-y-0.5 hover:brightness-105',
    secondary:
      'border-[rgba(182,149,86,0.45)] bg-[linear-gradient(180deg,#f8f1df_0%,#fffdfa_100%)] text-[#17355b] hover:-translate-y-0.5',
    ghost:
      'border-[rgba(19,53,91,0.12)] bg-white text-[#17355b] hover:-translate-y-0.5 hover:border-[rgba(19,53,91,0.22)]',
    danger:
      'border-transparent bg-[linear-gradient(135deg,#c94747_0%,#b53434_100%)] text-white shadow-[0_18px_34px_rgba(181,52,52,0.16)] hover:-translate-y-0.5',
    soft:
      'border-[rgba(19,53,91,0.08)] bg-[#f5f7fb] text-[#42546f] hover:-translate-y-0.5 hover:bg-white',
  };

  return (
    <button
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 text-[0.82rem] font-bold transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:px-4 sm:text-sm',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminIconButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(19,53,91,0.1)] bg-white text-[#17355b] transition hover:-translate-y-0.5 hover:border-[rgba(19,53,91,0.2)] hover:shadow-[0_14px_28px_rgba(19,53,91,0.08)] sm:h-11 sm:w-11',
        className,
      )}
      {...props}
    />
  );
}

export function AdminBadge({
  children,
  tone = 'neutral',
  className,
}: PropsWithChildren<{ tone?: BadgeTone; className?: string }>) {
  const toneClass: Record<BadgeTone, string> = {
    success: 'bg-[#eaf8ef] text-[#237a47] ring-[#9ad7af]',
    warning: 'bg-[#fff4dc] text-[#9c6a12] ring-[#e6c47c]',
    danger: 'bg-[#fdeaea] text-[#b53a3a] ring-[#efb2b2]',
    info: 'bg-[#e9f3ff] text-[#275e98] ring-[#a9c5e8]',
    neutral: 'bg-[#f3f5f8] text-[#5e7089] ring-[#d9e0e8]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.88))] px-6 py-6 shadow-[0_24px_60px_rgba(17,34,63,0.08)]"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-[#edf3fb] px-3 py-1 text-xs font-bold text-[#5a708e]">
            {eyebrow}
          </span>
          <div className="space-y-2">
            <h1 className="text-[clamp(1.8rem,2.8vw,2.7rem)] font-black tracking-[-0.04em] text-[#10213c]">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[#607286]">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </motion.section>
  );
}

export const AdminPageIntro = AdminPageHeader;

export function AdminKeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f8fafb] px-3 py-2.5 dark:bg-slate-800/60">
      <div className="text-[0.72rem] font-bold text-[#667784] dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#173349] dark:text-slate-100">{value}</div>
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  className,
  children,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className={cn(
        'rounded-[1.8rem] border border-[rgba(196,206,218,0.65)] bg-white/75 p-5 shadow-[0_20px_45px_rgba(17,34,63,0.06)] backdrop-blur-xl dark:border-slate-600/35 dark:bg-slate-900/50',
        className,
      )}
    >
      {title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 border-b border-[rgba(17,34,63,0.07)] pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-xl font-black text-[#10213c]">{title}</h2> : null}
            {description ? <p className="text-sm leading-7 text-[#63758a]">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}

export function AdminStatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const toneClass: Record<StatTone, string> = {
    primary: 'border-[#b89a58] bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf7_100%)] shadow-[0_20px_40px_rgba(184,154,88,0.12)]',
    secondary: 'border-[rgba(35,74,117,0.14)] bg-[linear-gradient(180deg,#ffffff_0%,#f6f9fc_100%)] shadow-[0_20px_40px_rgba(35,74,117,0.08)]',
    accent: 'border-[rgba(58,133,127,0.18)] bg-[linear-gradient(180deg,#ffffff_0%,#f4fbfb_100%)] shadow-[0_20px_40px_rgba(58,133,127,0.10)]',
    success: 'border-[rgba(53,145,98,0.16)] bg-[linear-gradient(180deg,#ffffff_0%,#f4fbf6_100%)] shadow-[0_20px_40px_rgba(53,145,98,0.10)]',
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className={cn('rounded-[1.8rem] border p-5', toneClass[tone])}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-bold text-[#485a72]">{label}</p>
          <strong className="block text-4xl font-black tracking-[-0.05em] text-[#10213c]">{value}</strong>
          {helper ? <p className="text-xs font-semibold leading-6 text-[#7b8796]">{helper}</p> : null}
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6efdf] text-[#9f7c32]">
          <Icon size={22} />
        </div>
      </div>
    </motion.article>
  );
}

export const AdminMetricCard = AdminStatCard;

export function AdminResponsiveChart({
  className,
  minHeight = 260,
  children,
}: {
  className?: string;
  minHeight?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: minHeight });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.round(element.clientWidth));
      const nextHeight = Math.max(minHeight, Math.round(element.clientHeight || minHeight));
      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, [minHeight]);

  return (
    <div ref={containerRef} className={cn('w-full', className)} style={{ minHeight }}>
      {size.width > 0 ? children(size) : null}
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-dashed border-[rgba(17,34,63,0.12)] bg-[linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)] px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef3f9] text-[#69809a]">
        <AlertTriangle size={24} />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-black text-[#10213c]">{title}</h3>
        <p className="max-w-lg text-sm leading-7 text-[#6b7d90]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminField({
  label,
  hint,
  required,
  children,
  className,
}: PropsWithChildren<{ label: string; hint?: string; required?: boolean; className?: string }>) {
  return (
    <label className={cn('flex flex-col gap-2', className)}>
      <span className="flex items-center gap-1.5 text-sm font-bold text-[#17355b]">
        {label}
        {required ? <span className="text-[#c94747]">*</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs leading-6 text-[#78889c]">{hint}</span> : null}
    </label>
  );
}

export function AdminInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'min-h-10 w-full rounded-xl border border-[rgba(19,53,91,0.12)] bg-white px-3.5 text-[0.82rem] text-[#10213c] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none transition placeholder:text-[#9aa8b8] focus:border-[#2b5687] focus:ring-4 focus:ring-[#dce8f5] sm:min-h-11 sm:px-4 sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export function AdminSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'min-h-10 w-full rounded-xl border border-[rgba(19,53,91,0.12)] bg-white px-3.5 text-[0.82rem] text-[#10213c] outline-none transition focus:border-[#2b5687] focus:ring-4 focus:ring-[#dce8f5] sm:min-h-11 sm:px-4 sm:text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function AdminTextarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-[112px] w-full rounded-xl border border-[rgba(19,53,91,0.12)] bg-white px-3.5 py-2.5 text-[0.82rem] text-[#10213c] outline-none transition placeholder:text-[#9aa8b8] focus:border-[#2b5687] focus:ring-4 focus:ring-[#dce8f5] sm:min-h-[124px] sm:px-4 sm:py-3 sm:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export function AdminSwitch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (nextValue: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className="flex w-full items-start justify-between gap-3 rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe] px-3.5 py-3 text-right transition hover:border-[rgba(19,53,91,0.14)] sm:px-4"
    >
      <div className="space-y-1">
        <div className="text-[0.84rem] font-bold text-[#17355b] sm:text-sm">{label}</div>
        {description ? <p className="text-[0.72rem] leading-5 text-[#71839b] sm:text-xs sm:leading-6">{description}</p> : null}
      </div>
      <span
        className={cn(
          'relative mt-0.5 flex h-6 w-12 rounded-full border transition sm:h-7 sm:w-14',
          checked ? 'border-[#1d4c75] bg-[#1d4c75]' : 'border-[rgba(19,53,91,0.12)] bg-white',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_10px_20px_rgba(17,34,63,0.18)] transition sm:h-5.5 sm:w-5.5',
            checked ? 'right-0.5' : 'right-[calc(100%-1.45rem)] sm:right-[calc(100%-1.65rem)]',
          )}
        />
      </span>
    </button>
  );
}

export function AdminFormSection({
  title,
  description,
  defaultOpen = true,
  children,
  className,
  contentClassName,
}: PropsWithChildren<{
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}>) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn('overflow-hidden rounded-[1rem] border border-[rgba(19,53,91,0.08)] bg-[#fbfcfe]', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-right transition hover:bg-[rgba(19,53,91,0.03)] sm:px-4"
        aria-expanded={open}
      >
        <div className="space-y-1">
          <div className="text-[0.9rem] font-black text-[#10213c] sm:text-[0.96rem]">{title}</div>
          {description ? <p className="text-[0.72rem] leading-5 text-[#71839b] sm:text-xs sm:leading-6">{description}</p> : null}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(19,53,91,0.1)] bg-white text-[#17355b]">
          <ChevronDown size={16} className={cn('transition-transform duration-200', open ? 'rotate-180' : '')} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('border-t border-[rgba(19,53,91,0.06)] px-3.5 py-3 sm:px-4 sm:py-4', contentClassName)}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function AdminSectionTabs({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-[1.15rem] border border-[rgba(19,53,91,0.1)] bg-white p-1.5 shadow-[0_14px_34px_rgba(17,34,63,0.06)]">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              'rounded-[0.95rem] px-4 py-2 text-sm font-bold transition',
              active
                ? 'bg-[#edf3fb] text-[#17355b] shadow-[inset_0_-2px_0_#2d5687]'
                : 'text-[#667a92] hover:text-[#17355b]',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminDataShell({
  toolbar,
  children,
  className,
}: PropsWithChildren<{ toolbar?: ReactNode; className?: string }>) {
  return (
    <AdminPanel className={cn('overflow-hidden p-0', className)}>
      {toolbar ? <div className="border-b border-[rgba(17,34,63,0.07)] px-5 py-4">{toolbar}</div> : null}
      <div className="p-5">{children}</div>
    </AdminPanel>
  );
}

export function AdminToolbar({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between', className)}>
      {children}
    </div>
  );
}

export function AdminTable({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('overflow-hidden rounded-[1.6rem] border border-[rgba(17,34,63,0.08)] bg-white', className)}>
      {children}
    </div>
  );
}

export function AdminTableShell({ children }: PropsWithChildren) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function AdminStatusBadge({ status, label }: { status: string; label?: string }) {
  const toneMap: Record<string, BadgeTone> = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'info',
    neutral: 'neutral',
    approved: 'success',
    accepted: 'success',
    hired: 'success',
    active: 'success',
    pending: 'warning',
    review: 'warning',
    archived: 'neutral',
    restricted: 'danger',
    rejected: 'danger',
    hidden: 'neutral',
    closed: 'neutral',
    open: 'info',
    flagged: 'warning',
  };

  return <AdminBadge tone={toneMap[status] || 'neutral'}>{label || status}</AdminBadge>;
}

export function AdminDialog({
  open,
  title,
  description,
  size = 'md',
  onClose,
  children,
  footer,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  footer?: ReactNode;
}>) {
  const widthClass = size === 'sm' ? 'max-w-lg' : size === 'lg' ? 'max-w-4xl' : 'max-w-2xl';

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-[rgba(10,18,32,0.46)] backdrop-blur-[3px]"
            aria-label="إغلاق النافذة"
          />
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-x-3 top-1/2 z-[71] mx-auto w-full max-h-[92vh] -translate-y-1/2 sm:inset-x-4"
          >
            <div
              className={cn(
                'mx-auto flex max-h-[92vh] flex-col overflow-hidden rounded-[1.35rem] bg-white px-4 py-4 shadow-[0_30px_80px_rgba(10,18,32,0.18)] sm:rounded-[1.65rem] sm:px-5 sm:py-5',
                widthClass,
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-[rgba(17,34,63,0.07)] pb-3.5 sm:mb-4 sm:gap-4 sm:pb-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-[#10213c] sm:text-[1.55rem]">{title}</h3>
                  {description ? <p className="text-[0.78rem] leading-6 text-[#67798d] sm:text-sm sm:leading-7">{description}</p> : null}
                </div>
                <AdminIconButton onClick={onClose} aria-label="إغلاق">
                  <X size={18} />
                </AdminIconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-4">{children}</div>
              </div>
              {footer ? <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[rgba(17,34,63,0.07)] pt-4">{footer}</div> : null}
            </div>
          </motion.section>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export { AdminDialog as AdminModal };

export function AdminDrawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
}>) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-[rgba(10,18,32,0.36)]"
            aria-label="إغلاق اللوحة الجانبية"
          />
          <motion.aside
            initial={{ x: 70, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 70, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="fixed inset-y-0 left-0 z-[81] w-full max-w-[420px] border-r border-[rgba(17,34,63,0.08)] bg-white shadow-[0_28px_80px_rgba(10,18,32,0.18)] sm:max-w-[430px]"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-[rgba(17,34,63,0.07)] px-4 py-4 sm:px-5 sm:py-4.5">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-[#10213c] sm:text-[1.55rem]">{title}</h3>
                  {description ? <p className="text-[0.78rem] leading-6 text-[#66788d] sm:text-sm sm:leading-7">{description}</p> : null}
                </div>
                <AdminIconButton onClick={onClose} aria-label="إغلاق">
                  <X size={18} />
                </AdminIconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-4">{children}</div>
              {footer ? <div className="border-t border-[rgba(17,34,63,0.07)] px-4 py-4 sm:px-5">{footer}</div> : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function AdminLoadingBlock({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-[1.6rem] border border-[rgba(17,34,63,0.08)] bg-white/90">
      <div className="inline-flex items-center gap-3 rounded-full bg-[#f3f6fb] px-4 py-3 text-sm font-bold text-[#4f647d]">
        <LoaderCircle size={18} className="animate-spin" />
        {label}
      </div>
    </div>
  );
}
