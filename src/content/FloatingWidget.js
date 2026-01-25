export default class FloatingWidget {
    constructor(onClick) {
        this.onClick = onClick;
        this.element = null;
        this.count = 0;
    }

    mount() {
        if (document.getElementById('algorecall-widget')) return;

        if (!document.body) {
            // If body doesn't exist yet (run_at: document_start), wait for it
            const observer = new MutationObserver(() => {
                if (document.body) {
                    observer.disconnect();
                    this.mount();
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            return;
        }

        // Container
        this.element = document.createElement('div');
        this.element.id = 'algorecall-widget';
        this.element.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #1e1e2e; /* Dark background */
            border: 2px solid #6366f1; /* Indigo border */
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        // Logo / Icon
        this.element.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>
            <style>
                #algorecall-widget:hover { transform: scale(1.1); }
                #algorecall-widget:active { transform: scale(0.95); }
                #algorecall-badge {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    background-color: #ef4444; /* Red 500 */
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    min-width: 18px;
                    height: 18px;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid #1e1e2e;
                    padding: 0 4px;
                }
            </style>
        `;

        // Proper Logo SVG (Brain/Zap hybrid approximation above, replacing with cleaner Zap)
        this.element.querySelector('svg').outerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
            </svg>
        `;


        // Draggable Logic
        let isDragging = false;
        let startX, startY;
        let initialRight, initialBottom;
        let hasMoved = false;

        const onMouseDown = (e) => {
            // Only left mouse button
            if (e.button !== 0) return;

            e.preventDefault(); // Prevent text selection
            isDragging = true;
            hasMoved = false;

            startX = e.clientX;
            startY = e.clientY;

            // Get current computed style positions
            const rect = this.element.getBoundingClientRect();
            // We store position based on Right/Bottom as initialized
            // But to make it draggable freely, we might need to switch to top/left or keep offset logic.
            // Easiest is to stick to bottom/right offsets.
            const style = window.getComputedStyle(this.element);
            initialRight = parseInt(style.right, 10) || 20;
            initialBottom = parseInt(style.bottom, 10) || 20;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // If moved more than small threshold, it's a drag
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
            }

            // Update position (inverted because we use right/bottom)
            // dragging right (positive dx) -> right decreases
            // dragging down (positive dy) -> bottom decreases
            this.element.style.right = `${initialRight - dx}px`;
            this.element.style.bottom = `${initialBottom - dy}px`;
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        // Attach events
        this.element.addEventListener('mousedown', onMouseDown);

        // Handle Click - Only trigger if NOT dragged
        this.element.addEventListener('click', (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (this.onClick) this.onClick(e);
        });

        document.body.appendChild(this.element);
        this.update(this.count); // Render initial state
    }

    update(count) {
        this.count = count;
        if (!this.element) return;

        let badge = document.getElementById('algorecall-badge');

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'algorecall-badge';
                this.element.appendChild(badge);
            }
            badge.textContent = count > 99 ? '99+' : count;
        } else {
            if (badge) badge.remove();
        }
    }

    unmount() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
