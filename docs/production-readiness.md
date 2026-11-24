# Preparação para produção

Este documento separa o que o código já suporta das operações que ainda precisam de configuração no ambiente de produção.

## Dados e privacidade

- Publicar termos de utilização e política de privacidade revistos para Angola, incluindo finalidades, retenção, partilha com fornecedores e pedidos de eliminação/exportação.
- A candidatura de fornecedor guarda nome comercial, contacto, email, telefone, localização e descrição. Limitar o acesso à equipa administrativa e definir um prazo de retenção para candidaturas recusadas.
- O utilizador escolhe explicitamente abrir email ou WhatsApp para enviar um pedido. A plataforma não envia nem confirma a entrega dessa mensagem.
- Não colocar segredos, bases de dados ou backups em repositórios. A pasta `backups/` está excluída do Git e os ficheiros são criados sem permissões de leitura para outros utilizadores do sistema.
- Os comprovativos das contribuições ficam fora da pasta pública, com nomes aleatórios e permissões restritas. Em produção, configurar `PRIVATE_UPLOAD_STORAGE_DIR` para volume persistente e privado, incluí-lo nos backups cifrados e definir uma política de retenção/eliminação. O endpoint de leitura exige sessão e acesso ao evento.
- As capas carregadas para a Biblioteca são convertidas para WebP e ficam em `GUIDE_COVER_STORAGE_DIR`. Em produção, montar esse caminho num volume persistente (`nuvia_guide_covers` no Compose Coolify) e incluí-lo nos backups dos conteúdos.
- As fotografias carregadas para a galeria dos espaços ficam em `VENUE_PHOTO_STORAGE_DIR`. Em produção, montar esse caminho num volume persistente (`nuvia_venue_photos` no Compose Coolify) e incluí-lo nos backups do catálogo.
- Documentos de eventos aceitam apenas PDF, JPG e PNG até 10 MB. Os ficheiros são validados pelo conteúdo, cifrados em AES-256-GCM no armazenamento privado, e só podem ser descarregados por membros do evento; uploads, alterações, downloads e remoções entram no histórico. Em produção, configurar uma chave dedicada `PROJECT_DOCUMENT_ENCRYPTION_KEY` e o volume persistente `nuvia_project_documents`; guardar a chave separada dos backups e não a rodar sem voltar a cifrar os ficheiros existentes.

## Backups e recuperação

Executar `DATABASE_URL='...' BACKUP_REQUIRE_OFFSITE=true ./scripts/backup-postgres.sh` num ambiente que tenha `pg_dump` instalado. O script valida o arquivo com `pg_restore --list`, limita permissões, cifra com `age` e envia cópia imutável para um destino `rclone`. Em produção, configura `AGE_RECIPIENT`, `RCLONE_REMOTE` e `BACKUP_RETENTION_DAYS`; agenda-o fora do container efémero da API (por exemplo, cron no host ou um job externo) pelo menos diariamente. Não guardes a chave privada `age` no mesmo servidor nem no mesmo destino dos backups.

Exemplo de cron no host, depois de guardar as variáveis em `/etc/nuvia/backup.env` com permissões `600`: `15 2 * * * cd /caminho/do/repo && set -a && . /etc/nuvia/backup.env && set +a && BACKUP_REQUIRE_OFFSITE=true ./scripts/backup-postgres.sh >> /var/log/nuvia-backup.log 2>&1`. Agenda também `scripts/backup-coolify-volumes.sh` com `BACKUP_VOLUMES` a conter os nomes completos dos volumes; usa as ferramentas `age`, `rclone` e `docker` instaladas no host.

Depois de cada backup, confirma que o ficheiro chegou ao destino remoto. Pelo menos trimestralmente, usa uma base vazia e isolada: `RESTORE_DATABASE_URL='postgresql://.../nuvia_restore_test' ./scripts/verify-postgres-backup.sh caminho/para/backup.dump.age`. A validação faz um restauro completo; não uses a URL da base de produção. Regista data, resultado e duração do exercício. As imagens e documentos também precisam de cópia: agenda `BACKUP_VOLUMES='nome-volume1 nome-volume2 …' ./scripts/backup-coolify-volumes.sh` no host Coolify para os volumes persistentes (`nuvia_event_albums`, `nuvia_project_documents`, `nuvia_contribution_proofs`, `nuvia_vendor_portfolio`, `nuvia_guide_covers` e `nuvia_venue_photos`). O script cria tarballs cifrados antes de os enviar para o destino remoto. Usa os nomes reais listados por `docker volume ls`, que no Coolify têm um prefixo do recurso. Para testar um arquivo sem tocar no volume de produção: `AGE_IDENTITY=/caminho/privado/age.key ./scripts/verify-coolify-volume-backup.sh caminho/para/backup.tar.gz.age`; o script extrai num volume temporário e remove-o ao terminar.

Para restaurar um dump validado num banco vazio: `pg_restore --no-owner --no-acl --dbname="$DATABASE_URL" caminho/para/backup.dump`. Confirmar a versão do PostgreSQL e executar a recuperação primeiro num ambiente isolado.

## Monitorização e operação

- O endpoint `/api/v1/health` verifica ligação à base de dados. Configurar monitorização externa, alertas para estados diferentes de `ok`, erros HTTP, latência e espaço em disco.
- Recolher logs sem palavras-passe, cookies de sessão, tokens de RSVP, conteúdo de mensagens ou dados completos de convidados.
- Definir responsáveis por incidentes, restauração, migrações e rotação de segredos antes de abrir o serviço ao público.
- Configurar `RSVP_TOKEN_ENCRYPTION_KEY` com 32 bytes aleatórios codificados em Base64 (`openssl rand -base64 32`), guardar fora do banco e incluí-la no backup seguro de segredos. A chave é necessária para voltar a mostrar links RSVP existentes; não a rodar sem re-cifrar os tokens.
- Aplicar a migration `20261115220000_secure_rsvp_tokens` antes de iniciar a nova API. No arranque, tokens antigos são substituídos por tokens aleatórios e o hash antigo continua aceite por 90 dias para evitar quebrar links que já foram partilhados.
- O limitador de pedidos usa PostgreSQL partilhado entre instâncias. Se a API estiver atrás de proxy, definir `TRUST_PROXY_HOPS` apenas para a cadeia controlada que substitui `X-Forwarded-For`; não confiar num cabeçalho encaminhado directamente por clientes.

## Fornecedores e informação civil

- Rever candidaturas com contacto directo antes de criar um perfil pendente. A conversão administrativa não publica nem verifica automaticamente o negócio.
- Pedidos de disponibilidade e orçamento para fornecedores e espaços associados a uma conta activa chegam à caixa de entrada do prestador e guardam a data, dimensão do evento, estado de disponibilidade e resposta. Perfis de demonstração ou espaços sem responsável não recebem pedidos; a página deve manter essa limitação visível.
- Só marcar perfis e contactos como revistos depois de confirmar a identidade, os dados de contacto e a informação publicada.
- Cada requisito civil publicado deve ter fonte oficial, âmbito, data de revisão e responsável editorial. A interface deve continuar a recomendar confirmação na Conservatória competente.

## Lançamento

- Aplicar migrations num ambiente de staging e verificar backup antes de produção.
- Aplicar também a migration `20261116230000_event_contributions` e configurar `PRIVATE_UPLOAD_STORAGE_DIR` num volume privado persistente antes de disponibilizar os links públicos.
- Configurar `PROJECT_DOCUMENT_ENCRYPTION_KEY` com 32 bytes aleatórios codificados em Base64 (`openssl rand -base64 32`) no Coolify. A migração dos documentos é aplicada pelo serviço `migrate` do Compose; preservar o volume `nuvia_project_documents` e incluir o seu conteúdo cifrado nos backups.
- Configurar HTTPS, origem pública, `API_INTERNAL_URL`, `WEB_ORIGIN`, segredos fortes e `TRUST_PROXY_HOPS` conforme a infraestrutura.
- Definir `NEXT_PUBLIC_SITE_URL` com a origem canónica HTTPS para metadados e sitemap; sem esta variável o sitemap permanece vazio para não publicar URLs locais.
- Executar testes automatizados, percursos no browser com contas de teste, revisão de acessos administrativos e teste de recuperação.
- Convites individuais por email podem ser enviados pelo Resend quando este está activo e configurado. O envio por WhatsApp não é integrado e a plataforma não processa pagamentos. Pedidos podem chegar à caixa de entrada interna apenas quando o fornecedor tem perfil activo associado a uma conta; perfis demonstrativos ou sem responsável continuam a exigir contacto manual.
- A funcionalidade de contribuições regista transferências feitas fora da Nuvia. O total só inclui contribuições confirmadas manualmente pela organização; não há processamento nem confirmação automática de pagamentos.
- Convites por email guardam estado de envio e tentativa. Uma falha pode ser reenviada a partir da lista de convidados. A resposta de envio do fornecedor de email confirma a aceitação do pedido pelo Resend, não a leitura pelo destinatário.
- Confirmações RSVP podem ser enviadas ao email associado ao convidado. O estado da última tentativa fica guardado; a página do convite permite repetir o envio com o token individual, limitado a quatro tentativas por hora e sem revelar o endereço de email.
- Emails de colaboração e remoção de acesso são tentados pela API e a dashboard mostra o resultado. Quando a notificação falha, a pessoa mantém o acesso actualizado e a pessoa responsável pode reenviar o email.
- O álbum do evento fica desligado até ser activado pela pessoa responsável. Os uploads públicos são privados e aguardam moderação; fotografias aprovadas são visíveis a qualquer pessoa com o link activo. Revogar/desactivar o link não remove as imagens. Definir uma rotina de retenção e cópia do volume `nuvia_event_albums` antes de activar em produção.
- Emails transaccionais usam Resend e ficam desligados por padrão. Antes de activar recuperação de palavra-passe e outros envios em produção, configura `RESEND_ENABLED=true`, uma chave API e um remetente num domínio validado; mantém a chave apenas nos segredos do serviço `api`. Com o envio desligado, fluxos que dependem de email — incluindo recuperação, confirmação de endereço, convites e confirmação RSVP — não ficam disponíveis em produção, enquanto notificações internas continuam a funcionar.
