import {
    toRemoteProblem, fromRemoteProblem, mergeReviewHistory, toRemoteReviews, shouldApplyRemote,
} from '../../src/sync/mapping.js';

const local = {
    url: 'https://leetcode.com/problems/two-sum/', title: 'Two Sum', platform: 'LeetCode', difficulty: 'Easy',
    pattern_tag: ['Array', 'Hash Table'], code: 'x', language: 'js', description: 'd', notes: 'n',
    interval: 3, repetition_count: 2, ease_factor: 2.4, next_review_at: '2026-02-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z', last_updated_at: '2026-01-10T00:00:00.000Z',
    review_history: [{ date: '2026-01-02T00:00:00.000Z', quality: 4 }],
    local_saved_at: '2026-01-10T00:00:00.000Z', _dirty: true, _deleted_at: null, custom_field: { a: 1 },
};

describe('mapping', () => {
    test('toRemoteProblem maps names, strips local-only fields, puts unknown into extra', () => {
        const r = toRemoteProblem(local);
        expect(r.pattern_tags).toEqual(['Array', 'Hash Table']);
        expect(r.client_updated_at).toBe(local.last_updated_at);
        expect(r.deleted_at).toBeNull();
        expect(r.extra).toEqual({ custom_field: { a: 1 } });
        for (const k of ['_dirty', 'local_saved_at', 'pattern_tag', 'last_updated_at', '_deleted_at', 'review_history']) {
            expect(r).not.toHaveProperty(k);
        }
    });

    test('round-trips', () => {
        const back = fromRemoteProblem(toRemoteProblem(local), local);
        expect(back).toEqual({ ...local, _dirty: false });
    });

    test('tombstone round-trip', () => {
        const t = { ...local, _deleted_at: '2026-01-11T00:00:00.000Z' };
        const r = toRemoteProblem(t);
        expect(r.deleted_at).toBe(t._deleted_at);
        expect(fromRemoteProblem(r, null)._deleted_at).toBe(t._deleted_at);
    });

    test('fromRemoteProblem ignores server columns', () => {
        const rec = fromRemoteProblem({ ...toRemoteProblem(local), user_id: 'u', updated_at: 'x' }, null);
        expect(rec).not.toHaveProperty('user_id');
        expect(rec).not.toHaveProperty('updated_at');
        expect(rec.review_history).toEqual([]);
    });

    test('review union dedups by (date, quality) and sorts', () => {
        const a = [{ date: '2026-01-03T00:00:00.000Z', quality: 3 }, { date: '2026-01-01T00:00:00.000Z', quality: 5 }];
        const b = [{ date: '2026-01-01T00:00:00+00:00', quality: 5 }, { date: '2026-01-02T00:00:00.000Z', quality: 1 }];
        const m = mergeReviewHistory(a, b);
        expect(m.map(x => x.date)).toEqual([
            '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z',
        ]);
        expect(mergeReviewHistory(undefined, null)).toEqual([]);
    });

    test('toRemoteReviews', () => {
        expect(toRemoteReviews(local)).toEqual([{ url: local.url, reviewed_at: '2026-01-02T00:00:00.000Z', quality: 4 }]);
    });

    test('LWW', () => {
        expect(shouldApplyRemote(undefined, { client_updated_at: 'x' })).toBe(true);
        expect(shouldApplyRemote(local, { client_updated_at: '2026-01-11T00:00:00.000Z' })).toBe(true);
        expect(shouldApplyRemote(local, { client_updated_at: '2026-01-09T00:00:00.000Z' })).toBe(false);
        expect(shouldApplyRemote(local, { client_updated_at: local.last_updated_at })).toBe(false);
    });
});
