import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import MockInterviewView from '../../../src/dashboard/mock/MockInterviewView';

jest.mock('lucide-react', () => ({
    ExternalLink: () => <span />, Clock: () => <span />, X: () => <span />,
}));

const problems = [
    { url: 'u1', title: 'Two Sum', difficulty: 'Easy', pattern_tag: 'Arrays', code: 'SAVED1' },
    { url: 'u2', title: 'Word Ladder', difficulty: 'Hard', pattern_tag: 'Graphs', code: 'SAVED2' },
    { url: 'u3', title: 'Coin Change', difficulty: 'Medium', pattern_tag: 'DP', code: 'SAVED3' },
    { url: 'u4', title: 'Deleted', difficulty: 'Medium', pattern_tag: 'DP', _deleted_at: 'x' },
];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('setup -> timer -> score -> summary and saves ratings', () => {
    const onSaveRating = jest.fn();
    const onExit = jest.fn();
    render(<MockInterviewView problems={problems} weakPatterns={['Graphs']} onExit={onExit} onSaveRating={onSaveRating} />);

    fireEvent.click(screen.getByRole('button', { name: '15 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    expect(screen.getByTestId('timer')).toHaveTextContent('15:00');

    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByTestId('timer')).toHaveTextContent('14:55');

    // pause stops the clock
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.getByTestId('timer')).toHaveTextContent('14:55');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    fireEvent.click(screen.getByRole('button', { name: 'Score 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Score 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Score 5' }));

    expect(onSaveRating).toHaveBeenCalledTimes(3);
    expect(onSaveRating.mock.calls.map((c) => c[1])).toEqual([5, 0, 5]);
    const urls = onSaveRating.mock.calls.map((c) => c[0].url);
    expect(urls).not.toContain('u4');

    expect(screen.getByTestId('overall-score')).toHaveTextContent('67%');
    expect(screen.getByTestId('time-used')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(onExit).toHaveBeenCalled();
});

test('reveal is gated until time is up or confirmed', () => {
    render(<MockInterviewView problems={problems} weakPatterns={[]} onExit={() => {}} onSaveRating={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText('Reveal my saved solution'));
    expect(screen.queryByTestId('saved-solution')).toBeNull();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('Reveal my saved solution'));
    expect(screen.getByTestId('saved-solution')).toBeInTheDocument();
    confirmSpy.mockRestore();
});

test('reveal needs no confirmation once time is up', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    render(<MockInterviewView problems={problems} weakPatterns={[]} onSaveRating={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '15 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start interview' }));
    act(() => { jest.advanceTimersByTime(15 * 60 * 1000 + 1000); });
    expect(screen.getByTestId('timer')).toHaveTextContent('00:00');
    fireEvent.click(screen.getByText('Reveal my saved solution'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('saved-solution')).toBeInTheDocument();
    confirmSpy.mockRestore();
});
