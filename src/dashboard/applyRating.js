import { calculateNextReview } from '../utils/algorithms';

// Same SM-2 update ReviewSession applies when a problem is rated.
export function applyRating(problem, quality, now = new Date()) {
    const { interval, repetition, easeFactor } = calculateNextReview(
        problem.interval || 0,
        problem.repetition_count || 0,
        problem.ease_factor || 2.5,
        quality
    );
    const next = new Date(now);
    next.setDate(next.getDate() + interval);
    return {
        ...problem,
        interval,
        repetition_count: repetition,
        ease_factor: easeFactor,
        next_review_at: next.toISOString(),
        review_history: [...(problem.review_history || []), { date: now.toISOString(), quality }],
    };
}
