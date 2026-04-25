import React from 'react';
import { MailCheck } from 'lucide-react';
import PortalShell from './PortalShell';
import { buildSiteUrl } from '../lib/navigation';

interface CheckEmailProps {
  onNavigate: (page: 'login' | 'register' | 'check-email') => void;
  redirectTo?: string;
}

export default function CheckEmail({ onNavigate, redirectTo }: CheckEmailProps) {
  const nextTarget = redirectTo?.trim() ? redirectTo.trim() : 'company-dashboard.html';
  return (
    <PortalShell
      screenLabel="تحقق من بريدك"
      badge="تم إنشاء الحساب"
      title="شكراً لإنشاء حساب الشركة"
      description="تم إرسال بريد إلكتروني لتفعيل الحساب. افتح البريد واتبع التعليمات لإكمال عملية التسجيل."
      sideLabel="التحقق من البريد"
      sideTitle="الخطوة التالية لاستخدام حساب الشركة"
      sideDescription="بعد تفعيل البريد، يمكنك تسجيل الدخول والوصول إلى لوحة الشركة لإدارة الوظائف ومتابعة الطلبات."
      sideHighlights={[
        {
          title: 'تفعيل سريع',
          description: 'افتح البريد الإلكتروني واضغط على رابط التفعيل لتفعيل حساب الشركة مباشرة.',
        },
        {
          title: 'الدخول بعد التفعيل',
          description: 'بعد التفعيل، سجّل الدخول من نفس الشاشة وابدأ النشر والإدارة.',
        },
        {
          title: 'مشكلة في البريد؟',
          description: 'تحقق من صندوق الرسائل المزعجة أو أعد المحاولة بعد قليل إذا لم يصلك البريد.',
        },
      ]}
      footer={
        <div className="portal-note">
          لقد تم إرسال رسالة التفعيل. بعد تأكيد البريد اضغط على:{' '}
          <button type="button" onClick={() => onNavigate('login')} className="portal-inline-link">
            الذهاب إلى تسجيل الدخول
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-indigo-200/80 bg-indigo-50/80 p-8 text-center shadow-sm shadow-indigo-100/80">
          <MailCheck className="mx-auto h-16 w-16 text-indigo-600" />
          <h2 className="mt-6 text-3xl font-black text-slate-900">تم إنشاء حسابك بنجاح</h2>
          <p className="mt-4 max-w-xl mx-auto text-sm leading-7 text-slate-600">
            لقد أرسلنا رسالة تفعيل إلى بريدك الإلكتروني. يرجى فتح الرسالة والضغط على رابط التفعيل حتى تتمكن من تسجيل الدخول إلى لوحة الشركة.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
          <p className="text-base font-semibold">نصيحة سريعة</p>
          <ul className="mt-3 space-y-2 text-sm leading-6">
            <li>• تأكد من فحص صندوق الرسائل المزعجة إذا لم تصل الرسالة في دقائق.</li>
            <li>• إذا ضغطت على رابط التفعيل عدة مرات، قد تحتاج إلى إعادة فتح صفحة تسجيل الدخول.</li>
            <li>• بعد التفعيل، عد إلى صفحة تسجيل الدخول لتسجيل الدخول بحساب الشركة.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="portal-submit w-full sm:w-auto"
          >
            الانتقال إلى تسجيل الدخول
          </button>
          <a
            href={buildSiteUrl('index.html')}
            className="portal-inline-link"
          >
            العودة إلى الصفحة الرئيسية
          </a>
        </div>
      </div>
    </PortalShell>
  );
}
