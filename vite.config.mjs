import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        outDir: "build",
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts'],
                    supabase: ['@supabase/supabase-js'],
                },
            },
        },
    },
    plugins: [tsconfigPaths(), react()],
    server: {
        port: "4028",
        host: "0.0.0.0",
        strictPort: true,
    }
});