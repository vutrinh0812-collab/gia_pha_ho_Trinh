import '@testing-library/jest-dom/vitest';

// UI tests run against the in-memory demo clan and the demo admin backend
// (set before any app module reads import.meta.env).
vi.stubEnv('VITE_DATA_SOURCE', 'demo');
