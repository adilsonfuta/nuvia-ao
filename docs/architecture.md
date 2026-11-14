# Arquitectura

Monorepo Turborepo com `apps/web` (Next.js App Router), `apps/api` (NestJS REST em `/api/v1`) e pacotes partilhados em `packages/`. PostgreSQL é acedido através do Prisma.

## Aplicações e pacotes

- `apps/web`: interface pública, área autenticada, páginas de fornecedores/guias/convites, assistente civil e administração.
- `apps/api`: autenticação e sessões, projectos de evento e planeamento, catálogo, conteúdo legal e administração.
- `packages/database`: schema Prisma, migrations, client e seed local.
- `packages/contracts`: tipos partilhados para contratos da aplicação.
- `packages/ui`: tokens visuais.
- `packages/utils`: utilitários comuns.

A gestão de eventos do dashboard usa o componente `apps/web/app/app/event-manager.tsx` e tipos de `packages/contracts`, para manter o ecrã de eventos separado da composição geral da dashboard.

## Segurança de sessão e dados

O browser recebe um token de sessão aleatório num cookie httpOnly, SameSite=Lax. A base de dados guarda apenas o hash do token. Recursos privados validam a sessão e a pertença ao projecto no servidor. Rotas públicas de convite usam slug não sequencial. RSVP valida o limite individual de acompanhantes; a ocupação das mesas é calculada por pessoas, usando confirmações quando disponíveis e o limite do convite enquanto não há resposta. Endpoints de entrada usam validação e limites de pedidos; as operações administrativas ficam registadas em auditoria.

No desenvolvimento, as chamadas do browser usam `/api/v1` no mesmo domínio do site; o Next.js encaminha-as para `API_INTERNAL_URL`. Isto mantém o cookie de sessão no mesmo domínio quer o site seja aberto por `localhost` quer por `127.0.0.1`. Em produção, configurar `API_INTERNAL_URL`, `WEB_ORIGIN` e as origens públicas conforme o alojamento. Limites de pedidos partilhados usam PostgreSQL; `TRUST_PROXY_HOPS` só deve reflectir proxies controlados que substituem `X-Forwarded-For`. HTTPS, gestão de segredos, backups, monitorização e revisão independente continuam necessários antes de produção.

As candidaturas de fornecedores são guardadas para revisão. A conversão cria um perfil pendente, que continua fora do directório até aprovação. Pedidos de orçamento podem abrir uma mensagem pré-preenchida no email ou WhatsApp escolhido pelo utilizador; a plataforma não envia nem detecta a entrega.

## Execução local

1. Copiar `.env.example` para `.env` e configurar as credenciais locais.
2. Instalar dependências com `npm install` (npm workspaces; lockfile único na raiz).
3. Iniciar PostgreSQL: `docker compose up -d postgres`.
4. Gerar client e aplicar migrations: `npm run db:generate --workspace=@casar/database` e `npm run db:migrate --workspace=@casar/database`.
5. Carregar conteúdo de demonstração: `npm run db:seed --workspace=@casar/api`.
6. Iniciar web e API com `npm run dev` na raiz; API em `:4000`, web em `:3000`.

O Compose publica PostgreSQL na porta local 5433. O `.env.example` já usa essa porta.

## Conteúdo civil

O assistente distingue informação confirmada, condicional e por confirmar. Requisitos devem ter fonte, âmbito e versão e requerem validação humana. Orientação da plataforma não substitui confirmação junto da Conservatória competente.
