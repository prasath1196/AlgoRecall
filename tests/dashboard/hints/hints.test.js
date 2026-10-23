import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewSession from '../../../src/dashboard/components/ReviewSession';
import { FEATURES } from '../../../src/sync/config';

const mockRequestHint = jest.fn();
jest.mock('../../../src/sync/profile.js', () => ({ requestHint: (...a) => mockRequestHint(...a) }), { virtual: true });

jest.mock('lucide-react', () => ({
    ChevronLeft: () => <span />, ChevronRight: () => <span />, X: () => <span />,
    Code2: () => <span />, Zap: () => <span />, ExternalLink: () => <span />,
}));
jest.mock('../../../src/utils/algorithms', () => ({
    calculateNextReview: jest.fn(() => ({ interval: 1, repetition: 1, easeFactor: 2.5 })),
    formatDate: jest.fn(() => '2026-01-01'),
}));

const problems = [{
    url: 'p1', title: 'Two Sum', difficulty: 'Easy', pattern_tag: ['Arrays'], description: '<p>desc</p>',
    interval: 1, repetition_count: 0, ease_factor: 2.5, code: 'x', review_history: [],
}];

const setup = () => {
    const onUpdateProblem = jest.fn().mockResolvedValue();
    const onComplete = jest.fn();
    render(<ReviewSession queue={['p1']} problems={problems} onComplete={onComplete} onUpdateProblem={onUpdateProblem} />);
    return { onUpdateProblem, onComplete };
};

beforeEach(() => { mockRequestHint.mockReset(); FEATURES.aiHints = true; });
afterEach(() => { FEATURES.aiHints = false; });

test('hint control is NOT rendered by default (flag off)', () => {
    FEATURES.aiHints = false;
    setup();
    expect(screen.queryByText('Stuck? Get a hint')).not.toBeInTheDocument();
});

test('never auto-requests', () => {
    setup();
    expect(screen.getByText('Stuck? Get a hint')).toBeInTheDocument();
    expect(mockRequestHint).not.toHaveBeenCalled();
});

test('progressive levels, remaining badge, no user_code when empty', async () => {
    setup();
    mockRequestHint.mockResolvedValueOnce({ hint: 'think pointers', remaining_today: 19 });
    fireEvent.click(screen.getByText('Stuck? Get a hint'));
    await screen.findByText('think pointers');
    expect(mockRequestHint).toHaveBeenLastCalledWith({
        url: 'p1', title: 'Two Sum', pattern_tags: ['Arrays'], difficulty: 'Easy', description: '<p>desc</p>', level: 1,
    });
    expect(mockRequestHint.mock.calls[0][0]).not.toHaveProperty('user_code');
    expect(screen.getByTestId('hint-remaining')).toHaveTextContent('19 left today');

    mockRequestHint.mockResolvedValueOnce({ hint: 'use a map', remaining_today: 18 });
    fireEvent.click(screen.getByText('Next hint: Key insight'));
    await screen.findByText('use a map');
    expect(mockRequestHint.mock.calls[1][0].level).toBe(2);

    mockRequestHint.mockResolvedValueOnce({ hint: 'step list', remaining_today: 17 });
    fireEvent.click(screen.getByText('Next hint: Outline'));
    await screen.findByText('step list');
    expect(mockRequestHint.mock.calls[2][0].level).toBe(3);
    expect(screen.getByText('All hints used')).toBeDisabled();
    expect(screen.getByText(/Level 1 · Nudge/)).toBeInTheDocument();
});

test('sends user_code only when typed', async () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('// Type your solution here...'), { target: { value: 'def f(): pass' } });
    mockRequestHint.mockResolvedValueOnce({ hint: 'h', remaining_today: 1 });
    fireEvent.click(screen.getByText('Stuck? Get a hint'));
    await screen.findByText('h');
    expect(mockRequestHint.mock.calls[0][0].user_code).toBe('def f(): pass');
});

test.each([
    [{ error: 'limit_reached' }, 'Daily hint limit reached — resets tomorrow'],
    [{ error: 'not_configured' }, "AI hints aren't set up yet"],
    [{ error: 'not_signed_in' }, 'Sign in to use AI hints'],
])('error %j', async (resp, msg) => {
    setup();
    mockRequestHint.mockResolvedValueOnce(resp);
    fireEvent.click(screen.getByText('Stuck? Get a hint'));
    expect(await screen.findByRole('alert')).toHaveTextContent(msg);
});

test('hints_used saved on review_history entry', async () => {
    const { onUpdateProblem } = setup();
    mockRequestHint.mockResolvedValueOnce({ hint: 'a', remaining_today: 5 });
    fireEvent.click(screen.getByText('Stuck? Get a hint'));
    await screen.findByText('a');
    mockRequestHint.mockResolvedValueOnce({ hint: 'b', remaining_today: 4 });
    fireEvent.click(screen.getByText('Next hint: Key insight'));
    await screen.findByText('b');

    fireEvent.click(screen.getByText('Reveal Solution'));
    fireEvent.click(screen.getByText('Good'));
    await waitFor(() => expect(onUpdateProblem).toHaveBeenCalled());
    const entry = onUpdateProblem.mock.calls[0][0].review_history[0];
    expect(entry).toEqual({ date: expect.any(String), quality: 3, hints_used: 2 });
});
