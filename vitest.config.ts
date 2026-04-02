import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/vitest.setup.ts'],
    include: ['tests/**/*.test.ts'], // Explicitly include only test files within the tests directory
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'app/build', 'app/.next'], // Standard exclusions
    alias: {
      '@/': resolve(__dirname, './src'), // Use path.resolve for alias
    },
    deps: {
      inline: [
        /@modelcontextprotocol\/sdk/ // Use regex to inline the SDK package if needed
      ],
    },
  },
});
