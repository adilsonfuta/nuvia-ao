# Preparação para produção

Este documento separa o que o código já suporta das operações que ainda precisam de configuração no ambiente de produção.

## Dados e privacidade

- Publicar termos de utilização e política de privacidade revistos para Angola, incluindo finalidades, retenção, partilha com fornecedores e pedidos de eliminação/exportação.
- A candidatura de fornecedor guarda nome comercial, contacto, email, telefone, localização e descrição. Limitar o acesso à equipa administrativa e definir um prazo de retenção para candidaturas recusadas.
- O utilizador escolhe explicitamente abrir email ou WhatsApp para enviar um pedido. A plataforma não envia nem confirma a entrega dessa mensagem.
- Não colocar segredos, bases de dados ou backups em repositórios. A pasta `backups/` está excluída do Git e os ficheiros são criados sem permissões de leitura para outros utilizadores do sistema.

## Backups e recuperação

Executar `DATABASE_URL='...' ./scripts/backup-postgres.sh` num ambiente que tenha `pg_dump` instalado. Guardar os dumps cifrados fora do servidor da aplicação, com acesso restrito e retenção definida. O processo de produção deve agendar backups e testar periodicamente a recuperação num banco separado; criar um ficheiro não comprova que a recuperação funciona.

Para restaurar um dump validado num banco vazio: `pg_restore --no-owner --no-acl --dbname="$DATABASE_URL" caminho/para/backup.dump`. Confirmar a versão do PostgreSQL e executar a recuperação primeiro num ambiente isolado.

## Monitorização e operação

- O endpoint `/api/v1/health` verifica ligação à base de dados. Configurar monitorização externa, alertas para estados diferentes de `ok`, erros HTTP, latência e espaço em disco.
- Recolher logs sem palavras-passe, cookies de sessão, tokens de RSVP, conteúdo de mensagens ou dados completos de convidados.
- Definir responsáveis por incidentes, restauração, migrações e rotação de segredos antes de abrir o serviço ao público.
- O limitador de pedidos usa PostgreSQL partilhado entre instâncias. Se a API estiver atrás de proxy, definir `TRUST_PROXY_HOPS` apenas para a cadeia controlada que substitui `X-Forwarded-For`; não confiar num cabeçalho encaminhado directamente por clientes.

## Fornecedores e informação civil

- Rever candidaturas com contacto directo antes de criar um perfil pendente. A conversão administrativa não publica nem verifica automaticamente o negócio.
- Contactar fornecedores fora da plataforma até existir um canal de entrega com consentimento, registo de tentativa e tratamento de falhas.
- Só marcar perfis e contactos como revistos depois de confirmar a identidade, os dados de contacto e a informação publicada.
- Cada requisito civil publicado deve ter fonte oficial, âmbito, data de revisão e responsável editorial. A interface deve continuar a recomendar confirmação na Conservatória competente.

## Lançamento

- Aplicar migrations num ambiente de staging e verificar backup antes de produção.
- Configurar HTTPS, origem pública, `API_INTERNAL_URL`, `WEB_ORIGIN`, segredos fortes e `TRUST_PROXY_HOPS` conforme a infraestrutura.
- Executar testes automatizados, percursos no browser com contas de teste, revisão de acessos administrativos e teste de recuperação.
- A plataforma ainda não entrega pedidos ou convites por email/WhatsApp, não processa pagamentos e não tem portal de resposta de fornecedores. Comunicar estas capacidades como pendentes até existirem serviços configurados e monitorizados.
