import React from 'react';

const countries = [
  { code: '+20', name: 'مصر' },
  { code: '+966', name: 'السعودية' },
  { code: '+971', name: 'الإمارات' },
  { code: '+965', name: 'الكويت' },
  { code: '+974', name: 'قطر' },
  { code: '+973', name: 'البحرين' },
  { code: '+968', name: 'عمان' },
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
    <div className="flex min-h-10 w-full overflow-hidden rounded-[14px] border border-[#d9e0e8] bg-[#fbfcfd] transition focus-within:border-[#b88f47] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#b88f47]/20">
      <select
        value={countryCode}
        onChange={(event) => onCountryCodeChange(event.target.value)}
        className="min-w-[6.8rem] border-l border-[#e3e8ee] bg-[#f7f9fb] px-2.5 text-[0.85rem] font-bold text-[#24364f] outline-none sm:min-w-[7.4rem]"
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
        className="min-w-0 flex-1 bg-transparent px-3 text-left text-[0.95rem] text-slate-900 outline-none placeholder:text-[#95a2b1]"
        placeholder="10XXXXXXXX"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        autoComplete="tel-national"
        inputMode="tel"
      />
    </div>
  );
}
