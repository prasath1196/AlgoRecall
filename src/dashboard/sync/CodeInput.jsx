import React, { useRef } from 'react';

const LEN = 6;

const CodeInput = ({ value, onChange, onComplete, disabled, hasError }) => {
    const refs = useRef([]);
    const digits = Array.from({ length: LEN }, (_, i) => value[i] || '');

    const focusAt = (i) => { const el = refs.current[Math.max(0, Math.min(LEN - 1, i))]; if (el) el.focus(); };

    const commit = (next) => {
        onChange(next);
        if (next.length === LEN && onComplete) onComplete(next);
    };

    const handleChange = (i, e) => {
        const typed = e.target.value.replace(/\D/g, '');
        if (!typed) return;
        // Typing (or autofill) of one or more digits starting at slot i
        const next = (value.slice(0, i) + typed).slice(0, LEN);
        commit(next);
        focusAt(Math.min(next.length, LEN - 1));
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (digits[i]) commit(value.slice(0, i) + value.slice(i + 1));
            else if (i > 0) { commit(value.slice(0, i - 1) + value.slice(i)); focusAt(i - 1); }
        } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1); }
    };

    const handlePaste = (e) => {
        const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, LEN);
        if (!text) return;
        e.preventDefault();
        commit(text);
        focusAt(Math.min(text.length, LEN - 1));
    };

    return (
        <div role="group" aria-label="6-digit verification code" className="flex gap-2 justify-center">
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    value={d}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={LEN}
                    disabled={disabled}
                    aria-label={`Digit ${i + 1} of ${LEN}`}
                    aria-invalid={hasError || undefined}
                    className={`w-11 h-14 text-center text-xl font-mono bg-gray-950 border rounded-lg text-white outline-none transition-colors focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${hasError ? 'border-red-500/60' : 'border-gray-700'}`}
                />
            ))}
        </div>
    );
};

export default CodeInput;
