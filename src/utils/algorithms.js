/**
 * SuperMemo-2 (SM-2) Spaced Repetition Algorithm
 * @param {number} previousInterval - Days since last review
 * @param {number} repetition - Number of successful reviews
 * @param {number} easeFactor - Difficulty multiplier (start 2.5)
 * @param {number} quality - User rating (0-5)
 * @returns {Object} { interval, repetition, easeFactor }
 */
export const calculateNextReview = (previousInterval, repetition, easeFactor, quality) => {
    let nextInterval;
    let nextRepetition;
    let nextEaseFactor;

    if (quality >= 3) {
        // Correct response
        if (repetition === 0) {
            nextInterval = 1;
        } else if (repetition === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(previousInterval * easeFactor);
        }
        nextRepetition = repetition + 1;
    } else {
        // Incorrect response: Reset
        nextRepetition = 0;
        nextInterval = 1;
    }

    // Update Ease Factor
    // FF = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    nextEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (nextEaseFactor < 1.3) nextEaseFactor = 1.3; // Minimum Cap

    return {
        interval: nextInterval,
        repetition: nextRepetition,
        easeFactor: nextEaseFactor
    };
};

/**
 * Format Date to YYYY-MM-DD
 */
export const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};
