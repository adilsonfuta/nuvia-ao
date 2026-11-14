import VendorApplicationForm from "./vendor-application-form";

export const metadata = {
  title: "Cria o perfil do teu serviço | Casar em Angola",
  description:
    "Candidata o teu negócio para integrar o directório de fornecedores da Casar em Angola.",
};

export default function VendorApplicationPage() {
  return (
    <main className="catalog-page vendor-application-page">
      <a className="planner-back" href="/fornecedores">
        ← Directório de fornecedores
      </a>
      <header>
      <p className="eyebrow">Área profissional</p>
      <h1>Cria o perfil do teu serviço</h1>
        <p>
          Cria uma conta, apresenta o teu negócio e acompanha a revisão. O perfil
          e as imagens só aparecem no directório depois de aprovados.
        </p>
      </header>
      <VendorApplicationForm />
    </main>
  );
}
