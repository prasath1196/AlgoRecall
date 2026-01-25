import React from 'react';
import { render, screen } from '@testing-library/react';
import MasteryWidget from '../../../src/dashboard/components/MasteryWidget';
import '@testing-library/jest-dom';

// FIX: Mock Lucide icon
jest.mock('lucide-react', () => ({
    TrendingUp: () => <span data-testid="icon-trending" />
}));

describe('MasteryWidget Component', () => {
    const mockStats = {
        Mastered: 5,
        Reviewing: 3,
        Learning: 2,
        Unrated: 0
    };
    const total = 10;

    test('Renders correct counts and total', () => {
        render(<MasteryWidget stats={mockStats} total={total} />);

        expect(screen.getByText('10')).toBeInTheDocument(); // Total

        // "5" appears in big stats AND in progress bar legend
        const fives = screen.getAllByText('5');
        expect(fives.length).toBeGreaterThanOrEqual(2);
    });

    test('Calculates percentages correctly', () => {
        render(<MasteryWidget stats={mockStats} total={total} />);

        // 5/10 = 50%
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('Handles Zero State gracefully', () => {
        const zeroStats = { Mastered: 0, Reviewing: 0, Learning: 0, Unrated: 0 };
        render(<MasteryWidget stats={zeroStats} total={0} />);

        expect(screen.getByText('0%')).toBeInTheDocument();
    });
});
