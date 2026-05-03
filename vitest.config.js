import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/tests/setup.js'],
        include: ['src/tests/**/*.test.{js,jsx,ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/utils/**', 'src/pages/**', 'src/components/**'],
            exclude: ['src/tests/**', 'src/utils/supabaseClient.js'],
        },
    },
});
