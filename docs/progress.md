# Estado do projecto

## Já implementado

- Monorepo npm workspaces com Turborepo, Next.js, NestJS, PostgreSQL e Prisma.
- Projectos de evento com tipo Casamento, Alambamento, Festa ou Outro. Os modelos Prisma chamam-se `EventProject`, `ProjectMember` e `EventMoment`; as tabelas existentes são preservadas por mapeamento e as rotas antigas `/weddings` continuam como alias de compatibilidade.
- Cada tipo de evento recebe tarefas, categorias iniciais do orçamento, sequência sugerida do programa e texto de convite adequado; o fluxo deixa de iniciar com um roteiro exclusivamente de casamento.
- Onboarding com tipo, província, data, orçamento e estimativa de participantes; o projecto cria um roteiro de tarefas adequado ao tipo escolhido.
- Os roteiros iniciais de casamento, alambamento, festa e outros eventos têm tarefas e categorias próprias, para que a primeira visita comece com passos mais relevantes.
- Gestão “Os meus eventos” com cartões que identificam tipo, nome, data, província, participantes e limite; permite mudar de projecto e marcar o activo.
- Tipo do projecto separado dos momentos do programa: Casamento, Alambamento, Festa e Outro classificam o plano; cerimónia civil, religiosa, pedido tradicional e recepção são momentos independentes dentro desse plano.
- Dashboard com próximo passo guiado, dados editáveis do projecto, tarefas com prazo/responsável e acções de edição e remoção.
- Planeamento em quadro por evento com colunas Por organizar, Em andamento, A aguardar e Concluído; cartões têm prioridade e categoria, podem ser arrastados ou movidos por controlo acessível, e oferecem vista de lista alternativa.
- Filtros por texto, membro responsável, categoria, prioridade e prazo; avisos visuais para tarefas atrasadas, a vencer hoje e nos próximos sete dias.
- Atribuição de tarefas a membros reais do projecto, validada pela API para impedir atribuições a pessoas sem acesso. Responsáveis antigos em texto continuam visíveis.
- Tarefas com categoria alinhada às categorias do orçamento podem iniciar o registo de uma despesa relacionada.
- Agenda cronológica reúne prazos das tarefas e horários dos momentos do evento.
- Orçamento com resumo do limite, estimativas, valores contratados/pagos e saldo, aviso de excesso, comparação por categoria, prazos de pagamento e layout de despesas em cartões no telemóvel.
- Cada despesa contratada pode ter prestações com valor, descrição, prazo e estado pago/por pagar. A API impede que a soma planeada ultrapasse o contrato; relatórios e saldo distinguem pagamentos parciais do montante ainda devido.
- O saldo previsto desconta despesas estimadas, contratadas e pagas; ao criar ou alterar qualquer despesa, o resumo reflecte o total registado.
- Despesas podem ligar-se a tarefas do mesmo evento; a relação é validada pela API e permite regressar à tarefa associada.
- Programa com data, hora e local; os momentos podem ser editados ou removidos.
- Lista de convidados com grupos, limite de acompanhantes por convite, RSVP e atribuição a mesas. A capacidade considera acompanhantes confirmados e lugares previstos para convites sem resposta.
- Convite público personalizável com editor e pré-visualização ao vivo, três estilos guardados, estado de publicação, partilha geral e acesso directo aos links individuais de RSVP. QR Codes gerais e individuais são gerados localmente.
- Convites por email registam tentativa, estado e falha sem guardar mensagens técnicas sensíveis; a lista permite repetir o envio. O resumo semanal inclui tarefas, RSVP pendentes, vencimentos, contribuições e pedidos de fornecedor, mostra o último estado e permite repetir o envio após falha.
- Álbum opcional do evento com link e QR, envio de fotografias sem conta, redimensionamento, limite de formato/tamanho e aprovação dos anfitriões antes da publicação. O álbum é desactivado por padrão, o link pode ser revogado e o volume privado precisa de backup próprio.
- Programa separado entre sequência dos momentos e prazos de preparação; momentos são ordenados por horário, prazos concluídos saem da lista pendente e atrasos ficam destacados.
- Datas e horas do programa e prazos usam o fuso de Luanda ao criar e editar, evitando desvios conforme o fuso do dispositivo.
- Gestão de convidados com contagem de convites e pessoas previstas/confirmadas, pesquisa e filtros por RSVP, grupo e mesa, edição directa, importação CSV com deduplicação até 500 registos e exportação CSV.
- Ocupação visual das mesas com lugares disponíveis e aviso de excesso; confirmações contam pessoas reais, respostas pendentes reservam o limite do convite e recusas libertam lugares.
- Pesquisa de fornecedores, favoritos e pedidos de informação no projecto. Para perfis activos associados a uma conta, os pedidos aparecem na caixa de entrada do fornecedor e as respostas notificam os membros do evento; outros perfis continuam com seguimento manual.
- Pedidos de fornecedores guardam data do evento, participantes e disponibilidade. Espaços ligados a prestadores activos também recebem pedidos de disponibilidade e orçamento; organizador acompanha resposta, disponibilidade e valor no evento e prestador responde pela área de Pedidos.
- A caixa de entrada do fornecedor acompanha quais pedidos ainda não foram vistos, permite marcá-los como vistos e evita contar pedidos antigos como novos após a activação deste indicador.
- Espaço de fornecedores por evento com favoritos comparáveis por categoria, localização e faixa de preço; o contexto acompanha a navegação do dashboard ao directório e ao perfil.
- Formulário público de candidatura de fornecedores, com registo na base de dados, validação, fila administrativa e conversão para perfil pendente de aprovação.
- Backoffice protegido para a equipa lista fornecedores em todos os estados, permite editar perfis, aprovar, suspender com motivo e reactivar; as decisões ficam auditadas.
- Candidaturas podem ser acompanhadas até conversão ou recusa com motivo, e o histórico administrativo mostra responsável, data e alterações recentes.
- Categorias do directório e províncias são configuráveis no backoffice e alimentam a pesquisa pública e o formulário de candidatura.
- Perfil real pode preparar mensagem para envio manual por WhatsApp ou email; o utilizador confirma o envio fora da plataforma.
- Perfis activos de fornecedores podem ser associados a uma conta responsável após pedido e aprovação administrativa; pedidos, decisões e alterações ficam no histórico auditável.
- Área do fornecedor para propor alterações de perfil e redes (site, Instagram, Facebook e TikTok) com validação HTTPS, carregar até oito imagens próprias (JPEG, PNG ou WebP até 8 MB, convertidas para WebP), escolher capa, ordenar e remover imagens.
- Área do fornecedor separada em Pedidos, Perfil e portefólio e Avaliações. A caixa de entrada mostra pedidos resumidos, abre a resposta num painel próprio, permite pesquisa por evento/mensagem/fornecedor, filtra por estado e pagina os resultados no servidor.
- Auto-registo profissional: após criar/entrar numa conta, o prestador cria até cinco perfis privados em estado pendente; cada perfil é associado à conta e entra na fila administrativa existente. Pode preparar o portefólio enquanto aguarda aprovação, sem publicação antecipada.
- Avaliações de fornecedores só podem ser criadas por membros com permissão de edição num evento já passado e para um pedido marcado como contratado com despesa associada. Há uma avaliação por contratação, nota geral e critérios de qualidade, comunicação e pontualidade; o nome fica oculto por padrão.
- Avaliações e respostas públicas dos prestadores passam por moderação. O perfil mostra apenas avaliações aprovadas, indica que o cliente registou a contratação no evento e inclui resposta do prestador apenas depois da sua aprovação.
- Imagens e alterações de perfil ficam pendentes até revisão; apenas conteúdo aprovado aparece publicamente. O perfil explica que revisão não garante disponibilidade nem execução do serviço.
- Pedidos de informação com estados manuais (guardado, enviado por outro canal, resposta recebida, contratado e fechado), notas e valor recebido; perfis demonstrativos são claramente identificados.
- Ao marcar um fornecedor como contratado, cria-se uma despesa comprometida no orçamento com prazo opcional e ligação ao pedido. Remover essa despesa reabre o pedido para resposta, evitando um estado de contratação sem registo financeiro.
- Colaboração por contas existentes, com permissões de edição ou consulta, gestão de nível e remoção de acessos visíveis apenas para responsáveis. O acesso é concedido imediatamente; não há envio de email.
- Relatórios com saldo versus limite, despesas por categoria e estado, contagem separada de pessoas e convites, e atalhos para tarefas atrasadas e pagamentos por fazer.
- Contribuições de convidados sem conta por link aleatório e revogável. Registo pode incluir nome ou anonimato, valor, método, mensagem, comprovativo privado e despesa apoiada; gestão do evento tem estados por confirmar/confirmada/recusada, paginação, totais que contam apenas validações e progresso agregado opcional. O registo não processa pagamentos.
- Definições separadas entre dados do evento e segurança/privacidade da conta, com aviso de alterações por guardar e bloqueio de submissões repetidas.
- Eventos podem ser arquivados e restaurados por quem os gere; os dados permanecem guardados e a API bloqueia alterações enquanto o evento está arquivado.
- Datas dos projectos são apresentadas e guardadas com referência ao fuso de Luanda.
- Assistente civil com fontes e estados de verificação. A orientação permanece informativa e requer confirmação oficial.
- Limites de tentativas de login, registo, candidaturas e RSVP persistidos no PostgreSQL e partilhados entre instâncias; encaminhamento de IP por proxy exige configuração explícita.
- DTOs de actualização administrativa de guias, conservatórias e candidaturas validados em runtime.
- Scripts de backup PostgreSQL e dos volumes do Coolify validam e cifram os arquivos, enviam-nos para um destino remoto `rclone` e permitem ensaios de restauro isolados. A operação em produção ainda depende de agendamento e credenciais no host.
- Rascunhos de despesas, convidados e documentos são recuperáveis no mesmo navegador durante 24 horas; os ficheiros de documentos não são guardados no armazenamento local do navegador.
- Migrações aplicadas para tipo de projecto, limite de acompanhantes e estilos dos convites. Dados existentes continuam nas tabelas e são classificados por momentos já guardados.
- Migrações de cifragem dos tokens RSVP e caixa de entrada/notificações de fornecedores aplicadas à base PostgreSQL local.

## Verificação

- Migrações de candidaturas, limite de pedidos e estilos dos convites foram aplicadas à base PostgreSQL local.
- Migração de acesso de fornecedores, submissões de perfil e portefólio aplicada à base PostgreSQL local.
- Migração de avaliações e respostas de fornecedores aplicada à base PostgreSQL local.
- `npx prisma validate --schema packages/database/prisma/schema.prisma` passou.
- `npm run build --workspace=@casar/api` e `npm run typecheck --workspace=@casar/web` passaram.
- `npm run typecheck --workspace=@casar/api`, validação Prisma e build de produção Next.js passaram após a implementação dos planos de pagamento e do estado de leitura da caixa de entrada.
- Migrações de prestações do orçamento e de leitura dos pedidos de fornecedores aplicadas à base PostgreSQL local.
- Migration `20261116230000_event_contributions` aplicada à base PostgreSQL local; inclui campanhas, contribuições e o tipo de notificação para novos registos.
- Validação Prisma, typecheck da API e Web e build de produção da Web passaram após a implementação das contribuições. Os comprovativos locais ficam em `apps/api/data/private-contribution-proofs/`, excluídos do Git.
- `npm test --workspace=@casar/api` passou com 15 testes, incluindo protecção dos responsáveis, RSVP, capacidade das mesas, importação CSV, tema do convite, DTOs e rate limit.
- `NEXT_DIST_DIR=.next-review npm run build --workspace=@casar/web` passou. O build isolado evita colidir com uma instância local que use `.next`.
- Em execução local, `/app` respondeu HTTP 200 e `/api/v1/health` reportou PostgreSQL ligado.
- Prisma validate, typecheck e builds de produção da API e Web passaram após os fluxos de disponibilidade, álbum, lembretes e rascunhos; os scripts de backup passaram `bash -n`.

## Ainda por ligar antes de produção

- Piloto com fornecedores reais: a caixa de entrada e notificações funcionam para perfis activos associados a uma conta, mas a plataforma ainda não tem fornecedores reais confirmados nem canal externo de email/WhatsApp.
- Em produção, configurar `PORTFOLIO_STORAGE_DIR` para um volume persistente com backup. O armazenamento local já funciona no desenvolvimento, mas um disco efémero de contentor não é adequado para publicação.
- Emails transaccionais por Resend já estão implementados, incluindo convites e recuperação de palavra-passe; ficam desligados por padrão e exigem `RESEND_ENABLED=true`, credenciais e domínio de envio configurados. Envio por WhatsApp e acompanhamento de entrega fora do email continuam por implementar.
- Reservas, pagamentos e disponibilidade sincronizada dos espaços continuam por implementar; o fluxo actual regista pedidos, respostas e estados, sem confirmar reservas.
- Agendar backups no host Coolify, configurar `age`/`rclone`, fazer restauro periódico de base e volumes de teste, activar monitorização externa, rever termos e privacidade e manter a revisão editorial das fontes civis.
- Testes de browser ponta a ponta e activação do pipeline CI no repositório remoto continuam pendentes.
- Substituição da fotografia de referência por activos licenciados adequados também a alambamentos e festas.
