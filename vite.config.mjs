// build: 2026-03-11 12:42
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    root: ".",
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            input: "./index.html",
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('@supabase')) return 'supabase';
                        if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'charts';
                        return 'vendor';
                    }
                },
            },
        },
    },
    plugins: [tsconfigPaths(), react()],
    server: {
        port: 4028,
        host: "0.0.0.0",
        strictPort: true,
    },
});
