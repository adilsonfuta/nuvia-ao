# Plano de implementação

## Fundação concluída

- Monorepo npm workspaces e Turborepo com aplicações Next.js e NestJS e PostgreSQL/Prisma.
- Identidade visual responsiva verde-floresta, dourado e creme.
- Modelos de domínio neutros `EventProject`, `ProjectMember` e `EventMoment`, com mapeamento para tabelas legadas para preservar dados.

## Fluxos actuais

- Criação de projectos para casamentos, alambamentos, festas e outros eventos com roteiro inicial conforme o tipo.
- Planeamento, orçamento, fornecedores, participantes/RSVP, convites com QR, programa, colaboração e relatórios.
- Edição dos dados principais, tarefas, despesas, momentos e convidados.

## Prioridades seguintes

1. Completar testes automatizados de API para sessão, autorização por projecto, RSVP e lotação de mesas.
2. Criar portal de fornecedores, encaminhamento real dos pedidos e notificações, depois de definir verificação e consentimento.
3. Adicionar importação CSV, recuperação de conta e gestão de espaços.
4. Implementar pipeline CI, monitorização, backups, retenção de dados e revisão de segurança.
5. Validar legalmente o conteúdo civil e actualizar fontes de forma recorrente.
