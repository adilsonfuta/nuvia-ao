import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClarityTracking } from './components/clarity-tracking';
import { jsonLd, publicSiteUrl } from './lib/server-public-api';
import './globals.css';

const siteUrl = publicSiteUrl();
const brandImage = '/casal-angolano-hero.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Nuvia | Organiza casamentos, alambamentos e eventos em Angola', template: '%s | Nuvia' },
  description: 'Planeia casamentos, alambamentos, festas e outras celebrações em Angola. Organiza tarefas, orçamento, convidados, espaços e fornecedores num só lugar.',
  openGraph: { title: 'Nuvia | Eventos e celebrações em Angola', description: 'Planeia casamentos, alambamentos, festas e outras celebrações num só lugar.', url: '/', locale: 'pt_AO', siteName: 'Nuvia', type: 'website', images: [{ url: brandImage, width: 1536, height: 1024, alt: 'Celebrações e planeamento de eventos em Angola' }] },
  twitter: { card: 'summary_large_image', title: 'Nuvia | Eventos e celebrações em Angola', description: 'Organiza o teu evento em Angola, do primeiro plano ao grande dia.', images: [brandImage] },
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  icons: { icon: '/brand/nuvia-mark.png', apple: '/brand/nuvia-mark.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Nuvia', url: siteUrl, logo: `${siteUrl}/brand/nuvia-logo.png`, areaServed: { '@type': 'Country', name: 'Angola' }, knowsLanguage: 'pt-AO' };
  const website = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Nuvia', url: siteUrl, inLanguage: 'pt-AO', potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/fornecedores?q={search_term_string}`, 'query-input': 'required name=search_term_string' } };
  return <html lang="pt-AO"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(organization) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(website) }} />{children}<Suspense fallback={null}><ClarityTracking /></Suspense></body></html>;
}
