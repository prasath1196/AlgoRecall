import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../../../src/dashboard/components/ErrorBoundary';
import '@testing-library/jest-dom';

// FIX: Mock Lucide icon
jest.mock('lucide-react', () => ({
    AlertTriangle: () => <span data-testid="icon-alert" />,
    RefreshCcw: () => <span data-testid="icon-refresh" />,
}));

const ThrowError = () => {
    throw new Error('Test Crash');
};

describe('ErrorBoundary Component', () => {
    // Prevent console.error from cluttering output during this test
    const originalError = console.error;
    beforeAll(() => {
        console.error = jest.fn();
    });

    afterAll(() => {
        console.error = originalError;
    });

    test('Renders children when no error', () => {
        render(
            <ErrorBoundary>
                <div>Safe Content</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Safe Content')).toBeInTheDocument();
    });

    test('Renders fallback UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/Test Crash/)).toBeInTheDocument();
    });
});
