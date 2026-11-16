export default function NotFound() {
  return (
    <main className="app-recovery-page">
      <section className="app-recovery-card">
        <p className="eyebrow">Página não encontrada</p>
        <h1>Este endereço já não está disponível.</h1>
        <p>Confirma o endereço ou volta à Nuvia para continuares a organizar o teu evento.</p>
        <div><a className="button button-primary" href="/">Ir para o início</a><a className="button button-outline" href="/dashboard">Abrir dashboard</a></div>
      </section>
    </main>
  );
}
