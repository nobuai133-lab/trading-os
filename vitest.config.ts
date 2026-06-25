import { defineConfig } from 'vitest/config';
import path             from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'json', 'html'],
      include:   ['src/lib/**/*.ts', 'src/core/**/*.ts', 'src/services/**/*.ts'],
      exclude:   ['src/lib/db.ts', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
