import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { include: ['src/**/__tests__/**/*.test.ts'] },
  resolve: {
    alias: {
      'expo-sqlite': path.resolve(import.meta.dirname, 'test/mocks/expo-sqlite.ts'),
      'expo-file-system': path.resolve(import.meta.dirname, 'test/mocks/empty.ts'),
      'expo-sharing': path.resolve(import.meta.dirname, 'test/mocks/empty.ts'),
    },
  },
});
