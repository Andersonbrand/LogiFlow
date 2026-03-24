import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from './components/HeroSection';
import GrupoHCSection from './components/GrupoHCSection';
import StatsSection from './components/StatsSection';
import ProductsPreview from './components/ProductsPreview';
import AboutSection from './components/AboutSection';
import QuoteForm from './components/QuoteForm';

export default function HomePage() {
    return (
        <main className="min-h-screen bg-white">
            <Header />
            <HeroSection />
            <GrupoHCSection />
            <StatsSection />
            <ProductsPreview />
            <AboutSection />
            <QuoteForm />
            <Footer />
        </main>
    );
}
