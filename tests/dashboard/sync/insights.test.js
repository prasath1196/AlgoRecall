import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InsightsSection, { buildHeatmap } from '../../../src/dashboard/sync/Insights';
import App, { queryClient as appQueryClient } from '../../../src/dashboard/App';
import { useProblems } from '../../../src/dashboard/hooks/useProblems';
import { installChrome } from './helpers';

const mockFetchStats = jest.fn();
jest.mock('../../../src/sync/stats.js', () => ({ fetchStats: (...a) => mockFetchStats(...a) }), { virtual: true });
jest.mock('../../../src/dashboard/hooks/useProblems');
jest.mock('../../../src/dashboard/components/QueueView', () => () => <div>Queue View</div>);
jest.mock('../../../src/dashboard/components/ReviewSession', () => ({ queue }) => <div data-testid="review-session">{queue.join(',')}</div>);

const stats = {
    current_streak: 7, longest_streak: 12, total_reviews: 40, retention_rate: 0.82,
    active_days: [{ day: new Date().toISOString().slice(0, 10), count: 3 }],
    weakest_patterns: [{ pattern: 'Graphs', problems: 3, reviews: 6, avg_quality: 2.1, retention: 0.4 }],
};

const wrap = (ui) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

beforeEach(() => { jest.clearAllMocks(); appQueryClient.clear(); installChrome(undefined); });

test('hidden (locked card shown) when stats are null', async () => {
    mockFetchStats.mockResolvedValue(null);
    wrap(<InsightsSection />);
    expect(await screen.findByText('Sign in to unlock cloud insights')).toBeInTheDocument();
    expect(screen.queryByTestId('streak-card')).not.toBeInTheDocument();
});

test('renders streak, retention, focus and heatmap when stats present', async () => {
    mockFetchStats.mockResolvedValue(stats);
    wrap(<InsightsSection />);
    expect(await screen.findByTestId('streak-card')).toHaveTextContent('7');
    expect(screen.getByTestId('streak-milestone')).toBeInTheDocument();
    expect(screen.getByLabelText('Retention rate 82 percent')).toBeInTheDocument();
    expect(screen.getByText('Graphs')).toBeInTheDocument();
    expect(screen.getAllByTestId('heat-cell').length).toBeGreaterThan(300);
    expect(screen.queryByText('Sign in to unlock cloud insights')).not.toBeInTheDocument();
});

test('heatmap spans 53 columns with 5 levels', () => {
    const cells = buildHeatmap([{ day: '2020-01-01', count: 1 }], new Date(2020, 5, 10));
    expect(cells).toHaveLength(53 * 7);
    const days = buildHeatmap([{ day: '2020-06-09', count: 10 }, { day: '2020-06-08', count: 1 }], new Date(2020, 5, 10)).filter(Boolean);
    expect(days.find((d) => d.day === '2020-06-09').level).toBe(4);
    expect(days.find((d) => d.day === '2020-06-08').level).toBe(1);
});

test('Focus mode "Practice these" starts a session filtered by pattern', async () => {
    mockFetchStats.mockResolvedValue(stats);
    useProblems.mockReturnValue({
        problems: [
            { url: 'u1', title: 'A', pattern_tag: ['Graphs', 'BFS'], review_history: [] },
            { url: 'u2', title: 'B', pattern_tag: ['DP'], review_history: [] },
            { url: 'u3', title: 'C', pattern_tag: ['graphs'], review_history: [] },
        ],
        isLoading: false, saveProblem: jest.fn(), deleteProblem: jest.fn(),
    });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Practice these' }));
    expect(screen.getByTestId('review-session')).toHaveTextContent('u1,u3');
});

test('PROBLEMS_CHANGED invalidates problems, refetches and toasts the count', async () => {
    mockFetchStats.mockResolvedValue(null);
    const bus = installChrome(undefined);
    useProblems.mockReturnValue({ problems: [], isLoading: false, saveProblem: jest.fn(), deleteProblem: jest.fn() });
    render(<App />);
    await screen.findByText('Sign in to unlock cloud insights');
    const calls = mockFetchStats.mock.calls.length;
    act(() => bus.emit({ type: 'PROBLEMS_CHANGED', count: 3 }));
    expect(await screen.findByText('Synced 3 changes from another device')).toBeInTheDocument();
    await waitFor(() => expect(mockFetchStats.mock.calls.length).toBeGreaterThan(calls));
});
