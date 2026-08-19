import 'fake-indexeddb/auto';

Object.defineProperty(globalThis, 'crypto', {
  value: crypto,
  configurable: true
});
