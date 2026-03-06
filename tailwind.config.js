/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
        './public/index.html',
    ],
    theme: {
        extend: {
            colors: {
                background: 'var(--color-background)',       // slate-50 / slate-900 dark
                foreground: 'var(--color-foreground)',       // gray-800 / slate-200 dark

                card: {
                    DEFAULT: 'var(--color-card)',              // white / slate-800 dark
                    foreground: 'var(--color-card-foreground)' // gray-700 / slate-300 dark
                },

                popover: {
                    DEFAULT: 'var(--color-popover)',           // white / slate-800 dark
                    foreground: 'var(--color-popover-foreground)' // gray-700 / slate-300 dark
                },

                primary: {
                    DEFAULT: 'var(--color-primary)',           // blue-900 deep industrial / blue-600 dark
                    foreground: 'var(--color-primary-foreground)' // white
                },

                secondary: {
                    DEFAULT: 'var(--color-secondary)',         // green-700 muted forest / green-600 dark
                    foreground: 'var(--color-secondary-foreground)' // white
                },

                accent: {
                    DEFAULT: 'var(--color-accent)',            // amber-600 / amber-400 dark
                    foreground: 'var(--color-accent-foreground)' // white / gray-800 dark
                },

                muted: {
                    DEFAULT: 'var(--color-muted)',             // slate-100 / slate-700 dark
                    foreground: 'var(--color-muted-foreground)' // gray-500 / slate-400 dark
                },

                destructive: {
                    DEFAULT: 'var(--color-destructive)',       // red-600 / red-500 dark
                    foreground: 'var(--color-destructive-foreground)' // white
                },

                success: {
                    DEFAULT: 'var(--color-success)',           // emerald-600 / emerald-500 dark
                    foreground: 'var(--color-success-foreground)' // white
                },

                warning: {
                    DEFAULT: 'var(--color-warning)',           // amber-600 / amber-400 dark
                    foreground: 'var(--color-warning-foreground)' // white / gray-800 dark
                },

                error: {
                    DEFAULT: 'var(--color-error)',             // red-600 / red-500 dark
                    foreground: 'var(--color-error-foreground)' // white
                },

                border: 'var(--color-border)',               // slate-200 / slate-700 dark
                input: 'var(--color-input)',                 // slate-200 / slate-700 dark
                ring: 'var(--color-ring)',                   // blue-900 / blue-600 dark
            },

            fontFamily: {
                heading: ['Outfit', 'sans-serif'],
                body: ['Source Sans 3', 'sans-serif'],
                caption: ['Inter', 'sans-serif'],
                data: ['JetBrains Mono', 'monospace'],
                sans: ['Source Sans 3', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },

            fontSize: {
                'h1': ['2.25rem', { lineHeight: '1.2' }],
                'h2': ['1.875rem', { lineHeight: '1.25' }],
                'h3': ['1.5rem', { lineHeight: '1.3' }],
                'h4': ['1.25rem', { lineHeight: '1.4' }],
                'h5': ['1.125rem', { lineHeight: '1.5' }],
                'caption': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.025em' }],
            },

            spacing: {
                '4.5': '1.125rem',
                '18': '4.5rem',
                '22': '5.5rem',
                '30': '7.5rem',
            },

            borderRadius: {
                'sm': '6px',
                'DEFAULT': '10px',
                'md': '10px',
                'lg': '14px',
                'xl': '20px',
            },

            boxShadow: {
                'card': '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
                'elevated': '0 4px 12px rgba(15, 23, 42, 0.10), 0 2px 4px rgba(15, 23, 42, 0.06)',
                'modal': '0 10px 25px -3px rgba(15, 23, 42, 0.16), 0 4px 8px rgba(15, 23, 42, 0.08)',
                'nav': '0 1px 3px rgba(15, 23, 42, 0.08)',
                'dropdown': '0 6px 16px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.06)',
            },

            transitionDuration: {
                '250': '250ms',
            },

            transitionTimingFunction: {
                'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
            },

            zIndex: {
                '50': '50',
                '75': '75',
                '100': '100',
                '150': '150',
                '160': '160',
                '200': '200',
                '300': '300',
            },

            minHeight: {
                'touch': '44px',
            },

            minWidth: {
                'touch': '44px',
            },

            height: {
                'nav': '60px',
                'row': '48px',
                'input': '44px',
                'btn': '48px',
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms'),
        require('tailwindcss-animate'),
    ],
};