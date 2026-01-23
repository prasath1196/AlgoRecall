import { PLATFORM_CONFIG } from './src/constants';

// Strict Data Validation Enums
const ALLOWED_PLATFORMS = ['LeetCode', 'HackerRank', 'Codeforces', 'TUF', 'Neetcode'];
const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Unknown'];
// EXACT STRINGS AS REQUESTED
const ALLOWED_PATTERN_TAGS = [
  'Sliding Window', 'Two Pointers', 'DFS', 'BFS', 'DP', 'Binary Search',
  'Backtracking', 'Greedy', 'Stack', 'Queue', 'Heap', 'Linked List',
  'Tree', 'Graph', 'Hash Table', 'Array', 'String', 'Math',
  'Bit Manipulation', 'Union Find', 'Trie', 'Recursion', 'Sorting'
];

function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('leetcode.com')) return 'LeetCode';
  if (hostname.includes('hackerrank.com')) return 'HackerRank';
  if (hostname.includes('codeforces.com')) return 'Codeforces';
  if (hostname.includes('takeuforward.org')) return 'TUF';
  if (hostname.includes('neetcode.io')) return 'Neetcode';
  return null;
}

function getDifficulty(platform) {
  const config = PLATFORM_CONFIG[platform] && PLATFORM_CONFIG[platform].DIFFICULTY_SELECTORS;
  if (!config) return 'Unknown';

  const found = [];
  if (document.querySelector(config.Easy)) found.push('Easy');
  if (document.querySelector(config.Medium)) found.push('Medium');
  if (document.querySelector(config.Hard)) found.push('Hard');

  if (found.length === 0) return 'Unknown';
  if (found.length === 1) return found[0];

  return `(${found.join('/')})`;
}

function getPatternTags(platform) {
  const config = PLATFORM_CONFIG[platform] && PLATFORM_CONFIG[platform].TOPIC_SELECTOR;
  if (!config) return [];

  // NeetCode Strategy: Company Tags + General Pattern tags
  if (platform === 'Neetcode') {
    const companyContainer = document.querySelector(config.COMPANY_CONTAINER);
    // For NeetCode, we might want to capture companies as tags or as separate metadata?
    // User said: "company-tags-container - contains all company names. Collect and keep as the user solves."
    // Current system stores everything in 'pattern_tag' array. Let's add them there.
    // But we should prioritize actual Pattern Tags if they exist distinct from companies.

    // Let's scrape whatever is in the company container as generic tags for now
    if (companyContainer) {
      // Extract text from pills inside it
      // Assuming structure is pills/chips
      const pills = companyContainer.querySelectorAll('div, span, button'); // Broad selector, refine if needed
      const tags = Array.from(pills)
        .map(el => el.innerText.trim())
        .filter(t => t.length > 0 && !t.includes('\n')); // Simple filter

      return [...new Set(tags)];
    }
    return [];
  }

  // LeetCode / Default Strategy
  // Strategy 1: URL Pattern Match (More Robust)
  if (config.LINK_ATTR && config.LINK_VALUE) {
    const tagLinks = document.querySelectorAll(`a[${config.LINK_ATTR}*="${config.LINK_VALUE}"]`);
    if (tagLinks.length > 0) {
      const tags = Array.from(tagLinks)
        .map(a => a.innerText.trim())
        .filter(t => t.length > 0);
      return [...new Set(tags)];
    }
  }

  // Strategy 2: CSS Container (Fallback)
  if (config.CONTAINER) {
    // LeetCode config uses space-separated classes, so getElementsByClassName is safer than querySelector unless we format it.
    // If config.CONTAINER starts with '.', we assume it's a selector.

    const container = config.CONTAINER.startsWith('.')
      ? document.querySelector(config.CONTAINER)
      : document.getElementsByClassName(config.CONTAINER)[0];

    if (container) {
      const tags = Array.from(container.querySelectorAll('a')).map(a => a.innerText.trim());
      if (tags.length > 0) {
        return [...new Set(tags)];
      }
    }
  }

  // Strategy 3: Loose Text Search (Last Resort)
  const text = document.body.innerText;
  const foundTags = [];
  ALLOWED_PATTERN_TAGS.forEach(tag => {
    if (text.includes(tag)) {
      foundTags.push(tag);
    }
  });
  return foundTags;
}

function cleanUrl(url) {
  // Regex to capture up to the problem slug
  const match = url.match(/(.*\/problems\/[^/?#]+)/);
  if (match) {
    return match[1];
  }
  return url;
}

function scrapeData(platform) {
  let title = document.title;

  if (platform === 'LeetCode') {
    title = title.replace(' - LeetCode', '').trim();
  } else if (platform === 'Neetcode') {
    title = title.replace(' - NeetCode', '').replace('NeetCode', '').trim();
    // If title is just "NeetCode", try to find h1
    const h1 = document.querySelector('h1');
    if (h1) title = h1.innerText;
  }

  const difficulty = getDifficulty(platform);
  const pattern_tag = getPatternTags(platform);

  // Attempt to scrape code - Robust Method
  let code = '';
  // Method 1: Get all lines individually (Preserves structure better)
  const lines = document.querySelectorAll('.view-line'); // Monaco editor (LeetCode)
  if (lines.length > 0) {
    code = Array.from(lines).map(line => line.innerText.replace(/\u00a0/g, ' ')).join('\n');
  }
  // Method 2: Fallback to LeetCode container
  else {
    const viewLines = document.querySelector('.view-lines');
    if (viewLines) {
      code = viewLines.innerText;
    } else if (platform === 'Neetcode') {
      // NeetCode likely uses Monaco too or CodeMirror
      // If we intercepted the code payload, that will override this anyway.
      // But for manual scrape (Popup), we need to read from DOM if possible.
      // Assuming Monaco editor based on "view-line" selectors usually working.
      // If NeetCode uses something else, likely CodeMirror:
      const cmContent = document.querySelector('.cm-content');
      if (cmContent) code = cmContent.innerText;
    }
  }

  console.log('AlgoRecall: Scraped Code Length:', code.length);

  // Allow Known Difficulties OR Multi-Difficulty strings starting with '('
  const finalDifficulty = (ALLOWED_DIFFICULTIES.includes(difficulty) || difficulty.startsWith('('))
    ? difficulty
    : 'Unknown';

  return {
    title: title,
    url: cleanUrl(window.location.href),
    platform: platform, // Verified via detectPlatform call
    difficulty: finalDifficulty,
    pattern_tag: pattern_tag, // Filtered by logic
    notes: '',
    code: code, // Captured code
    interval: 1,
    ease_factor: 2.5,
    repetition_count: 0
  };
}

function handleSubmission() {
  const platform = detectPlatform();
  if (!platform || !ALLOWED_PLATFORMS.includes(platform)) return;

  console.log(`AlgoRecall: Submission detected on ${platform}`);

  // Small delay to ensure any UI updates happen if we need them (optional but safer)
  setTimeout(() => {
    const data = scrapeData(platform);
    console.log('AlgoRecall: Scraped data', data);

    // Validate required fields basic check
    if (!data.title || !data.url) {
      console.error('AlgoRecall: Missing required data fields');
      return;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'SUBMISSION_DETECTED',
        payload: data
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("AlgoRecall: Runtime error sending message", chrome.runtime.lastError);
        } else {
          console.log("AlgoRecall: Message sent to background", response);
        }
      });
    } catch (e) {
      console.error("AlgoRecall: Error sending message", e);
    }

  }, 1000);
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DETAILS') {
    const platform = detectPlatform();
    if (platform) {
      const data = scrapeData(platform);
      console.log('AlgoRecall: Sending details to popup', data);
      sendResponse(data);
    } else {
      sendResponse(null);
    }
  }
});

// --- INJECTION & INTERCEPTION ---

// Inject the fetch interceptor
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // We only accept messages from ourselves
  if (event.source !== window || !event.data || event.data.source !== 'ALGORECALL_INJECTED') {
    return;
  }

  if (event.data.type === 'SUBMISSION_PAYLOAD') {
    const { typed_code, lang, timestamp, ai_summary } = event.data.payload;
    console.log('AlgoRecall: Received intercepted code', lang);

    // Add a small delay to allow DOM to settle if needed (usually fetch happens at click, DOM might not change yet)
    // But we scrape Title/Tags which are static usually.
    handleSubmissionWithCode(typed_code, lang, timestamp, ai_summary);
  }
});

function handleSubmissionWithCode(code, lang, timestamp, ai_summary) {
  const platform = detectPlatform();
  if (!platform || !ALLOWED_PLATFORMS.includes(platform)) return;

  const data = scrapeData(platform);

  // Set AI summary if available from main worldPayload
  if (ai_summary) {
    data.clean_problem_statement = ai_summary;
    console.log('AlgoRecall: Received AI Summary from Injected Script', ai_summary);
  }

  // Override the scrapped code with the intercepted code
  data.code = code;
  data.lang = lang; // store language too if we want
  data.created_at = new Date(timestamp).toISOString();

  console.log('AlgoRecall: Final Data prepared', data);

  if (!data.title || !data.url) {
    console.error('AlgoRecall: Missing required data fields');
    return;
  }

  try {
    chrome.runtime.sendMessage({
      type: 'SUBMISSION_DETECTED',
      payload: data
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("AlgoRecall: Runtime error sending message", chrome.runtime.lastError);
      } else {
        console.log("AlgoRecall: Message sent to background", response);
      }
    });
  } catch (e) {
    console.error("AlgoRecall: Error sending message", e);
  }
}

