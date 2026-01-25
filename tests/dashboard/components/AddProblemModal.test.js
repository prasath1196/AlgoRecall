import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddProblemModal from '../../../src/dashboard/components/AddProblemModal';
import '@testing-library/jest-dom';

// Mocks
jest.mock('lucide-react', () => ({
    Save: () => <span data-testid="icon-save" />,
    X: () => <span data-testid="icon-x" />,
}));
// Mock Modal to simple div
jest.mock('../../../src/dashboard/components/Modal', () => ({ isOpen, children, onClose }) => (
    isOpen ? <div data-testid="modal-content"><button onClick={onClose} data-testid="close-modal">X</button>{children}</div> : null
));

describe('AddProblemModal Component', () => {
    const mockOnClose = jest.fn();
    const mockOnSave = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Renders Add New Problem layout correctly', () => {
        render(<AddProblemModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />);

        expect(screen.getByText('Add New Problem')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. Two Sum/i)).toBeInTheDocument();
        expect(screen.getByText('Save Problem')).toBeInTheDocument();
    });

    test('Renders Edit Problem layout with initial data', () => {
        const initialData = {
            title: 'Existing Problem',
            url: 'https://leetcode.com/existing',
            platform: 'LeetCode',
            difficulty: 'Hard',
            pattern_tag: ['Graph'],
            notes: 'Test note'
        };

        render(<AddProblemModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} initialData={initialData} />);

        expect(screen.getByText('Edit Problem')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Existing Problem')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://leetcode.com/existing')).toBeInTheDocument();
        // Check Select values
        expect(screen.getByDisplayValue('Hard')).toBeInTheDocument();
        // Check Notes
        expect(screen.getByDisplayValue('Test note')).toBeInTheDocument();

        expect(screen.getByText('Update Problem')).toBeInTheDocument();
    });

    test('Submits form data correctly', async () => {
        render(<AddProblemModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />);

        // Fill inputs
        fireEvent.change(screen.getByPlaceholderText(/e.g. Two Sum/i), { target: { value: 'New Problem' } });
        fireEvent.change(screen.getByPlaceholderText(/https:\/\/leetcode.com/i), { target: { value: 'https://leetcode.com/new' } });

        // Submit
        fireEvent.click(screen.getByText('Save Problem'));

        await waitFor(() => {
            expect(mockOnSave).toHaveBeenCalled();
        });

        // Verify FormData argument (partial check)
        const formData = mockOnSave.mock.calls[0][0];
        expect(formData.get('title')).toBe('New Problem');
        expect(formData.get('url')).toBe('https://leetcode.com/new');
    });

    test('Closes on Cancel button click', () => {
        render(<AddProblemModal isOpen={true} onClose={mockOnClose} onSave={mockOnSave} />);

        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnClose).toHaveBeenCalled();
    });
});
