import React, { useMemo } from 'react';
import { Zap, Play, CheckCircle2, Calendar } from 'lucide-react';
import CalendarWidget from './CalendarWidget';
import MasteryWidget from './MasteryWidget';

const QueueView = ({ problems, onStartSession, onStartUpcoming, onProblemClick, onOpenSettings, maxLimit, todaysCount }) => {

    // 1. Calculate Due Problems (UTC Logic)
    const dueProblems = useMemo(() => {
        const now = new Date();
        const utcCutoff = new Date();
        utcCutoff.setUTCHours(23, 59, 59, 999);

        return problems.filter(p => new Date(p.next_review_at) <= utcCutoff);
    }, [problems]);

    // 2. Calculate Next Upcoming
    const nextUpcoming = useMemo(() => {
        const now = new Date();
        const utcCutoff = new Date();
        utcCutoff.setUTCHours(23, 59, 59, 999);

        const upcoming = problems.filter(p => new Date(p.next_review_at) > utcCutoff);
        if (upcoming.length === 0) return null;
        return upcoming.sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at))[0];
    }, [problems]);

    // 3. Stats for Widgets
    const masteryStats = useMemo(() => {
        const stats = { Unrated: 0, Learning: 0, Reviewing: 0, Mastered: 0 };
        problems.forEach(p => {
            const rating = p.review_history?.length > 0 ? p.review_history[p.review_history.length - 1].quality : null;
            if (rating === null) stats.Unrated++;
            else if (rating <= 2) stats.Learning++;
            else if (rating === 3) stats.Reviewing++;
            else if (rating >= 4) stats.Mastered++;
        });
        return stats;
    }, [problems]);

    // Limit Check
    const remainingLimit = maxLimit === 0 ? Infinity : Math.max(0, maxLimit - todaysCount);
    const isLimitReached = maxLimit > 0 && remainingLimit <= 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* LEFT COLUMN: Widgets */}
            <div className="flex flex-col gap-6">
                <MasteryWidget stats={masteryStats} total={problems.length} />
                <CalendarWidget data={problems} />
            </div>

            {/* MAIN COLUMN */}
            <div className="lg:col-span-3 space-y-8">

                {/* HERO SECTION */}
                {dueProblems.length > 0 ? (
                    /* ACTIVE STATE */
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl p-8 mb-6 flex flex-col items-center justify-center text-center">
                        <div className="bg-indigo-500/10 p-4 rounded-full mb-4">
                            <Zap size={32} className="text-indigo-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Ready for Recall</h2>
                        <p className="text-gray-400 mb-6 text-lg">
                            You have <span className="text-indigo-400 font-bold">{dueProblems.length}</span> recalls due today.
                        </p>

                        <button
                            onClick={() => onStartSession(dueProblems)}
                            disabled={isLimitReached}
                            className={`px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 ${isLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Play size={20} fill="currentColor" /> Start Recall Session
                        </button>

                        <div className="mt-4 text-xs text-gray-500 font-medium">
                            Daily Limit: <span className="text-gray-300">{todaysCount}</span> / {
                                maxLimit === 0
                                    ? (dueProblems.length > 0 ? dueProblems.length : todaysCount) // If unlimited: show due count, or if all done show todaysCount
                                    : maxLimit
                            } recalls completed
                        </div>
                    </div>
                ) : (
                    /* ZERO STATE */
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl p-8 mb-6 flex flex-col items-center justify-center text-center">
                        <div className="bg-green-500/10 p-4 rounded-full mb-4">
                            <CheckCircle2 size={32} className="text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">All Caught Up!</h2>
                        <p className="text-gray-400 mb-6 text-lg">
                            Great job! You've completed all your recalls for now.
                        </p>

                        <button
                            onClick={onStartUpcoming}
                            disabled={!nextUpcoming || isLimitReached}
                            className={`px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-lg border border-gray-700 hover:border-gray-600 transition-all flex items-center gap-2 ${(!nextUpcoming || isLimitReached) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Calendar size={20} /> Recall Upcoming
                        </button>

                        <div className="mt-4 text-xs text-gray-500 font-medium">
                            Daily Limit: <span className="text-gray-300">{todaysCount}</span> / {
                                maxLimit === 0 ? todaysCount : maxLimit
                            } recalls completed
                        </div>
                        {isLimitReached && maxLimit > 0 && (
                            <div className="mt-3 text-sm text-amber-400 font-medium bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20" data-testid="settings-hint">
                                🚫 Daily Limit Reached. <button onClick={onOpenSettings} className="underline hover:text-amber-300 font-bold">Adjust in Settings ⚙️</button>
                            </div>
                        )}
                    </div>
                )}


                {/* QUEUE LIST */}
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 font-bold text-white flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        {dueProblems.length > 0 ? "Today's Queue" : "Upcoming Reviews"}
                    </div>
                    <div className="divide-y divide-gray-800/50">
                        {(dueProblems.length > 0 ? dueProblems : problems.filter(p => new Date(p.next_review_at) > new Date()).sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at)).slice(0, 5)).map(p => (
                            <div
                                key={p.url}
                                className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors cursor-pointer"
                                onClick={() => onProblemClick && onProblemClick(p)}
                            >
                                <div>
                                    <h4 className="font-medium text-white text-sm">{p.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-1.5 py-0.5 rounded border border-gray-700 text-gray-400">{p.difficulty}</span>
                                        <span className="text-xs text-gray-500">{p.platform}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 font-mono">
                                        {new Date(p.next_review_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-0.5">
                                        {(() => {
                                            const dueTime = new Date(p.next_review_at).getTime();
                                            const endOfDay = new Date();
                                            endOfDay.setUTCHours(23, 59, 59, 999);
                                            return dueTime <= endOfDay.getTime() ? 'Due Today' : 'Upcoming';
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {problems.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                No problems tracked yet. Add one to get started!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QueueView;
