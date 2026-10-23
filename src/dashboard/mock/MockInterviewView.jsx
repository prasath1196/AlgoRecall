import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ExternalLink, Clock, X } from 'lucide-react';
import { pickProblems, getPatterns } from './pickProblems';

const COUNTS = [3, 5];
const MINUTES = [15, 25, 45];
const SCORES = [0, 1, 2, 3, 4, 5];

const fmt = (secs) => {
    const s = Math.max(0, secs);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const Chip = ({ active, onClick, children, label }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${active ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}`}
    >
        {children}
    </button>
);

const Shell = ({ children }) => (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center p-4 sm:p-8">
        <div className="w-full max-w-3xl motion-safe:animate-in motion-safe:fade-in duration-300">{children}</div>
    </div>
);

export const MockInterviewView = ({ problems = [], weakPatterns = [], onExit, onSaveRating }) => {
    const [phase, setPhase] = useState('setup'); // setup | interview | summary
    const [count, setCount] = useState(3);
    const [minutes, setMinutes] = useState(25);
    const [focusWeak, setFocusWeak] = useState(true);
    const [picked, setPicked] = useState([]);
    const [idx, setIdx] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [paused, setPaused] = useState(false);
    const [notes, setNotes] = useState({});
    const [revealed, setRevealed] = useState({});
    const [scores, setScores] = useState({}); // url -> quality
    const [used, setUsed] = useState({}); // url -> seconds used
    const remainingRef = useRef(0);

    const available = useMemo(() => problems.filter((p) => !p._deleted_at), [problems]);
    const current = picked[idx];
    const timeUp = remaining <= 0;

    const begin = (chosen) => {
        if (!chosen.length) return;
        setPicked(chosen); setIdx(0); setScores({}); setUsed({}); setNotes({}); setRevealed({});
        setRemaining(minutes * 60); remainingRef.current = minutes * 60; setPaused(false);
        setPhase('interview');
    };

    const start = () => begin(pickProblems(available, { count, weakPatterns: focusWeak ? weakPatterns : [] }));

    // Countdown
    useEffect(() => {
        if (phase !== 'interview' || paused) return undefined;
        const t = setInterval(() => {
            setRemaining((r) => {
                const n = Math.max(0, r - 1);
                remainingRef.current = n;
                return n;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [phase, paused, idx]);

    const finishProblem = useCallback((quality) => {
        const p = picked[idx];
        const spent = minutes * 60 - remainingRef.current;
        setScores((s) => ({ ...s, [p.url]: quality }));
        setUsed((u) => ({ ...u, [p.url]: spent }));
        if (onSaveRating) onSaveRating(p, quality);
        if (idx < picked.length - 1) {
            setIdx(idx + 1); setRemaining(minutes * 60); remainingRef.current = minutes * 60; setPaused(false);
        } else {
            setPhase('summary');
        }
    }, [picked, idx, minutes, onSaveRating]);

    const reveal = () => {
        if (!timeUp && !window.confirm('Reveal your saved solution before time is up?')) return;
        setRevealed((r) => ({ ...r, [current.url]: true }));
    };

    // ---------- SETUP ----------
    if (phase === 'setup') {
        return (
            <Shell>
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl font-bold">Mock interview</h1>
                        <p className="text-gray-400 text-sm mt-1">Timed practice with problems picked from your library.</p>
                    </div>
                    {onExit && (
                        <button onClick={onExit} aria-label="Exit mock interview" className="p-2 rounded-full hover:bg-gray-800 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                            <X size={18} />
                        </button>
                    )}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-2xl">
                    <fieldset>
                        <legend className="text-xs uppercase tracking-wider text-gray-500 mb-2">Problems</legend>
                        <div className="flex gap-2">
                            {COUNTS.map((c) => <Chip key={c} active={count === c} onClick={() => setCount(c)} label={`${c} problems`}>{c}</Chip>)}
                        </div>
                    </fieldset>
                    <fieldset>
                        <legend className="text-xs uppercase tracking-wider text-gray-500 mb-2">Minutes per problem</legend>
                        <div className="flex gap-2">
                            {MINUTES.map((m) => <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} label={`${m} minutes`}>{m}</Chip>)}
                        </div>
                    </fieldset>
                    <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={focusWeak} onChange={(e) => setFocusWeak(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                        Focus weak patterns
                        {weakPatterns.length > 0 && <span className="text-xs text-gray-500">({weakPatterns.join(', ')})</span>}
                    </label>
                    {available.length === 0 && <p className="text-sm text-yellow-400">Add some problems first to start a mock interview.</p>}
                    <button
                        onClick={start}
                        disabled={available.length === 0}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-lg font-medium shadow-lg shadow-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                    >
                        Start interview
                    </button>
                </div>
            </Shell>
        );
    }

    // ---------- SUMMARY ----------
    if (phase === 'summary') {
        const entries = picked.map((p) => ({ p, q: scores[p.url] ?? 0, t: used[p.url] ?? 0 }));
        const pct = Math.round((entries.reduce((s, e) => s + e.q, 0) / (entries.length * 5)) * 100);
        const totalUsed = entries.reduce((s, e) => s + e.t, 0);
        const byPattern = {};
        entries.forEach(({ p, q }) => {
            const tags = getPatterns(p);
            (tags.length ? tags : ['Untagged']).forEach((t) => {
                byPattern[t] = byPattern[t] || { sum: 0, n: 0 };
                byPattern[t].sum += q; byPattern[t].n += 1;
            });
        });
        const rows = Object.entries(byPattern).map(([tag, v]) => ({ tag, pct: Math.round((v.sum / (v.n * 5)) * 100), n: v.n }));
        const weak = rows.filter((r) => r.pct < 60).map((r) => r.tag);
        const practiceWeak = () => begin(pickProblems(available, { count, weakPatterns: weak }));
        return (
            <Shell>
                <h1 className="text-2xl font-bold mb-6">Interview summary</h1>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className="text-xs uppercase tracking-wider text-gray-500">Overall score</div>
                        <div className="text-4xl font-bold mt-1" data-testid="overall-score">{pct}%</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                        <div className="text-xs uppercase tracking-wider text-gray-500">Time used</div>
                        <div className="text-4xl font-bold mt-1" data-testid="time-used">{fmt(totalUsed)}</div>
                    </div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
                    <h2 className="text-sm font-semibold text-gray-300 mb-3">By pattern</h2>
                    <ul className="space-y-3">
                        {rows.map((r) => (
                            <li key={r.tag} data-testid={`pattern-${r.tag}`}>
                                <div className="flex justify-between text-sm"><span>{r.tag} <span className="text-gray-500">({r.n})</span></span><span>{r.pct}%</span></div>
                                <div className="h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden"><div className={`h-full ${r.pct < 60 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${r.pct}%` }} /></div>
                            </li>
                        ))}
                    </ul>
                </div>
                <ul className="mb-6 divide-y divide-gray-800 bg-gray-900 border border-gray-800 rounded-2xl">
                    {entries.map(({ p, q }) => (
                        <li key={p.url} className="flex justify-between px-5 py-3 text-sm"><span>{p.title}</span><span className="text-gray-400">{q}/5</span></li>
                    ))}
                </ul>
                <div className="flex gap-3">
                    {weak.length > 0 && (
                        <button onClick={practiceWeak} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                            Practice weak ones
                        </button>
                    )}
                    <button onClick={onExit} className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-lg font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                        Exit
                    </button>
                </div>
            </Shell>
        );
    }

    // ---------- INTERVIEW ----------
    const low = remaining <= 60 && !timeUp;
    return (
        <Shell>
            <div className="flex justify-between items-center mb-4 text-sm text-gray-400">
                <span>Problem {idx + 1} of {picked.length}</span>
                {onExit && <button onClick={onExit} className="text-red-400 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded">End interview</button>}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex flex-wrap justify-between items-start gap-3">
                    <div>
                        <h2 className="text-xl font-bold">{current.title}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${current.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400' : current.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>{current.difficulty}</span>
                        </div>
                    </div>
                    <a href={current.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                        <ExternalLink size={14} /> Open problem
                    </a>
                </div>

                <div className="flex items-center gap-3">
                    <Clock size={16} />
                    <span
                        role="timer"
                        aria-label="Time remaining"
                        data-testid="timer"
                        className={`font-mono text-3xl tabular-nums ${timeUp ? 'text-red-400' : low ? 'text-yellow-400 motion-safe:animate-pulse' : 'text-white'}`}
                    >
                        {fmt(remaining)}
                    </span>
                    <button onClick={() => setPaused((p) => !p)} disabled={timeUp} className="ml-2 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    {timeUp && <span className="text-sm text-red-400" role="status">Time is up</span>}
                </div>

                <div>
                    <label htmlFor="mock-notes" className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Scratchpad</label>
                    <textarea
                        id="mock-notes"
                        value={notes[current.url] || ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [current.url]: e.target.value }))}
                        rows={6}
                        placeholder="Approach, complexity, edge cases…"
                        className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 font-mono focus:border-indigo-500 outline-none"
                    />
                </div>

                <div>
                    {revealed[current.url] ? (
                        <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-green-400 overflow-auto whitespace-pre" data-testid="saved-solution">{current.code || '// No saved code'}</pre>
                    ) : (
                        <button onClick={reveal} className="text-sm text-indigo-400 hover:text-indigo-300 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded">
                            Reveal my saved solution
                        </button>
                    )}
                </div>

                <div role="group" aria-labelledby="mock-score-label">
                    <div id="mock-score-label" className="text-xs uppercase tracking-wider text-gray-500 mb-2">Self-score (0 = blank, 5 = perfect)</div>
                    <div className="flex flex-wrap gap-2">
                        {SCORES.map((q) => (
                            <button key={q} onClick={() => finishProblem(q)} aria-label={`Score ${q}`} className="w-11 h-11 rounded-lg bg-gray-800 hover:bg-indigo-600 border border-gray-700 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Shell>
    );
};

export default MockInterviewView;
