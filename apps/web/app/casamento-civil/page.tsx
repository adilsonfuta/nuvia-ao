import LegalAssistant from './legal-assistant';

export const metadata = { title: 'Casamento civil em Angola', description: 'Consulta orientação, fontes oficiais e contactos para tratar do casamento civil em Angola. Confirma os requisitos junto da Conservatória competente.', alternates: { canonical: '/casamento-civil' } };

export default function CasamentoCivilPage() {
  return <main className="legal-page"><a className="planner-back" href="/">← Voltar ao início</a><article className="legal-card legal-page-card">
    <header className="legal-page-heading"><p className="eyebrow">Orientação informativa · Angola</p><h1>Casamento civil</h1><p className="legal-lede">Consulta fontes oficiais, procura contactos de Conservatórias e vê se há informação revista para a vossa situação.</p></header>
    <LegalAssistant/>
    <section className="legal-before-visit"><h2>Antes de te deslocares</h2><ul><li>Confirma documentos, taxas, prazos e necessidade de marcação directamente com a Conservatória.</li><li>Os procedimentos podem variar conforme a situação de cada pessoa e o local do processo.</li><li>Não submetemos processos nem recolhemos documentos de identidade.</li></ul><a className="button button-outline" href="/planear">Voltar ao meu roteiro →</a></section>
  </article></main>;
}
