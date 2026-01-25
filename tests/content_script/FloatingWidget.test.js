/**
 * @jest-environment jsdom
 */
import FloatingWidget from '../../src/content/FloatingWidget.js';

describe('FloatingWidget', () => {
    let widget;

    beforeEach(() => {
        document.body.innerHTML = '';
        widget = new FloatingWidget();
    });

    test('should inject widget into DOM on mount', () => {
        widget.mount();
        const element = document.getElementById('algorecall-widget');
        expect(element).not.toBeNull();
        expect(element.tagName).toBe('DIV');
    });

    test('should display default state (logo only) when no problem overdue', () => {
        widget.mount();
        widget.update(0);

        const badge = document.getElementById('algorecall-badge');
        expect(badge).toBeNull(); // No badge if 0 due
    });

    test('should display red badge with count when problems are due', () => {
        widget.mount();
        widget.update(5);

        const badge = document.getElementById('algorecall-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toBe('5');
    });

    test('should have a click handler that dispatches event or calls callback', () => {
        const mockCallback = jest.fn();
        widget = new FloatingWidget(mockCallback);
        widget.mount();

        const element = document.getElementById('algorecall-widget');
        element.click();

        expect(mockCallback).toHaveBeenCalled();
    });

    test('should preserve position or default to bottom-right', () => {
        widget.mount();
        const element = document.getElementById('algorecall-widget');
        expect(element.style.position).toBe('fixed');
        expect(element.style.bottom).toBe('20px');
        expect(element.style.right).toBe('20px');
    });

    test('should NOT trigger click if dragged', () => {
        const mockCallback = jest.fn();
        widget = new FloatingWidget(mockCallback);
        widget.mount();
        const element = document.getElementById('algorecall-widget');

        // Simulate Drag
        const mousedown = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
        const mousemove = new MouseEvent('mousemove', { clientX: 110, clientY: 110 });
        const mouseup = new MouseEvent('mouseup', { clientX: 110, clientY: 110 });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });

        element.dispatchEvent(mousedown);
        document.dispatchEvent(mousemove);
        document.dispatchEvent(mouseup);
        element.dispatchEvent(click);

        expect(mockCallback).not.toHaveBeenCalled();
    });

    test('should trigger click if NOT dragged (static click)', () => {
        const mockCallback = jest.fn();
        widget = new FloatingWidget(mockCallback);
        widget.mount();
        const element = document.getElementById('algorecall-widget');

        // Simulate Static Click
        const mousedown = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
        const mouseup = new MouseEvent('mouseup', { clientX: 100, clientY: 100 });
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });

        element.dispatchEvent(mousedown);
        document.dispatchEvent(mouseup);
        element.dispatchEvent(click);

        expect(mockCallback).toHaveBeenCalled();
    });

    test('should show rating mode correctly', () => {
        const mockCallback = jest.fn();
        widget = new FloatingWidget(() => { });
        widget.mount();

        widget.showRating(mockCallback);

        const element = document.getElementById('algorecall-widget');
        const rateButtons = element.querySelectorAll('.ar-rate-btn');

        expect(rateButtons.length).toBe(4);
        expect(element.innerHTML).toContain('Rate:');

        // Simulate clicking "Good" (rating 3)
        const goodBtn = Array.from(rateButtons).find(b => b.textContent === 'Good');
        goodBtn.click();

        expect(mockCallback).toHaveBeenCalledWith(3);

        // Should revert to normal (icon)
        expect(element.querySelector('svg')).not.toBeNull();
    });
});
