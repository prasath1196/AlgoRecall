import './src/index.css';


const ALLOWED_PATTERN_TAGS_SET = new Set([
    'Sliding Window', 'Two Pointers', 'DFS', 'BFS', 'DP', 'Binary Search',
    'Backtracking', 'Greedy', 'Stack', 'Queue', 'Heap', 'Linked List',
    'Tree', 'Graph', 'Hash Table', 'Array', 'String', 'Math',
    'Bit Manipulation', 'Union Find', 'Trie', 'Recursion', 'Sorting'
]);

function cleanUrl(url) {
    // Regex to capture up to the problem slug, ignoring subsequent paths/params
    // Matches: .../problems/{slug}
    const match = url.match(/(.*\/problems\/[^/?#]+)/);
    if (match) {
        return match[1];
    }
    return url;
}


document.addEventListener('DOMContentLoaded', () => {
    // 1. Auto-fill from Active Tab via Message (Robust Method)

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'GET_DETAILS' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('AlgoRecall: Content script not ready or error', chrome.runtime.lastError);
                    // Fallback to basic URL info if content script doesn't respond
                    if (tab.url) {
                        document.getElementById('url').value = cleanUrl(tab.url);
                        let title = tab.title.replace(' - LeetCode', '').trim();
                        document.getElementById('title').value = title;
                        // Platform guess
                        if (tab.url.includes('leetcode.com')) document.getElementById('platform').value = 'LeetCode';
                        else if (tab.url.includes('hackerrank.com')) document.getElementById('platform').value = 'HackerRank';
                        else if (tab.url.includes('codeforces.com')) document.getElementById('platform').value = 'Codeforces';
                        else if (tab.url.includes('takeuforward.org')) document.getElementById('platform').value = 'TUF';
                        else if (tab.url.includes('neetcode.io')) document.getElementById('platform').value = 'Neetcode';
                    }
                } else if (response) {
                    console.log("AlgoRecall: Received details from content script", response);
                    if (response.title) document.getElementById('title').value = response.title;
                    if (response.url) document.getElementById('url').value = response.url;
                    if (response.platform) document.getElementById('platform').value = response.platform;
                    if (response.difficulty && response.difficulty !== 'Unknown') document.getElementById('difficulty').value = response.difficulty;
                    if (response.pattern_tag && response.pattern_tag.length > 0) {
                        document.getElementById('tags').value = response.pattern_tag.join(', ');
                    }
                }
            });
        }
    });

    document.getElementById('saveBtn').addEventListener('click', () => {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = 'Saving...';
        statusDiv.className = 'status';

        const title = document.getElementById('title').value;
        const url = document.getElementById('url').value;
        const platform = document.getElementById('platform').value;
        const difficulty = document.getElementById('difficulty').value;
        const tagsInput = document.getElementById('tags').value;
        const notes = document.getElementById('notes').value;

        if (!title || !url) {
            statusDiv.textContent = 'Error: Title and URL are required.';
            statusDiv.className = 'status error';
            return;
        }

        // Parse and validate tags
        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const validTags = [];
        tags.forEach(t => {
            // Case-sensitive exact match required by API schema description, 
            // but for user friendliness we could try case-insensitive match against allowed list
            // For now, strict check or try to match case from the allowed set
            let match = [...ALLOWED_PATTERN_TAGS_SET].find(allowed => allowed.toLowerCase() === t.toLowerCase());
            if (match) {
                validTags.push(match);
            }
        });

        const data = {
            title,
            url,
            platform,
            difficulty,
            pattern_tag: validTags,
            notes,
            // background script adds these: next_review_at, interval, ease_factor, repetition_count
        };

        chrome.runtime.sendMessage({
            type: 'MANUAL_SAVE',
            payload: data
        }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                statusDiv.className = 'status error';
            } else if (response && response.status === 'success') {
                statusDiv.textContent = 'Saved Successfully!';
                statusDiv.className = 'status success';
                setTimeout(() => window.close(), 1500);
            } else {
                statusDiv.textContent = 'Error: ' + (response ? response.error : 'Unknown error');
                statusDiv.className = 'status error';
            }
        });
    });
    document.getElementById('dashboardBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    });
});

