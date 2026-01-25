import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';

const CalendarWidget = ({ data }) => {
    // 1. Process Data -> Map of DateString (YYYY-MM-DD): Count
    const { reviewCounts, currentStreak, maxStreak, activeDays } = useMemo(() => {
        const counts = {};
        let total = 0;

        // Populate counts
        data.forEach(p => {
            if (p.review_history && Array.isArray(p.review_history)) {
                p.review_history.forEach(log => {
                    // Extract YYYY-MM-DD
                    const dateStr = log.date.split('T')[0];
                    counts[dateStr] = (counts[dateStr] || 0) + 1;
                    total++;
                });
            }
        });

        // Streak Calculation
        const dates = Object.keys(counts).sort();
        let curr = 0;
        let max = 0;
        if (dates.length > 0) {
            let prev = new Date(dates[0]);
            curr = 1;
            max = 1;
            for (let i = 1; i < dates.length; i++) {
                const d = new Date(dates[i]);
                const diff = (d - prev) / (1000 * 60 * 60 * 24);
                if (diff === 1) curr++;
                else if (diff > 1) curr = 1;
                if (curr > max) max = curr;
                prev = d;
            }
        }

        // Active Days
        const active = dates.length;

        return { reviewCounts: counts, totalReviews: total, currentStreak: curr, maxStreak: max, activeDays: active };
    }, [data]);

    // 2. Generate Calendar Grid (Current Month or custom window)
    const { days, monthName, year } = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const monthName = today.toLocaleString('default', { month: 'long' });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

        const gridDays = [];

        // Previous month padding
        for (let i = 0; i < startDayOfWeek; i++) {
            gridDays.push(null);
        }

        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = date.toISOString().split('T')[0];
            gridDays.push({
                day: i,
                date: dateStr,
                count: reviewCounts[dateStr] || 0
            });
        }

        return { days: gridDays, monthName, year };
    }, [reviewCounts]);

    const getLevelColor = (count) => {
        if (!count) return 'bg-gray-800 text-gray-400';
        if (count <= 2) return 'bg-green-900/50 text-green-200 border border-green-800';
        if (count <= 5) return 'bg-green-700/50 text-green-100 border border-green-600';
        return 'bg-green-500 text-white font-bold shadow-green-500/20 shadow-lg';
    };

    return (
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h3 className="text-gray-100 font-semibold flex items-center gap-2">
                    <Calendar size={18} className="text-indigo-500" />
                    Consistency
                </h3>
                <div className="text-xs text-gray-500 font-mono bg-gray-950 px-2 py-1 rounded border border-gray-800">
                    {monthName} {year}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800/50">
                    <span className="block text-xs text-gray-500 mb-1">Current Streak</span>
                    <span className="text-xl font-bold text-white flex items-center gap-1">
                        {currentStreak} <span className="text-xs text-gray-600 font-normal">days</span>
                    </span>
                </div>
                <div className="bg-gray-950 p-3 rounded-lg border border-gray-800/50">
                    <span className="block text-xs text-gray-500 mb-1">Max Streak</span>
                    <span className="text-xl font-bold text-gray-300 flex items-center gap-1">
                        {maxStreak} <span className="text-xs text-gray-600 font-normal">days</span>
                    </span>
                </div>
            </div>

            <div>
                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={`${d}-${i}`} className="text-[10px] text-gray-600 font-medium">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                    {days.map((d, i) => (
                        d === null ? (
                            <div key={`param-${i}`} className="aspect-square"></div>
                        ) : (
                            <div
                                key={d.date}
                                className={`aspect-square rounded-lg flex items-center justify-center text-xs transition-all relative group cursor-default ${getLevelColor(d.count)}`}
                            >
                                {d.day}
                                {d.count > 0 && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 border border-gray-700">
                                        {d.count} reviews
                                    </div>
                                )}
                            </div>
                        )
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800/50">
                <span>Total Active Days</span>
                <span className="text-gray-300 font-medium">{activeDays}</span>
            </div>
        </div>
    );
};

export default CalendarWidget;
