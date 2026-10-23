import React, { useState, useEffect, useRef } from 'react';
import { HINT_LEVELS, levelLabel, errorMessage, buildHintPayload, fetchHint } from './hintUtils';

/**
 * Progressive AI hints. Never auto-requests. Resets when `problem.url` changes.
 * onHintsUsed(count) is called whenever the count of received hints changes.
 */
const HintPanel = ({ problem, userCode, onHintsUsed }) => {
    const [hints, setHints] = useState([]); // [{ level, text }]
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(null);
    const urlRef = useRef(problem.url);

    useEffect(() => {
        urlRef.current = problem.url;
        setHints([]); setError(null); setLoading(false); setRemaining(null);
    }, [problem.url]);

    const nextLevel = hints.length + 1;
    const done = nextLevel > HINT_LEVELS.length;

    const request = async () => {
        if (loading || done) return;
        const url = problem.url;
        setLoading(true); setError(null);
        const res = await fetchHint(buildHintPayload(problem, userCode, nextLevel));
        if (urlRef.current !== url) return; // problem changed while loading
        setLoading(false);
        if (res.error || !res.hint) {
            setError(errorMessage(res.error ? res : 'generic'));
            return;
        }
        const next = [...hints, { level: nextLevel, text: res.hint }];
        setHints(next);
        if (typeof res.remaining_today === 'number') setRemaining(res.remaining_today);
        if (onHintsUsed) onHintsUsed(next.length);
    };

    return (
        <div className="border-t border-gray-800 bg-gray-900/40 px-4 py-3" data-testid="hint-panel">
            <div className="flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={request}
                    disabled={loading || done}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                    {loading
                        ? 'Thinking…'
                        : done
                            ? 'All hints used'
                            : hints.length === 0
                                ? 'Stuck? Get a hint'
                                : `Next hint: ${levelLabel(nextLevel)}`}
                </button>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span>{HINT_LEVELS.map((l) => l.label).join(' → ')}</span>
                    {remaining !== null && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300" data-testid="hint-remaining">
                            {remaining} left today
                        </span>
                    )}
                </div>
            </div>
            {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
            {loading && <span className="sr-only" role="status">Loading hint</span>}
            {hints.length > 0 && (
                <ol className="mt-3 space-y-2" aria-label="Hints">
                    {hints.map((h) => (
                        <li key={h.level} className="rounded-lg border border-gray-800 bg-gray-950 p-3" data-testid={`hint-${h.level}`}>
                            <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                                Level {h.level} · {levelLabel(h.level)}
                            </div>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{h.text}</p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default HintPanel;
