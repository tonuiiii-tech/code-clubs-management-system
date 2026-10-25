export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // One in-memory MongoDB for the whole run; each test file uses its own database.
  globalSetup: '<rootDir>/tests/support/globalSetup.js',
  globalTeardown: '<rootDir>/tests/support/globalTeardown.js',
  // Starting MongoDB and building indexes is slow on Windows; Jest's default is 5 s.
  testTimeout: 30000,
};
