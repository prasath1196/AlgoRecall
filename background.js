import { saveProblem, openDB } from './db.js';

// Initialize DB immediately so it shows up in DevTools
openDB().then(() => console.log('AlgoRecall: DB Initialized')).catch(err => console.error('AlgoRecall: DB Init Failed', err));



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SUBMISSION_DETECTED' || message.type === 'MANUAL_SAVE') {
        handleDataSubmission(message.payload).then(response => {
            sendResponse({ status: 'success', data: response });
        }).catch(error => {
            console.error('AlgoRecall: Submission failed', error);
            sendResponse({ status: 'error', error: error.toString() });
        });
        return true; // Keep the message channel open for async response
    }
});

async function handleDataSubmission(data) {
    // Calculate next_review_at (Tomorrow)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    data.next_review_at = tomorrow.toISOString();

    // Ensure types
    data.interval = 1;
    data.ease_factor = 2.5;
    data.repetition_count = 0;

    console.log('AlgoRecall: Processing data...', data);

    try {
        // Save to IndexedDB (asynchronously, await ensures completion)
        try {
            await saveProblem(data);
            console.log('AlgoRecall: Saved to IndexedDB');
        } catch (dbError) {
            console.error('AlgoRecall: Failed to save to IndexedDB', dbError);
            throw dbError;
        }

        return { status: 'saved_local' };

    } catch (error) {
        console.error('AlgoRecall: Error processing submission', error);
        throw error;
    }
}
