import { Sparkles } from 'lucide-react';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#12293b]">{title}</h1>
        <p className="mt-1 text-sm text-[#667784]">هذه الصفحة قيد التطوير حاليًا داخل لوحة التحكم.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-[#d7dde3] bg-white px-6 py-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f5f9] text-[#26445d]">
          <Sparkles size={24} />
        </div>
        <h3 className="text-lg font-bold text-[#12293b]">قريبًا</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#667784]">
          جاري العمل على تطوير واجهة {title} بالكامل، وستكون متاحة داخل لوحة التحكم في التحديث القادم.
        </p>
      </div>
    </div>
  );
}
