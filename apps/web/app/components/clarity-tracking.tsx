'use client';

import { useLayoutEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';

const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID || 'zflr7uxcf5';

function isPublicPage(pathname: string, hasQuery: boolean) {
  if (hasQuery) return false;
  if (pathname === '/fornecedores/aderir') return false;

  return (
    pathname === '/' ||
    pathname === '/planear' ||
    pathname === '/casamento-civil' ||
    pathname === '/fornecedores' ||
    pathname.startsWith('/fornecedores/') ||
    pathname === '/espacos' ||
    pathname.startsWith('/espacos/') ||
    pathname === '/guias' ||
    pathname.startsWith('/guias/')
  );
}

export function ClarityTracking() {
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const hasQuery = searchParams.size > 0;
  const trackPage = isPublicPage(pathname, hasQuery);

  useLayoutEffect(() => {
    if (trackPage) {
      document.body.removeAttribute('data-clarity-mask');
    } else {
      // Keep authenticated and token-based pages out of session recordings,
      // including client-side navigation from a public page.
      document.body.setAttribute('data-clarity-mask', '');
    }
  }, [trackPage]);

  if (!trackPage) return null;

  return (
    <>
      <Script id="google-tag-manager" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!=='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PN7VMJJC');`}
      </Script>
      <Script id="nuvia-clarity" strategy="afterInteractive">
        {`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${clarityId}");`}
      </Script>
    </>
  );
}
