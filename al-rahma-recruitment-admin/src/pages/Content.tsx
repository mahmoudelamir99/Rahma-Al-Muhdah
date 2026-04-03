import { Save } from 'lucide-react';
import { useState } from 'react';
import PageHeader from '../components/ui/PageHeader';
import { useAdmin, type ContentState } from '../lib/admin-store';

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
};

function Field({ label, value, onChange, placeholder, rows, hint }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {rows ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white"
        />
      )}
      {hint ? <p className="mt-2 text-xs leading-6 text-slate-500">{hint}</p> : null}
    </label>
  );
}

export default function Content() {
  const { state, updateContent } = useAdmin();
  const [content, setContent] = useState<ContentState>(state.content);

  const updateField = <K extends keyof ContentState>(key: K, value: ContentState[K]) => {
    setContent((current) => ({ ...current, [key]: value }));
  };

  const saveContent = () => {
    updateContent(content);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content Management"
        title="إدارة المحتوى"
        description="عدّل نصوص الواجهة العامة، صفحة من نحن، التواصل، والصفحات الثابتة المستخدمة فعليًا في الموقع."
        actions={
          <button
            type="button"
            onClick={saveContent}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
          >
            <Save size={16} />
            حفظ المحتوى
          </button>
        }
      />

      <section className="grid gap-6">
        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">الواجهة الرئيسية</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            هذه القيم تظهر في الصفحة الرئيسية وتحدد الرسالة الأساسية التي يراها الزائر أولًا.
          </p>
          <div className="mt-5 space-y-4">
            <Field
              label="عنوان الهيرو"
              value={content.heroTitle}
              onChange={(value) => updateField('heroTitle', value)}
              placeholder="الرحمة المهداه للتوظيف"
            />
            <Field
              label="الوصف الرئيسي"
              value={content.heroSubtitle}
              onChange={(value) => updateField('heroSubtitle', value)}
              placeholder="اعرض الوظائف المنشورة فعليًا وقدّم عليها مباشرة..."
              rows={4}
            />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">صفحة من نحن</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            هذا المحتوى يظهر في {`about.html`} ويشرح هوية المنصة وطبيعة الخدمة بشكل مباشر وواضح.
          </p>
          <div className="mt-5 grid gap-4">
            <Field
              label="عنوان البطل"
              value={content.aboutHeroTitle}
              onChange={(value) => updateField('aboutHeroTitle', value)}
            />
            <Field
              label="الوصف الرئيسي"
              value={content.aboutHeroSubtitle}
              onChange={(value) => updateField('aboutHeroSubtitle', value)}
              rows={3}
            />
            <Field
              label="عنوان قسم النظرة العامة"
              value={content.aboutOverviewTitle}
              onChange={(value) => updateField('aboutOverviewTitle', value)}
            />
            <Field
              label="نص قسم النظرة العامة"
              value={content.aboutOverviewText}
              onChange={(value) => updateField('aboutOverviewText', value)}
              rows={4}
            />
            <Field
              label="عنوان قسم العملية"
              value={content.aboutProcessTitle}
              onChange={(value) => updateField('aboutProcessTitle', value)}
            />
            <Field
              label="نص قسم العملية"
              value={content.aboutProcessText}
              onChange={(value) => updateField('aboutProcessText', value)}
              rows={4}
            />
            <Field
              label="عنوان CTA"
              value={content.aboutCTAHeading}
              onChange={(value) => updateField('aboutCTAHeading', value)}
            />
            <Field
              label="نص CTA"
              value={content.aboutCTAText}
              onChange={(value) => updateField('aboutCTAText', value)}
              rows={3}
            />
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">صفحة تواصل معنا</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            عدّل بيانات الدعم والتواصل حتى تنعكس على {`contact.html`} وصفحات الدعم المرتبطة.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field
              label="عنوان الصفحة"
              value={content.contactHeroTitle}
              onChange={(value) => updateField('contactHeroTitle', value)}
            />
            <Field
              label="وصف الصفحة"
              value={content.contactHeroSubtitle}
              onChange={(value) => updateField('contactHeroSubtitle', value)}
              rows={3}
            />
            <Field
              label="النص التعريفي"
              value={content.contactIntroText}
              onChange={(value) => updateField('contactIntroText', value)}
              rows={4}
            />
            <Field
              label="رقم الهاتف"
              value={content.contactPhone}
              onChange={(value) => updateField('contactPhone', value)}
            />
            <Field
              label="البريد الإلكتروني"
              value={content.contactEmail}
              onChange={(value) => updateField('contactEmail', value)}
            />
            <Field
              label="الموقع"
              value={content.contactLocation}
              onChange={(value) => updateField('contactLocation', value)}
            />
            <Field
              label="ساعات العمل"
              value={content.contactHours}
              onChange={(value) => updateField('contactHours', value)}
            />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">سياسة الخصوصية</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">هذه القيم تظهر أعلى صفحة الخصوصية في {`privacy.html`}.</p>
          <div className="mt-5 space-y-4">
            <Field
              label="عنوان الصفحة"
              value={content.privacyHeroTitle}
              onChange={(value) => updateField('privacyHeroTitle', value)}
            />
            <Field
              label="وصف الصفحة"
              value={content.privacyHeroSubtitle}
              onChange={(value) => updateField('privacyHeroSubtitle', value)}
              rows={3}
            />
            <Field
              label="النص التعريفي"
              value={content.privacyIntroText}
              onChange={(value) => updateField('privacyIntroText', value)}
              rows={4}
            />
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/70 bg-white p-5 shadow-sm">
          <h3 className="font-display text-2xl font-bold text-slate-900">الشروط والأحكام</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">هذه القيم تظهر أعلى صفحة الشروط في {`terms.html`}.</p>
          <div className="mt-5 space-y-4">
            <Field
              label="عنوان الصفحة"
              value={content.termsHeroTitle}
              onChange={(value) => updateField('termsHeroTitle', value)}
            />
            <Field
              label="وصف الصفحة"
              value={content.termsHeroSubtitle}
              onChange={(value) => updateField('termsHeroSubtitle', value)}
              rows={3}
            />
            <Field
              label="النص التعريفي"
              value={content.termsIntroText}
              onChange={(value) => updateField('termsIntroText', value)}
              rows={4}
            />
          </div>
        </article>
      </section>
    </div>
  );
}
