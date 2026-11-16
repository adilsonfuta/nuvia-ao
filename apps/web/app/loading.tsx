export default function Loading() {
  return (
    <main className="app-recovery-page" aria-busy="true" aria-label="A carregar página">
      <section className="app-recovery-card app-loading-card">
        <span className="app-loading-mark" aria-hidden="true" />
        <p className="eyebrow">Nuvia</p>
        <h1>A preparar o teu espaço.</h1>
        <p>Estamos a carregar os dados. Isto pode demorar alguns segundos.</p>
      </section>
    </main>
  );
}
