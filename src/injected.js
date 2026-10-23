// AlgoRecall: Fetch/XHR Interceptor
// Runs in the page's MAIN world as a classic, self-contained script (declared in manifest.json
// with "world": "MAIN", run_at document_start). Do not add import/export.
(function () {
    'use strict';
    if (window.__ALGORECALL_INJECTED__) return;
    window.__ALGORECALL_INJECTED__ = true;

    function debugOn() {
        try { return window.localStorage.getItem('algorecall_debug') === '1'; } catch (e) { return false; }
    }
    function debug(...args) {
        if (debugOn()) console.log('AlgoRecall:', ...args);
    }

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


    const LC_SUBMIT_RE = /\/problems\/[^/]+\/submit\/?(\?|$)/;
    function isLeetCodeSubmitUrl(url) {
        if (!url || url.includes('interpret_solution')) return false;
        return LC_SUBMIT_RE.test(url) || url.includes(PLATFORM_CONFIG.LeetCode.SUBMISSION.URL_MATCH);
    }

    function parseBody(body) {
        try {
            if (typeof body === 'string') return JSON.parse(body);
            if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
                return JSON.parse(body.toString());
            }
        } catch (e) { /* not JSON */ }
        return null;
    }

    function isTargetUrl(url) {
        return !!url && (isLeetCodeSubmitUrl(url) ||
            url.includes(PLATFORM_CONFIG.Neetcode.SUBMISSION.URL_MATCH) ||
            url.includes(PLATFORM_CONFIG.TUF.SUBMISSION.URL_MATCH));
    }

    function checkSubmission(url, body) {
        if (!url || !body) return;

        // LeetCode
        const lcConfig = PLATFORM_CONFIG.LeetCode.SUBMISSION;
        if (isLeetCodeSubmitUrl(url)) {
            debug('submit detected', url);
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
            debug('submit detected', url);
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
            debug('submit detected', url);
            if (body[tufConfig.PAYLOAD.TYPED_CODE]) {
                const problem_id = body[tufConfig.PAYLOAD.PROBLEM_ID];
                const mode = body[tufConfig.PAYLOAD.MODE];
                debug('TUF details', { problem_id, mode });

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


    // --- fetch interceptor ---
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
        window.fetch = function (resource, config) {
            try {
                let url = '';
                if (typeof Request !== 'undefined' && resource instanceof Request) url = resource.url;
                else if (resource != null) url = String(resource);

                if (isTargetUrl(url)) {
                    if (config && config.body != null) {
                        const parsed = parseBody(config.body);
                        if (parsed) checkSubmission(url, parsed);
                    } else if (typeof Request !== 'undefined' && resource instanceof Request) {
                        resource.clone().text()
                            .then((text) => { const p = parseBody(text); if (p) checkSubmission(url, p); })
                            .catch(() => { /* ignore */ });
                    }
                }
            } catch (e) {
                debug('fetch wrapper error', e);
            }
            return originalFetch.apply(this, arguments);
        };
    }

    // --- XHR interceptor ---
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        try { this._algorecallUrl = url ? String(url) : ''; } catch (e) { /* ignore */ }
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
        try {
            const url = this._algorecallUrl;
            if (isTargetUrl(url) && body != null) {
                const parsed = parseBody(body);
                if (parsed) checkSubmission(url, parsed);
            }
        } catch (e) {
            debug('xhr wrapper error', e);
        }
        return originalSend.apply(this, arguments);
    };

    window.postMessage({ source: 'ALGORECALL_INJECTED', type: 'INTERCEPTOR_READY' }, '*');
    debug('interceptor active');
})();
