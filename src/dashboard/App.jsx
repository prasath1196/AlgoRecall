import React, { useState, useEffect, useMemo } from 'react';
import {
    Brain,
    CheckCircle2,
    Clock,
    Plus,
    LogOut,
    TrendingUp,
    Calendar,
    X,
    Code2,
    Zap,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Save,
    Shield,
    Lock,
    Settings,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import SettingsModal from './SettingsModal';
import Toast from './Toast';
import { getAllProblems, saveProblem } from '../../db.js';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-tomorrow.css'; // Dark theme

/**
 * UTILITIES & ALGORITHMS
 */

// SuperMemo-2 (SM-2) Spaced Repetition Algorithm
const calculateNextReview = (previousInterval, repetition, easeFactor, quality) => {
    let nextInterval;
    let nextRepetition;
    let nextEaseFactor;

    if (quality >= 3) {
        if (repetition === 0) {
            nextInterval = 1;
        } else if (repetition === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(previousInterval * easeFactor);
        }
        nextRepetition = repetition + 1;
    } else {
        nextInterval = 1;
        nextRepetition = 0;
    }

    nextEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEaseFactor < 1.3) nextEaseFactor = 1.3;

    return {
        interval: nextInterval,
        repetition: nextRepetition,
        easeFactor: nextEaseFactor
    };
};

const formatDate = (date) => new Date(date).toISOString().split('T')[0];

/**
 * COMPONENTS
 */

const CalendarWidget = ({ data }) => {
    // 1. Prepare Data
    const { reviewCounts, totalReviews, currentStreak, maxStreak, activeDays } = useMemo(() => {
        const counts = {};
        let total = 0;

        data.forEach(problem => {
            if (problem.review_history && Array.isArray(problem.review_history)) {
                problem.review_history.forEach(entry => {
                    const d = entry.date.split('T')[0];
                    counts[d] = (counts[d] || 0) + 1;
                    total++;
                });
            } else if (problem.last_reviewed) {
                const d = problem.last_reviewed.split('T')[0];
                counts[d] = (counts[d] || 0) + 1;
                total++;
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
    // We'll show a "Last 4 weeks" or "Current Month" style to fit the sidebar.
    // Let's do "Current Month" + filler days, typical calendar view.
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
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                        <div key={d} className="text-[10px] text-gray-600 font-medium">{d}</div>
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

const Modal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="p-2 flex justify-end sticky top-0 bg-gray-900/90 border-b border-gray-800 z-10">
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

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

export default function App() {
    // --- STATE ---
    const [problems, setProblems] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, list
    const [showAddModal, setShowAddModal] = useState(false);
    const [reviewMode, setReviewMode] = useState(false);
    const [reviewQueue, setReviewQueue] = useState([]); // Array of URLs
    const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
    const [reviewCutoff, setReviewCutoff] = useState(() => new Date().toISOString());

    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
    const [codeModalData, setCodeModalData] = useState(null); // Stores FULL problem object now

    // Edit Mode State for Code Modal
    const [isEditingProblem, setIsEditingProblem] = useState(false);
    const [editProblemData, setEditProblemData] = useState(null);

    // Active Recall State
    const [userCode, setUserCode] = useState('');
    const [selectedLang, setSelectedLang] = useState('javascript');
    const [comparisonTab, setComparisonTab] = useState('saved'); // 'saved' | 'mine'
    const [editedNotes, setEditedNotes] = useState(''); // Local state for editable notes

    // Settings State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [maxReviewsPerDay, setMaxReviewsPerDay] = useState(() => {
        const saved = localStorage.getItem('ALGORECALL_SETTINGS');
        return saved ? (JSON.parse(saved).maxReviewsPerDay || 0) : 0;
    });

    const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });
    const showToast = (message, type = 'info') => {
        setToast({ message, type, isVisible: true });
    };

    const [sortConfig, setSortConfig] = useState([{ key: 'created_at', direction: 'desc' }]);

    const handleSort = (key, event) => {
        setSortConfig(prev => {
            const isShift = event?.shiftKey;
            const existingIndex = prev.findIndex(s => s.key === key);

            if (!isShift) {
                // Single Sort Mode: Replace entire config
                let newDirection = 'asc';
                if (prev.length === 1 && prev[0].key === key) {
                    newDirection = prev[0].direction === 'asc' ? 'desc' : 'asc';
                }
                return [{ key, direction: newDirection }];
            }

            // Multi Sort Mode (Shift+Click)
            const next = [...prev];
            if (existingIndex >= 0) {
                // Toggle direction if exists
                next[existingIndex] = {
                    key,
                    direction: next[existingIndex].direction === 'asc' ? 'desc' : 'asc'
                };
            } else {
                // Append new key
                next.push({ key, direction: 'asc' });
            }
            return next;
        });
    };

    // --- INITIALIZATION ---
    const loadData = async () => {
        try {
            const data = await getAllProblems();
            setProblems(data);
        } catch (e) {
            console.error("Failed to load problems", e);
        }
    };

    useEffect(() => {
        loadData();
        // Optional: Poll for changes if needed, but for now load on mount/focus
        window.addEventListener('focus', loadData);
        return () => window.removeEventListener('focus', loadData);
    }, []);

    // --- ACTIONS ---

    const addProblem = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const patternTag = formData.get('pattern');

        const newProblem = {
            // url is keyPath
            title: formData.get('title'),
            url: formData.get('url'),
            platform: formData.get('platform') || 'LeetCode',
            pattern_tag: patternTag ? patternTag.split(',').map(s => s.trim()) : [],
            difficulty: formData.get('difficulty'),
            notes: formData.get('notes'),
            next_review_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            interval: 1,
            repetition_count: 0,
            ease_factor: 2.5,
            last_reviewed: null, // snake_case to match DB schema
            created_at: new Date().toISOString(),
            review_history: []
        };

        try {
            await saveProblem(newProblem);
            await loadData(); // Reload from DB
            setShowAddModal(false);
            showToast('Problem saved successfully', 'success');
        } catch (e) {
            showToast('Error saving problem: ' + e.message, 'error');
        }
    };

    const submitReview = async (quality) => {
        const problemUrl = reviewQueue[currentReviewIndex];
        const problem = problems.find(p => p.url === problemUrl);

        if (!problem) {
            // Fallback if problem seemingly lost
            console.error("Problem not found in queue lookup");
            return;
        }

        const { interval, repetition, easeFactor } = calculateNextReview(
            problem.interval || 1,
            problem.repetition_count || 0,
            problem.ease_factor || 2.5,
            quality
        );

        const today = new Date();
        const nextDate = new Date();
        nextDate.setDate(today.getDate() + interval);

        const updatedProblem = {
            ...problem,
            notes: editedNotes, // Save the edited notes
            interval,
            repetition_count: repetition,
            ease_factor: easeFactor,
            next_review_at: nextDate.toISOString(),
            last_reviewed: formatDate(today),
            review_history: [
                ...(problem.review_history || []),
                {
                    date: today.toISOString(),
                    quality,
                    interval_before: problem.interval,
                    interval_after: interval
                }
            ]
        };

        try {
            await saveProblem(updatedProblem);
            // Optimistic update locally
            setProblems(prev => prev.map(p => p.url === problem.url ? updatedProblem : p));

            // Move to next or finish
            if (currentReviewIndex < reviewQueue.length - 1) {
                setCurrentReviewIndex(prev => prev + 1);
                setIsAnswerRevealed(false);
                setUserCode(''); // Reset user code
            } else {
                setReviewMode(false);
                setReviewQueue([]);
                setReviewCutoff(new Date().toISOString()); // Reset cutoff
                setCurrentReviewIndex(0);
                setIsAnswerRevealed(false);
                setUserCode(''); // Reset user code
            }
        } catch (e) {
            console.error("Failed to save review", e);
        }
    };

    // --- FILTER & PAGINATION STATE ---
    const [filters, setFilters] = useState({
        search: '',
        difficulty: 'All',
        platform: 'All',
        status: 'All', // All, Due, Completed
        mastery: 'All', // All, Unrated, Learning (1-2), Reviewing (3), Mastered (4-5)
        pattern: 'All'
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        itemsPerPage: 10
    });

    // Extract unique patterns
    const uniquePatterns = useMemo(() => {
        const patterns = new Set();
        problems.forEach(p => {
            if (Array.isArray(p.pattern_tag)) {
                p.pattern_tag.forEach(tag => patterns.add(tag));
            } else if (p.pattern_tag) {
                patterns.add(p.pattern_tag);
            }
        });
        return Array.from(patterns).sort();
    }, [problems]);

    // --- FILTER LOGIC ---
    const filteredProblems = useMemo(() => {
        return problems.filter(p => {
            // Search (Title or Tags)
            if (filters.search) {
                const term = filters.search.toLowerCase();
                const inTitle = p.title.toLowerCase().includes(term);
                const inTags = Array.isArray(p.pattern_tag)
                    ? p.pattern_tag.some(t => t.toLowerCase().includes(term))
                    : (p.pattern_tag || '').toLowerCase().includes(term);
                if (!inTitle && !inTags) return false;
            }
            // Difficulty
            if (filters.difficulty !== 'All' && p.difficulty !== filters.difficulty) return false;
            // Platform
            if (filters.platform !== 'All' && p.platform !== filters.platform) return false;
            // Pattern
            if (filters.pattern !== 'All') {
                const pTags = Array.isArray(p.pattern_tag) ? p.pattern_tag : (p.pattern_tag ? [p.pattern_tag] : []);
                if (!pTags.includes(filters.pattern)) return false;
            }
            // Status
            if (filters.status === 'Due') {
                if (p.next_review_at > reviewCutoff) return false;
            } else if (filters.status === 'Scheduled') {
                if (p.next_review_at <= reviewCutoff) return false;
            }

            // Mastery Level logic
            if (filters.mastery !== 'All') {
                const lastHistory = p.review_history && p.review_history.length > 0 ? p.review_history[p.review_history.length - 1] : null;
                const rating = lastHistory ? lastHistory.quality : null;

                if (filters.mastery === 'Unrated') {
                    if (rating !== null) return false;
                } else if (filters.mastery === 'Learning') {
                    if (rating === null || rating > 2) return false; // 0, 1, 2
                } else if (filters.mastery === 'Reviewing') {
                    if (rating !== 3) return false;
                } else if (filters.mastery === 'Mastered') {
                    if (rating < 4) return false; // 4, 5
                }
            }

            return true;
        });
    }, [problems, filters, reviewCutoff]);

    // --- SORTING LOGIC ---
    const sortedProblems = useMemo(() => {
        let sortable = [...filteredProblems];
        if (sortConfig.length > 0) {
            sortable.sort((a, b) => {
                for (const sort of sortConfig) {
                    let aVal, bVal;
                    const { key, direction } = sort;

                    // Value Extractors
                    if (key === 'pattern') {
                        const getTag = (p) => Array.isArray(p.pattern_tag) ? (p.pattern_tag[0] || '') : (p.pattern_tag || '');
                        aVal = getTag(a).toLowerCase();
                        bVal = getTag(b).toLowerCase();
                    } else if (key === 'mastery') {
                        const getRating = (p) => p.review_history && p.review_history.length > 0 ? p.review_history[p.review_history.length - 1].quality : -1;
                        aVal = getRating(a);
                        bVal = getRating(b);
                    } else if (key === 'status') {
                        aVal = a.next_review_at;
                        bVal = b.next_review_at;
                    } else {
                        // Default string/number props
                        aVal = a[key];
                        bVal = b[key];

                        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
                    }

                    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
                    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
                    // If equal, continue to next sort key
                }
                return 0;
            });
        }
        return sortable;
    }, [filteredProblems, sortConfig]);


    // --- PAGINATION LOGIC ---
    const totalPages = Math.ceil(sortedProblems.length / pagination.itemsPerPage);
    const paginatedProblems = useMemo(() => {
        const start = (pagination.currentPage - 1) * pagination.itemsPerPage;
        return sortedProblems.slice(start, start + pagination.itemsPerPage);
    }, [sortedProblems, pagination]);

    // Reset page on filter change
    useEffect(() => {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
    }, [filters]);

    // --- COMPUTED STATS ---

    const dueProblems = useMemo(() => {
        return problems.filter(p => p.next_review_at <= reviewCutoff);
    }, [problems, reviewCutoff]);

    const nextUpcomingProblem = useMemo(() => {
        const upcoming = problems.filter(p => p.next_review_at > reviewCutoff);
        if (upcoming.length === 0) return null;
        return upcoming.sort((a, b) => a.next_review_at.localeCompare(b.next_review_at))[0];
    }, [problems, reviewCutoff]);

    // MASTERY STATS (Aggregated Ratings 1-5 across all problems)
    const masteryStats = useMemo(() => {
        const stats = {
            Unrated: 0,
            Learning: 0, // 0-2
            Reviewing: 0, // 3
            Mastered: 0 // 4-5
        };

        problems.forEach(p => {
            const lastHistory = p.review_history && p.review_history.length > 0 ? p.review_history[p.review_history.length - 1] : null;
            const rating = lastHistory ? lastHistory.quality : null;

            if (rating === null) stats.Unrated++;
            else if (rating <= 2) stats.Learning++; // Includes 0 (Again)
            else if (rating === 3) stats.Reviewing++;
            else if (rating >= 4) stats.Mastered++;
        });
        return stats;
    }, [problems]);

    // DAILY LIMIT LOGIC
    const todaysReviewCount = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        let count = 0;
        problems.forEach(p => {
            if (p.review_history && Array.isArray(p.review_history)) {
                count += p.review_history.filter(h => h.date.startsWith(todayStr)).length;
            }
        });
        return count;
    }, [problems]);

    const remainingDailyAllowance = maxReviewsPerDay === 0 ? Infinity : Math.max(0, maxReviewsPerDay - todaysReviewCount);

    // --- RENDER HELPERS ---
    // Ensure we find the problem from the main list so we have fresh state if needed, 
    // though for the review card itself we mostly need static info until save.
    const currentProblemUrl = reviewMode ? reviewQueue[currentReviewIndex] : null;
    const currentProblem = useMemo(() => {
        return problems.find(p => p.url === currentProblemUrl);
    }, [problems, currentProblemUrl]);

    // Sync editedNotes whenever the current problem changes
    useEffect(() => {
        if (currentProblem) {
            setEditedNotes(currentProblem.notes || '');
            // Also reset other transient state when problem changes
            setUserCode('');
            setIsAnswerRevealed(false);
            setComparisonTab('saved');
        }
    }, [currentProblem]);

    // Navigation Handlers
    const handlePrev = () => {
        if (currentReviewIndex > 0) {
            setCurrentReviewIndex(prev => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentReviewIndex < reviewQueue.length - 1) {
            setCurrentReviewIndex(prev => prev + 1);
        }
    };

    if (reviewMode && currentProblem) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-6xl animate-in fade-in zoom-in duration-300">
                    <div className="mb-6 flex justify-between items-center text-gray-500">
                        <div className="flex items-center gap-4">
                            <span className="text-sm">Reviewing {currentReviewIndex + 1} of {reviewQueue.length}</span>
                            <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
                                <button
                                    onClick={handlePrev}
                                    disabled={currentReviewIndex === 0}
                                    className="p-1 hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-white transition-colors"
                                    title="Previous Problem"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="w-px h-4 bg-gray-800 mx-1"></div>
                                <button
                                    onClick={handleNext}
                                    disabled={currentReviewIndex === reviewQueue.length - 1}
                                    className="p-1 hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent text-gray-400 hover:text-white transition-colors"
                                    title="Next Problem"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>

                        <button onClick={() => {
                            setReviewMode(false);
                            setReviewQueue([]);
                            setReviewCutoff(new Date().toISOString());
                            setUserCode('');
                        }} className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-1.5 rounded-full hover:bg-red-500/20 transition-colors text-sm font-medium">
                            <span className="hidden sm:inline">Exit Session</span>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                        {/* FRONT OF CARD - COMPACT HEADER */}
                        <div className="px-8 py-5 flex items-center justify-between border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium 
                ${currentProblem.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400' :
                                        currentProblem.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' :
                                            'bg-red-500/10 text-red-400'}`}>
                                    {currentProblem.difficulty}
                                </span>
                                <h2 className="text-xl font-bold truncate max-w-2xl">{currentProblem.title}</h2>
                            </div>
                            <a
                                href={currentProblem.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                Problem Link <Code2 size={14} />
                            </a>
                        </div>

                        {/* Problem Description - Show if available */}
                        {currentProblem.description && (
                            <details className="mx-8 mt-4 bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                                <summary className="px-4 py-2 cursor-pointer hover:bg-gray-800/50 transition-colors text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <span className="text-xs text-gray-500">▶</span> Problem Description
                                </summary>
                                <div className="px-4 py-3 text-sm text-gray-300 leading-relaxed border-t border-gray-800 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                    {currentProblem.description}
                                </div>
                            </details>
                        )}

                        {/* REVEAL AREA - FLIP CARD CONTAINER */}
                        <div className="perspective-1000 min-h-[80vh] bg-gray-900/50">
                            <div className={`relative w-full min-h-[80vh] transition-all duration-700 transform-style-3d ${isAnswerRevealed ? 'rotate-y-180' : ''}`}>

                                {/* FRONT FACE: EDITOR */}
                                <div className="absolute inset-0 backface-hidden p-8 flex flex-col">
                                    <div className="w-full flex flex-col gap-4 h-full">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-gray-400 font-medium flex items-center gap-2">
                                                <Code2 size={16} /> Active Recall: Type your solution
                                            </h3>
                                            <select
                                                value={selectedLang}
                                                onChange={(e) => setSelectedLang(e.target.value)}
                                                className="bg-gray-800 text-gray-300 text-xs rounded-md px-3 py-1 border border-gray-700 outline-none focus:border-indigo-500"
                                            >
                                                <option value="javascript">JavaScript</option>
                                                <option value="python">Python</option>
                                                <option value="java">Java</option>
                                                <option value="cpp">C++</option>
                                                <option value="go">Go</option>
                                                <option value="rust">Rust</option>
                                                <option value="sql">SQL</option>
                                                <option value="typescript">TypeScript</option>
                                            </select>
                                        </div>
                                        <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950 font-mono text-sm relative flex-1">
                                            <Editor
                                                value={userCode}
                                                onValueChange={code => setUserCode(code)}
                                                highlight={code => highlight(code, languages[selectedLang] || languages.javascript)}
                                                padding={16}
                                                className="min-h-full font-mono"
                                                textareaClassName="focus:outline-none"
                                                style={{
                                                    fontFamily: '"Fira code", "Fira Mono", monospace',
                                                    fontSize: 14,
                                                    backgroundColor: '#030712', // gray-950
                                                    color: '#e5e7eb', // gray-200
                                                    minHeight: '100%'
                                                }}
                                                placeholder="// Type your solution here before revealing..."
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                setIsAnswerRevealed(true);
                                                setComparisonTab(userCode.trim() ? 'mine' : 'saved'); // Show mine if typed, else saved
                                            }}
                                            className="self-center bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 mt-2"
                                        >
                                            Reveal Solution
                                        </button>
                                    </div>
                                </div>

                                {/* BACK FACE: SOLUTION */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col bg-gray-900 rounded-2xl overflow-y-auto">
                                    {/* BACK NAV */}
                                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                                        <button
                                            onClick={() => setIsAnswerRevealed(false)}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                                        >
                                            ← Back to Editor
                                        </button>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setComparisonTab('saved')}
                                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${comparisonTab === 'saved' ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-600 hover:text-gray-400'}`}
                                            >
                                                Saved Solution
                                            </button>
                                            <button
                                                onClick={() => setComparisonTab('mine')}
                                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${comparisonTab === 'mine' ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-600 hover:text-gray-400'}`}
                                            >
                                                Your Answer
                                            </button>
                                        </div>
                                    </div>

                                    {/* CODE DISPLAY */}
                                    <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 overflow-x-auto mb-6 max-h-[40vh] overflow-y-auto flex-shrink-0">
                                        {comparisonTab === 'saved' ? (
                                            <pre className="font-mono text-sm text-green-400 whitespace-pre">
                                                {currentProblem.code || '// No saved code for this problem'}
                                            </pre>
                                        ) : (
                                            <pre className="font-mono text-sm text-indigo-400 whitespace-pre">
                                                {userCode || '// You did not type an answer'}
                                            </pre>
                                        )}
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-1/2 flex flex-col gap-4">
                                            {/* AI SUMMARY If Available */}
                                            {currentProblem.clean_problem_statement && (
                                                <div className="bg-indigo-900/10 border border-indigo-500/20 p-3 rounded-lg">
                                                    <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                        <Zap size={12} /> AI Summary
                                                    </h3>
                                                    <p className="text-gray-300 text-sm italic leading-relaxed">
                                                        "{currentProblem.clean_problem_statement}"
                                                    </p>
                                                </div>
                                            )}

                                            <div>
                                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Pattern</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {Array.isArray(currentProblem.pattern_tag) ? currentProblem.pattern_tag.map(tag => (
                                                        <span key={tag} className="bg-gray-800 text-gray-200 px-3 py-1 rounded-md border border-gray-700 text-xs">
                                                            {tag}
                                                        </span>
                                                    )) : (
                                                        <span className="bg-gray-800 text-gray-200 px-3 py-1 rounded-md border border-gray-700 text-xs">
                                                            {currentProblem.pattern_tag || 'Uncategorized'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-1/2">
                                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Insight</h3>
                                            <textarea
                                                value={editedNotes}
                                                onChange={(e) => setEditedNotes(e.target.value)}
                                                placeholder="Add your key insights here..."
                                                className="w-full bg-gray-950 p-3 rounded-lg border border-gray-800 text-gray-300 leading-relaxed font-mono text-sm focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none h-24"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-800 mt-auto">
                                        <button onClick={() => submitReview(0)} className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors group">
                                            <span className="font-bold group-hover:scale-110 transition-transform">Again</span>
                                            <span className="text-xs opacity-70 text-center">&lt; 1 min</span>
                                        </button>
                                        <button onClick={() => submitReview(3)} className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-orange-900/20 text-orange-400 transition-colors group">
                                            <span className="font-bold group-hover:scale-110 transition-transform">Hard</span>
                                            <span className="text-xs opacity-70 text-center">1 day</span>
                                        </button>
                                        <button onClick={() => submitReview(4)} className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-green-900/20 text-green-400 transition-colors group">
                                            <span className="font-bold group-hover:scale-110 transition-transform">Good</span>
                                            <span className="text-xs opacity-70 text-center">3 days</span>
                                        </button>
                                        <button onClick={() => submitReview(5)} className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-blue-900/20 text-blue-400 transition-colors group">
                                            <span className="font-bold group-hover:scale-110 transition-transform">Easy</span>
                                            <span className="text-xs opacity-70 text-center">7 days</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500/30">

            {/* HEADER */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <Brain size={20} className="text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">AlgoRecall</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors border border-transparent hover:border-gray-700"
                            title="Settings"
                        >
                            <Settings size={20} />
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="hidden md:flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors border border-gray-700"
                        >
                            <Plus size={16} /> Add Problem
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto px-4 py-8">

                {/* HERO: DUE FOR REVIEW */}
                <div className="mb-8">
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden relative group p-1">
                        <div className="absolute top-0 right-0 p-8 text-gray-700 opacity-20 group-hover:opacity-30 transition-opacity pointer-events-none">
                            <Clock size={120} />
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-6 relative z-10">
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-gray-400 font-medium mb-2 uppercase tracking-wide text-sm flex items-center justify-center md:justify-start gap-2">
                                    <Clock size={16} /> Ready for Review
                                </h3>
                                <div className="flex items-baseline justify-center md:justify-start gap-3">
                                    <span className="text-5xl md:text-6xl font-bold text-white tracking-tight">{dueProblems.length}</span>
                                    <span className="text-lg text-gray-500 font-medium">problems need your attention</span>
                                </div>
                                {maxReviewsPerDay > 0 && (
                                    <div className="mt-2 text-xs font-mono text-gray-500 bg-gray-950/50 inline-block px-2 py-1 rounded border border-gray-800">
                                        <span className={remainingDailyAllowance <= 0 ? 'text-green-400' : 'text-indigo-400'}>
                                            {todaysReviewCount}
                                        </span>
                                        <span className="opacity-50"> / {maxReviewsPerDay} today</span>
                                    </div>
                                )}
                            </div>

                            <div className="w-full md:w-auto min-w-[300px]">
                                <button
                                    onClick={() => {
                                        if (dueProblems.length > 0) {
                                            // CHECK DAILY LIMIT
                                            if (remainingDailyAllowance <= 0) {
                                                showToast(`Daily limit of ${maxReviewsPerDay} reviews reached! You're done for today.`, 'success');
                                                return;
                                            }

                                            // Cap the queue based on remaining allowance
                                            const queue = dueProblems.slice(0, remainingDailyAllowance).map(p => p.url);
                                            setReviewQueue(queue);
                                            setReviewMode(true);
                                            setCurrentReviewIndex(0);
                                            setIsAnswerRevealed(false);
                                            setUserCode('');
                                        } else if (nextUpcomingProblem) {
                                            // CHECK DAILY LIMIT
                                            if (remainingDailyAllowance <= 0) {
                                                showToast(`Daily limit of ${maxReviewsPerDay} reviews reached! You're done for today.`, 'success');
                                                return;
                                            }

                                            const nextDate = new Date(nextUpcomingProblem.next_review_at);
                                            nextDate.setHours(23, 59, 59, 999);
                                            const targetDate = nextDate.toISOString();
                                            setReviewCutoff(targetDate);
                                            const batch = problems.filter(p => p.next_review_at <= targetDate);

                                            // CAP BATCH
                                            const queue = batch.slice(0, remainingDailyAllowance).map(p => p.url);
                                            setReviewQueue(queue);
                                            setReviewMode(true);
                                            setCurrentReviewIndex(0);
                                            setIsAnswerRevealed(false);
                                            setUserCode('');
                                        }
                                    }}
                                    disabled={dueProblems.length === 0 && !nextUpcomingProblem}
                                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg transform hover:-translate-y-1 active:scale-95
                 ${dueProblems.length > 0
                                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                                            : nextUpcomingProblem
                                                ? 'bg-gray-800 hover:bg-gray-700 text-indigo-400 border border-indigo-500/30'
                                                : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-800'}`}
                                >
                                    {dueProblems.length > 0 ? (
                                        <><Zap size={20} fill="currentColor" /> Start Review Session</>
                                    ) : nextUpcomingProblem ? (
                                        <><Calendar size={20} /> Review Upcoming ({new Date(nextUpcomingProblem.next_review_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})</>
                                    ) : (
                                        <><CheckCircle2 size={20} /> All Caught Up</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* LEFT COLUMN: SIDEBAR (lg:col-span-1) */}
                    <div className="lg:col-span-1 flex flex-col gap-6">

                        {/* FILTERS SIDEBAR CARD */}
                        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                            <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
                                <Code2 size={16} /> Filters
                            </h3>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium ml-1">Pattern</label>
                                    <select
                                        value={filters.pattern}
                                        onChange={(e) => setFilters(prev => ({ ...prev, pattern: e.target.value }))}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500"
                                    >
                                        <option value="All">All Patterns</option>
                                        {uniquePatterns.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium ml-1">Difficulty</label>
                                    <select
                                        value={filters.difficulty}
                                        onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value }))}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500"
                                    >
                                        <option value="All">All Difficulties</option>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium ml-1">Platform</label>
                                    <select
                                        value={filters.platform}
                                        onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500"
                                    >
                                        <option value="All">All Platforms</option>
                                        <option value="LeetCode">LeetCode</option>
                                        <option value="Neetcode">Neetcode</option>
                                        <option value="HackerRank">HackerRank</option>
                                        <option value="Codeforces">Codeforces</option>
                                        <option value="TUF">TUF</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium ml-1">Review Status</label>
                                    <select
                                        value={filters.status}
                                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500"
                                    >
                                        <option value="All">All Status</option>
                                        <option value="Due">Due for Review</option>
                                        <option value="Scheduled">Scheduled</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 font-medium ml-1">Mastery</label>
                                    <select
                                        value={filters.mastery}
                                        onChange={(e) => setFilters(prev => ({ ...prev, mastery: e.target.value }))}
                                        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-indigo-500"
                                    >
                                        <option value="All">All Mastery</option>
                                        <option value="Unrated">Unrated</option>
                                        <option value="Learning">Learning</option>
                                        <option value="Reviewing">Reviewing</option>
                                        <option value="Mastered">Mastered 🚀</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Mastery Breakdown */}
                        <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                            <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
                                <TrendingUp size={16} /> Mastery Level
                            </h3>

                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{problems.length}</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide">Tracked</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-400">{masteryStats.Mastered}</div>
                                    <div className="text-xs text-blue-400/70 uppercase tracking-wide">Mastered</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-indigo-400">
                                        {Math.round((masteryStats.Mastered / (problems.length || 1)) * 100)}%
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
                                        <span className="text-gray-500">{masteryStats.Mastered}</span>
                                    </div>
                                    <ProgressBar value={masteryStats.Mastered} max={problems.length} color="bg-blue-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <div className="flex items-center gap-1.5 text-green-400">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span>Reviewing</span>
                                        </div>
                                        <span className="text-gray-500">{masteryStats.Reviewing}</span>
                                    </div>
                                    <ProgressBar value={masteryStats.Reviewing} max={problems.length} color="bg-green-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <div className="flex items-center gap-1.5 text-orange-400">
                                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                            <span>Learning</span>
                                        </div>
                                        <span className="text-gray-500">{masteryStats.Learning}</span>
                                    </div>
                                    <ProgressBar value={masteryStats.Learning} max={problems.length} color="bg-orange-500" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                                            <span>Unrated</span>
                                        </div>
                                        <span className="text-gray-500">{masteryStats.Unrated}</span>
                                    </div>
                                    <ProgressBar value={masteryStats.Unrated} max={problems.length} color="bg-gray-600" />
                                </div>
                            </div>
                        </div>

                        {/* Heatmap (Fixed for Sidebar: Calendar Widget) */}
                        <CalendarWidget data={problems} />

                    </div>

                    {/* RIGHT COLUMN: FILTERS & TABLE (lg:col-span-3) */}
                    <div className="lg:col-span-3 flex flex-col gap-6">

                        {/* FILTER BAR - Search Only */}
                        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex-1 relative w-full">
                                <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search problem title or tags..."
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* PROBLEM LIST */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-900 border-b border-gray-800 text-gray-400 font-medium select-none">
                                        <tr>
                                            {[
                                                { label: 'Problem', key: 'title', className: 'pl-6' },
                                                { label: 'Pattern', key: 'pattern' },
                                                { label: 'Added', key: 'created_at' },
                                                { label: 'Next Review', key: 'next_review_at' },
                                                { label: 'Interval', key: 'interval' },
                                                { label: 'Mastery', key: 'mastery' },
                                                { label: 'Status', key: 'status' }
                                            ].map(col => {
                                                const sortState = sortConfig.find(s => s.key === col.key);
                                                const sortIndex = sortConfig.findIndex(s => s.key === col.key);

                                                return (
                                                    <th
                                                        key={col.key}
                                                        className={`p-4 cursor-pointer hover:text-indigo-400 transition-colors ${col.className || ''}`}
                                                        onClick={(e) => handleSort(col.key, e)}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {col.label}
                                                            {sortState ? (
                                                                <div className="flex items-center text-indigo-500">
                                                                    {sortState.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                                                                    {sortConfig.length > 1 && <span className="text-[10px] ml-0.5">{sortIndex + 1}</span>}
                                                                </div>
                                                            ) : (
                                                                <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                                                            )}
                                                        </div>
                                                    </th>
                                                )
                                            })}
                                            <th className="p-4 text-right pr-6">Code</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {paginatedProblems.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="p-8 text-center text-gray-500">
                                                    No problems match your filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedProblems.map(problem => {
                                                const isDue = problem.next_review_at <= new Date().toISOString();
                                                const lastHistory = problem.review_history && problem.review_history.length > 0
                                                    ? problem.review_history[problem.review_history.length - 1]
                                                    : null;
                                                const lastQuality = lastHistory ? lastHistory.quality : null;

                                                return (
                                                    <tr key={problem.url} className="hover:bg-gray-800/50 transition-colors group">
                                                        <td className="p-4 pl-6">
                                                            <div className="font-medium text-white flex items-center gap-2">
                                                                <a href={problem.url} target="_blank" rel="noreferrer" className="hover:text-indigo-400 hover:underline decoration-indigo-400/50 underline-offset-4">
                                                                    {problem.title}
                                                                </a>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                                                <span className={`${problem.difficulty === 'Easy' ? 'text-green-500' :
                                                                    problem.difficulty === 'Medium' ? 'text-yellow-500' : 'text-red-500'
                                                                    }`}>{problem.difficulty}</span>
                                                                <span>•</span>
                                                                <span>{problem.platform}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            {Array.isArray(problem.pattern_tag) ? problem.pattern_tag.map(tag => (
                                                                <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-300 text-xs border border-gray-700 mr-1">
                                                                    {tag}
                                                                </span>
                                                            )) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-300 text-xs border border-gray-700">
                                                                    {problem.pattern_tag || 'Uncategorized'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-gray-400 text-xs">
                                                            {problem.created_at ? formatDate(problem.created_at) : '-'}
                                                        </td>
                                                        <td className="p-4 text-gray-400">
                                                            {isDue && problem.repetition_count > 0 ? (
                                                                <span className="text-orange-400 font-medium flex items-center gap-1">
                                                                    Today
                                                                </span>
                                                            ) : isDue && problem.repetition_count === 0 ? (
                                                                <span className="text-blue-400 font-medium">New</span>
                                                            ) : (
                                                                formatDate(problem.next_review_at)
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-gray-500 font-mono text-xs">
                                                            {problem.interval} days
                                                        </td>

                                                        {/* MASTERY COLUMN */}
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-0.5" title={`Last Rating: ${lastQuality !== null ? lastQuality : 'N/A'}/5`}>
                                                                {[1, 2, 3, 4, 5].map(i => {
                                                                    let color = 'bg-gray-800';
                                                                    if (lastQuality !== null && i <= lastQuality) {
                                                                        if (lastQuality <= 3) color = 'bg-orange-500';
                                                                        else if (lastQuality === 4) color = 'bg-green-500';
                                                                        else if (lastQuality === 5) color = 'bg-blue-500';
                                                                    }
                                                                    return (
                                                                        <div key={i} className={`w-1.5 h-3 rounded-sm ${color} transition-colors`}></div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {lastQuality === null && <span className="text-[10px] text-gray-600">Unrated</span>}
                                                        </td>

                                                        <td className="p-4">
                                                            {isDue ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                                                                    Due
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                                                    Scheduled
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="p-4 text-right pr-6">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Pass FULL problem object for editing context
                                                                    setCodeModalData(problem);
                                                                    setIsEditingProblem(false); // Reset edit mode
                                                                }}
                                                                className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-indigo-400 transition-colors"
                                                                title="View Saved Code"
                                                            >
                                                                <Code2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* PAGINATION CONTROLS */}
                            <div className="border-t border-gray-800 p-4 flex items-center justify-between bg-gray-900">
                                <div className="text-xs text-gray-500">
                                    Showing <span className="text-gray-300">{(pagination.currentPage - 1) * pagination.itemsPerPage + 1}</span> to <span className="text-gray-300">{Math.min(pagination.currentPage * pagination.itemsPerPage, filteredProblems.length)}</span> of <span className="text-gray-300">{filteredProblems.length}</span> results
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={pagination.currentPage === 1}
                                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            // Simple pagination logic for now (first 5 or window)
                                            // For robustness, just showing current page is safer if complex
                                            let p = i + 1;
                                            if (totalPages > 5 && pagination.currentPage > 3) {
                                                p = pagination.currentPage - 2 + i;
                                            }
                                            if (p > totalPages) return null;

                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPagination(prev => ({ ...prev, currentPage: p }))}
                                                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${pagination.currentPage === p ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={pagination.currentPage === totalPages || totalPages === 0}
                                        onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                                        className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>



                </div>
            </main >

            {/* CODE / DETAILS MODAL */}
            < Modal isOpen={!!codeModalData
            } onClose={() => setCodeModalData(null)}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Code2 size={24} className="text-indigo-400" />
                        {isEditingProblem ? 'Edit Problem' : 'Problem Details'}
                    </h2>
                    {!isEditingProblem && (
                        <button
                            onClick={() => {
                                setIsEditingProblem(true);
                                setEditProblemData({
                                    ...codeModalData,
                                    // Flatten tags for input if array
                                    pattern_tag: Array.isArray(codeModalData.pattern_tag)
                                        ? codeModalData.pattern_tag.join(', ')
                                        : (codeModalData.pattern_tag || '')
                                });
                            }}
                            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-indigo-400 transition-colors"
                            title="Edit Problem"
                        >
                            <Pencil size={18} />
                        </button>
                    )}
                </div>

                {
                    isEditingProblem ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                                <input
                                    value={editProblemData.title}
                                    onChange={e => setEditProblemData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Tags (Comma separated)</label>
                                <input
                                    value={editProblemData.pattern_tag}
                                    onChange={e => setEditProblemData(prev => ({ ...prev, pattern_tag: e.target.value }))}
                                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Saved Solution</label>
                                <div className="border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
                                    <Editor
                                        value={editProblemData.code || ''}
                                        onValueChange={code => setEditProblemData(prev => ({ ...prev, code }))}
                                        highlight={code => highlight(code, languages.javascript)}
                                        padding={10}
                                        style={{
                                            fontFamily: '"Fira Code", "Fira Mono", monospace',
                                            fontSize: 14,
                                            backgroundColor: 'transparent',
                                            minHeight: '200px'
                                        }}
                                        className="min-h-[200px]"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setIsEditingProblem(false)}
                                    className="px-4 py-2 hover:bg-gray-800 rounded-lg text-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            // Save to DB
                                            const updatedProblem = {
                                                ...codeModalData, // Keep original ID/URL/Stats
                                                title: editProblemData.title,
                                                code: editProblemData.code,
                                                // Split tags back to array if needed, or keep string? The app seems to handle mixed array/string in filters but DB might prefer consistency. 
                                                // The Add Modal saves comma-string. The scraper saves array. 
                                                // Let's standardise on Array for better filtering if possible, or just string for simplicity as per existing "Add" logic.
                                                // Existing "Add" logic saves raw string. Problem Table handles both. 
                                                // Let's save as trimmed specific array for cleaner data if user entered commas.
                                                pattern_tag: editProblemData.pattern_tag.split(',').map(t => t.trim()).filter(Boolean)
                                            };

                                            await saveProblem(updatedProblem);

                                            // Update Local State
                                            setProblems(prev => prev.map(p => p.url === updatedProblem.url ? updatedProblem : p));
                                            setCodeModalData(updatedProblem); // Update modal view
                                            setIsEditingProblem(false);
                                            showToast('Changes saved successfully', 'success');
                                        } catch (err) {
                                            console.error("Failed to update problem", err);
                                            showToast("Failed to save changes.", "error");
                                        }
                                    }}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Save size={16} /> Save Changes
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <div className="text-lg font-medium text-gray-200">{codeModalData?.title}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {Array.isArray(codeModalData?.pattern_tag) ? codeModalData.pattern_tag.map(tag => (
                                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-400 text-xs border border-gray-700">
                                            {tag}
                                        </span>
                                    )) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-gray-400 text-xs border border-gray-700">
                                            {codeModalData?.pattern_tag || 'Uncategorized'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Description Section */}
                            {codeModalData?.description && (
                                <details className="mb-4 bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                                    <summary className="px-4 py-2 cursor-pointer hover:bg-gray-800/50 transition-colors text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <span className="text-xs text-gray-500">▶</span> Problem Description
                                    </summary>
                                    <div className="px-4 py-3 text-sm text-gray-300 leading-relaxed border-t border-gray-800 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                        {codeModalData.description}
                                    </div>
                                </details>
                            )}

                            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 overflow-x-auto max-h-[60vh]">
                                <pre className="font-mono text-sm text-gray-300 whitespace-pre">
                                    {codeModalData?.code || '// No code captured'}
                                </pre>
                            </div>
                            <div className="flex justify-between mt-4">
                                <div className="text-gray-500 text-xs max-h-32 overflow-y-auto w-1/2">
                                    <strong className="block mb-1 text-gray-400">Review History</strong>
                                    {codeModalData?.review_history && codeModalData.review_history.length > 0 ? (
                                        <ul className="space-y-1">
                                            {codeModalData.review_history.slice().reverse().map((h, i) => (
                                                <li key={i}>
                                                    {formatDate(h.date)}: Rating {h.quality} ({h.interval_before}d → {h.interval_after}d)
                                                </li>
                                            ))}
                                        </ul>
                                    ) : 'No reviews yet'}
                                </div>
                                <button
                                    onClick={() => setCodeModalData(null)}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors h-fit self-end"
                                >
                                    Close
                                </button>
                            </div>
                        </>
                    )
                }
            </Modal >

            {/* ADD MODAL */}
            < Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
                <h2 className="text-xl font-bold mb-6 text-white">Log New Problem</h2>
                <form onSubmit={addProblem} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Problem Title</label>
                        <input name="title" required className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" placeholder="e.g. Trapping Rain Water" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Difficulty</label>
                            <select name="difficulty" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white outline-none">
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Platform</label>
                            <select name="platform" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white outline-none">
                                <option value="LeetCode">LeetCode</option>
                                <option value="HackerRank">HackerRank</option>
                                <option value="Codeforces">Codeforces</option>
                                <option value="TUF">TUF</option>
                                <option value="Neetcode">Neetcode</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Pattern / Tag (Comma separated)</label>
                        <input name="pattern" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Sliding Window, Two Pointers" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">URL</label>
                        <input name="url" type="url" required className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Key Insight / Notes</label>
                        <textarea name="notes" rows="4" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" placeholder="What was the 'Aha!' moment? (Markdown supported)" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 hover:bg-gray-800 rounded-lg text-gray-300 transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20">Save Problem</button>
                    </div>
                </form>
            </Modal >

            {/* FAB for Mobile */}
            < button
                onClick={() => setShowAddModal(true)}
                className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-500/40 z-30"
            >
                <Plus size={24} />
            </button >

            {/* SEPARATE COMPONENT: SETTINGS MODAL */}
            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onSave={(newSettings) => setMaxReviewsPerDay(newSettings.maxReviewsPerDay || 0)}
            />

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
            />

        </div >
    );
}
