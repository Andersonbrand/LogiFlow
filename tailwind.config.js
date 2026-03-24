/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#af1518',
                    dark: '#8a0f12',
                    light: '#fdf0f0',
                },
                accent: {
                    DEFAULT: '#0056a6',
                    dark: '#003d7a',
                },
                surface: {
                    DEFAULT: '#f5f7fa',
                    2: '#eef1f6',
                },
                foreground: '#0d1117',
                muted: '#5a6272',
                border: '#dde3ed',
            },
            fontFamily: {
                sans: ['Plus Jakarta Sans', 'sans-serif'],
                display: ['Fraunces', 'serif'],
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            boxShadow: {
                'red-lg':  '0 20px 60px rgba(175, 21, 24, 0.15)',
                'red-xl':  '0 32px 80px rgba(175, 21, 24, 0.2)',
                'blue-lg': '0 20px 60px rgba(0, 86, 166, 0.15)',
                'blue-xl': '0 32px 80px rgba(0, 86, 166, 0.2)',
            },
            animation: {
                'float':      'float-gentle 7s ease-in-out infinite',
                'float-delay':'float-gentle 7s ease-in-out 1.5s infinite',
                'float-slow': 'float-gentle 9s ease-in-out 3s infinite',
                'marquee':    'marquee-ltr 30s linear infinite',
            },
        },
    },
    plugins: [],
};
