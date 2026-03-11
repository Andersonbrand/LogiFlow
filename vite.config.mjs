// build: 2026-03-11 12:42
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    root: ".",
    build: {
        outDir: "build",
        emptyOutDir: true,
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            input: "./index.html",
            output: {
                manualChunks: {
                    vendor:   ["react", "react-dom", "react-router-dom"],
                    charts:   ["recharts"],
                    supabase: ["@supabase/supabase-js"],
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
