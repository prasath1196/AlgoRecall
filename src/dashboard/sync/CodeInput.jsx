import React from 'react';

export const MIN_CODE_LEN = 6;
export const MAX_CODE_LEN = 10;

// Supabase OTP length is configurable (6-10 digits), so this is a single length-agnostic input.
// Typing never auto-submits (length unknown); pasting a complete 6-10 digit code calls onComplete.
const CodeInput = ({ value, onChange, onComplete, onSubmit, disabled, hasError }) => {
    const clean = (s) => (s || '').replace(/\D/g, '').slice(0, MAX_CODE_LEN);

    const handlePaste = (e) => {
        const raw = e.clipboardData?.getData('text') || '';
        const text = clean(raw);
        if (!text) return;
        e.preventDefault();
        onChange(text);
        if (text.length >= MIN_CODE_LEN && onComplete) onComplete(text);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit(); }
    };

    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(clean(e.target.value))}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={MAX_CODE_LEN}
            disabled={disabled}
            aria-label="Sign-in code"
            aria-invalid={hasError || undefined}
            placeholder="Enter code"
            className={`w-full h-14 text-center text-2xl tracking-[0.4em] font-mono bg-gray-950 border rounded-lg text-white placeholder:text-base placeholder:tracking-normal placeholder:text-gray-600 outline-none transition-colors focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${hasError ? 'border-red-500/60' : 'border-gray-700'}`}
        />
    );
};

export default CodeInput;
