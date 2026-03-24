import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { PriceProvider } from '@/context/PriceContext';
import { CompanyProvider } from '@/context/CompanyContext';
import CompanyBanner from '@/components/CompanyBanner';
import '../styles/tailwind.css';

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:4028'),
  title: 'Grupo HC — Comercial Araguaia · Confiance Indústria · Aços Confiance',
  description: 'O Grupo Hugo Costa reúne a Comercial Araguaia, Confiance Indústria e Aços Confiance. Materiais de construção, aço e serralheria em Guanambi, Bahia. Desde 1990.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <CartProvider>
            <PriceProvider>
              <CompanyProvider>
                {children}
                <CompanyBanner />
                <Toaster position="top-center" toastOptions={{
                  duration: 3000,
                  style: {
                    background: '#fff', color: '#0d1117',
                    border: '1px solid #dde3ed', borderRadius: '0.75rem',
                    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem', fontWeight: 600,
                  },
                  success: { iconTheme: { primary: '#af1518', secondary: '#fff' } },
                  error:   { iconTheme: { primary: '#af1518', secondary: '#fff' } },
                }} />
              </CompanyProvider>
            </PriceProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
