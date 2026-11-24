import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Planeamento de casamentos, alambamentos e festas em Angola',
  description: 'Organiza o teu casamento, alambamento, festa ou outra celebração em Angola. Planeia tarefas, orçamento, convidados e encontra espaços e fornecedores.',
  alternates: { canonical: '/' },
};

const features = [
  { icon: '▤', title: 'Um primeiro roteiro', text: 'Responde a algumas perguntas e recebe uma lista inicial de próximos passos.', href: '/planear', action: 'Criar roteiro' },
  { icon: '◷', title: 'Despesas e tarefas', text: 'Na tua área, regista despesas e acompanha as tarefas do evento.', href: '/planear', action: 'Criar roteiro' },
  { icon: '♙', title: 'Convidados e RSVP', text: 'Organiza convidados e partilha um convite com confirmação de presença.', href: '/planear', action: 'Criar roteiro' }
];

function Mark({ alt = 'Nuvia', priority = false }: { alt?: string; priority?: boolean }) { return <Image className="nuvia-logo" src="/brand/nuvia-logo.png" alt={alt} width={320} height={100} priority={priority} />; }
function Arrow() { return <span aria-hidden="true">→</span>; }

export default function Home() {
  return <>
    <header className="site-header">
      <a className="brand" href="/" aria-label="Nuvia — início"><Mark alt="" priority/></a>
      <nav className="main-nav" aria-label="Navegação principal">
        <a className="active" href="/">Início</a><a href="/planear">Planear</a><a href="/fornecedores">Fornecedores</a><a href="/espacos">Espaços</a><a href="/guias">Guias</a><a href="/casamento-civil">Casamento Civil</a>
      </nav>
      <div className="header-actions"><a className="button button-outline compact" href="/entrar">Entrar</a><a className="button button-primary compact" href="/criar-conta">Criar conta</a></div>
      <details className="mobile-nav">
        <summary aria-label="Abrir navegação">Menu</summary>
        <nav aria-label="Navegação principal">
          <a href="/planear">Planear</a><a href="/fornecedores">Fornecedores</a><a href="/espacos">Espaços</a><a href="/guias">Guias</a><a href="/casamento-civil">Casamento Civil</a><a href="/entrar">Entrar</a>
        </nav>
      </details>
    </header>

    <main id="inicio">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Organização de eventos em Angola</p>
          <h1>Casamento, alambamento ou festa.<br/>Tudo no seu lugar.</h1>
          <p className="hero-lede">Planeiem o evento ao vosso ritmo. Organizem tarefas, despesas, participantes e fornecedores num só lugar.</p>
          <div className="hero-actions"><a className="button button-primary" href="/planear">Criar o meu roteiro <Arrow/></a><a className="button button-outline" href="/criar-conta">Criar conta</a></div>
        </div>
        <div className="hero-note"><span className="note-spark">✦</span><h2>Uma etapa de cada vez</h2><p>Sem precisar de ter todas as decisões tomadas. Começa com a data, o orçamento ou uma ideia.</p><a href="/planear">Ver como funciona <Arrow/></a></div>
      </section>

      <section className="home-features" aria-labelledby="features-title">
        <div className="home-section-heading"><p className="eyebrow">Começa com o essencial</p><h2 id="features-title">O que podes organizar</h2><p>Ferramentas práticas para transformar os planos do vosso evento em próximos passos.</p></div>
        <div className="home-feature-grid">{features.map((feature) => <article className="home-feature" key={feature.title}><span className="home-feature-icon" aria-hidden="true">{feature.icon}</span><h3>{feature.title}</h3><p>{feature.text}</p><a href={feature.href}>{feature.action} <Arrow/></a></article>)}</div>
      </section>

      <section className="civil-callout" aria-labelledby="civil-title">
        <div className="civil-callout-icon" aria-hidden="true">♜</div>
        <div className="civil-callout-copy"><p className="eyebrow">Informação para Angola</p><h2 id="civil-title">Têm dúvidas sobre o vosso evento civil?</h2><p>Consulta a orientação disponível, vê as fontes e confirma os requisitos do vosso caso junto da Conservatória competente.</p><small>O conteúdo é informativo e pode não abranger todas as situações. Não substitui confirmação oficial.</small></div>
        <a className="button button-cream" href="/casamento-civil">Consultar orientação <Arrow/></a>
      </section>

      <section className="directory-note" aria-labelledby="directory-title">
        <div><p className="eyebrow">Fornecedores</p><h2 id="directory-title">O directório está numa fase inicial.</h2><p>Podes explorar as categorias e testar os pedidos de informação. Os perfis disponíveis são demonstrativos; ainda não representam disponibilidade, preços ou recomendações verificadas.</p></div>
        <a className="button button-outline" href="/fornecedores">Ver o directório <Arrow/></a>
      </section>

      <section className="bottom-cta" id="planear"><div><p className="eyebrow">Começa sem compromisso</p><h2>O próximo passo pode ser simples.</h2><p>Prepara um roteiro inicial e decide depois o que queres guardar e organizar.</p></div><a href="/planear" className="button button-primary">Começar o roteiro <Arrow/></a></section>
    </main>
    <footer className="site-footer"><a className="brand footer-brand" href="/"><Mark/></a><p>Feito para acompanhar cada celebração.</p><small>© {new Date().getFullYear()} Nuvia</small></footer>
  </>;
}
