import { calculateNextReview, formatDate } from '../../src/utils/algorithms';

describe('Algorithm: calculateNextReview (SM-2)', () => {
    test('Initial Review (Rep 0) -> Interval 1', () => {
        const result = calculateNextReview(1, 0, 2.5, 4);
        expect(result.interval).toBe(1);
        expect(result.repetition).toBe(1);
    });

    test('Second Review (Rep 1) -> Interval 6', () => {
        const result = calculateNextReview(1, 1, 2.5, 4);
        expect(result.interval).toBe(6);
        expect(result.repetition).toBe(2);
    });

    test('Good Quality (4) -> Ease Factor remains same (SM-2 standard)', () => {
        const initialEF = 2.5;
        const result = calculateNextReview(6, 2, initialEF, 4);
        expect(result.easeFactor).toBe(initialEF); // deviation is 0
        expect(result.interval).toBeGreaterThan(6);
    });

    test('Perfect Quality (5) -> Ease Factor increases more', () => {
        const result = calculateNextReview(6, 2, 2.5, 5);
        expect(result.easeFactor).toBeCloseTo(2.6, 1);
    });

    test('Poor Quality (<3) -> Reset to 1', () => {
        const result = calculateNextReview(10, 5, 2.8, 2); // Forgot the answer
        expect(result.interval).toBe(1);
        expect(result.repetition).toBe(0);
        expect(result.easeFactor).toBeLessThan(2.8); // EF drops
    });

    test('Ease Factor Minimum Cap (1.3)', () => {
        // Force EF down repeatedly
        let ef = 1.35;
        let res = calculateNextReview(1, 1, ef, 2); // Drop
        expect(res.easeFactor).toBe(1.3); // Floored
    });
});

describe('Utility: formatDate', () => {
    test('Formats date as YYYY-MM-DD', () => {
        const d = new Date('2023-12-25T10:00:00Z');
        expect(formatDate(d)).toBe('2023-12-25');
    });
});
