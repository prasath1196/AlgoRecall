import React from 'react';

export const Toggle = ({ checked, onChange, label, disabled, id }) => (
    <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-indigo-600' : 'bg-gray-700'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

export const SectionShell = ({ icon, title, children, testId }) => (
    <div className="border-t border-gray-800 pt-6 space-y-3" data-testid={testId}>
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            {icon}
            {title}
        </h3>
        {children}
    </div>
);

export const inputCls = 'bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder:text-gray-600';
export const secondaryBtn = 'inline-flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-100 text-sm rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
