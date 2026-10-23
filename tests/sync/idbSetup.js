// jsdom lacks structuredClone, which fake-indexeddb needs.
if (typeof global.structuredClone !== 'function') {
    global.structuredClone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}
import 'fake-indexeddb/auto';
