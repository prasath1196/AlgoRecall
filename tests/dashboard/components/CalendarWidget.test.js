import React from 'react';
import { render, screen } from '@testing-library/react';
import CalendarWidget from '../../../src/dashboard/components/CalendarWidget';
import '@testing-library/jest-dom';

jest.mock('lucide-react', () => ({
    Calendar: () => <span data-testid="icon-calendar" />
}));

describe('CalendarWidget Component', () => {
    // Helper to create problem with history
    const createLog = (dateStr) => ({ date: dateStr, quality: 3 });
    const problems = [
        { review_history: [createLog('2026-01-01T10:00:00Z'), createLog('2026-01-01T15:00:00Z')] }, // 2 reviews on Jan 1
        { review_history: [createLog('2026-01-02T10:00:00Z')] } // 1 review on Jan 2
    ];

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-31T12:00:00Z')); // End of Jan 2026
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('Calculates Streak Correctly', () => {
        render(<CalendarWidget data={problems} />);

        // Find the "Current Streak" label, then find the count within that semantic section
        // Or simply check that '2 days' is present if that's how it's formatted
        // Based on component: <span ...>{currentStreak} <span ...>days</span></span>

        // Let's use getAllByText('2') and ensure at least one exists, or query loosely
        const streaks = screen.getAllByText('2');
        expect(streaks.length).toBeGreaterThan(0);

        // Both Current and Max streak might be "2 days"
        // Ensure that we find *some* element saying "2 days"
        const elements = screen.getAllByText((content, element) => {
            return element.textContent === '2 days' && element.classList.contains('font-bold');
        });
        expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    test('Renders Month Name correctly', () => {
        render(<CalendarWidget data={problems} />);
        // Expect "January 2026"
        expect(screen.getByText(/January 2026/i)).toBeInTheDocument();
    });
});
