import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlameIcon, TargetIcon, LockIcon, CloudIcon } from './icons';
import { fetchStatsSafe } from './syncApi';
import './sync.css';

export const MILESTONES = [3, 7, 30, 100];

const card = 'bg-gray-900 rounded-2xl border border-gray-800 p-5';

export const StreakCard = ({ current = 0, longest = 0 }) => {
    const milestone = MILESTONES.includes(current);
    return (
        <div className={`${card} relative overflow-hidden ${milestone ? 'ar-glow border-orange-500/40' : ''}`} data-testid="streak-card">
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Streak</div>
            <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${current > 0 ? 'bg-orange-500/10 text-orange-400' : 'bg-gray-800 text-gray-600'} ${milestone ? 'ar-pop' : ''}`} data-testid={milestone ? 'streak-milestone' : undefined}>
                    <FlameIcon size={28} />
                </div>
                <div>
                    <div className="text-3xl font-bold text-white leading-none">{current}<span className="text-sm text-gray-500 font-medium ml-1">{current === 1 ? 'day' : 'days'}</span></div>
                    <div className="text-xs text-gray-500 mt-1">Longest: <span className="text-gray-300">{longest}</span></div>
                </div>
            </div>
            {milestone && (
                <>
                    <p className="text-xs text-orange-300 mt-3" role="status">{current}-day milestone - keep it burning!</p>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <span key={i} className="ar-spark bg-orange-400" aria-hidden="true"
                            style={{ left: `${18 + i * 6}%`, top: '38%', animationDelay: `${i * 120}ms`, background: i % 2 ? '#fb923c' : '#818cf8' }} />
                    ))}
                </>
            )}
        </div>
    );
};

export const RetentionRing = ({ rate }) => {
    const r = 34; const c = 2 * Math.PI * r;
    const has = typeof rate === 'number';
    const pct = has ? Math.round(rate * 100) : null;
    const dash = has ? c * Math.min(1, Math.max(0, rate)) : 0;
    return (
        <div className={card} data-testid="retention-card">
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">Retention</div>
            <div className="flex items-center gap-4">
                <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={has ? `Retention rate ${pct} percent` : 'No retention data yet'}>
                    <circle cx="44" cy="44" r={r} fill="none" stroke="#1f2937" strokeWidth="8" />
                    <circle cx="44" cy="44" r={r} fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${dash} ${c}`} transform="rotate(-90 44 44)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                    <text x="44" y="49" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">{has ? `${pct}%` : '-'}</text>
                </svg>
                <p className="text-xs text-gray-500 leading-relaxed">Share of reviews rated 3 or higher.</p>
            </div>
        </div>
    );
};

export const FocusMode = ({ patterns = [], onPractice }) => (
    <div className={`${card} flex flex-col`} data-testid="focus-card">
        <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <TargetIcon size={14} /> Focus mode
        </div>
        {patterns.length === 0 ? (
            <p className="text-sm text-gray-500">No weak spots yet - keep reviewing!</p>
        ) : (
            <>
                <ul className="space-y-2 mb-4">
                    {patterns.map((p) => (
                        <li key={p.pattern} className="flex items-center justify-between text-sm">
                            <span className="text-gray-200 truncate pr-2">{p.pattern}</span>
                            <span className="text-xs text-gray-500 font-mono shrink-0">
                                <span className="text-amber-400">{Math.round((p.retention ?? 0) * 100)}%</span>
                                {' '}&middot; avg {Number(p.avg_quality ?? 0).toFixed(1)}
                            </span>
                        </li>
                    ))}
                </ul>
                <button type="button" onClick={() => onPractice && onPractice(patterns.map((p) => p.pattern))}
                    className="mt-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                    Practice these
                </button>
            </>
        )}
    </div>
);

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const LEVEL_CLS = ['bg-gray-800/70', 'bg-indigo-900', 'bg-indigo-700', 'bg-indigo-500', 'bg-indigo-300'];

export function buildHeatmap(activeDays = [], today = new Date()) {
    const counts = {};
    let max = 0;
    activeDays.forEach((d) => { counts[d.day] = d.count; if (d.count > max) max = d.count; });
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(start.getDate() - end.getDay() - 52 * 7); // Sunday, 52 weeks before this week's Sunday
    const cells = [];
    for (let i = 0; i < 53 * 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        if (d > end) { cells.push(null); continue; }
        const k = key(d); const count = counts[k] || 0;
        const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
        cells.push({ day: k, count, level });
    }
    return cells;
}

export const YearHeatmap = ({ activeDays }) => {
    const cells = useMemo(() => buildHeatmap(activeDays), [activeDays]);
    const total = (activeDays || []).reduce((s, d) => s + d.count, 0);
    return (
        <div className={`${card} lg:col-span-3`} data-testid="year-heatmap">
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider font-semibold text-gray-500">Last 12 months</div>
                <div className="text-xs text-gray-500">{total} reviews &middot; {(activeDays || []).length} active days</div>
            </div>
            <div className="overflow-x-auto pb-1" tabIndex={0} role="group" aria-label="Review activity over the last 12 months">
                <div className="grid grid-flow-col grid-rows-7 gap-[3px] w-max">
                    {cells.map((c, i) => c ? (
                        <div key={c.day} data-testid="heat-cell" data-level={c.level}
                            title={`${c.count} review${c.count === 1 ? '' : 's'} on ${c.day}`}
                            aria-label={`${c.count} reviews on ${c.day}`}
                            className={`w-[11px] h-[11px] rounded-[2px] ${LEVEL_CLS[c.level]}`} />
                    ) : <div key={`e${i}`} className="w-[11px] h-[11px]" />)}
                </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500 justify-end">
                Less {LEVEL_CLS.map((c, i) => <span key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />)} More
            </div>
        </div>
    );
};

export const useStats = () => useQuery({
    queryKey: ['stats'],
    queryFn: fetchStatsSafe,
    staleTime: 60 * 1000,
    retry: false,
});

const InsightsSection = ({ onPractice, onSignIn }) => {
    const { data: stats, isLoading } = useStats();

    if (isLoading) return null;

    if (!stats) {
        return (
            <section aria-label="Cloud insights" className="mt-8">
                <div className="bg-gradient-to-br from-indigo-950/40 to-gray-900 rounded-2xl border border-indigo-500/20 p-6 flex flex-col sm:flex-row items-center gap-4" data-testid="insights-locked">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400"><LockIcon size={24} /></div>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-white font-bold">Sign in to unlock cloud insights</h3>
                        <p className="text-sm text-gray-400">Streaks, retention, weak-spot practice and a 12-month activity map - synced across all your devices.</p>
                    </div>
                    {onSignIn && (
                        <button type="button" onClick={onSignIn}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                            <CloudIcon size={16} /> Sign in
                        </button>
                    )}
                </div>
            </section>
        );
    }

    return (
        <section aria-label="Cloud insights" className="mt-8" data-testid="insights">
            <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><CloudIcon size={16} className="text-indigo-400" /> Cloud insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <StreakCard current={stats.current_streak || 0} longest={stats.longest_streak || 0} />
                <RetentionRing rate={stats.retention_rate == null ? null : Number(stats.retention_rate)} />
                <FocusMode patterns={stats.weakest_patterns || []} onPractice={onPractice} />
                <YearHeatmap activeDays={stats.active_days || []} />
            </div>
        </section>
    );
};

export default InsightsSection;
