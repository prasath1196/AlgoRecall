import React from 'react';
import { TrendingUp } from 'lucide-react';

const ProgressBar = ({ value, max, color = "bg-green-500" }) => {
    const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
            <div
                className={`h-full ${color} transition-all duration-500 ease-out`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};

const MasteryWidget = ({ stats, total }) => {
    // Helper for percentage
    const getPercent = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

    return (
        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
            <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
                <TrendingUp size={16} /> Mastery Level
            </h3>

            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                <div className="text-center">
                    <div className="text-2xl font-bold text-white">{total}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Tracked</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.Mastered}</div>
                    <div className="text-xs text-blue-400/70 uppercase tracking-wide">Mastered</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-400">
                        {getPercent(stats.Mastered)}%
                    </div>
                    <div className="text-xs text-indigo-400/70 uppercase tracking-wide">Rate</div>
                </div>
            </div>
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 text-blue-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span>Mastered</span>
                        </div>
                        <span className="text-gray-500">{stats.Mastered}</span>
                    </div>
                    <ProgressBar value={stats.Mastered} max={total} color="bg-blue-500" />
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 text-green-400">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>Reviewing</span>
                        </div>
                        <span className="text-gray-500">{stats.Reviewing}</span>
                    </div>
                    <ProgressBar value={stats.Reviewing} max={total} color="bg-green-500" />
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 text-orange-400">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            <span>Learning</span>
                        </div>
                        <span className="text-gray-500">{stats.Learning}</span>
                    </div>
                    <ProgressBar value={stats.Learning} max={total} color="bg-orange-500" />
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 text-gray-400">
                            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                            <span>Unrated</span>
                        </div>
                        <span className="text-gray-500">{stats.Unrated}</span>
                    </div>
                    <ProgressBar value={stats.Unrated} max={total} color="bg-gray-600" />
                </div>
            </div>
        </div>
    );
};

export default MasteryWidget;
