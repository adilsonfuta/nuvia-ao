# Preparação para produção

Este documento separa o que o código já suporta das operações que ainda precisam de configuração no ambiente de produção.

## Dados e privacidade

- Publicar termos de utilização e política de privacidade revistos para Angola, incluindo finalidades, retenção, partilha com fornecedores e pedidos de eliminação/exportação.
- A candidatura de fornecedor guarda nome comercial, contacto, email, telefone, localização e descrição. Limitar o acesso à equipa administrativa e definir um prazo de retenção para candidaturas recusadas.
- O utilizador escolhe explicitamente abrir email ou WhatsApp para enviar um pedido. A plataforma não envia nem confirma a entrega dessa mensagem.
- Não colocar segredos, bases de dados ou backups em repositórios. A pasta `backups/` está excluída do Git e os ficheiros são criados sem permissões de leitura para outros utilizadores do sistema.
- Os comprovativos das contribuições ficam fora da pasta pública, com nomes aleatórios e permissões restritas. Em produção, configurar `PRIVATE_UPLOAD_STORAGE_DIR` para volume persistente e privado, incluí-lo nos backups cifrados e definir uma política de retenção/eliminação. O endpoint de leitura exige sessão e acesso ao evento.

## Backups e recuperação

Executar `DATABASE_URL='...' ./scripts/backup-postgres.sh` num ambiente que tenha `pg_dump` instalado. Guardar os dumps cifrados fora do servidor da aplicação, com acesso restrito e retenção definida. O processo de produção deve agendar backups e testar periodicamente a recuperação num banco separado; criar um ficheiro não comprova que a recuperação funciona.

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
- Contactar fornecedores fora da plataforma até existir um canal de entrega com consentimento, registo de tentativa e tratamento de falhas.
- Só marcar perfis e contactos como revistos depois de confirmar a identidade, os dados de contacto e a informação publicada.
- Cada requisito civil publicado deve ter fonte oficial, âmbito, data de revisão e responsável editorial. A interface deve continuar a recomendar confirmação na Conservatória competente.

## Lançamento

- Aplicar migrations num ambiente de staging e verificar backup antes de produção.
- Aplicar também a migration `20261116230000_event_contributions` e configurar `PRIVATE_UPLOAD_STORAGE_DIR` num volume privado persistente antes de disponibilizar os links públicos.
- Configurar HTTPS, origem pública, `API_INTERNAL_URL`, `WEB_ORIGIN`, segredos fortes e `TRUST_PROXY_HOPS` conforme a infraestrutura.
- Definir `NEXT_PUBLIC_SITE_URL` com a origem canónica HTTPS para metadados e sitemap; sem esta variável o sitemap permanece vazio para não publicar URLs locais.
- Executar testes automatizados, percursos no browser com contas de teste, revisão de acessos administrativos e teste de recuperação.
- A plataforma não envia convites por email/WhatsApp nem processa pagamentos. Pedidos podem chegar à caixa de entrada interna apenas quando o fornecedor tem perfil activo associado a uma conta; perfis demonstrativos ou sem responsável continuam a exigir contacto manual.
- A funcionalidade de contribuições regista transferências feitas fora da Nuvia. O total só inclui contribuições confirmadas manualmente pela organização; não há processamento nem confirmação automática de pagamentos.
- A recuperação de palavra-passe precisa de um serviço transaccional de email e domínio verificado. O envio de links de recuperação para um serviço externo foi bloqueado pela revisão automática nesta etapa; não activar essa integração sem a aprovação necessária e uma configuração segura.
