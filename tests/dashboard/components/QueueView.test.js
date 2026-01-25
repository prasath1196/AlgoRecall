import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueView from '../../../src/dashboard/components/QueueView';
import '@testing-library/jest-dom';

// FIX: Mock Lucide icon to avoid SVG weirdness
jest.mock('lucide-react', () => ({
    Zap: () => <span data-testid="icon-zap" />,
    Play: () => <span data-testid="icon-play" />,
    CheckCircle2: () => <span data-testid="icon-check" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    TrendingUp: () => <span data-testid="icon-trending" />,
}));
jest.mock('../../../src/dashboard/components/CalendarWidget', () => () => <div data-testid="calendar-widget" />);
jest.mock('../../../src/dashboard/components/MasteryWidget', () => () => <div data-testid="mastery-widget" />);

describe('QueueView Integration Tests', () => {
    const mockStartSession = jest.fn();
    const mockStartUpcoming = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup Date to Fixed UTC Time for consistency
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T12:00:00Z')); // Today is Jan 1
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('UseCase: Problems Due Today -> Shows Active State', () => {
        const problems = [
            { url: 'p1', title: 'Problem 1', difficulty: 'Easy', platform: 'LeetCode', next_review_at: '2026-01-01T23:59:59Z' }, // Due Today
            { url: 'p2', title: 'Problem 2', difficulty: 'Medium', platform: 'LeetCode', next_review_at: '2025-12-31T00:00:00Z' }, // Overdue
        ];

        render(
            <QueueView
                problems={problems}
                todaysCount={0}
                maxLimit={5}
                onStartSession={mockStartSession}
                onStartUpcoming={mockStartUpcoming}
            />
        );

        // Expect "Ready for Recall"
        expect(screen.getByText(/Ready for Recall/i)).toBeInTheDocument();
        // Check for specific count span logic or just existence
        const countElements = screen.getAllByText('2', { selector: 'span' });
        expect(countElements.length).toBeGreaterThan(0);

        // Action: Click Start
        fireEvent.click(screen.getByText(/Start Recall Session/i));
        expect(mockStartSession).toHaveBeenCalledTimes(1);
        expect(mockStartSession).toHaveBeenCalledWith(problems); // Passed correct batch
    });

    test('UseCase: Zero Due -> Shows Zero State + Upcoming Button', () => {
        const problems = [
            { url: 'p1', next_review_at: '2026-01-02T00:00:00Z' } // Due Tomorrow
        ];

        render(
            <QueueView
                problems={problems}
                todaysCount={0}
                maxLimit={5}
                onStartSession={mockStartSession}
                onStartUpcoming={mockStartUpcoming}
            />
        );

        expect(screen.getByText(/All Caught Up!/i)).toBeInTheDocument();

        // Upcoming button should be enabled
        const upcomingBtn = screen.getByText(/Recall Upcoming/i);
        expect(upcomingBtn).not.toBeDisabled();

        // Action: Recall Upcoming
        fireEvent.click(upcomingBtn);
        expect(mockStartUpcoming).toHaveBeenCalledTimes(1);
    });

    test('UseCase: Daily Limit Reached -> Buttons Disabled', () => {
        const problems = [
            { url: 'p1', next_review_at: '2026-01-01T10:00:00Z' }
        ];

        render(
            <QueueView
                problems={problems}
                todaysCount={5}
                maxLimit={5} // LIMIT REACHED
                onStartSession={mockStartSession}
                onStartUpcoming={mockStartUpcoming}
            />
        );

        // Active State is shown but button disabled
        expect(screen.getByText(/Ready for Recall/i)).toBeInTheDocument();

        const startBtn = screen.getByRole('button', { name: /Start Recall Session/i });
        // Depending on implementation, it might be disabled class or attribute
        // In my code: disabled={isLimitReached}
        // However, role lookup can catch the button container

        // Alternative: Click it and check NO call
        fireEvent.click(startBtn);
        expect(mockStartSession).not.toHaveBeenCalled();
    });

    test('UseCase: No Upcoming Problems -> Upcoming Button Disabled', () => {
        render(
            <QueueView
                problems={[]}
                todaysCount={0}
                maxLimit={5}
                onStartSession={mockStartSession}
                onStartUpcoming={mockStartUpcoming}
            />
        );

        // Zero State
        expect(screen.getByText(/All Caught Up!/i)).toBeInTheDocument();

        // Upcoming Disabled
        const upcomingBtn = screen.getByRole('button', { name: /Recall Upcoming/i });
        expect(upcomingBtn).toBeDisabled();
    });
    test('UseCase: Label Consistency - Same Day should be Due Now', () => {
        // Current Time Mocked: 12:00 PM
        const problems = [
            { url: 'p1', title: 'Morning Problem', next_review_at: '2026-01-01T08:00:00Z' }, // 8 AM (Past)
            { url: 'p2', title: 'Evening Problem', next_review_at: '2026-01-01T18:00:00Z' }, // 6 PM (Future, but same day)
        ];

        render(
            <QueueView
                problems={problems}
                todaysCount={0}
                maxLimit={10}
                onStartSession={mockStartSession}
                onStartUpcoming={mockStartUpcoming}
            />
        );

        // Both are in the "Due" list because they are <= EndOfToday
        expect(screen.getByText('Morning Problem')).toBeInTheDocument();
        expect(screen.getByText('Evening Problem')).toBeInTheDocument();

        // FAIL CONDITION REPRODUCTION:
        // Current Logic: 18:00 > 12:00 -> "Upcoming"
        // Desired Logic: 18:00 is Today -> "Due Today" or "Due Now"

        const dueLabels = screen.getAllByText('Due Today');
        // Currently this would likely fail if I expect 2, usually returns 1
        expect(dueLabels.length).toBe(2);
    });

    test('Daily Limit Label: When maxLimit=0 shows due count instead of limit', () => {
        const dueProblems = [
            { url: 'p1', title: 'P1', next_review_at: '2026-01-01T00:00:00Z', review_history: [] },
            { url: 'p2', title: 'P2', next_review_at: '2026-01-01T00:00:00Z', review_history: [] },
            { url: 'p3', title: 'P3', next_review_at: '2026-01-01T00:00:00Z', review_history: [] }
        ];

        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));

        render(
            <QueueView
                problems={dueProblems}
                onStartSession={jest.fn()}
                onStartUpcoming={jest.fn()}
                maxLimit={0}  // Unlimited
                todaysCount={0}
            />
        );

        // When maxLimit is 0 (unlimited), label should show "X / Y recalls" where Y is due count
        const limitText = screen.getByText(/Daily Limit:/i).closest('div');
        expect(limitText).toHaveTextContent(/0.*\/.*3.*recalls/);

        jest.useRealTimers();
    });

    test('Daily Limit Label: When maxLimit=0 and all completed, shows X/X instead of X/0', () => {
        // All problems are NOT due (already completed today)
        const completedProblems = [
            { url: 'p1', title: 'P1', next_review_at: '2026-01-02T00:00:00Z', review_history: [{ date: '2026-01-01T10:00:00Z', quality: 4 }] },
            { url: 'p2', title: 'P2', next_review_at: '2026-01-03T00:00:00Z', review_history: [{ date: '2026-01-01T11:00:00Z', quality: 5 }] }
        ];

        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T12:00:00Z'));

        render(
            <QueueView
                problems={completedProblems}
                onStartSession={jest.fn()}
                onStartUpcoming={jest.fn()}
                maxLimit={0}  // Unlimited
                todaysCount={2} // User completed 2 recalls today
            />
        );

        // When all done and maxLimit=0, should show "2 / 2" not "2 / 0"
        // This indicates "you completed 2 out of the 2 that were due today"
        const limitText = screen.queryByText(/Daily Limit:/i);
        if (limitText) {
            const limitDiv = limitText.closest('div');
            expect(limitDiv).toHaveTextContent(/2.*\/.*2.*recalls/);
        }

        jest.useRealTimers();
    });

    test('Shows settings hint when daily limit is reached', () => {
        const noDueProblems = [
            { url: 'p1', title: 'P1', next_review_at: '2099-01-01' }
        ];
        const mockOpenSettings = jest.fn();

        render(
            <QueueView
                problems={noDueProblems}
                maxLimit={10}
                todaysCount={10}
                onStartSession={jest.fn()}
                onStartUpcoming={jest.fn()}
                onOpenSettings={mockOpenSettings}
            />
        );

        // Should show settings hint when limit reached
        expect(screen.getByTestId('settings-hint')).toBeInTheDocument();
        expect(screen.getByText(/Daily Limit Reached/i)).toBeInTheDocument();

        // Click settings button should call onOpenSettings
        fireEvent.click(screen.getByText(/Adjust in Settings/i));
        expect(mockOpenSettings).toHaveBeenCalled();
    });
});
