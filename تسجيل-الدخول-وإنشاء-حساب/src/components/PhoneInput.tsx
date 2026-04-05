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
    <div className="portal-phone">
      <select
        value={countryCode}
        onChange={(event) => onCountryCodeChange(event.target.value)}
        className="portal-phone-code"
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
        className="portal-phone-input"
        placeholder="10XXXXXXXX"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        autoComplete="tel-national"
        inputMode="tel"
      />
    </div>
  );
}
