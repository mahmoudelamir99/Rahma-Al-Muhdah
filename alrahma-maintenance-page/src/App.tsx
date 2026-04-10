import React from 'react';
import { Settings, Mail, Phone } from 'lucide-react';

const contactInfo = {
  phone: '01066718722',
  email: 'info@alrahma.com'
};

export default function App() {
  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-arabic"
      dir="rtl"
    >
      {/* Main Content Card */}
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {/* Top Brand Bar */}
        <div className="h-3 w-full flex">
          <div className="w-1/2 bg-[#e60000]"></div> {/* Alrahma Red */}
          <div className="w-1/2 bg-[#000080]"></div> {/* Alrahma Blue */}
        </div>

        <div className="p-8 md:p-12 flex flex-col items-center text-center">
          {/* Logo Placeholder / Brand Name */}
          <div className="mb-8 flex flex-col items-center">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 relative shadow-inner">
              <Settings className="w-12 h-12 text-[#e60000] animate-[spin_4s_linear_infinite]" />
              <div className="absolute inset-0 border-4 border-[#000080] rounded-full opacity-10"></div>
            </div>
            <h2 className="text-2xl font-bold text-[#e60000] uppercase tracking-wider font-sans">Alrahma</h2>
            <h3 className="text-lg font-semibold text-[#000080] uppercase tracking-widest font-sans">Recruitment</h3>
            <h3 className="text-xl font-bold text-[#e60000] mt-2 font-arabic">الرحمة للتوظيف</h3>
          </div>

          {/* Maintenance Message */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            الموقع تحت الصيانة
          </h1>
          <p className="text-lg text-[#000080] mb-6 font-semibold">
            نحن نعمل على تحسين تجربتك
          </p>
          <p className="text-gray-600 mb-10 max-w-lg leading-relaxed">
            نقوم حالياً ببعض التحديثات الضرورية على موقعنا الإلكتروني لشركة الرحمة للتوظيف. سنعود للعمل في أقرب وقت ممكن. شكراً لصبركم وتفهمكم.
          </p>

          {/* Contact Info */}
          <div className="w-full pt-8 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-4 uppercase tracking-wider font-semibold">
              للتواصل معنا في الحالات الطارئة:
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
              <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-2 text-[#000080] hover:text-[#e60000] transition-colors bg-gray-50 px-4 py-2 rounded-lg">
                <Mail className="w-5 h-5" />
                <span className="font-medium font-sans" dir="ltr">{contactInfo.email}</span>
              </a>
              <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-2 text-[#000080] hover:text-[#e60000] transition-colors bg-gray-50 px-4 py-2 rounded-lg">
                <Phone className="w-5 h-5" />
                <span className="font-medium font-sans" dir="ltr">{contactInfo.phone}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
