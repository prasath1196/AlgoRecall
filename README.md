# AlgoRecall

AlgoRecall is a powerful browser extension designed to help software engineers master Data Structures and Algorithms through **Spaced Repetition**. It seamlessly integrates with platforms like LeetCode and Neetcode to track your problem-solving journey and ensure you never forget a key insight.

## 🚀 Key Features

- **One-Click Scrape**: Instantly save problems, solutions, and tags from LeetCode.
- **Mastery Dashboard**: A premium, dark-themed dashboard to visualize your progress.
- **Spaced Repetition (SM-2)**: Automatically schedules reviews based on your mastery level.
- **Pattern Filtering**: Easily filter problems by unique patterns (e.g., Sliding Window, DP, BFS).
- **Consistency Tracking**: Monthly heatmap and mastery breakdown to keep you motivated.
- **Fast Search**: Instant search through problem titles and custom tags.

## 🛠 Tech Stack

- **Frontend**: React, Tailwind CSS, Vite
- **Storage**: IndexedDB (Local-first, no account required)
- **Icons**: Lucide React
- **Syntax Highlighting**: PrismJS
- **Spaced Repetition**: SuperMemo-2 (SM-2) Algorithm

## 📦 Installation

1. Clone the repository: `git clone <repo-url>`
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder.

## 📖 Usage

1. **Save**: Browse a problem on LeetCode, click the "Record" button in the injected UI or use the popup.
2. **Review**: Open the Dashboard via the popup ("Master DSA") to see what's due today.
3. **Master**: Rate your recall (1-5) to update the next review interval.

---
Built with ❤️ for better recall.
