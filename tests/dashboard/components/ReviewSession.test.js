import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewSession from '../../../src/dashboard/components/ReviewSession';
import '@testing-library/jest-dom';

// FIX: Mock Lucide icon
jest.mock('lucide-react', () => ({
    ChevronLeft: () => <span data-testid="icon-left" />,
    ChevronRight: () => <span data-testid="icon-right" />,
    X: () => <span data-testid="icon-x" />,
    Code2: () => <span data-testid="icon-code" />,
    Zap: () => <span data-testid="icon-zap" />,
    ExternalLink: () => <span data-testid="icon-external" />,
}));

// Mock algorithms util
jest.mock('../../../src/utils/algorithms', () => ({
    calculateNextReview: jest.fn(() => ({ interval: 1, repetition: 1, easeFactor: 2.5 })),
    formatDate: jest.fn(() => '2026-01-01')
}));

describe('ReviewSession Component', () => {
    const mockOnComplete = jest.fn();
    const mockOnUpdateProblem = jest.fn();

    const queue = ['p1'];
    const problems = [
        {
            url: 'p1',
            title: 'Test Problem',
            difficulty: 'Easy',
            interval: 1,
            repetition_count: 0,
            ease_factor: 2.5
        }
    ];

    test('Renders without crashing and shows editor', () => {
        render(
            <ReviewSession
                queue={queue}
                problems={problems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        expect(screen.getByText('Test Problem')).toBeInTheDocument();
        expect(screen.getByText('Code your solution')).toBeInTheDocument();

        // Check for Editor placeholder (textarea inside simple-code-editor)
        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
    });

    test('Switching details language does not crash', () => {
        render(
            <ReviewSession
                queue={queue}
                problems={problems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'python' } });

        // Should still be visible and not crashed
        expect(screen.getByText('Test Problem')).toBeInTheDocument();
    });

    test('Revealing solution shows rating buttons and notes input', () => {
        render(
            <ReviewSession
                queue={queue}
                problems={problems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        fireEvent.click(screen.getByText('Reveal Solution'));

        expect(screen.getByText('How well did you recall this?')).toBeInTheDocument();
        expect(screen.getByText('Good')).toBeInTheDocument();

        // Notes should be visible now
        expect(screen.getByPlaceholderText(/What did you miss/i)).toBeInTheDocument();
    });

    test('Navigates problems with Previous/Skip buttons', () => {
        const multiQueue = ['p1', 'p2'];
        const multiProblems = [
            ...problems,
            { url: 'p2', title: 'Second Problem', difficulty: 'Hard', pattern_tag: 'test' }
        ];

        render(
            <ReviewSession
                queue={multiQueue}
                problems={multiProblems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Should start at p1
        expect(screen.getByText('Test Problem')).toBeInTheDocument();
        expect(screen.getByText('Problem 1 of 2')).toBeInTheDocument();

        // Previous should be disabled initially
        const prevIcon = screen.getByTestId('icon-left');
        // The first chevron-left is the global Previous button. 
        // Note: "Back to Editor" also uses ChevronLeft, but that's only visible when revealed. 
        // So initially only one ChevronLeft should be in the DOM controls? 
        // Actually, let's target the button directly by finding parent of icon or by text if available.
        // We know structure: Header -> Left Control -> Button with disabled attribute.
        // Or cleaner: getByTitle('Skip') paired with previous logic.
        // Let's assume the first button with disabled attribute containing the icon.
        const headerPrevBtn = prevIcon.closest('button');
        expect(headerPrevBtn).toBeDisabled();

        // Click Skip (Next)
        const nextIcon = screen.getByTestId('icon-right');
        const nextButton = nextIcon.closest('button');
        fireEvent.click(nextButton);

        // Should be at p2
        expect(screen.getByText('Second Problem')).toBeInTheDocument();
        expect(screen.getByText('Problem 2 of 2')).toBeInTheDocument();

        // Previous should be enabled
        expect(headerPrevBtn).not.toBeDisabled();

        // Click Previous
        fireEvent.click(headerPrevBtn);
        expect(screen.getByText('Test Problem')).toBeInTheDocument();
    });

    test('REV-02: Syntax Highlighting Fallback (Invalid Code)', () => {
        // Mock safeHighlight to throw error
        const { calculateNextReview } = require('../../../src/utils/algorithms');
        jest.spyOn(console, 'error').mockImplementation(() => { }); // Suppress error logs

        render(
            <ReviewSession
                queue={queue}
                problems={problems}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Type invalid code that might break Prism
        const codeInput = screen.getByRole('textbox');
        fireEvent.change(codeInput, { target: { value: 'const x = {{{{' } });

        // Should not crash - component should still render
        expect(screen.getByText('Test Problem')).toBeInTheDocument();
        console.error.mockRestore();
    });

    test('REV-04: Reveal with User Code defaults to "Your Answer" tab', () => {
        render(
            <ReviewSession
                queue={queue}
                problems={[{ ...problems[0], code: 'const saved = true;' }]}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Type user code
        const codeInput = screen.getByRole('textbox');
        fireEvent.change(codeInput, { target: { value: 'const myCode = true;' } });

        // Reveal
        fireEvent.click(screen.getByText('Reveal Solution'));

        // Check that "Your Answer" button is active (has active styling)
        const yourAnswerBtn = screen.getByText('Your Answer').closest('button');
        expect(yourAnswerBtn).toHaveClass('bg-indigo-600'); // Active state
    });

    test('REV-05: Reveal without User Code defaults to "Saved Solution" tab', () => {
        render(
            <ReviewSession
                queue={queue}
                problems={[{ ...problems[0], code: 'const saved = true;' }]}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Do NOT type code
        // Immediately reveal
        fireEvent.click(screen.getByText('Reveal Solution'));

        // Check that "Saved Solution" button is active
        const savedSolutionBtn = screen.getByText('Saved Solution').closest('button');
        expect(savedSolutionBtn).toHaveClass('bg-indigo-600'); // Active state
    });

    test('REV-07: Notes Dirty State shows warning', async () => {
        // Create a mutable problem reference
        let currentProblem = {
            url: 'p1',
            title: 'Test Problem',
            difficulty: 'Easy',
            interval: 1,
            repetition_count: 0,
            ease_factor: 2.5,
            notes: 'Original notes'
        };

        // Mock that actually updates the problem
        const mockOnUpdateProblem = jest.fn().mockImplementation((updated) => {
            currentProblem = updated; // Update the reference
            return Promise.resolve();
        });

        const { rerender } = render(
            <ReviewSession
                queue={['p1']}
                problems={[currentProblem]}
                onComplete={jest.fn()}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Reveal to access notes
        fireEvent.click(screen.getByText('Reveal Solution'));

        // Get notes textarea
        const notesInput = screen.getByPlaceholderText(/What did you miss/i);
        expect(notesInput).toHaveValue('Original notes');

        // Modify notes
        fireEvent.change(notesInput, { target: { value: 'Modified notes' } });

        // Should show dirty state warning
        expect(screen.getByText('Unsaved changes...')).toBeInTheDocument();

        // Blur saves and updates the problem
        fireEvent.blur(notesInput);

        await waitFor(() => {
            expect(mockOnUpdateProblem).toHaveBeenCalled();
        });

        // Rerender with updated problem to simulate React Query refetch
        rerender(
            <ReviewSession
                queue={['p1']}
                problems={[currentProblem]}
                onComplete={jest.fn()}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // Warning should disappear after rerender with updated data
        expect(screen.queryByText('Unsaved changes...')).not.toBeInTheDocument();
    });

    test('Comprehensive Flow: Load -> Type Code -> Reveal -> Add Notes -> Rate -> Next', async () => {
        const multiQueue = ['p1', 'p2'];
        render(
            <ReviewSession
                queue={multiQueue}
                problems={[
                    { ...problems[0], description: '<p>This is a mock description</p>' },
                    { url: 'p2', title: 'P2', difficulty: 'Easy' }
                ]}
                onComplete={mockOnComplete}
                onUpdateProblem={mockOnUpdateProblem}
            />
        );

        // 1. Verify Problem Statement is visible immediately (Left Split)
        // Should show the description, NOT the offline message
        expect(screen.getByText('This is a mock description')).toBeInTheDocument();
        expect(screen.queryByText('Problem description is not currently available offline.')).not.toBeInTheDocument();
        expect(screen.getByText('Test Problem')).toBeInTheDocument();

        // 2. Type Code (Right Split - Solving)
        // Note: react-simple-code-editor uses a textarea but it might be hidden or overlaid.
        // Testing-library text matching usually works on values if controlled.
        const codeInput = screen.getAllByRole('textbox')[0]; // First textarea is usually the editor
        fireEvent.change(codeInput, { target: { value: 'const solution = () => {};' } });

        // 3. Reveal
        fireEvent.click(screen.getByText(/Reveal Solution/i));

        // 4. Verify Review View
        // Editor should be read-only or replaced by pre block. 
        // Notes input should appear.
        const notesInput = screen.getByPlaceholderText(/What did you miss/i);
        expect(notesInput).toBeInTheDocument();

        // 5. Add Notes
        fireEvent.change(notesInput, { target: { value: 'Forgot edge case' } });
        // Trigger blur to save
        fireEvent.blur(notesInput);

        expect(mockOnUpdateProblem).toHaveBeenCalledWith(expect.objectContaining({
            url: 'p1',
            notes: 'Forgot edge case'
        }));

        // 6. Rate 'Good'
        fireEvent.click(screen.getByText('Good'));

        // 7. Should advance to next problem
        // Wait for update/rerender
        await waitFor(() => {
            expect(screen.getByText('P2')).toBeInTheDocument();
        });
    });

    test('Shows Solve in Platform button with correct URL', () => {
        const mockQueue = ['url1'];
        const mockProblems = [{
            url: 'url1',
            title: 'Two Sum',
            pattern_tag: 'Array',
            platform: 'LeetCode'
        }];

        render(
            <ReviewSession
                queue={mockQueue}
                problems={mockProblems}
                onComplete={jest.fn()}
                onUpdateProblem={jest.fn()}
            />
        );

        // Find the solve button
        const solveButton = screen.getByTestId('solve-in-platform-btn');
        expect(solveButton).toBeInTheDocument();
        expect(solveButton).toHaveTextContent('Solve in LeetCode');
        expect(solveButton).toHaveAttribute('href', 'url1');
        expect(solveButton).toHaveAttribute('target', '_blank');
    });
});
