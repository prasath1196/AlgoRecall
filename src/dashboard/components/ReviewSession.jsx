import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python'; // Add typical languages
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { ChevronLeft, ChevronRight, X, Code2, Zap, ExternalLink } from 'lucide-react';
import { calculateNextReview, formatDate } from '../../utils/algorithms';
import HintPanel from '../hints/HintPanel';

const ReviewSession = ({ queue, problems, onComplete, onUpdateProblem }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [selectedLang, setSelectedLang] = useState('javascript');
    const [comparisonTab, setComparisonTab] = useState('saved');
    const [activeTab, setActiveTab] = useState('solve');
    const [noteContent, setNoteContent] = useState('');
    const [isRating, setIsRating] = useState(false); // Prevent rapid clicking
    const [hintsUsed, setHintsUsed] = useState(0);

    const currentUrl = queue[currentIndex];
    const currentProblem = problems.find(p => p.url === currentUrl);

    const safeHighlight = (code) => {
        if (!code) return '';
        try {
            const lang = Prism.languages[selectedLang] || Prism.languages.javascript;
            return Prism.highlight(code, lang, selectedLang);
        } catch (e) {
            return code; // Fallback on error
        }
    };

    const handleNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    useEffect(() => {
        if (currentProblem) {
            setUserCode('');
            setIsRevealed(false);
            setComparisonTab('saved');
            setNoteContent(currentProblem.notes || '');
            setIsRating(false); // Reset rating state on problem change
            setHintsUsed(0);
        }
    }, [currentProblem]);

    if (!currentProblem) return <div>Loading problem...</div>;

    const handlePrevious = () => {
        if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    };

    const handleSkip = () => {
        handleNext();
    };

    const saveNotes = async () => {
        const updated = { ...currentProblem, notes: noteContent };
        await onUpdateProblem(updated);
    };

    // Auto-save notes on blur or explicitly
    const handleNotesBlur = () => {
        saveNotes();
    };

    const handleRating = async (rating) => {
        // Prevent rapid clicking
        if (isRating) return;
        setIsRating(true);

        try {
            // Calculate next review metadata using SM-2 Algorithm
            const { interval, repetition, easeFactor } = calculateNextReview(
                currentProblem.interval || 0,
                currentProblem.repetition_count || 0,
                currentProblem.ease_factor || 2.5,
                rating
            );

            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + interval);

            // Update Problem Object
            const updatedProblem = {
                ...currentProblem,
                notes: noteContent, // Ensure latest notes are saved
                interval,
                repetition_count: repetition,
                ease_factor: easeFactor,
                next_review_at: nextReviewDate.toISOString(),
                review_history: [
                    ...(currentProblem.review_history || []),
                    {
                        date: new Date().toISOString(),
                        quality: rating,
                        hints_used: hintsUsed
                    }
                ]
            };

            // Save and Advance
            await onUpdateProblem(updatedProblem);
            handleNext();
        } finally {
            // Reset after handleNext (which might change problem)
            // isRating will be reset in useEffect when problem changes
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-7xl animate-in fade-in zoom-in duration-300 h-[85vh] flex flex-col">
                {/* Header Control */}
                <div className="mb-4 flex justify-between items-center text-gray-500 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="p-2 rounded-full hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium">Problem {currentIndex + 1} of {queue.length}</span>
                        <button
                            onClick={handleSkip}
                            className="p-2 rounded-full hover:bg-gray-800 transition-colors"
                            title="Skip"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium 
                            ${currentProblem.difficulty === 'Easy' ? 'bg-green-500/10 text-green-400' :
                                currentProblem.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' :
                                    'bg-red-500/10 text-red-400'}`}>
                            {currentProblem.difficulty}
                        </span>
                        <button onClick={onComplete} className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-1.5 rounded-full hover:bg-red-500/20 transition-colors text-sm font-medium">
                            <span className="hidden sm:inline">Exit Session</span>
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-1 w-full">

                    {/* LEFT PANE: PROBLEM STATEMENT (40%) */}
                    <div className="w-2/5 border-r border-gray-800 bg-gray-900 flex flex-col">
                        <div className="p-6 border-b border-gray-800 bg-gray-900/50">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-xl font-bold text-white">{currentProblem.title}</h2>
                                <a
                                    href={currentProblem.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                                    data-testid="solve-in-platform-btn"
                                >
                                    <ExternalLink size={14} />
                                    Solve in {currentProblem.platform || 'Browser'}
                                </a>
                            </div>
                            <div className="flex gap-2">
                                {(Array.isArray(currentProblem.pattern_tag) ? currentProblem.pattern_tag : [currentProblem.pattern_tag]).filter(Boolean).map(tag => (
                                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-800 border border-gray-700 text-gray-300">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto prose prose-invert max-w-none">
                            {/* Description or Fallback */}
                            {currentProblem.description ? (
                                <div className="text-gray-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: currentProblem.description }} />
                            ) : (
                                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 flex flex-col items-center justify-center text-center h-full max-h-[300px]">
                                    <p className="text-gray-400 italic mb-4">
                                        Problem description is not currently available offline.
                                    </p>
                                    <a
                                        href={currentProblem.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium"
                                    >
                                        Open in {currentProblem.platform} <ExternalLink size={14} />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANE: EDITOR / REVIEW (60%) */}
                    <div className="w-3/5 flex flex-col bg-gray-950 relative">
                        {!isRevealed ? (
                            // MODE: SOLVING
                            <div className="flex flex-col h-full">
                                <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-gray-900/30">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium px-2">
                                        <Code2 size={14} /> Code your solution
                                    </div>
                                    <select
                                        value={selectedLang}
                                        onChange={(e) => setSelectedLang(e.target.value)}
                                        className="bg-gray-800 text-gray-300 text-xs rounded-md px-2 py-1 border border-gray-700 outline-none focus:border-indigo-500"
                                    >
                                        <option value="javascript">JavaScript</option>
                                        <option value="python">Python</option>
                                        <option value="java">Java</option>
                                        <option value="cpp">C++</option>
                                    </select>
                                </div>
                                <div className="flex-1 relative overflow-auto font-mono text-sm">
                                    <Editor
                                        value={userCode}
                                        onValueChange={code => setUserCode(code)}
                                        highlight={code => safeHighlight(code)}
                                        padding={20}
                                        className="min-h-full font-mono"
                                        style={{
                                            fontFamily: '"Fira code", "Fira Mono", monospace',
                                            fontSize: 14,
                                            backgroundColor: 'transparent',
                                            color: '#e5e7eb',
                                            minHeight: '100%'
                                        }}
                                        placeholder="// Type your solution here..."
                                    />
                                </div>
                                <HintPanel problem={currentProblem} userCode={userCode} onHintsUsed={(n) => setHintsUsed((prev) => Math.max(prev, n))} />
                                <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-end">
                                    <button
                                        onClick={() => {
                                            setIsRevealed(true);
                                            setComparisonTab(userCode.trim() ? 'mine' : 'saved');
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all text-sm flex items-center gap-2"
                                    >
                                        Reveal Solution <Zap size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // MODE: REVIEW (Comparsion + Notes + Rating) as requested by user
                            <div className="flex flex-col h-full animate-in fade-in duration-300">
                                {/* Comparison Header */}
                                <div className="flex justify-between items-center p-3 border-b border-gray-800 bg-gray-900/30">
                                    <button onClick={() => setIsRevealed(false)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                                        <ChevronLeft size={14} /> Back to Editor
                                    </button>
                                    <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-800">
                                        <button
                                            onClick={() => setComparisonTab('saved')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${comparisonTab === 'saved' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                                        >
                                            Saved Solution
                                        </button>
                                        <button
                                            onClick={() => setComparisonTab('mine')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${comparisonTab === 'mine' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                                        >
                                            Your Answer
                                        </button>
                                    </div>
                                </div>

                                {/* Code Display */}
                                <div className="h-1/2 overflow-auto bg-gray-950 p-4 border-b border-gray-800">
                                    <pre className={`font-mono text-sm ${comparisonTab === 'saved' ? 'text-green-400' : 'text-indigo-400'} whitespace-pre`}>
                                        {comparisonTab === 'saved' ? (currentProblem.code || '// No saved code') : (userCode || '// No answer typed')}
                                    </pre>
                                </div>

                                {/* Notes & Key Insights (Integrated) */}
                                <div className="h-1/2 flex flex-col p-4 bg-gray-900/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-gray-400 font-medium text-xs uppercase tracking-wider">Key Insights</h3>
                                        {noteContent !== (currentProblem.notes || '') && (
                                            <span className="text-xs text-yellow-500 animate-pulse">Unsaved changes...</span>
                                        )}
                                    </div>
                                    <textarea
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        onBlur={handleNotesBlur}
                                        className="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-gray-300 focus:border-indigo-500 outline-none resize-none font-sans leading-relaxed mb-4"
                                        placeholder="What did you miss? Write it down to reinforce the memory..."
                                    />

                                    {/* Rating Footer */}
                                    <div className="flex flex-col items-center gap-3">
                                        <h4 className="text-gray-500 text-xs">How well did you recall this?</h4>
                                        <div className="flex gap-3 w-full justify-center">
                                            <RatingButton label="Again" sub="Fail" color="bg-red-500" onClick={() => handleRating(0)} />
                                            <RatingButton label="Hard" sub="Struggle" color="bg-orange-500" onClick={() => handleRating(1)} />
                                            <RatingButton label="Good" sub="Recall" color="bg-green-500" onClick={() => handleRating(3)} />
                                            <RatingButton label="Easy" sub="Perfect" color="bg-blue-500" onClick={() => handleRating(5)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const RatingButton = ({ label, sub, color, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-24 py-2 rounded-lg bg-gray-800 border-b-4 border-gray-900 hover:-translate-y-1 hover:brightness-110 active:translate-y-0 active:border-b-0 transition-all`}
    >
        <span className={`text-sm font-bold ${color.replace('bg-', 'text-')}`}>{label}</span>
        <span className="text-[10px] text-gray-500">{sub}</span>
    </button>
);

export default ReviewSession;
