import { pickProblems, problemWeight } from '../../../src/dashboard/mock/pickProblems';

const NOW = new Date('2026-10-23T00:00:00Z').getTime();
const mk = (url, tag, over = {}) => ({ url, title: url, pattern_tag: tag, next_review_at: '2027-01-01T00:00:00Z', ...over });

describe('pickProblems', () => {
    test('weights: 1, x3 weak, x2 overdue, x6 both', () => {
        expect(problemWeight(mk('a', 'DP'), ['Graphs'], NOW)).toBe(1);
        expect(problemWeight(mk('a', 'Graphs'), ['Graphs'], NOW)).toBe(3);
        expect(problemWeight(mk('a', 'DP', { next_review_at: '2026-01-01T00:00:00Z' }), [], NOW)).toBe(2);
        expect(problemWeight(mk('a', ['DP', 'Graphs'], { next_review_at: '2026-01-01T00:00:00Z' }), ['Graphs'], NOW)).toBe(6);
    });

    test('excludes tombstoned problems', () => {
        const ps = [mk('a', 'X'), mk('b', 'X', { _deleted_at: '2026-01-01' }), mk('c', 'X')];
        const out = pickProblems(ps, { count: 5, rng: () => 0.5, now: NOW });
        expect(out.map((p) => p.url).sort()).toEqual(['a', 'c']);
    });

    test('deterministic with injected rng and no duplicates', () => {
        const ps = [mk('a', 'X'), mk('b', 'X'), mk('c', 'X'), mk('d', 'X')];
        const run = () => pickProblems(ps, { count: 3, rng: () => 0.3, now: NOW }).map((p) => p.url);
        expect(run()).toEqual(run());
        expect(new Set(run()).size).toBe(3);
    });

    test('weak patterns get proportionally more mass', () => {
        const ps = [mk('a', 'DP'), mk('w', 'Graphs')]; // weights 1 and 3, total 4
        const pick = (r) => pickProblems(ps, { count: 1, weakPatterns: ['Graphs'], rng: () => r, now: NOW })[0].url;
        expect(pick(0.1)).toBe('a');   // r*4 = 0.4 < 1
        expect(pick(0.26)).toBe('w');  // 1.04 >= 1
        expect(pick(0.99)).toBe('w');
    });

    test('returns fewer when pool is small', () => {
        expect(pickProblems([mk('a', 'X')], { count: 3, rng: () => 0 })).toHaveLength(1);
        expect(pickProblems([], { count: 3 })).toEqual([]);
    });
});
