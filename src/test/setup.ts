import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setDemoSpeed } from '@/lib/timing';

// Simulated backend latency runs instantly in tests.
setDemoSpeed(0);

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
});
