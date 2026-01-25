import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/dashboard/App';
import { useProblems } from '../../src/dashboard/hooks/useProblems';
import '@testing-library/jest-dom';

// Mocks
jest.mock('../../src/dashboard/hooks/useProblems');
jest.mock('lucide-react', () => ({
    Brain: () => <span data-testid="icon-brain" />,
    Plus: () => <span data-testid="icon-plus" />,
    Settings: () => <span data-testid="icon-settings" />,
    LogOut: () => <span data-testid="icon-logout" />,
}));

// Mock Sub-Components to isolate App Logic
jest.mock('../../src/dashboard/components/QueueView', () => () => <div data-testid="queue-view">Queue View</div>);
jest.mock('../../src/dashboard/components/LibraryView', () => () => <div data-testid="library-view">Library View</div>);
jest.mock('../../src/dashboard/components/AddProblemModal', () => ({ isOpen }) => (isOpen ? <div data-testid="add-problem-modal">Add Problem Modal</div> : null));
jest.mock('../../src/dashboard/SettingsModal', () => ({ isOpen }) => (isOpen ? <div data-testid="settings-modal">Settings Modal</div> : null));
jest.mock('../../src/dashboard/components/ReviewSession', () => () => <div data-testid="review-session">Review Session</div>);

describe('App Integration / Global Navigation', () => {
    beforeEach(() => {
        useProblems.mockReturnValue({
            problems: [],
            isLoading: false,
            saveProblem: jest.fn(),
            deleteProblem: jest.fn()
        });
    });

    test('Renders Dashboard with Queue View by default', () => {
        render(<App />);
        expect(screen.getByText('AlgoRecall')).toBeInTheDocument();
        expect(screen.getByTestId('queue-view')).toBeInTheDocument();
        expect(screen.queryByTestId('library-view')).not.toBeInTheDocument();
    });

    test('Navigates between Tabs', () => {
        render(<App />);

        // Switch to All Problems
        fireEvent.click(screen.getByText('All Problems'));
        expect(screen.getByTestId('library-view')).toBeInTheDocument();
        expect(screen.queryByTestId('queue-view')).not.toBeInTheDocument();

        // Switch back to Queue
        fireEvent.click(screen.getByText('Recall Queue'));
        expect(screen.getByTestId('queue-view')).toBeInTheDocument();
    });

    test('Opens Add Problem Modal', () => {
        render(<App />);

        // Click Add Problem Button
        fireEvent.click(screen.getByText('Add Problem'));

        expect(screen.getByTestId('add-problem-modal')).toBeInTheDocument();
    });

    test('Opens Settings Modal', () => {
        render(<App />);

        // Click Settings Icon Button
        const settingsBtn = screen.getByTestId('icon-settings').closest('button');
        fireEvent.click(settingsBtn);

        expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
});
