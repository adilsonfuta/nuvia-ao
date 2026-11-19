# Métricas do GA4 no backoffice

A secção **Administração → Métricas** consulta relatórios agregados do Google Analytics 4 através da Google Analytics Data API. O endpoint é protegido para contas com papel `ADMIN`; as credenciais ficam apenas na API e nunca são enviadas ao browser.

## Configuração

1. No Google Cloud, activa a **Google Analytics Data API** no projecto associado à conta de serviço.
2. Cria uma conta de serviço e uma chave privada. Guarda a chave como segredo; não a comites nem a coloques no frontend.
3. Na propriedade GA4, abre **Administração → Gestão de acessos à propriedade** e adiciona o email da conta de serviço com o papel **Leitor**.
4. Define `GA4_ENABLED=true` e estas variáveis no `.env` local ou no Coolify:

   ```env
   GA4_ENABLED=true
   GA4_PROPERTY_ID="123456789"
   GA4_SERVICE_ACCOUNT_EMAIL="nuvia-analytics@project-id.iam.gserviceaccount.com"
   GA4_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

   O `GA4_PROPERTY_ID` é o identificador numérico da propriedade GA4, não o ID do contentor GTM nem o Measurement ID `G-...`. A chave pode ser guardada com quebras de linha reais ou com `\n`.
5. Reinicia/republica a API e abre a tab **Métricas** na administração.

Para desligar a integração sem apagar as credenciais, define `GA4_ENABLED=false` no serviço `api` e reinicia-o. O padrão é `false`; com a integração desligada, a API não pede tokens nem consulta o Google. Se estiver activa mas as credenciais estiverem incompletas, o painel indica o que falta sem afectar o funcionamento normal do site.

## O que aparece

- Visitantes activos, sessões, visualizações de páginas e taxa de envolvimento.
- Gráfico diário de páginas vistas.
- Páginas mais vistas e canais de aquisição.
- Períodos de 7, 28 ou 90 dias; respostas em cache durante cinco minutos.

Se `GA4_ENABLED=true` mas as credenciais não estiverem definidas, a página mostra instruções de configuração. Erros da Data API não revelam credenciais e indicam que se deve rever a propriedade, o acesso de leitura e a API activa no Google Cloud. Os relatórios padrão do GA4 podem demorar 24–48 horas a processar dados recentes; o relatório Tempo real serve para confirmar a recolha inicial.
