import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LibraryView from '../../../src/dashboard/components/LibraryView';
import '@testing-library/jest-dom';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
    Search: () => <div data-testid="icon-search" />,
    Filter: () => <div data-testid="icon-filter" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    BarChart2: () => <div data-testid="icon-chart" />,
    Tag: () => <div data-testid="icon-tag" />,
    Layers: () => <div data-testid="icon-layers" />,
    MoreHorizontal: () => <div data-testid="icon-more" />,
    ExternalLink: () => <div data-testid="icon-external" />,
    Pencil: () => <div data-testid="icon-pencil" />,
    Trash2: () => <div data-testid="icon-trash" />,
    CheckCircle2: () => <div data-testid="icon-check" />,
    ArrowUpDown: () => <div data-testid="icon-sort" />,
    ArrowUp: () => <div data-testid="icon-up" />,
    ArrowDown: () => <div data-testid="icon-down" />
}));

describe('LibraryView Propagation', () => {
    const mockProblems = [
        {
            title: 'Two Sum',
            url: 'https://leetcode.com/problems/two-sum/',
            platform: 'LeetCode',
            difficulty: 'Easy',
            pattern_tag: 'Array',
            next_review_at: new Date().toISOString(),
            interval: 1,
            created_at: new Date().toISOString()
        }
    ];

    test('Clicking DELETE button should NOT trigger row click', () => {
        const onEdit = jest.fn();
        const onDelete = jest.fn();
        const onProblemClick = jest.fn();

        render(
            <LibraryView
                problems={mockProblems}
                onEdit={onEdit}
                onDelete={onDelete}
                onProblemClick={onProblemClick}
            />
        );

        // Find the Delete button (Trash icon container)
        // Since we mock Trash2, we look for the button containing it.
        // The button has title="Delete"
        const deleteBtn = screen.getByTitle('Delete');

        // Click it
        fireEvent.click(deleteBtn);

        // Expect Delete to be called
        expect(onDelete).toHaveBeenCalledWith(mockProblems[0].url);

        // Expect Row Click (onProblemClick) NOT to be called
        expect(onProblemClick).not.toHaveBeenCalled();
    });

    test('Clicking EDIT button should NOT trigger row click', () => {
        const onEdit = jest.fn();
        const onDelete = jest.fn();
        const onProblemClick = jest.fn();

        render(
            <LibraryView
                problems={mockProblems}
                onEdit={onEdit}
                onDelete={onDelete}
                onProblemClick={onProblemClick}
            />
        );

        const editBtn = screen.getByTitle('Edit');
        fireEvent.click(editBtn);

        expect(onEdit).toHaveBeenCalledWith(mockProblems[0]);
        expect(onProblemClick).not.toHaveBeenCalled();
    });
});
