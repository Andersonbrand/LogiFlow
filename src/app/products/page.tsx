import React, { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCatalog from './components/ProductCatalog';

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Suspense fallback={
        <div className="pt-40 flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }>
        <ProductCatalog />
      </Suspense>
      <Footer />
    </main>
  );
}
