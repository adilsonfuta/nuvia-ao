'use client';

import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-AO">
      <body>
        <main className="app-recovery-page">
          <section className="app-recovery-card" role="alert">
            <p className="eyebrow">Nuvia</p>
            <h1>A aplicação não conseguiu abrir.</h1>
            <p>Tenta novamente. Se o problema continuar, volta à página inicial e entra de novo.</p>
            <button className="button button-primary" onClick={() => reset()}>Tentar novamente</button>
          </section>
        </main>
      </body>
    </html>
  );
}
