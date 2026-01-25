import { saveProblem, openDB, getDueProblemsCount, getProblem } from './db.js';

// Initialize DB immediately so it shows up in DevTools
openDB().then(() => console.log('AlgoRecall: DB Initialized')).catch(err => console.error('AlgoRecall: DB Init Failed', err));



import { calculateNextReview } from './src/utils/algorithms.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SUBMISSION_DETECTED' || message.type === 'MANUAL_SAVE') {
        // Legacy/Manual save without rating (defaults to 1 day)
        handleDataSubmission(message.payload).then(response => {
            sendResponse({ status: 'success', data: response });
        }).catch(error => {
            console.error('AlgoRecall: Submission failed', error);
            sendResponse({ status: 'error', error: error.toString() });
        });
        return true;
    }

    if (message.type === 'SUBMISSION_RATED') {
        handleRatedSubmission(message.payload.data, message.payload.rating).then(response => {
            sendResponse({ status: 'success', data: response });
        }).catch(error => {
            console.error('AlgoRecall: Rated submission failed', error);
            sendResponse({ status: 'error', error: error.toString() });
        });
        return true;
    }

    if (message.type === 'CHECK_DUE_REVIEWS') {
        getDueProblemsCount().then(count => {
            sendResponse({ count });
        }).catch(err => {
            console.error('AlgoRecall: Error checking due reviews', err);
            sendResponse({ count: 0 });
        });
        return true;
    }
});

async function handleRatedSubmission(data, rating) {
    console.log('AlgoRecall: Processing rated submission...', data.title, 'Rating:', rating);

    // 1. Fetch existing problem state to apply SM-2 correctly
    let previousInterval = 0;
    let previousRepetition = 0;
    let previousEaseFactor = 2.5;

    // We can't use getProblem directly if not imported, need to import it.
    // Assuming getProblem is imported from db.js (I will update imports in next step or assume checked)
    // Actually I need to update the imports block of this file too.

    try {
        // Try to find existing
        // Note: I need to ensure getProblem is imported.
        // For now, I'll rely on saveProblem handling the merge, BUT valid SM-2 requires reading *before* calculating.
        // So I MUST import getProblem.

        let existing = null;
        try {
            existing = await getProblem(data.url);
        } catch (e) { /* ignore if not found */ }

        if (existing) {
            previousInterval = existing.interval || 0;
            previousRepetition = existing.repetition_count || 0;
            previousEaseFactor = existing.ease_factor || 2.5;
        }

        // 2. Calculate New Schedule
        const { interval, repetition, easeFactor } = calculateNextReview(
            previousInterval,
            previousRepetition,
            previousEaseFactor,
            rating
        );

        // 3. Update Data
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        data.interval = interval;
        data.repetition_count = repetition;
        data.ease_factor = easeFactor;
        data.next_review_at = nextReviewDate.toISOString();

        // Append to history
        const newHistoryItem = {
            date: new Date().toISOString(),
            quality: rating
        };

        // We let saveProblem handle merging history, but we should probably prepare it here if we want to be safe,
        // or ensure saveProblem doesn't overwrite it improperly.
        // saveProblem logic: "Preserve metadata...". It doesn't explicitly append history unless we pass it? 
        // saveProblem doesn't seem to have specific history merging logic in the snippet I saw, it puts the whole object.
        // So we should append history here.

        if (existing && existing.review_history) {
            data.review_history = [...existing.review_history, newHistoryItem];
        } else {
            data.review_history = [newHistoryItem];
        }

        // 4. Save
        await saveProblem(data);
        console.log('AlgoRecall: Saved rated problem', data.next_review_at);
        return { status: 'saved_rated', next_review_at: data.next_review_at };

    } catch (error) {
        console.error('AlgoRecall: Error handling rated submission', error);
        throw error;
    }
}

async function handleDataSubmission(data) {
    // Default fallback (e.g. Manual Save from Popup, no rating provided)
    // We treat this as a "Learning" step or just default 1 day.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    data.next_review_at = tomorrow.toISOString();
    data.interval = 1;
    data.ease_factor = 2.5;
    data.repetition_count = 0;
    // No history update for manual save without rating? Or maybe add a default entry?
    // Let's keep it simple for now.

    try {
        await saveProblem(data);
        return { status: 'saved_manual' };
    } catch (error) {
        throw error;
    }
}
