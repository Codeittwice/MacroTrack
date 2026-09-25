import 'fake-indexeddb/auto';

// Unit tests must never reach the network (Open Food Facts, AI providers): results would be
// non-deterministic and fail offline. Tests that need fetch stub it themselves.
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  throw new TypeError(`Network access is disabled in unit tests: ${url}`);
}) as typeof fetch;
