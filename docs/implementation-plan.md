# Plano de implementação

## Fundação concluída

- Monorepo npm workspaces e Turborepo com aplicações Next.js e NestJS e PostgreSQL/Prisma.
- Identidade visual responsiva verde-floresta, dourado e creme.
- Modelos de domínio neutros `EventProject`, `ProjectMember` e `EventMoment`, com mapeamento para tabelas legadas para preservar dados.

## Fluxos actuais

- Criação de projectos para casamentos, alambamentos, festas e outros eventos com roteiro inicial conforme o tipo.
- Planeamento, orçamento, fornecedores, participantes/RSVP, convites com QR, programa, colaboração e relatórios.
- Edição dos dados principais, tarefas, despesas, momentos e convidados.

## Próximas prioridades

1. Activar e verificar o pipeline CI e ampliar testes de integração para fluxos completos no browser.
2. Configurar email transaccional para recuperação de conta, após aprovação e configuração explícita do serviço e domínio de envio.
3. Fazer piloto com fornecedores reais: os perfis demonstrativos não representam negócios, e o encaminhamento só funciona para perfis activos associados a uma conta responsável.
4. Configurar monitorização externa, backups agendados e recuperação ensaiada no alojamento de produção.
5. Rever termos, privacidade, retenção de dados e fontes oficiais de informação civil antes do lançamento público.

## Melhorias implementadas nesta etapa

- Caixa de entrada de pedidos para fornecedores com perfil activo associado a uma conta; a resposta fica guardada no evento e gera notificação na plataforma.
- Estados de erro, recuperação e carregamento em nível de rota, além de páginas claras para endereços inexistentes.
- Testes automatizados da formatação de valores/datas e dos fluxos de token RSVP e resposta de fornecedor.
- Workflow CI com typecheck, testes e build; `NEXT_PUBLIC_SITE_URL` permite gerar metadados e sitemap com o domínio público correcto.
- Recuperação de palavra-passe continua sem envio de email configurado. O endpoint não deve ser apresentado como funcional até existir um serviço de envio aprovado e operacional.
