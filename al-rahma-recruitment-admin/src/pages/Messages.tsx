import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import { cleanAdminText } from '../lib/admin-dashboard';
import { humanRelative, useAdmin } from '../lib/admin-store';

export default function Messages() {
  const { state, addNote, assignThread, updateThreadStatus } = useAdmin();
  const [search, setSearch] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const normalizedSearch = cleanAdminText(search).trim().toLowerCase();
  const threads = useMemo(
    () =>
      state.messages.filter((thread) => {
        if (!normalizedSearch) return true;
        const target = cleanAdminText(`${thread.title} ${thread.participantName} ${thread.companyName}`).toLowerCase();
        return target.includes(normalizedSearch);
      }),
    [normalizedSearch, state.messages],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="الدعم"
        title="إدارة الرسائل والدعم"
        description="مراجعة المحادثات الواردة، توزيعها على المسؤول المناسب، وإضافة ملاحظات داخلية تساعد في المتابعة السريعة."
      />

      <section className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pr-12 pl-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="ابحث باسم المرشح أو الشركة أو عنوان المحادثة..."
            />
          </div>
        </div>

        <div className="space-y-4">
          {threads.length ? (
            threads.map((thread) => (
              <article key={thread.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl font-bold text-slate-900">{cleanAdminText(thread.title)}</h3>
                      <StatusBadge status={thread.status} />
                      {thread.unreadCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                          {thread.unreadCount} غير مقروءة
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-600">
                      {cleanAdminText(thread.participantName)} • {cleanAdminText(thread.companyName)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">آخر تحديث {humanRelative(thread.lastMessageAt)}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                    <select
                      value={thread.status}
                      onChange={(event) => updateThreadStatus(thread.id, event.target.value as typeof thread.status)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                    >
                      <option value="open">مفتوحة</option>
                      <option value="closed">مغلقة</option>
                      <option value="flagged">تحت المراجعة</option>
                    </select>
                    <select
                      value={thread.assignedAdminId || ''}
                      onChange={(event) => assignThread(thread.id, event.target.value || null)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                    >
                      <option value="">غير معينة</option>
                      {state.admins.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {cleanAdminText(admin.displayName)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_auto]">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">ملاحظات الإدارة</p>
                    <div className="space-y-2">
                      {thread.internalNotes.length ? (
                        thread.internalNotes.slice(0, 2).map((note) => (
                          <div key={note.id} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            <p>{cleanAdminText(note.body)}</p>
                            <p className="mt-2 text-xs font-bold text-slate-400">{cleanAdminText(note.authorName)}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">لا توجد ملاحظات داخلية على هذه المحادثة حتى الآن.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 xl:w-[320px]">
                    <input
                      value={noteDrafts[thread.id] || ''}
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [thread.id]: event.target.value }))}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                      placeholder="ملاحظة داخلية لفريق الدعم فقط..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addNote('messages', thread.id, noteDrafts[thread.id] || '');
                        setNoteDrafts((current) => ({ ...current, [thread.id]: '' }));
                      }}
                      className="rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white"
                    >
                      حفظ
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              لا توجد محادثات أو بلاغات مطابقة للبحث الحالي.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
