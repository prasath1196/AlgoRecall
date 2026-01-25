import './src/index.css';
import { getAllProblems } from './db.js';


import { ALLOWED_PATTERN_TAGS_SET } from './src/constants.js';

function cleanUrl(url) {
    // Regex to capture up to the problem slug, ignoring subsequent paths/params
    // Matches: .../problems/{slug}
    const match = url.match(/(.*\/problems\/[^/?#]+)/);
    if (match) {
        return match[1];
    }
    return url;
}



// DOM ELEMENTS
const tabBtnSave = document.getElementById('tabBtnSave');
const tabBtnReview = document.getElementById('tabBtnReview');
const tabSave = document.getElementById('tabSave');
const tabReview = document.getElementById('tabReview');
const reviewList = document.getElementById('reviewList');
const dueCountBadge = document.getElementById('dueCountBadge');

document.addEventListener('DOMContentLoaded', () => {

    // --- TAB SWITCHING ---
    function switchTab(tab) {
        if (tab === 'save') {
            tabBtnSave.classList.add('text-indigo-400', 'border-indigo-500');
            tabBtnSave.classList.remove('text-gray-500', 'border-transparent');
            tabBtnReview.classList.add('text-gray-500', 'border-transparent');
            tabBtnReview.classList.remove('text-indigo-400', 'border-indigo-500');

            tabSave.classList.remove('hidden');
            tabReview.classList.add('hidden');
        } else {
            tabBtnReview.classList.add('text-indigo-400', 'border-indigo-500');
            tabBtnReview.classList.remove('text-gray-500', 'border-transparent');
            tabBtnSave.classList.add('text-gray-500', 'border-transparent');
            tabBtnSave.classList.remove('text-indigo-400', 'border-indigo-500');

            tabReview.classList.remove('hidden');
            tabSave.classList.add('hidden');
            loadReviewData();
        }
    }

    tabBtnSave.addEventListener('click', () => switchTab('save'));
    tabBtnReview.addEventListener('click', () => switchTab('review'));

    // --- DATA LOADING ---
    async function loadReviewData() {
        reviewList.innerHTML = '<li class="text-[10px] text-gray-500 text-center py-2 animate-pulse">Loading reviews...</li>';

        try {
            const problems = await getAllProblems();

            // Calculate cutoff: end of current UTC day (matches Dashboard/QueueView logic)
            const utcCutoff = new Date();
            utcCutoff.setUTCHours(23, 59, 59, 999);

            // Filter Due Problems
            const dueProblems = problems.filter(p => new Date(p.next_review_at) <= utcCutoff);

            // Update Badge
            dueCountBadge.textContent = `${dueProblems.length} Due`;

            // Render List (Top 3)
            reviewList.innerHTML = '';
            const top3 = dueProblems.sort((a, b) => a.next_review_at.localeCompare(b.next_review_at)).slice(0, 3);

            if (top3.length === 0) {
                reviewList.innerHTML = `
                    <li class="text-center py-4 flex flex-col items-center gap-2">
                        <div class="bg-gray-800 p-2 rounded-full text-green-400 opacity-80">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <span class="text-xs text-gray-400">All caught up!</span>
                    </li>
                 `;
            } else {
                top3.forEach(p => {
                    const li = document.createElement('li');
                    li.className = 'bg-gray-950/50 border border-gray-800 rounded-lg p-3 flex items-center justify-between group hover:border-gray-700 transition-colors cursor-pointer';
                    li.addEventListener('click', () => {
                        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
                    });

                    // Difficulty Class
                    let diffClass = 'text-gray-400 bg-gray-800 border-gray-700';
                    if (p.difficulty === 'Easy') diffClass = 'text-green-400 bg-green-500/10 border-green-500/20';
                    else if (p.difficulty === 'Medium') diffClass = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                    else if (p.difficulty === 'Hard') diffClass = 'text-red-400 bg-red-500/10 border-red-500/20';

                    li.innerHTML = `
                        <span class="text-xs font-medium text-gray-200 truncate pr-2">${p.title}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded border ${diffClass}">${p.difficulty}</span>
                    `;
                    reviewList.appendChild(li);
                });
            }
        } catch (error) {
            console.error(error);
            reviewList.innerHTML = '<li class="text-xs text-red-500 text-center">Failed to load data</li>';
        }
    }

    document.getElementById('startSessionBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html?start_review=true') });
    });


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
    document.getElementById('openDashboardLink').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') });
    });
});

