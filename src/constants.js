// Platform Configuration
export const PLATFORM_CONFIG = {
    LeetCode: {
        DIFFICULTY_SELECTORS: {
            Easy: '.text-difficulty-easy',
            Medium: '.text-difficulty-medium',
            Hard: '.text-difficulty-hard'
        },
        TOPIC_SELECTOR: {
            CONTAINER: 'mt-2 flex flex-wrap gap-1 pl-7', // Class lookup
            LINK_ATTR: 'href',
            LINK_VALUE: '/tag/'
        },
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
        DIFFICULTY_SELECTORS: {
            Easy: '.difficulty-pill.easy',
            Medium: '.difficulty-pill.medium',
            Hard: '.difficulty-pill.hard'
        },
        TOPIC_SELECTOR: {
            // Main pattern tags often in a similar container or just list
            // User requested: company-tags-container
            COMPANY_CONTAINER: '.company-tags-container',
            COMPANY_COUNT_CLASS: '.company-tag-count' // For frequency if needed
        },
        SUBMISSION: {
            URL_MATCH: 'executeCodeFunctionV2',
            PAYLOAD: {
                RAW_CODE: ['rawCode', 'data.rawCode'],
                LANG: ['lang', 'data.lang'],
                PROBLEM_ID: ['problemId', 'data.problemId']
            }
        }
    },
    // Fallbacks or others can be added here
};

// Keep legacy exports for backward compatibility during refactor if needed, 
// or remove them if we update content.js immediately. 
// I will update content.js immediately, but keep these for safety for one step.
export const DIFFICULTY_CLASSES = {
    EASY: 'text-difficulty-easy',
    MEDIUM: 'text-difficulty-medium',
    HARD: 'text-difficulty-hard'
};

export const TOPIC_CLASS = {
    CONTAINER: 'mt-2 flex flex-wrap gap-1 pl-7',
    TAG_HREF_IDENTIFIER: '/tag/'
};
