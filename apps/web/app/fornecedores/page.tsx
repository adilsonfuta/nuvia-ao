import VendorDirectory from "./vendor-directory";

export const metadata = {
  title: "Fornecedores | Nuvia",
  description:
    "Pesquisa profissionais para casamentos, alambamentos e eventos em Angola.",
};

export default function Page() {
  return (
    <main className="catalog-page">
      <a className="catalog-back" href="/">
        <span aria-hidden="true">←</span> Início
      </a>
      <header className="catalog-heading">
        <p className="eyebrow">Profissionais para a tua celebração</p>
        <h1>Encontra fornecedores para o teu evento.</h1>
        <p>
          Pesquisa perfis por serviço e província. Os perfis de demonstração
          são fictícios e não representam disponibilidade, preços ou
          recomendações verificadas.
        </p>
        <a className="button button-outline vendor-join-link" href="/fornecedores/aderir">
          Tens um negócio? Cria o teu perfil <span aria-hidden="true">→</span>
        </a>
      </header>
      <VendorDirectory />
    </main>
  );
}
