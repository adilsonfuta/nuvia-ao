# Nuvia

Plataforma para organizar casamentos, alambamentos, festas e outros eventos em Angola. Cada evento reúne planeamento, fornecedores, convidados, orçamento, documentos e colaboração.

## Stack

- Monorepo npm/Turborepo
- Web: Next.js, TypeScript e Tailwind CSS
- API: NestJS e REST em `/api/v1`
- Base de dados: PostgreSQL com Prisma ORM

## Desenvolvimento local

Requisitos: Node.js 22 ou superior, npm e Docker.

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate --workspace=@casar/database
npm run db:migrate --workspace=@casar/database
npm run dev
```

A Web fica disponível em `http://localhost:3000` e a API em `http://localhost:4000/api/v1`. Para carregar fornecedores e guias de demonstração, executa:

```bash
npm run db:seed --workspace=@casar/api
```

Para criar o administrador inicial, define `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` no ambiente da API antes de a iniciar. A conta é criada automaticamente no arranque; não é necessário executar um script. Usa uma palavra-passe com pelo menos 12 caracteres. O seed de demonstração serve apenas para carregar conteúdos fictícios.

Novas contas recebem um email de boas-vindas com um link de confirmação válido por 24 horas e de utilização única. A confirmação não bloqueia o acesso à dashboard; o utilizador pode reenviar o link enquanto o endereço estiver pendente.

## Deploy no Coolify

Usa a raiz do repositório e `docker-compose.coolify.yml` como ficheiro Compose. Publica o serviço `web` na porta 3000; a API e o PostgreSQL permanecem na rede privada do Compose. Configura as variáveis descritas em [docs/deploy-coolify.md](docs/deploy-coolify.md), incluindo as chaves de cifragem e o domínio HTTPS.

O serviço `migrate` executa `prisma migrate deploy` antes da API. Mantém os volumes PostgreSQL e de ficheiros privados; faz backups e guarda as chaves de cifragem separadamente. A perda de `PROJECT_DOCUMENT_ENCRYPTION_KEY` impede a leitura de documentos já carregados.

### Recuperar uma migração P3009

O Prisma não continua automaticamente depois de uma migração falhar. A migração `20261114135403_vendor_service_reviews` foi corrigida para criar `VendorContentStatus` antes de a tabela de avaliações a usar e para tolerar a ausência do índice `Vendor_ownerUserId_idx`. Uma base que já registou uma falha continua a exigir recuperação.

Se for uma instalação inicial sem dados que precisem de ser preservados, pára a aplicação no Coolify, remove apenas o volume PostgreSQL deste recurso e volta a fazer deploy. O nome costuma incluir `nuvia-postgres-data`. Mantém os volumes `nuvia-project-documents`, `nuvia-vendor-portfolio` e `nuvia-contribution-proofs`; não uses `docker compose down -v`.

Se a base já contiver dados importantes, não removas o volume. Faz primeiro um backup, confirma os objectos parcialmente criados pela migração falhada e recupera o estado antes de executar `migrate deploy`. Para a falha conhecida, que ocorreu antes da tabela `VendorReview`, a recuperação pode exigir remover o tipo `VendorReviewStatus` caso exista e marcar a migração como revertida:

```sql
DROP TYPE IF EXISTS "VendorReviewStatus";
DROP TYPE IF EXISTS "VendorContentStatus";
```

```bash
npx prisma migrate resolve --rolled-back 20261114135403_vendor_service_reviews --schema packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

Executa os comandos com a `DATABASE_URL` do ambiente de produção e só depois de confirmar o estado parcial. Não marques como aplicada uma migração cujas alterações não foram concluídas.

## Documentação

- [Deploy e variáveis do Coolify](docs/deploy-coolify.md)
- [Métricas do GA4 no backoffice](docs/admin-analytics.md)
- [Arquitectura](docs/architecture.md)
- [Estado do projecto](docs/progress.md)
- [Preparação para produção](docs/production-readiness.md)
