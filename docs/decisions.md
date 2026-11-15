# Decisões técnicas e de produto

1. **npm workspaces + Turborepo:** o repositório usa npm e `package-lock.json` na raiz. Um único gestor reduz divergências de instalação.
2. **Next.js App Router + NestJS REST:** páginas públicas e aplicação autenticada partilham os contratos REST versionados.
3. **Projectos de evento:** o domínio chama-se `EventProject` e suporta casamento, alambamento, festa e outro evento. As tabelas físicas antigas são mantidas via `@@map` e campos `@map`, evitando migração destrutiva dos dados.
4. **Momentos do projecto:** cerimónia, pedido, festa e outros horários são `EventMoment` associados ao projecto.
5. **PostgreSQL + Prisma:** relações e migrações explícitas. Alterações de schema devem preservar dados e ser aplicadas por migration.
6. **Idioma/moeda:** conteúdo `pt-AO`, datas em `Africa/Luanda` e moeda padrão AOA.
7. **Conteúdo civil:** a plataforma diferencia informação confirmada, condicional e por confirmar. Orientação não substitui confirmação oficial.
8. **Fornecedores:** perfis fictícios são identificados como demonstração; pedidos ficam guardados e não são comunicados enquanto não existir canal de entrega.
9. **Fotografia:** a imagem actual é um activo editorial temporário e requer substituição por fotografia licenciada que represente os vários tipos de evento.
10. **Planeamento visual:** cada projecto tem quadro com estados Por organizar, Em andamento, A aguardar e Concluído, além de vista de lista. A movimentação funciona por arrastar no computador e por selector para toque/teclado; categorias partilhadas com o orçamento facilitam registar custos a partir de uma tarefa.
11. **Responsável pela tarefa:** tarefas podem apontar para um membro do projecto através de relação a utilizador; a API valida a pertença ao projecto. O campo de nome livre mantém compatibilidade com atribuições antigas e responsáveis externos.
12. **Despesa ligada a tarefa:** a relação é opcional e a API só aceita tarefas do mesmo projecto. Remover uma tarefa mantém a despesa e limpa a referência, para preservar o histórico financeiro.
13. **Fornecedores por evento:** favoritos usam uma relação projecto-fornecedor, sem misturar opções entre eventos. A ligação ao directório e aos perfis preserva o projecto activo e pré-associa o formulário de pedido.
14. **Pedidos de fornecedor:** os estados descrevem o acompanhamento feito pelo utilizador; “enviado” significa contacto manual fora da plataforma. Uma contratação gera uma despesa comprometida ligada ao pedido, e a remoção dessa despesa devolve o pedido ao estado de resposta recebida.
15. **Classificação e momentos:** `ProjectKind` classifica o projecto como casamento, alambamento, festa ou outro; `EventType` classifica momentos individuais no programa. Um projecto pode reunir vários tipos de momento.
16. **Gestão dos projectos:** a dashboard inclui a vista “Os meus eventos”, com cartões para seleccionar o projecto activo e rever os dados principais sem confundir projectos com momentos do programa.
17. **Marca do produto:** Nuvia é o nome da plataforma. A comunicação pública usa “Casamentos · Alambamentos · Eventos” como descritor, mantendo referências específicas ao casamento nas páginas civis e conteúdos relevantes. Nomes internos de pacotes, sessões e base de dados permanecem estáveis para evitar migrações sem benefício ao produto.
