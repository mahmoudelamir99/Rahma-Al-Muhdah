import React from 'react';

const countries = [
  { code: '+20', name: 'مصر' },
  { code: '+966', name: 'السعودية' },
  { code: '+971', name: 'الإمارات' },
  { code: '+965', name: 'الكويت' },
  { code: '+974', name: 'قطر' },
  { code: '+973', name: 'البحرين' },
  { code: '+968', name: 'عُمان' },
  { code: '+962', name: 'الأردن' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
}

export default function PhoneInput({ value, onChange, countryCode, onCountryCodeChange }: PhoneInputProps) {
  return (
    <div className="flex min-h-10 w-full overflow-hidden rounded-[16px] border border-[#cfe0e1] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus-within:border-[#1f6b7a] focus-within:ring-4 focus-within:ring-[#1f6b7a]/12">
      <select
        value={countryCode}
        onChange={(event) => onCountryCodeChange(event.target.value)}
        className="min-w-[6.5rem] border-l border-[#d9e7e8] bg-[#eef6f6] px-3 text-[0.8rem] font-extrabold text-[#0f3d4c] outline-none sm:min-w-[7rem]"
        dir="rtl"
        aria-label="مفتاح الدولة"
      >
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name} ({country.code})
          </option>
        ))}
      </select>

      <input
        type="tel"
        dir="ltr"
        className="min-w-0 flex-1 bg-transparent px-3 text-left text-[0.92rem] font-semibold text-slate-900 outline-none placeholder:text-[#90a1a5]"
        placeholder="10XXXXXXXX"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        autoComplete="tel-national"
        inputMode="tel"
      />
    </div>
  );
}
