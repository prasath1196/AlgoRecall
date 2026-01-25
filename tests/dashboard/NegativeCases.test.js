import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/dashboard/App';
import ReviewSession from '../../src/dashboard/components/ReviewSession';
import { useProblems } from '../../src/dashboard/hooks/useProblems';
import '@testing-library/jest-dom';

// Mock hooks and dependencies
jest.mock('../../src/dashboard/hooks/useProblems');
jest.mock('lucide-react', () => ({
    Brain: () => <span data-testid="icon-brain" />,
    Plus: () => <span data-testid="icon-plus" />,
    Settings: () => <span data-testid="icon-settings" />,
    ChevronLeft: () => <span data-testid="icon-left" />,
    ChevronRight: () => <span data-testid="icon-right" />,
    X: () => <span data-testid="icon-x" />,
    Code2: () => <span data-testid="icon-code" />,
    Zap: () => <span data-testid="icon-zap" />,
    ExternalLink: () => <span data-testid="icon-external" />,
    Save: () => <span data-testid="icon-save" />,
    Shield: () => <span data-testid="icon-shield" />,
    Clock: () => <span data-testid="icon-clock" />,
    Play: () => <span data-testid="icon-play" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    CheckCircle2: () => <span data-testid="icon-check" />,
    Trash2: () => <span data-testid="icon-trash" />,
    Edit: () => <span data-testid="icon-edit" />,
    Search: () => <span data-testid="icon-search" />,
    Filter: () => <span data-testid="icon-filter" />,
    BarChart2: () => <span data-testid="icon-barchart" />,
    Tag: () => <span data-testid="icon-tag" />,
    Layers: () => <span data-testid="icon-layers" />,
    MoreHorizontal: () => <span data-testid="icon-more" />,
    Pencil: () => <span data-testid="icon-pencil" />,
    ArrowUpDown: () => <span data-testid="icon-arrow-up-down" />,
    ArrowUp: () => <span data-testid="icon-arrow-up" />,
    ArrowDown: () => <span data-testid="icon-arrow-down" />,
}));

jest.mock('../../src/dashboard/components/ErrorBoundary', () => ({ children }) => <div>{children}</div>);
jest.mock('../../src/dashboard/components/CalendarWidget', () => () => <div data-testid="calendar-widget" />);
jest.mock('../../src/dashboard/components/MasteryWidget', () => () => <div data-testid="mastery-widget" />);
jest.mock('react-simple-code-editor', () => ({ value, onValueChange }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onValueChange(e.target.value)} />
));

describe('Negative & Edge Case Testing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    test('NEG-01: Corrupt Data - Missing Title', () => {
        const corruptProblems = [{
            url: 'corrupt1',
            title: '', // Empty title instead of undefined
            difficulty: 'Easy',
            next_review_at: '2026-01-01T00:00:00Z'
        }];

        useProblems.mockReturnValue({
            problems: corruptProblems,
            isLoading: false,
            saveProblem: jest.fn(),
            deleteProblem: jest.fn()
        });

        render(<App />);

        // Should render gracefully (no crash)
        expect(screen.getByText('AlgoRecall')).toBeInTheDocument();

        // Library view should handle missing title
        fireEvent.click(screen.getByText('All Problems'));
        // Should not crash - check that the view still renders
        expect(screen.getByText('All Problems')).toBeInTheDocument();
    });

    test('NEG-01: Corrupt Data - Missing Code in ReviewSession', () => {
        const mockOnComplete = jest.fn();
        const mockOnUpdateProblem = jest.fn();

        const corruptProblem = {
            url: 'p1',
            title: 'Problem Without Code',
            difficulty: 'Easy',
            interval: 1,
            repetition_count: 0,
            ease_factor: 2.5
            // code field is missing
        };

        render(
            <ReviewSession
                queue={['p1']}
                problems={[corruptProblem]}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Should render without crashing
        expect(screen.getByText('Problem Without Code')).toBeInTheDocument();

        // Reveal should show fallback for missing code
        fireEvent.click(screen.getByText('Reveal Solution'));
        expect(screen.getByText('// No saved code')).toBeInTheDocument();
    });

    test('NEG-02: Rapid Clicking - Rating Buttons', async () => {
        const mockOnComplete = jest.fn();
        const mockOnUpdateProblem = jest.fn().mockResolvedValue(undefined);

        const multiQueue = ['p1', 'p2', 'p3'];
        const multiProblems = [
            { url: 'p1', title: 'P1', difficulty: 'Easy', interval: 1, repetition_count: 0, ease_factor: 2.5 },
            { url: 'p2', title: 'P2', difficulty: 'Easy', interval: 1, repetition_count: 0, ease_factor: 2.5 },
            { url: 'p3', title: 'P3', difficulty: 'Easy', interval: 1, repetition_count: 0, ease_factor: 2.5 }
        ];

        render(
            <ReviewSession
                queue={multiQueue}
                problems={multiProblems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        expect(screen.getByText('Problem 1 of 3')).toBeInTheDocument();

        // Reveal
        fireEvent.click(screen.getByText('Reveal Solution'));

        // Rapidly click Good multiple times
        const goodBtn = screen.getByText('Good').closest('button');
        fireEvent.click(goodBtn);
        fireEvent.click(goodBtn);
        fireEvent.click(goodBtn);

        // Should only trigger once and advance to next problem
        await waitFor(() => {
            expect(screen.getByText('Problem 2 of 3')).toBeInTheDocument();
        });

        // Verify saveProblem was called only once
        expect(mockOnUpdateProblem).toHaveBeenCalledTimes(1);
    });

    test('NEG-03: Empty Queue Handling', () => {
        useProblems.mockReturnValue({
            problems: [], // No problems
            isLoading: false,
            saveProblem: jest.fn(),
            deleteProblem: jest.fn()
        });

        render(<App />);

        // Should show empty state gracefully
        // QueueView should handle empty list without crashing
        expect(screen.getByText('AlgoRecall')).toBeInTheDocument();

        // Check for "All Caught Up" or empty state message
        // (The actual message depends on implementation)
        // Just verify no crash
        const queueTab = screen.getByText('Recall Queue');
        expect(queueTab).toBeInTheDocument();
    });

    test('NEG-04: Storage Error Handling in saveProblem', async () => {
        const mockSaveProblem = jest.fn().mockRejectedValue(new Error('Storage quota exceeded'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        useProblems.mockReturnValue({
            problems: [],
            isLoading: false,
            saveProblem: mockSaveProblem,
            deleteProblem: jest.fn()
        });

        render(<App />);

        // Try to add a problem
        fireEvent.click(screen.getByText('Add Problem'));
        fireEvent.change(screen.getByPlaceholderText(/e.g. Two Sum/i), { target: { value: 'Test Problem' } });

        const saveBtn = screen.getByRole('button', { name: /Save Problem/i });
        fireEvent.submit(saveBtn.closest('form'));

        // Wait for error handling
        await waitFor(() => {
            expect(mockSaveProblem).toHaveBeenCalled();
        });

        // Should not crash - verify app is still functional
        expect(screen.getByText('AlgoRecall')).toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });
});
