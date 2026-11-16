'use client';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-recovery-page">
      <section className="app-recovery-card" role="alert">
        <p className="eyebrow">A página encontrou um problema</p>
        <h1>Vamos tentar novamente.</h1>
        <p>A operação pode não ter sido concluída. Confirma o estado antes de a repetir. Podes recarregar a página ou voltar à dashboard.</p>
        {error.digest && <small>Referência: {error.digest}</small>}
        <div><button className="button button-primary" onClick={() => reset()}>Tentar novamente</button><a className="button button-outline" href="/dashboard">Abrir dashboard</a></div>
      </section>
    </main>
  );
}
