/** @type {import('next').NextConfig['images']['remotePatterns']} */
const imageHosts = [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: 'images.pexels.com' },
    { protocol: 'https', hostname: 'img.rocket.new' },
    {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
    },
];

module.exports = { imageHosts };
