# Deploy da Nuvia no Coolify

O repositório inclui um Compose de produção em `docker-compose.coolify.yml`. O `docker-compose.yml` normal continua reservado ao PostgreSQL de desenvolvimento local.

## Recursos e domínio

1. No Coolify, cria uma aplicação Compose ligada a este repositório e escolhe a branch que será publicada.
2. Usa a raiz do repositório como Base Directory e `docker-compose.coolify.yml` como Docker Compose Location.
3. Mantém o modo Compose normal; não uses Raw, porque o Coolify configura o proxy e as rotas de domínio nesse modo.
4. Adiciona o domínio público ao serviço `web`, porta interna `3000`. Não publiques as portas do serviço `api` nem da base de dados.
5. Confirma no conteúdo Compose renderizado que os serviços `database`, `migrate`, `api` e `web` foram reconhecidos.

O Coolify encaminha o domínio ao serviço e porta interna configurados. Na rede privada do Compose, os serviços comunicam através dos nomes `api` e `database`. A API não é publicada directamente na Internet.

## Variáveis necessárias

Define no painel de variáveis da aplicação Compose, sem guardar valores reais neste repositório:

- `POSTGRES_DB`: nome da base de dados.
- `POSTGRES_USER`: utilizador da base de dados.
- `POSTGRES_PASSWORD`: gera uma palavra-passe forte sem caracteres que exijam escaping na URL, por exemplo com `openssl rand -hex 32`.
- `DATABASE_URL`: `postgresql://<utilizador>:<palavra-passe>@database:5432/<base>?schema=public`. Se a palavra-passe tiver caracteres reservados de URL, codifica-os.
- `WEB_ORIGIN`: origem exacta do site, por exemplo `https://nuvia.example.com`, sem barra final.
- `RSVP_TOKEN_ENCRYPTION_KEY`: chave base64 de exactamente 32 bytes; gera com `openssl rand -base64 32`.
- `PROJECT_DOCUMENT_ENCRYPTION_KEY`: chave Base64 dedicada de exactamente 32 bytes para cifrar ficheiros pessoais dos eventos; gera uma chave diferente com `openssl rand -base64 32` e mantém-na estável.
- `TRUST_PROXY_HOPS`: usa `1` se a instalação tiver apenas o proxy confiável do Coolify antes da API; ajusta se a topologia mudar.
- `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_EMAIL` e `GA4_SERVICE_ACCOUNT_PRIVATE_KEY`: opcionais; define os três apenas se quiseres mostrar relatórios do GA4 na tab privada **Administração → Métricas**. A chave privada deve ficar como segredo do serviço `api`, nunca no serviço `web`.
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: configura para activar emails transaccionais. O remetente deve usar um domínio validado na conta Resend, por exemplo `Nuvia <conta@nuvia.teudominio.ao>`. A validação do domínio requer os registos DNS indicados no painel Resend, incluindo SPF/DKIM quando apresentados ([documentação de domínios](https://resend.com/docs/dashboard/domains/introduction)). Guarda a API key apenas como variável secreta do serviço `api`.

Com o Resend configurado, a Nuvia envia boas-vindas, recuperação de palavra-passe, alertas de novo acesso e alteração de email, partilha e remoção de acesso a eventos, convites individuais, actualizações do programa, avisos de contribuições, pedidos e respostas de fornecedores e mensagens de suporte. As preferências de emails de actividade ficam em **Dashboard → Definições → Conta e privacidade**; os avisos de segurança e de alteração de acessos continuam activos. O resumo semanal é opcional e começa uma semana após a activação. Sem estas variáveis, os pedidos continuam guardados e as notificações internas funcionam; os fluxos que dependem de email, incluindo recuperação e confirmação de alteração de email, ficam indisponíveis em produção. Em desenvolvimento, a recuperação e confirmação de email devolvem links locais para testes.

`API_INTERNAL_URL` e `NEXT_PUBLIC_API_URL` já estão definidos no Compose. A aplicação Web chama a API pelo mesmo domínio através do rewrite do Next.js; a ligação entre containers usa `http://api:4000/api/v1`.

## Armazenamento e migrações

O Compose mantém a base de dados, o portefólio dos fornecedores, os comprovativos das contribuições e os documentos privados dos eventos em volumes separados. Os documentos são cifrados antes de serem gravados; preserva a chave `PROJECT_DOCUMENT_ENCRYPTION_KEY` fora do volume e dos backups. Configura backups regulares desses volumes e testa a reposição antes de guardar dados reais.

O serviço de execução única `migrate` aplica `prisma migrate deploy` antes de iniciar a API. Está marcado com `exclude_from_hc`, extensão do Coolify para impedir que o container de migração (que termina com código zero) afecte o estado de saúde global. Mantém o modo Compose normal no Coolify para que esta extensão e o proxy gerido sejam processados. Faz backup antes de alterações de schema. Se o Prisma indicar P3009, segue a recuperação descrita em [README.md](../README.md#recuperar-uma-migração-p3009); não apagues volumes que possam conter dados necessários.

## Verificação após o primeiro deploy

- `database`, `api` e `web` ficam saudáveis; `migrate` termina com código zero e não participa no healthcheck global.
- `https://<domínio>/` e as rotas públicas respondem por HTTPS.
- A API responde em `http://api:4000/api/v1/health` dentro da rede; não precisa de domínio público.
- Registo, sessão segura, recuperação de palavra-passe e carregamento de imagens/comprovativos funcionam com as variáveis de produção.
- A pasta `apps/api` escuta em `0.0.0.0:4000` no container.

## Estado da preparação

Em 17 de Novembro de 2026, os builds locais e Docker, o typecheck, os 19 testes e a configuração Compose passaram. A auditoria de dependências encontrou zero vulnerabilidades de produção na Web e 13 na API (4 moderadas e 9 altas), incluindo dependências do NestJS e do processamento multipart. O `npm audit` indica que a correcção completa disponível exige uma actualização major do NestJS; essa migração deve ser revista e validada antes de expor a API publicamente. Por isso, as imagens estão construídas, mas a API ainda não está aprovada para um lançamento público.
