import fs from 'fs';
import path from 'path';

test('manifest declares injected.js as a MAIN-world document_start content script', () => {
    const m = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/manifest.json'), 'utf8'));
    const entry = m.content_scripts.find((c) => c.js.includes('injected.js'));
    expect(entry).toBeDefined();
    expect(entry.world).toBe('MAIN');
    expect(entry.run_at).toBe('document_start');
    expect(entry.matches).toEqual(expect.arrayContaining(['*://*.leetcode.com/*']));
});
