// AlgoRecall: Fetch Interceptor
// This script runs in the MAIN web page context (not content script isolation)

// Inline PLATFORM_CONFIG to avoid module imports
const PLATFORM_CONFIG = {
    LeetCode: {
        SUBMISSION: {
            URL_MATCH: '/submit/',
            PAYLOAD: {
                TYPED_CODE: 'typed_code',
                LANG: 'lang',
                QUESTION_ID: 'question_id'
            }
        }
    },
    Neetcode: {
        SUBMISSION: {
            URL_MATCH: 'executeCodeFunctionV2',
            PAYLOAD: {
                RAW_CODE: ['rawCode', 'data.rawCode'],
                LANG: ['lang', 'data.lang'],
                PROBLEM_ID: ['problemId', 'data.problemId']
            }
        }
    },
    TUF: {
        SUBMISSION: {
            URL_MATCH: 'backend-go.takeuforward.org/api/v1/plus/judge/submit',
            PAYLOAD: {
                TYPED_CODE: 'usercode',
                LANG: 'language',
                PROBLEM_ID: 'problem_id',
                MODE: 'mode'
            }
        }
    }
};

const originalFetch = window.fetch;

window.fetch = async function (...args) {
    const [resource, config] = args;
    let url = '';
    let requestBody = null;

    // Robust URL extraction
    if (resource instanceof Request) {
        url = resource.url;
    } else if (resource) {
        url = resource.toString();
    }

    if (resource instanceof Request) {
        url = resource.url;
        try {
            const clone = resource.clone();
            clone.text().then(text => {
                try {
                    requestBody = JSON.parse(text);
                    checkSubmission(url, requestBody);
                } catch (e) { /* ignore non-json */ }
            }).catch(err => console.error('AlgoRecall: Clone parse error', err));
        } catch (e) {
            console.error('AlgoRecall: Request clone error', e);
        }
    } else if (typeof resource === 'string') {
        url = resource;
        if (config && config.body) {
            try {
                requestBody = JSON.parse(config.body);
            } catch (e) { }
        }
        if (requestBody) {
            checkSubmission(url, requestBody);
        }
    }

    return originalFetch.apply(this, args);
};

function checkSubmission(url, body) {
    if (!url || !body) return;

    // LeetCode
    const lcConfig = PLATFORM_CONFIG.LeetCode.SUBMISSION;
    if (url.includes(lcConfig.URL_MATCH)) {
        if (body[lcConfig.PAYLOAD.TYPED_CODE]) {
            window.postMessage({
                source: 'ALGORECALL_INJECTED',
                type: 'SUBMISSION_PAYLOAD',
                payload: {
                    typed_code: body[lcConfig.PAYLOAD.TYPED_CODE],
                    lang: body[lcConfig.PAYLOAD.LANG],
                    question_id: body[lcConfig.PAYLOAD.QUESTION_ID],
                    timestamp: Date.now(),
                    ai_summary: null
                }
            }, '*');
        }
    }
    // NeetCode
    const ncConfig = PLATFORM_CONFIG.Neetcode.SUBMISSION;
    if (url.includes(ncConfig.URL_MATCH)) {
        // Helper to find value from possible paths
        const getValue = (keys) => {
            for (const key of keys) {
                if (key.includes('.')) {
                    const [root, child] = key.split('.');
                    if (body[root] && body[root][child]) return body[root][child];
                } else {
                    if (body[key]) return body[key];
                }
            }
            return null;
        };

        const rawCode = getValue(ncConfig.PAYLOAD.RAW_CODE);
        const lang = getValue(ncConfig.PAYLOAD.LANG);
        const problemId = getValue(ncConfig.PAYLOAD.PROBLEM_ID);

        if (rawCode) {
            window.postMessage({
                source: 'ALGORECALL_INJECTED',
                type: 'SUBMISSION_PAYLOAD',
                payload: {
                    typed_code: rawCode,
                    lang: lang,
                    question_id: problemId,
                    timestamp: Date.now(),
                    ai_summary: null
                }
            }, '*');
        }
    }

    // TakeUForward
    const tufConfig = PLATFORM_CONFIG.TUF.SUBMISSION;
    if (url.includes(tufConfig.URL_MATCH)) {
        console.log('AlgoRecall: TUF submission detected!', body);
        if (body[tufConfig.PAYLOAD.TYPED_CODE]) {
            const problem_id = body[tufConfig.PAYLOAD.PROBLEM_ID];
            const mode = body[tufConfig.PAYLOAD.MODE];
            console.log('AlgoRecall: TUF details -', { problem_id, mode });

            window.postMessage({
                source: 'ALGORECALL_INJECTED',
                type: 'SUBMISSION_PAYLOAD',
                payload: {
                    typed_code: body[tufConfig.PAYLOAD.TYPED_CODE],
                    lang: body[tufConfig.PAYLOAD.LANG],
                    timestamp: Date.now(),
                    ai_summary: null
                }
            }, '*');
        }
    }
}

// --- XHR Interceptor (Fallback) ---
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url ? url.toString() : '';
    return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function (body) {
    if (this._url) {
        const lcMatch = PLATFORM_CONFIG.LeetCode.SUBMISSION.URL_MATCH;
        const ncMatch = PLATFORM_CONFIG.Neetcode.SUBMISSION.URL_MATCH;
        const tufMatch = PLATFORM_CONFIG.TUF.SUBMISSION.URL_MATCH;
        const isTarget = this._url.includes(lcMatch) || this._url.includes(ncMatch) || this._url.includes(tufMatch);

        if (isTarget && body) {
            try {
                const parsedBody = JSON.parse(body);
                checkSubmission(this._url, parsedBody);
            } catch (e) { /* ignore */ }
        }
    }
    return originalSend.apply(this, arguments);
};

console.log('AlgoRecall: Interceptors Injected');
