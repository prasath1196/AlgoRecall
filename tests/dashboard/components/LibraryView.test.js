import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LibraryView from '../../../src/dashboard/components/LibraryView';
import '@testing-library/jest-dom';

// FIX: Mock all used Lucide icons
jest.mock('lucide-react', () => ({
    Code2: () => <span data-testid="icon-code" />,
    ExternalLink: () => <span data-testid="icon-link" />,
    Pencil: () => <span data-testid="icon-pencil" />,
    Trash2: () => <span data-testid="icon-trash" />,
    Search: () => <span data-testid="icon-search" />,
    Filter: () => <span data-testid="icon-filter" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    BarChart2: () => <span data-testid="icon-chart" />,
    Tag: () => <span data-testid="icon-tag" />,
    Layers: () => <span data-testid="icon-layers" />,
    MoreHorizontal: () => <span data-testid="icon-more" />,
    CheckCircle2: () => <span data-testid="icon-check" />,
    ArrowUpDown: () => <span data-testid="icon-arrow-up-down" />,
    ArrowUp: () => <span data-testid="icon-arrow-up" />,
    ArrowDown: () => <span data-testid="icon-arrow-down" />
}));

describe('LibraryView Component', () => {
    const problems = [
        { title: 'Two Sum', difficulty: 'Easy', platform: 'LeetCode', next_review_at: '2026-01-01T00:00:00Z', url: 'p1', pattern_tag: 'Array' },
        { title: 'Hard Graph', difficulty: 'Hard', platform: 'Codeforces', next_review_at: '2026-01-01T00:00:00Z', url: 'p2', pattern_tag: 'Graph' }
    ];

    test('Renders all problems initially', () => {
        render(<LibraryView problems={problems} />);
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
        expect(screen.getByText('Hard Graph')).toBeInTheDocument();
    });

    test('Filters by Search Text', () => {
        render(<LibraryView problems={problems} />);
        const input = screen.getByPlaceholderText(/Search problem title or tags.../i);

        fireEvent.change(input, { target: { value: 'Graph' } });

        expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
        expect(screen.getByText('Hard Graph')).toBeInTheDocument();
    });

    test('Filters by Difficulty', () => {
        render(<LibraryView problems={problems} />);

        // Use getByRole with name description if possible, or filter by label text nearby.
        // Since we have labels like "Difficulty", we can use that to find the select
        // But for simplicity/robustness in this specific structure:
        const difficultySelect = screen.getAllByRole('combobox')[1]; // 0: Pattern, 1: Difficulty, 2: Platform, 3: Status

        fireEvent.change(difficultySelect, { target: { value: 'Hard' } });

        expect(screen.queryByText('Two Sum')).not.toBeInTheDocument(); // Easy
        expect(screen.getByText('Hard Graph')).toBeInTheDocument(); // Hard
    });

    test('Shows "No problems" message when empty', () => {
        render(<LibraryView problems={[]} />);
        expect(screen.getByText(/No problems found/i)).toBeInTheDocument();
        expect(screen.getByText(/Try adjusting your filters/i)).toBeInTheDocument();
    });

    test('Triggers Edit and Delete actions', () => {
        const mockOnEdit = jest.fn();
        const mockOnDelete = jest.fn();

        render(<LibraryView problems={problems} onEdit={mockOnEdit} onDelete={mockOnDelete} />);

        // Find Edit Button (Pencil) - Assuming first row
        const editBtns = screen.getAllByTestId('icon-pencil');
        fireEvent.click(editBtns[0].closest('button'));
        expect(mockOnEdit).toHaveBeenCalledWith(problems[0]);

        // Find Delete Button (Trash)
        const deleteBtns = screen.getAllByTestId('icon-trash');
        fireEvent.click(deleteBtns[0].closest('button'));
        expect(mockOnDelete).toHaveBeenCalledWith(problems[0].url);
    });

    test('Paginates results correctly', () => {
        const manyProblems = Array.from({ length: 20 }, (_, i) => ({
            title: `Problem ${i + 1}`,
            difficulty: 'Medium',
            platform: 'LeetCode',
            next_review_at: '2026-01-01',
            url: `p${i}`,
            pattern_tag: 'test'
        }));

        render(<LibraryView problems={manyProblems} />);

        // Items per page is 8 (based on component logic)
        expect(screen.getByText('Problem 1')).toBeInTheDocument();
        expect(screen.getByText('Problem 8')).toBeInTheDocument();
        expect(screen.queryByText('Problem 9')).not.toBeInTheDocument(); // 9th item on next page

        const nextButton = screen.getByText('Next');
        fireEvent.click(nextButton);

        expect(screen.getByText('Problem 9')).toBeInTheDocument();
        expect(screen.queryByText('Problem 1')).not.toBeInTheDocument();

        const prevButton = screen.getByText('Previous');
        fireEvent.click(prevButton);

        expect(screen.getByText('Problem 1')).toBeInTheDocument();
    });

    test('Problem title is not a hyperlink (row click opens recall)', () => {
        const problems = [
            { url: 'https://leetcode.com/problems/two-sum', title: 'Two Sum', difficulty: 'Easy', pattern_tag: 'Array', platform: 'LeetCode', next_review_at: '2026-01-01' }
        ];

        render(<LibraryView problems={problems} onEdit={jest.fn()} onDelete={jest.fn()} onProblemClick={jest.fn()} />);

        // Problem title should exist as text but NOT as a link
        const titleElement = screen.getByText('Two Sum');
        expect(titleElement).toBeInTheDocument();
        expect(titleElement.tagName).not.toBe('A'); // Should NOT be an anchor tag
    });

    // === SORTING TESTS ===
    describe('Sorting', () => {
        test('Clicking column header sorts by that column (ascending)', () => {
            const problems = [
                { url: 'p1', title: 'Zebra Problem', difficulty: 'Easy', pattern_tag: 'Array', platform: 'LeetCode', next_review_at: '2026-01-01' },
                { url: 'p2', title: 'Apple Problem', difficulty: 'Medium', pattern_tag: 'Tree', platform: 'LeetCode', next_review_at: '2026-01-02' }
            ];

            render(<LibraryView problems={problems} onEdit={jest.fn()} onDelete={jest.fn()} onProblemClick={jest.fn()} />);

            // Click Problem header to sort by title
            fireEvent.click(screen.getByText('Problem'));

            // Apple should come before Zebra (ascending)
            const rows = screen.getAllByRole('row');
            expect(rows[1]).toHaveTextContent('Apple Problem');
        });

        test('Clicking same column header toggles sort direction', () => {
            const problems = [
                { url: 'p1', title: 'Apple', difficulty: 'Easy', pattern_tag: 'Array', platform: 'LC', next_review_at: '2026-01-01' },
                { url: 'p2', title: 'Zebra', difficulty: 'Medium', pattern_tag: 'Tree', platform: 'LC', next_review_at: '2026-01-02' }
            ];

            render(<LibraryView problems={problems} onEdit={jest.fn()} onDelete={jest.fn()} onProblemClick={jest.fn()} />);

            // Click Problem header twice to sort descending
            fireEvent.click(screen.getByText('Problem'));
            fireEvent.click(screen.getByText('Problem'));

            // Zebra should come before Apple (descending)
            const rows = screen.getAllByRole('row');
            expect(rows[1]).toHaveTextContent('Zebra');
        });

        test('Sorting by Next Review orders by date', () => {
            const problems = [
                { url: 'p1', title: 'Later', difficulty: 'Easy', pattern_tag: 'A', platform: 'LC', next_review_at: '2026-03-01' },
                { url: 'p2', title: 'Earlier', difficulty: 'Easy', pattern_tag: 'B', platform: 'LC', next_review_at: '2026-01-01' }
            ];

            render(<LibraryView problems={problems} onEdit={jest.fn()} onDelete={jest.fn()} onProblemClick={jest.fn()} />);

            // Click Next Review header
            fireEvent.click(screen.getByText('Next Review'));

            // Earlier date should come first
            const rows = screen.getAllByRole('row');
            expect(rows[1]).toHaveTextContent('Earlier');
        });

        test('Sorting by Interval orders by numeric value', () => {
            const problems = [
                { url: 'p1', title: 'Short', difficulty: 'Easy', pattern_tag: 'A', platform: 'LC', next_review_at: '2026-01-01', interval: 1 },
                { url: 'p2', title: 'Long', difficulty: 'Easy', pattern_tag: 'B', platform: 'LC', next_review_at: '2026-01-01', interval: 30 }
            ];

            render(<LibraryView problems={problems} onEdit={jest.fn()} onDelete={jest.fn()} onProblemClick={jest.fn()} />);

            // Click Interval header
            fireEvent.click(screen.getByText('Interval'));

            // Short interval should come first
            const rows = screen.getAllByRole('row');
            expect(rows[1]).toHaveTextContent('Short');
        });
    });
});
