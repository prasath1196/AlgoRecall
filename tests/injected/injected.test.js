/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';

const code = fs.readFileSync(path.resolve(__dirname, '../../src/injected.js'), 'utf8');
const load = () => window.eval(code);
const SUBMIT = 'https://leetcode.com/problems/two-sum/submit/';
const body = JSON.stringify({ lang: 'python3', question_id: '1', typed_code: 'class S: pass' });

let posted, origFetch, origOpen, origSend, listener;

beforeEach(() => {
    delete window.__ALGORECALL_INJECTED__;
    origFetch = jest.fn(() => Promise.resolve({ ok: true }));
    window.fetch = origFetch;
    origOpen = XMLHttpRequest.prototype.open;
    origSend = XMLHttpRequest.prototype.send;
    posted = [];
    listener = (e) => { if (e.data && e.data.type === 'SUBMISSION_PAYLOAD') posted.push(e.data.payload); };
    window.addEventListener('message', listener);
    load();
});

afterEach(() => {
    window.removeEventListener('message', listener);
    XMLHttpRequest.prototype.open = origOpen;
    XMLHttpRequest.prototype.send = origSend;
});

const tick = () => new Promise((r) => setTimeout(r, 20));

test('string URL + JSON body posts payload and returns original promise', async () => {
    const res = await window.fetch(SUBMIT, { method: 'POST', body });
    expect(res).toEqual({ ok: true });
    expect(origFetch).toHaveBeenCalledTimes(1);
    await tick();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ typed_code: 'class S: pass', lang: 'python3', question_id: '1' });
});

test('URL object', async () => {
    await window.fetch(new URL(SUBMIT), { method: 'POST', body });
    await tick();
    expect(posted).toHaveLength(1);
});

test('Request object', async () => {
    if (typeof Request === 'undefined') return;
    await window.fetch(new Request(SUBMIT, { method: 'POST', body }));
    await tick();
    expect(posted).toHaveLength(1);
    expect(posted[0].question_id).toBe('1');
});

test('XHR send', async () => {
    const send = jest.fn();
    XMLHttpRequest.prototype.send = send;
    XMLHttpRequest.prototype.open = function () {};
    delete window.__ALGORECALL_INJECTED__;
    load();
    const x = new XMLHttpRequest();
    x.open('POST', SUBMIT);
    x.send(body);
    await tick();
    expect(send).toHaveBeenCalledTimes(1);
    expect(posted).toHaveLength(1);
    expect(posted[0].typed_code).toBe('class S: pass');
});

test('interpret_solution (Run) does not post', async () => {
    await window.fetch('https://leetcode.com/problems/two-sum/interpret_solution/', { method: 'POST', body });
    await tick();
    expect(posted).toHaveLength(0);
});

test('double load does not double-wrap', async () => {
    const wrapped = window.fetch;
    load();
    expect(window.fetch).toBe(wrapped);
    await window.fetch(SUBMIT, { method: 'POST', body });
    await tick();
    expect(posted).toHaveLength(1);
});
