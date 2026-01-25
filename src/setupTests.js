import '@testing-library/jest-dom';

// TextEncoder polyfill for JSDOM
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Chrome API
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
        },
    },
    runtime: {
        sendMessage: jest.fn(),
    },
};

// Mock IndexedDB wrapper (db.js)
jest.mock('../db.js', () => ({
    getAllProblems: jest.fn(),
    saveProblem: jest.fn(),
    deleteProblem: jest.fn(),
}));

// Mock Lucide icons globally
jest.mock('lucide-react', () => ({
    Search: () => <span data-testid="icon-search" />,
    Filter: () => <span data-testid="icon-filter" />,
    Calendar: () => <span data-testid="icon-calendar" />,
    BarChart2: () => <span data-testid="icon-barchart" />,
    Tag: () => <span data-testid="icon-tag" />,
    Layers: () => <span data-testid="icon-layers" />,
    MoreHorizontal: () => <span data-testid="icon-more" />,
    ExternalLink: () => <span data-testid="icon-external" />,
    Pencil: () => <span data-testid="icon-pencil" />,
    Trash2: () => <span data-testid="icon-trash" />,
    CheckCircle2: () => <span data-testid="icon-check" />,
    ArrowUpDown: () => <span data-testid="icon-arrow-up-down" />,
    ArrowUp: () => <span data-testid="icon-arrow-up" />,
    ArrowDown: () => <span data-testid="icon-arrow-down" />,
    ChevronLeft: () => <span data-testid="icon-chevron-left" />,
    ChevronRight: () => <span data-testid="icon-chevron-right" />,
    X: () => <span data-testid="icon-x" />,
    Brain: () => <span data-testid="icon-brain" />,
    Plus: () => <span data-testid="icon-plus" />,
    Zap: () => <span data-testid="icon-zap" />,
    Play: () => <span data-testid="icon-play" />,
    Settings: () => <span data-testid="icon-settings" />,
    Clock: () => <span data-testid="icon-clock" />,
    Save: () => <span data-testid="icon-save" />,
    Shield: () => <span data-testid="icon-shield" />,
}));
