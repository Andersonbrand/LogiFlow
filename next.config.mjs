import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { imageHosts } = require('./image-hosts.config.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir: process.env.DIST_DIR || '.next',
    typescript: { ignoreBuildErrors: true },
    eslint: { ignoreDuringBuilds: true },
    images: {
        remotePatterns: [
            ...imageHosts,
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
    async redirects() {
        return [
            { source: '/', destination: '/homepage', permanent: false },
        ];
    },
};

export default nextConfig;
