export const GUIDE_COVERS: Record<string, { src: string; alt: string }> = {
  "como-comecar-a-planear": { src: "/guias/como-comecar-a-planear.webp", alt: "Casal a planear o casamento em conjunto" },
  "organizar-o-orcamento": { src: "/guias/organizar-o-orcamento.webp", alt: "Agenda, calculadora e alianças para organizar o orçamento" },
  "primeira-lista-de-convidados": { src: "/guias/primeira-lista-de-convidados.webp", alt: "Mesa de casamento com cartões de convidados" },
  "escolher-o-espaco": { src: "/guias/escolher-o-espaco.webp", alt: "Espaço de casamento ao ar livre ao pôr do sol" },
  "casamento-civil-documentos-angola": { src: "/guias/casamento-civil-documentos-angola.webp", alt: "Documentos e alianças para preparar o casamento civil" },
};

export const GUIDE_ACTIONS: Record<string, { label: string; href: string }> = {
  "como-comecar-a-planear": { label: "Criar o meu roteiro", href: "/entrar?next=%2Fdashboard%3Ftab%3Dplaneamento" },
  "organizar-o-orcamento": { label: "Controlar despesas", href: "/entrar?next=%2Fdashboard%3Ftab%3Dorcamento" },
  "primeira-lista-de-convidados": { label: "Gerir convidados", href: "/entrar?next=%2Fdashboard%3Ftab%3Dconvidados" },
  "escolher-o-espaco": { label: "Explorar espaços", href: "/espacos" },
  "casamento-civil-documentos-angola": { label: "Consultar orientação civil", href: "/casamento-civil" },
};
