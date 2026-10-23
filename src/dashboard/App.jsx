import React, { useState, useEffect, Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Brain, Plus, LogOut, Settings } from 'lucide-react';

import QueueView from './components/QueueView';
import LibraryView from './components/LibraryView';
import ReviewSession from './components/ReviewSession';
import AddProblemModal from './components/AddProblemModal';
import SettingsModal from './SettingsModal';
import Toast from './Toast';
import { useProblems } from './hooks/useProblems';
import SyncIndicator from './sync/SyncIndicator';
import AccountPanel from './sync/AccountPanel';
import InsightsSection, { useStats } from './sync/Insights';
import BackupPrompt from './sync/BackupPrompt';
import { applyRating } from './applyRating';
import { useSyncStatus } from './sync/useSyncStatus';
import { onRuntimeMessage } from './sync/syncApi';

export const queryClient = new QueryClient();

// Mock interview view is loaded on demand (and may fail independently of the rest of the app).
const MockInterviewView = lazy(() => import('./mock/MockInterviewView.jsx'));

class MockBoundary extends React.Component {
    constructor(props) { super(props); this.state = { failed: false }; }
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(err) { console.error('Mock interview failed to load', err); }
    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3">
                <p className="text-sm text-red-300">Mock interview couldn't be loaded.</p>
                <button type="button" onClick={this.props.onExit} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-100 text-sm rounded-lg">Back to queue</button>
            </div>
        );
    }
}

// Wrapped App to use Query Context
const Dashboard = () => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState('queue'); // 'queue' | 'library'
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Review Session State
    const [isReviewing, setIsReviewing] = useState(false);
    const [reviewQueue, setReviewQueue] = useState([]);

    const [editingProblem, setEditingProblem] = useState(null);

    const queryClient = useQueryClient();
    const [showAccount, setShowAccount] = useState(false);
    const { status: syncStatus, setStatus: setSyncStatus, refresh: refreshSync, loaded: syncLoaded } = useSyncStatus();
    const { data: statsData } = useStats();
    const weakPatterns = (statsData && Array.isArray(statsData.weakest_patterns))
        ? statsData.weakest_patterns.map(w => w.pattern).filter(Boolean)
        : [];

    // Custom Hook
    const { problems, isLoading, saveProblem, deleteProblem } = useProblems();

    // Local Storage Settings
    const [maxReviewsPerDay, setMaxReviewsPerDay] = useState(0);
    useEffect(() => {
        const saved = localStorage.getItem('ALGORECALL_SETTINGS');
        if (saved) setMaxReviewsPerDay(JSON.parse(saved).maxReviewsPerDay || 0);
    }, []);

    // Toast State
    const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });
    const showToast = (message, type = 'info') => setToast({ message, type, isVisible: true });

    // Live updates from other devices / background sync
    useEffect(() => {
        return onRuntimeMessage((msg) => {
            if (!msg) return;
            if (msg.type === 'PROBLEMS_CHANGED') {
                queryClient.invalidateQueries({ queryKey: ['problems'] });
                queryClient.invalidateQueries({ queryKey: ['stats'] });
                if (typeof msg.count === 'number' && msg.count > 0) {
                    showToast(`Synced ${msg.count} change${msg.count === 1 ? '' : 's'} from another device`, 'success');
                }
            } else if (msg.type === 'SYNC_STATUS_CHANGED' && msg.status && msg.status.state === 'idle') {
                queryClient.invalidateQueries({ queryKey: ['stats'] });
            }
        });
    }, [queryClient]);

    // --- COMPUTED ---
    const todaysReviewCount = problems.reduce((count, p) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const reviewsToday = p.review_history?.filter(h => h.date.startsWith(todayStr)).length || 0;
        return count + reviewsToday;
    }, 0);

    const remainingDailyAllowance = maxReviewsPerDay === 0 ? Infinity : Math.max(0, maxReviewsPerDay - todaysReviewCount);

    // --- HANDLERS ---
    const handleSaveProblem = async (formData) => {
        const newProblem = {
            title: formData.get('title'),
            url: formData.get('url'),
            platform: formData.get('platform') || 'LeetCode',
            pattern_tag: formData.get('pattern') ? formData.get('pattern').split(',').map(s => s.trim()) : [],
            difficulty: formData.get('difficulty'),
            notes: formData.get('notes'),
            // Default fields for new problems (db.js will preserve existing if url matches)
            next_review_at: new Date(Date.now() + 86400000).toISOString(),
            interval: 1,
            repetition_count: 0,
            ease_factor: 2.5,
            review_history: [],
            created_at: new Date().toISOString()
        };

        try {
            await saveProblem(newProblem);
            setShowAddModal(false);
            setEditingProblem(null);
            showToast('Problem saved successfully', 'success');
        } catch (err) {
            showToast('Failed to save: ' + err.message, 'error');
        }
    };

    const handleDeleteProblem = async (url) => {
        if (confirm('Are you sure you want to delete this problem?')) {
            try {
                await deleteProblem(url);
                showToast('Problem deleted successfully', 'success');
            } catch (err) {
                showToast('Failed to delete: ' + err.message, 'error');
            }
        }
    };

    const handleEditProblem = (problem) => {
        setEditingProblem(problem);
        setShowAddModal(true);
    };

    const startSession = (batch) => {
        if (remainingDailyAllowance <= 0) {
            showToast(`Daily limit of ${maxReviewsPerDay} recalls reached!`, 'success');
            return;
        }
        const queue = batch.slice(0, remainingDailyAllowance).map(p => p.url);
        setReviewQueue(queue);
        setIsReviewing(true);
    };

    // Start a single-problem recall session
    const startSingleProblem = (problem) => {
        setReviewQueue([problem.url]);
        setIsReviewing(true);
    };

    const startUpcoming = () => {
        if (remainingDailyAllowance <= 0) {
            showToast(`Daily limit of ${maxReviewsPerDay} recalls reached!`, 'success');
            return;
        }

        const now = new Date();
        const utcCutoff = new Date();
        utcCutoff.setUTCHours(23, 59, 59, 999);

        const upcoming = problems.filter(p => new Date(p.next_review_at) > utcCutoff);
        if (upcoming.length > 0) {
            // Sort by next_review_at and take all upcoming problems (or up to daily limit)
            const sortedUpcoming = upcoming.sort((a, b) => new Date(a.next_review_at) - new Date(b.next_review_at));
            startSession(sortedUpcoming); // Pass all sorted upcoming problems
        }
    };

    // Focus mode: practice problems whose pattern_tag matches any of the given patterns
    const startFocus = (patterns) => {
        const wanted = new Set(patterns.map(p => String(p).toLowerCase()));
        const matches = problems.filter(p => {
            const tags = Array.isArray(p.pattern_tag) ? p.pattern_tag : [p.pattern_tag];
            return tags.filter(Boolean).some(t => wanted.has(String(t).toLowerCase()));
        });
        if (matches.length === 0) {
            showToast('No saved problems match those patterns yet', 'info');
            return;
        }
        setReviewQueue(matches.map(p => p.url));
        setIsReviewing(true);
    };

    const handleMockRating = (problem, quality) => saveProblem(applyRating(problem, quality));

    if (isReviewing) {
        return (
            <ReviewSession
                queue={reviewQueue}
                problems={problems}
                onComplete={() => setIsReviewing(false)}
                onUpdateProblem={saveProblem}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500/30">
            {/* NAV */}
            <nav className="border-b border-gray-800 bg-gray-950/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
                            <Brain className="text-white" size={20} />
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent tracking-tight">
                            AlgoRecall
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={() => { setEditingProblem(null); setShowAddModal(true); }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                            <Plus size={16} /> <span className="hidden sm:inline">Add Problem</span>
                        </button>
                        <div className="h-6 w-px bg-gray-800"></div>
                        <SyncIndicator status={syncStatus} onClick={() => setShowAccount(true)} />
                        <button onClick={() => setShowSettingsModal(true)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* TABS */}
                <div className="flex gap-8 border-b border-gray-800 mb-8">
                    <button
                        onClick={() => setActiveTab('queue')}
                        className={`pb-4 text-sm font-medium transition-all relative ${activeTab === 'queue' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Recall Queue
                        {activeTab === 'queue' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`pb-4 text-sm font-medium transition-all relative ${activeTab === 'library' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        All Problems
                        {activeTab === 'library' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab('mock')}
                        className={`pb-4 text-sm font-medium transition-all relative ${activeTab === 'mock' ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Mock interview
                        {activeTab === 'mock' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"></div>}
                    </button>
                </div>

                {activeTab === 'queue' && (
                    <BackupPrompt
                        signedIn={syncStatus.state !== 'signed_out'}
                        statusLoaded={syncLoaded}
                        onBackup={() => setShowAccount(true)}
                    />
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'mock' ? (
                            <MockBoundary onExit={() => setActiveTab('queue')}>
                                <Suspense fallback={<div className="py-16 text-center text-sm text-gray-500" role="status">Loading mock interview…</div>}>
                                    <MockInterviewView
                                        problems={problems}
                                        weakPatterns={weakPatterns}
                                        onExit={() => setActiveTab('queue')}
                                        onSaveRating={handleMockRating}
                                    />
                                </Suspense>
                            </MockBoundary>
                        ) : activeTab === 'queue' ? (
                            <>
                            <QueueView
                                problems={problems}
                                maxLimit={maxReviewsPerDay}
                                todaysCount={todaysReviewCount}
                                onStartSession={startSession}
                                onStartUpcoming={startUpcoming}
                                onProblemClick={startSingleProblem}
                                onOpenSettings={() => setShowSettingsModal(true)}
                            />
                            <InsightsSection onPractice={startFocus} onSignIn={() => setShowAccount(true)} />
                            </>
                        ) : (
                            <LibraryView
                                problems={problems}
                                onEdit={handleEditProblem}
                                onDelete={handleDeleteProblem}
                                onProblemClick={startSingleProblem}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* MODALS */}
            <AddProblemModal
                isOpen={showAddModal}
                onClose={() => { setShowAddModal(false); setEditingProblem(null); }}
                onSave={handleSaveProblem}
                initialData={editingProblem}
            />
            <AccountPanel
                isOpen={showAccount}
                onClose={() => setShowAccount(false)}
                status={syncStatus}
                setStatus={setSyncStatus}
                refresh={refreshSync}
            />
            {showSettingsModal && (
                <SettingsModal
                    isOpen={showSettingsModal}
                    onClose={() => setShowSettingsModal(false)}
                    status={syncStatus}
                    onSave={(newSettings) => {
                        setMaxReviewsPerDay(newSettings.maxReviewsPerDay);
                    }}
                />
            )}

            {/* TOAST */}
            {toast.isVisible && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    isVisible={toast.isVisible}
                    onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
                />
            )}
        </div>
    );
};

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <Dashboard />
            </ErrorBoundary>
        </QueryClientProvider>
    );
}
