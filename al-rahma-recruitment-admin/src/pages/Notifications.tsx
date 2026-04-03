import { Send } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { humanDate, useAdmin } from '../lib/admin-store';

export default function Notifications() {
  const { state, sendNotification } = useAdmin();
  const [audience, setAudience] = useState('الكل');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Notifications Hub"
        title="إدارة الإشعارات"
        description="إنشاء إشعار جديد، استخدام القوالب الجاهزة، ومراجعة آخر الرسائل المرسلة."
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">إنشاء إشعار جديد</h3>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">الفئة المستهدفة</span>
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none"
              >
                <option>الكل</option>
                <option>الباحثين</option>
                <option>الشركات</option>
                <option>المدن الكبرى</option>
                <option>فريق الدعم</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">العنوان</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">المحتوى</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                sendNotification(audience, subject, body);
                setSubject('');
                setBody('');
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <Send size={16} />
              إرسال الإشعار
            </button>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">القوالب الجاهزة</h3>
          <div className="mt-5 space-y-3">
            {state.notificationTemplates.length ? (
              state.notificationTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setAudience(template.audience);
                    setSubject(template.subject);
                    setBody(template.body);
                  }}
                  className="block w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 text-right transition hover:bg-white"
                >
                  <p className="font-bold text-slate-900">{template.name}</p>
                  <p className="mt-1 text-xs font-bold text-blue-600">{template.audience}</p>
                  <p className="mt-2 text-sm text-slate-500">{template.subject}</p>
                </button>
              ))
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                لا توجد قوالب محفوظة حتى الآن.
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <h4 className="font-display text-xl font-bold text-slate-900">آخر الإشعارات المرسلة</h4>
            <div className="mt-4 space-y-3">
              {state.sentNotifications.length ? (
                state.sentNotifications.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-bold text-slate-900">{notification.subject}</p>
                    <p className="mt-1 text-xs font-bold text-amber-600">{notification.audience}</p>
                    <p className="mt-2 text-sm text-slate-500">{notification.body}</p>
                    <p className="mt-2 text-xs font-bold text-slate-400">{humanDate(notification.sentAt)}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  لم يتم إرسال إشعارات حتى الآن.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
