import React, { useState, useMemo } from 'react';
import {
    Search, Filter, Calendar, BarChart2, Tag, Layers,
    MoreHorizontal, ExternalLink, Pencil, Trash2, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';

const LibraryView = ({ problems, onEdit, onDelete, onProblemClick }) => {
    // --- FILTERS STATE ---
    const [searchText, setSearchText] = useState('');
    const [filters, setFilters] = useState({
        pattern: 'All Patterns',
        difficulty: 'All Difficulties',
        platform: 'All Platforms',
        status: 'All Status',
        mastery: 'All Mastery'
    });

    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // --- SORTING STATE ---
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // --- DERIVED LISTS FOR FILTERS ---
    const uniquePatterns = useMemo(() => {
        const patterns = new Set();
        problems.forEach(p => {
            if (Array.isArray(p.pattern_tag)) p.pattern_tag.forEach(t => patterns.add(t));
            else if (p.pattern_tag) patterns.add(p.pattern_tag);
        });
        return ['All Patterns', ...Array.from(patterns).sort()];
    }, [problems]);

    // --- FILTER LOGIC ---
    const filteredProblems = useMemo(() => {
        return problems.filter(p => {
            // 1. Search
            if (searchText) {
                const lowerSearch = searchText.toLowerCase();
                if (!p.title.toLowerCase().includes(lowerSearch) &&
                    !p.url.toLowerCase().includes(lowerSearch)) return false;
            }

            // 2. Pattern
            if (filters.pattern !== 'All Patterns') {
                const pTags = Array.isArray(p.pattern_tag) ? p.pattern_tag : [p.pattern_tag];
                if (!pTags.includes(filters.pattern)) return false;
            }

            // 3. Difficulty
            if (filters.difficulty !== 'All Difficulties' && p.difficulty !== filters.difficulty) return false;

            // 4. Platform
            if (filters.platform !== 'All Platforms' && p.platform !== filters.platform) return false;

            // 5. Status logic (Simplified for demo)
            const isDue = new Date(p.next_review_at) <= new Date();
            if (filters.status === 'Scheduled' && isDue) return false; // "Scheduled" means future? Or just present in DB?
            if (filters.status === 'Due Now' && !isDue) return false;

            // 6. Mastery logic
            // ... (Implementation can be refined based on specific mastery definition)

            return true;
        });
    }, [problems, searchText, filters]);

    // Reset page when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [searchText, filters]);

    // --- SORTING LOGIC ---
    const sortedProblems = useMemo(() => {
        if (!sortConfig.key) return filteredProblems;

        return [...filteredProblems].sort((a, b) => {
            let aVal, bVal;

            switch (sortConfig.key) {
                case 'title':
                    aVal = a.title?.toLowerCase() || '';
                    bVal = b.title?.toLowerCase() || '';
                    break;
                case 'difficulty':
                    const diffOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                    aVal = diffOrder[a.difficulty] || 0;
                    bVal = diffOrder[b.difficulty] || 0;
                    break;
                case 'added':
                    aVal = new Date(a.added_at || 0).getTime();
                    bVal = new Date(b.added_at || 0).getTime();
                    break;
                case 'nextReview':
                    aVal = new Date(a.next_review_at || 0).getTime();
                    bVal = new Date(b.next_review_at || 0).getTime();
                    break;
                case 'interval':
                    aVal = a.interval || 0;
                    bVal = b.interval || 0;
                    break;
                case 'mastery':
                    const getQuality = (p) => p.review_history?.[p.review_history.length - 1]?.quality || 0;
                    aVal = getQuality(a);
                    bVal = getQuality(b);
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredProblems, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="opacity-40" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={12} className="text-indigo-400" />
            : <ArrowDown size={12} className="text-indigo-400" />;
    };

    // --- PAGINATION LOGIC ---
    const totalPages = Math.ceil(sortedProblems.length / itemsPerPage);
    const paginatedProblems = sortedProblems.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- HELPERS ---
    const getDifficultyColor = (diff) => {
        switch (diff) {
            case 'Easy': return 'text-green-400';
            case 'Medium': return 'text-yellow-400';
            case 'Hard': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    const getMasteryBars = (problem) => {
        // Visualize last quality or ease factor
        // Logic: review_history last item quality (0-5)
        const lastReview = problem.review_history?.[problem.review_history.length - 1];
        const quality = lastReview ? lastReview.quality : 0; // 0 if unrated

        return (
            <div className="flex flex-col gap-1 items-start">
                <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div
                            key={i}
                            className={`w-1.5 h-3 rounded-sm ${i <= quality ? 'bg-blue-500' : 'bg-gray-800'}`}
                        />
                    ))}
                </div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">
                    {quality === 0 ? 'Unrated' : quality === 5 ? 'Mastered' : 'Learning'}
                </span>
            </div>
        );
    };

    const getStatusBadge = (problem) => {
        const isDue = new Date(problem.next_review_at) <= new Date();
        return isDue ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Due Now
            </span>
        ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Scheduled
            </span>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

            {/* SIDEBAR FILTERS */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Filter size={16} />
                    <span className="text-sm font-semibold uppercase tracking-wider">Filters</span>
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-5 shadow-lg">
                    {/* Pattern Filter */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Pattern</label>
                        <select
                            value={filters.pattern}
                            onChange={(e) => setFilters(prev => ({ ...prev, pattern: e.target.value }))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                        >
                            {uniquePatterns.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Difficulty Filter */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Difficulty</label>
                        <select
                            value={filters.difficulty}
                            onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                        >
                            <option>All Difficulties</option>
                            <option>Easy</option>
                            <option>Medium</option>
                            <option>Hard</option>
                        </select>
                    </div>

                    {/* Platform Filter */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Platform</label>
                        <select
                            value={filters.platform}
                            onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                        >
                            <option>All Platforms</option>
                            <option>LeetCode</option>
                            <option>HackerRank</option>
                            <option>NeetCode</option>
                            <option>TUF</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500">Review Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-300 outline-none focus:border-indigo-500 transition-colors"
                        >
                            <option>All Status</option>
                            <option>Due Now</option>
                            <option>Scheduled</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT TABLE */}
            <div className="lg:col-span-3 space-y-6">

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search problem title or tags..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-lg"
                    />
                </div>

                {/* Table Container */}
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-800 bg-gray-950/30 text-gray-400 text-xs font-bold uppercase tracking-wider">
                                    <th className="p-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                                        <span className="flex items-center gap-1">Problem <SortIcon columnKey="title" /></span>
                                    </th>
                                    <th className="p-3">Pattern</th>
                                    <th className="p-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('added')}>
                                        <span className="flex items-center gap-1">Added <SortIcon columnKey="added" /></span>
                                    </th>
                                    <th className="p-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('nextReview')}>
                                        <span className="flex items-center gap-1">Next Review <SortIcon columnKey="nextReview" /></span>
                                    </th>
                                    <th className="p-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('interval')}>
                                        <span className="flex items-center gap-1">Interval <SortIcon columnKey="interval" /></span>
                                    </th>
                                    <th className="p-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('mastery')}>
                                        <span className="flex items-center gap-1">Mastery <SortIcon columnKey="mastery" /></span>
                                    </th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {paginatedProblems.map(problem => (
                                    <tr
                                        key={problem.url}
                                        className="hover:bg-gray-800/40 transition-colors group cursor-pointer"
                                        onClick={() => onProblemClick && onProblemClick(problem)}
                                    >
                                        {/* PROBLEM COL */}
                                        <td className="p-3 max-w-[220px]">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-semibold text-gray-200 truncate">
                                                    {problem.title}
                                                </span>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={`font-medium ${getDifficultyColor(problem.difficulty)}`}>
                                                        {problem.difficulty}
                                                    </span>
                                                    <span className="text-gray-600">•</span>
                                                    <span className="text-gray-500">{problem.platform}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* PATTERN COL */}
                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-1.5 max-w-[140px]">
                                                {(Array.isArray(problem.pattern_tag) ? problem.pattern_tag : [problem.pattern_tag].filter(Boolean)).map(tag => (
                                                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-800 border border-gray-700 text-gray-300 font-medium">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>

                                        {/* ADDED COL */}
                                        <td className="p-3 text-xs text-gray-500 font-mono">
                                            {new Date(problem.created_at || Date.now()).toISOString().split('T')[0]}
                                        </td>

                                        {/* NEXT REVIEW COL */}
                                        <td className="p-3 text-xs text-gray-400 font-mono">
                                            {new Date(problem.next_review_at).toISOString().split('T')[0]}
                                        </td>

                                        {/* INTERVAL COL */}
                                        <td className="p-3 text-xs text-gray-400">
                                            {problem.interval} days
                                        </td>

                                        {/* MASTERY COL */}
                                        <td className="p-3">
                                            {getMasteryBars(problem)}
                                        </td>

                                        {/* STATUS COL */}
                                        <td className="p-3">
                                            {getStatusBadge(problem)}
                                        </td>

                                        {/* ACTIONS COL */}
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit(problem);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDelete(problem.url);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedProblems.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-gray-500 flex flex-col items-center">
                                            <Layers size={48} className="mb-4 text-gray-700" />
                                            <p className="text-lg font-medium text-gray-400">No problems found</p>
                                            <p className="text-sm">Try adjusting your filters or search query.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PAGINATION CONTROLS */}
                {filteredProblems.length > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-800/50 pt-4">
                        <div className="flex items-center gap-2">
                            <span>
                                Showing <span className="text-gray-300 font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-300 font-medium">{Math.min(currentPage * itemsPerPage, filteredProblems.length)}</span> of <span className="text-gray-300 font-medium">{filteredProblems.length}</span> items
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="flex items-center px-2 font-medium text-gray-300">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-gray-900 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryView;
