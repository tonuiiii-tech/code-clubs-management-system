export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // One in-memory MongoDB for the whole run; each test file uses its own database.
  globalSetup: '<rootDir>/tests/support/globalSetup.js',
  globalTeardown: '<rootDir>/tests/support/globalTeardown.js',
  // Starting MongoDB and building indexes is slow on Windows; Jest's default is 5 s.
  testTimeout: 30000,
  // All test files share that one MongoDB: more than two at once starved it on a PC with 8 CPUs
  // and under 3 GB of free memory (96 of 143 tests timed out).
  maxWorkers: 2,
};
