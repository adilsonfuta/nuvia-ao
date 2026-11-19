ALTER TABLE "GuideArticle"
  ADD COLUMN "readingMinutes" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 1000;

INSERT INTO "GuideArticle" ("id", "slug", "title", "summary", "body", "category", "readingMinutes", "sortOrder", "status", "isDemo", "reviewedAt", "createdAt")
VALUES ('nuvia-como-comecar-a-planear', 'como-comecar-a-planear', 'Como começar a planear o casamento', 'O vosso casamento começa muito antes do grande dia. Começa com uma conversa, algumas decisões importantes e um plano que faça sentido para os dois.', 'Decidir casar é um momento especial. Mas, depois da emoção inicial, surge uma pergunta que muitos casais fazem: *por onde começamos?*

É natural pensar imediatamente no vestido, no espaço da festa, na decoração ou nos convidados. No entanto, antes de contratar qualquer serviço, existem decisões que podem tornar todo o processo mais simples e evitar despesas desnecessárias.

Neste guia, vamos ajudar-vos a dar os primeiros passos.

## 1. Conversem sobre o casamento que desejam

Antes de começarem a procurar fornecedores, reservem algum tempo para conversar sobre as vossas expectativas.

Perguntem um ao outro:

- Queremos uma celebração pequena, média ou grande?
- Pretendemos realizar alambamento, casamento civil, cerimónia religiosa e festa?
- Queremos realizar tudo no mesmo período ou em datas diferentes?
- Qual é a nossa prioridade: reunir a família, proporcionar uma grande festa ou realizar uma celebração mais íntima?
- Quanto estamos dispostos a gastar?

Não precisam de concordar imediatamente com tudo. O importante é identificar as prioridades de cada um e chegar a decisões conjuntas.

**Dica Nuvia:** Escolham três aspectos que consideram indispensáveis e três nos quais aceitariam fazer ajustes.

## 2. Definam um orçamento inicial

Em Angola, os custos de um casamento podem variar significativamente conforme a província, o número de convidados, o espaço escolhido e os serviços contratados.

Por isso, evitem começar a contratar fornecedores antes de estabelecer um limite financeiro.

O orçamento deve considerar o dinheiro efectivamente disponível, as poupanças previstas e eventuais contribuições familiares que estejam confirmadas.

Não contem com promessas de ajuda financeira como se fossem dinheiro já recebido.

Reservem também uma margem para imprevistos. Uma referência inicial possível é separar 10% do orçamento, ajustando-a à vossa realidade.

## 3. Preparem uma primeira lista de convidados

O número de convidados influencia directamente o tamanho do espaço, a alimentação, as bebidas, as mesas, as cadeiras e vários outros custos.

Comecem por identificar:

- Familiares próximos de ambos.
- Amigos mais próximos.
- Pessoas importantes na vossa história.
- Outros convidados que gostariam de incluir, caso o orçamento permita.

Nesta fase, a lista é provisória. Não precisam de enviar convites imediatamente.

Se as famílias participarem na organização, conversem desde cedo sobre quantos convidados cada parte poderá sugerir.

## 4. Escolham uma data ou um período

A data do casamento deve considerar mais do que a preferência pessoal.

Verifiquem a disponibilidade dos espaços, o tempo necessário para preparar a documentação, as condições climáticas e os compromissos familiares relevantes.

Se possível, definam duas ou três datas alternativas.

Para casamentos que envolvam cerimónia civil, confirmem os procedimentos e a disponibilidade junto da conservatória competente antes de assumirem compromissos definitivos com fornecedores.

## 5. Identifiquem os serviços necessários

Façam uma lista dos serviços de que poderão precisar.

Alguns exemplos são:

- Espaço para a cerimónia e para a festa.
- Catering e bebidas.
- Decoração.
- Fotografia e vídeo.
- Música e sonorização.
- Vestuário e beleza.
- Transporte.
- Convites.
- Coordenação do evento.

Nem todos os casamentos precisam dos mesmos serviços.

Um casal que pretende uma celebração simples pode ter necessidades muito diferentes de outro que planeia uma festa com centenas de convidados.

## 6. Criem um calendário de preparação

Dividam o trabalho em etapas.

**Nos primeiros momentos:** definam prioridades, orçamento, convidados e período pretendido.

**Na fase seguinte:** pesquisem espaços, consultem os procedimentos legais e solicitem propostas aos fornecedores essenciais.

**Depois:** confirmem contratos, acompanhem pagamentos, preparem convites e organizem a logística.

**Nas últimas semanas:** confirmem convidados, horários, contactos e responsabilidades.

Os prazos concretos devem ser ajustados à dimensão e às condições do vosso evento.

## 7. Organizem as responsabilidades

Não é necessário que uma única pessoa trate de tudo.

Podem dividir tarefas entre os noivos e outras pessoas de confiança, mantendo as decisões principais sob controlo do casal.

Por exemplo, uma pessoa pode acompanhar os fornecedores, outra ajudar com a lista de convidados e outra verificar os preparativos do espaço.

O importante é que todos saibam o que lhes compete fazer.

## Erros comuns a evitar

- Contratar serviços antes de definir o orçamento.
- Convidar pessoas sem calcular os custos.
- Aceitar propostas sem confirmar o que está incluído.
- Deixar a documentação para a última hora.
- Assumir que familiares irão pagar determinadas despesas sem confirmação.
- Tentar resolver tudo nos últimos dias.

## Checklist: os vossos primeiros passos

- Conversámos sobre o tipo de casamento que queremos.
- Identificámos as nossas prioridades.
- Definimos um orçamento inicial.
- Criámos uma lista provisória de convidados.
- Escolhemos possíveis datas.
- Identificámos os principais serviços.
- Começámos a verificar os requisitos legais.
- Organizámos as primeiras tarefas.

## O próximo passo

Não precisam de resolver todo o casamento hoje.

Comecem pelas decisões essenciais e avancem uma etapa de cada vez.

**Com a Nuvia, podem criar um roteiro inicial, organizar tarefas e acompanhar os preparativos num só lugar.**

**Começar o meu planeamento:** [https://nuvia.sirius.ao/](https://nuvia.sirius.ao/)', 'Planeamento', 7, 1, 'PUBLISHED', false, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "category" = EXCLUDED."category",
  "readingMinutes" = EXCLUDED."readingMinutes",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'PUBLISHED',
  "isDemo" = false,
  "reviewedAt" = EXCLUDED."reviewedAt";

INSERT INTO "GuideArticle" ("id", "slug", "title", "summary", "body", "category", "readingMinutes", "sortOrder", "status", "isDemo", "reviewedAt", "createdAt")
VALUES ('nuvia-organizar-o-orcamento', 'organizar-o-orcamento', 'Como organizar o orçamento do casamento', 'Um casamento bem organizado não é necessariamente o mais caro. É aquele em que as decisões respeitam as prioridades e a capacidade financeira do casal.', 'O orçamento é uma das partes mais importantes da preparação do casamento.

Quando não existe um controlo claro, pequenas despesas podem acumular-se e comprometer valores reservados para serviços essenciais.

A boa notícia é que não precisam de ser especialistas em finanças para organizar o vosso orçamento.

## 1. Descubram quanto podem realmente gastar

Antes de pedir orçamentos, respondam a três perguntas:

1. Quanto dinheiro temos disponível?
2. Quanto conseguimos poupar até à data prevista?
3. Existem contribuições financeiras confirmadas?

A soma desses valores constitui o ponto de partida.

Evitem assumir dívidas apenas para corresponder às expectativas de outras pessoas.

Se o valor disponível for insuficiente, podem reduzir o número de convidados, simplificar a celebração ou escolher outra data.

## 2. Distribuam o orçamento por categorias

Vamos imaginar um casal com um orçamento de **5.000.000 Kz**.

Uma distribuição ilustrativa poderia ser:

| Categoria                      | Percentagem | Valor            |
| ------------------------------ | ----------- | ---------------- |
| Espaço e alimentação           | 40%         | 2.000.000 Kz     |
| Decoração                      | 12%         | 600.000 Kz       |
| Fotografia e vídeo             | 10%         | 500.000 Kz       |
| Vestuário e beleza             | 10%         | 500.000 Kz       |
| Música e entretenimento        | 8%          | 400.000 Kz       |
| Transporte e logística         | 5%          | 250.000 Kz       |
| Documentação e outros serviços | 5%          | 250.000 Kz       |
| Reserva para imprevistos       | 10%         | 500.000 Kz       |
| **Total**                      | **100%**    | **5.000.000 Kz** |

Estes valores são apenas um exemplo de planeamento, não preços médios do mercado angolano.

A distribuição real dependerá das vossas prioridades e das propostas recebidas.

## 3. Distingam estimativas, compromissos e pagamentos

Este é um dos erros financeiros mais frequentes na organização de eventos.

**Estimativa:** o valor que imaginam gastar.

**Valor contratado:** o montante acordado com o fornecedor.

**Valor pago:** o dinheiro que já saiu efectivamente do orçamento.

**Valor por pagar:** o saldo que ainda precisam de liquidar.

Por exemplo, se contrataram um fotógrafo por 350.000 Kz e pagaram um sinal de 100.000 Kz, ainda existe uma obrigação de 250.000 Kz.

Não confundam dinheiro disponível na conta com dinheiro livre para novas despesas.

## 4. Comparem propostas antes de contratar

Não escolham um fornecedor apenas pelo preço mais baixo.

Verifiquem:

- O que está incluído no serviço.
- Quantidade de pessoas abrangidas.
- Transporte e montagem.
- Equipamentos necessários.
- Horários de prestação do serviço.
- Condições de pagamento.
- Política de cancelamento.
- Custos adicionais.

Uma proposta aparentemente mais barata pode tornar-se mais cara quando determinados serviços são cobrados separadamente.

## 5. Criem um calendário de pagamentos

Alguns fornecedores exigem pagamentos faseados.

Registem sempre o valor total, o sinal pago, as prestações seguintes e as respectivas datas.

Guardem comprovativos e acordos por escrito.

Se houver alterações ao serviço, peçam a actualização do orçamento ou contrato.

## 6. Controlem as despesas inesperadas

Durante a preparação, podem surgir despesas com transporte adicional, alterações de decoração, convidados extra ou serviços não previstos.

Utilizem a reserva para imprevistos com critério.

Sempre que surgir uma nova despesa, perguntem:

**É indispensável? Está dentro do orçamento? O que teremos de ajustar para a incluir?**

## 7. Façam uma revisão semanal

Reservem alguns minutos por semana para verificar:

- Quanto já foi pago.
- Quanto ainda falta pagar.
- Quais os próximos vencimentos.
- Que despesas ultrapassaram a estimativa.
- Quanto resta da reserva financeira.

Uma revisão regular evita surpresas perto da data do casamento.

## Checklist financeira

- Definimos o orçamento total.
- Identificámos as fontes de financiamento.
- Distribuímos valores por categoria.
- Reservámos uma margem para imprevistos.
- Registámos os fornecedores contratados.
- Registámos sinais e pagamentos.
- Identificámos os saldos por pagar.
- Criámos um calendário financeiro.

## O próximo passo

Um orçamento não serve para limitar a felicidade do casal. Serve para ajudar a tomar decisões conscientes.

**Na Nuvia, podem registar despesas, acompanhar pagamentos e consultar o orçamento do vosso evento num único painel.**

**Organizar o meu orçamento:** [https://nuvia.sirius.ao/](https://nuvia.sirius.ao/)', 'Orçamento', 8, 2, 'PUBLISHED', false, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "category" = EXCLUDED."category",
  "readingMinutes" = EXCLUDED."readingMinutes",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'PUBLISHED',
  "isDemo" = false,
  "reviewedAt" = EXCLUDED."reviewedAt";

INSERT INTO "GuideArticle" ("id", "slug", "title", "summary", "body", "category", "readingMinutes", "sortOrder", "status", "isDemo", "reviewedAt", "createdAt")
VALUES ('nuvia-primeira-lista-de-convidados', 'primeira-lista-de-convidados', 'Preparar a primeira lista de convidados', 'Uma boa lista de convidados não começa com nomes. Começa com uma decisão: quantas pessoas conseguimos receber?', 'A lista de convidados é uma das partes mais delicadas da organização de um casamento.

Em muitas famílias angolanas, o casamento envolve não apenas os noivos, mas também pais, tios, primos, amigos e pessoas próximas das duas famílias.

É natural que todos queiram participar. Mas, sem organização, a lista pode crescer rapidamente e ultrapassar a capacidade do espaço ou do orçamento.

## 1. Comecem pelo número máximo de convidados

Antes de escreverem os nomes, definam quantas pessoas conseguem receber.

Esse número deve considerar a capacidade do espaço, o orçamento de alimentação, as mesas e cadeiras disponíveis e a dimensão da celebração.

Por exemplo, se o orçamento permitir receber 200 pessoas, essa será a referência para organizar a lista.

Não enviem convites antes de confirmar que existe capacidade para receber todos.

## 2. Organizem os convidados por grupos

Uma forma simples de começar é dividir a lista em categorias:

- Família da noiva.
- Família do noivo.
- Amigos próximos do casal.
- Colegas e outras pessoas importantes.
- Convidados sugeridos pelas famílias.

Também podem distinguir adultos e crianças, quando isso for relevante para a organização.

Esta separação facilita a identificação de nomes repetidos e ajuda a perceber como os lugares estão distribuídos.

## 3. Criem uma lista por prioridades

Nem sempre será possível convidar todas as pessoas que gostariam.

Podem utilizar três grupos:

**Prioridade A — Indispensáveis:** familiares próximos e pessoas cuja presença consideram essencial.

**Prioridade B — Muito importantes:** amigos e familiares que gostariam de incluir.

**Prioridade C — Possíveis convidados:** pessoas que poderão ser incluídas caso existam lugares e orçamento disponíveis.

Esta classificação é apenas uma ferramenta de planeamento. Não deve ser utilizada para diminuir a importância pessoal de ninguém.

## 4. Conversem com as famílias antecipadamente

Quando os pais ou outros familiares participam na organização, é importante esclarecer como serão feitas as sugestões de convidados.

Uma abordagem prática é comunicar o número de lugares disponíveis e pedir que cada família prepare uma lista dentro desse limite.

Se houver contribuições financeiras, conversem abertamente sobre as expectativas associadas a essas contribuições.

Evitem deixar essas decisões para as últimas semanas.

## 5. Registem os dados essenciais

Para cada convidado, podem guardar:

- Nome completo.
- Grupo ou família.
- Contacto, quando necessário.
- Número de acompanhantes autorizados.
- Estado do convite.
- Confirmação de presença.
- Observações logísticas relevantes.

Evitem recolher dados pessoais que não sejam necessários.

## 6. Acompanhem as confirmações de presença

Enviar um convite não significa que a pessoa confirmou presença.

Criem estados claros:

- Por convidar.
- Convite enviado.
- Confirmado.
- Não poderá comparecer.
- A aguardar resposta.

Definam uma data-limite para as confirmações, com tempo suficiente para comunicar os números finais aos fornecedores.

O WhatsApp pode ser útil para partilhar os convites e lembrar os convidados de responder.

## 7. Preparem a distribuição das mesas

Depois de receberem as confirmações, podem começar a organizar os lugares.

Considerem famílias, grupos de amigos, pessoas com mobilidade reduzida e necessidades específicas que tenham sido comunicadas voluntariamente.

Confirmem sempre a capacidade real das mesas e do espaço.

Evitem alterar constantemente a distribuição sem informar a equipa responsável pela recepção.

## 8. Preparem o controlo de entrada

Para eventos maiores, pode ser útil ter uma equipa de recepção com acesso à lista final.

Se utilizarem convites com QR Code, testem antecipadamente o processo de leitura e tenham uma alternativa manual para falhas de internet, bateria ou equipamento.

A equipa deve saber como agir perante convidados que não constem da lista, sem criar situações constrangedoras.

## Erros comuns

- Convidar pessoas antes de definir a capacidade.
- Manter várias listas diferentes sem sincronização.
- Esquecer acompanhantes e crianças.
- Confundir convite enviado com presença confirmada.
- Não comunicar alterações ao catering.
- Deixar a distribuição das mesas para o próprio dia.

## Checklist dos convidados

- Definimos o número máximo de convidados.
- Criámos grupos familiares e sociais.
- Identificámos as prioridades.
- Conversámos com as famílias.
- Eliminámos nomes repetidos.
- Registámos os convites enviados.
- Definimos o prazo de confirmação.
- Actualizámos a lista final.
- Preparámos a distribuição das mesas.

## O próximo passo

A lista de convidados deve ajudar-vos a organizar a celebração, não tornar-se uma fonte permanente de preocupação.

**Na Nuvia, podem reunir os convidados num só lugar, acompanhar confirmações e organizar melhor a participação de cada pessoa.**

**Organizar os meus convidados:** [https://nuvia.sirius.ao/](https://nuvia.sirius.ao/)', 'Convidados', 7, 3, 'PUBLISHED', false, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "category" = EXCLUDED."category",
  "readingMinutes" = EXCLUDED."readingMinutes",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'PUBLISHED',
  "isDemo" = false,
  "reviewedAt" = EXCLUDED."reviewedAt";

INSERT INTO "GuideArticle" ("id", "slug", "title", "summary", "body", "category", "readingMinutes", "sortOrder", "status", "isDemo", "reviewedAt", "createdAt")
VALUES ('nuvia-escolher-o-espaco', 'escolher-o-espaco', 'O que considerar ao escolher um espaço para o casamento', 'Um espaço bonito pode impressionar nas fotografias. Mas o espaço certo precisa de funcionar bem para os convidados, os fornecedores e o orçamento.', 'Escolher o local do casamento é uma das decisões mais importantes do planeamento.

Em Angola, existem diferentes opções: salões de eventos, hotéis, restaurantes, quintas, jardins e espaços familiares.

Cada alternativa tem vantagens e limitações.

Antes de pagar qualquer reserva, há aspectos que devem ser avaliados com atenção.

## 1. Confirmem a capacidade real

A primeira pergunta não deve ser apenas: *quantas pessoas cabem?*

Perguntem quantas pessoas o espaço consegue receber confortavelmente com a disposição pretendida.

Uma sala que recebe 300 pessoas em formato de conferência pode não ter capacidade equivalente para um casamento com mesas, pista de dança, buffet e decoração.

Peçam para conhecer uma disposição semelhante à que pretendem utilizar.

## 2. Avaliem a localização

A localização influencia a experiência dos convidados e os custos logísticos.

Considerem:

- Distância em relação ao local da cerimónia.
- Condições das vias de acesso.
- Disponibilidade de estacionamento.
- Facilidade para encontrar o espaço.
- Segurança e iluminação exterior.
- Acessibilidade para pessoas com mobilidade reduzida.

Em Luanda, por exemplo, a deslocação entre diferentes zonas pode exigir uma margem adicional no cronograma, dependendo do trânsito.

## 3. Verifiquem os serviços incluídos

Não assumam que o aluguer inclui tudo.

Perguntem se o valor contempla mesas, cadeiras, climatização, limpeza, segurança, gerador, estacionamento e equipamentos de som.

Confirmem também se podem contratar catering e decoração externos.

Alguns espaços trabalham exclusivamente com determinados fornecedores.

## 4. Confirmem a disponibilidade de energia e água

Este ponto merece especial atenção.

Perguntem se o espaço possui gerador funcional, combustível suficiente e um plano de contingência para falhas de energia.

Verifiquem igualmente a disponibilidade de água, o funcionamento das casas de banho e as condições de higiene.

Uma visita presencial ajuda a identificar problemas que não aparecem nas fotografias.

## 5. Avaliem a climatização e o conforto

Em eventos realizados durante períodos de calor, o conforto térmico pode afectar significativamente a experiência dos convidados.

Confirmem se os equipamentos de climatização funcionam adequadamente para a lotação prevista.

Em espaços exteriores, considerem sombra, ventilação, chuva e alternativas cobertas.

## 6. Peçam um orçamento detalhado

O orçamento deve esclarecer:

- Valor total do aluguer.
- Horas incluídas.
- Condições para montagem e desmontagem.
- Pagamento inicial e saldo.
- Horas extraordinárias.
- Custos de limpeza e segurança.
- Eventuais cauções.
- Política de cancelamento ou alteração de data.

Solicitem que os acordos sejam formalizados por escrito.

## 7. Visitem o espaço antes de decidir

Sempre que possível, façam uma visita presencial.

Durante a visita, observem os acessos, as casas de banho, a cozinha, as áreas de apoio, a iluminação e as condições de segurança.

Tirem fotografias e registem as respostas recebidas.

Se estiverem a comparar vários locais, utilizem os mesmos critérios para todos.

## 8. Confirmem as condições do contrato

Antes de pagar, leiam o contrato com atenção.

Verifiquem as responsabilidades de cada parte, o que acontece em caso de cancelamento, quais os limites de utilização e se existem restrições de horário ou ruído.

Peçam esclarecimentos sobre qualquer cláusula que não compreendam.

## Perguntas para fazer ao responsável pelo espaço

1. Qual é a capacidade máxima autorizada?
2. O espaço está disponível na nossa data?
3. O que está incluído no preço?
4. Existe gerador de emergência?
5. Podemos contratar fornecedores externos?
6. Quantas horas temos para montagem e desmontagem?
7. Existe estacionamento suficiente?
8. Como funcionam os pagamentos?
9. O que acontece se precisarmos de alterar a data?
10. Existe uma alternativa para chuva ou falhas técnicas?

## Checklist da visita

- Confirmámos a capacidade.
- Avaliámos a localização.
- Verificámos estacionamento e acessos.
- Inspeccionámos as casas de banho.
- Confirmámos energia e água.
- Verificámos os serviços incluídos.
- Recebemos um orçamento detalhado.
- Analisámos as condições contratuais.
- Comparámos pelo menos duas opções, quando possível.

## O próximo passo

O melhor espaço não é necessariamente o mais caro ou o mais conhecido. É aquele que reúne as condições necessárias para realizar a celebração que desejam.

**Na Nuvia, podem organizar as opções de espaços, registar informações e acompanhar as decisões do vosso evento.**

**Começar a planear:** [https://nuvia.sirius.ao/](https://nuvia.sirius.ao/)', 'Espaços', 8, 4, 'PUBLISHED', false, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "category" = EXCLUDED."category",
  "readingMinutes" = EXCLUDED."readingMinutes",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'PUBLISHED',
  "isDemo" = false,
  "reviewedAt" = EXCLUDED."reviewedAt";

INSERT INTO "GuideArticle" ("id", "slug", "title", "summary", "body", "category", "readingMinutes", "sortOrder", "status", "isDemo", "reviewedAt", "createdAt")
VALUES ('nuvia-casamento-civil-documentos-angola', 'casamento-civil-documentos-angola', 'Casamento civil em Angola: documentos necessários e onde tratar', 'Pretendem casar pelo civil em Angola, mas não sabem por onde começar? Conheçam os primeiros passos, os documentos que podem ser necessários e os serviços onde devem procurar orientação.', 'Organizar um casamento envolve muitas decisões, mas uma das mais importantes é compreender os procedimentos necessários para que o casamento tenha validade legal.

É comum surgirem dúvidas:

- Onde devemos iniciar o processo?
- Que documentos precisamos de apresentar?
- Quanto tempo demora?
- Quais são os custos?
- E se um dos noivos for estrangeiro?

Neste guia, explicamos como preparar os primeiros passos e onde confirmar os requisitos aplicáveis à vossa situação.

**Informação importante:** Este conteúdo é informativo e não substitui as orientações da conservatória competente. Os requisitos podem variar conforme a situação dos nubentes e a integração dos serviços nos sistemas de simplificação administrativa.

## 1. Onde começar o processo de casamento civil?

O casamento civil é tratado através dos serviços de registo civil.

Em Angola, os noivos podem procurar orientação numa Conservatória do Registo Civil ou num posto de atendimento que disponibilize esse serviço, como determinadas unidades do SIAC.

Antes de se deslocarem, confirmem se o local realiza processos de casamento e quais são as condições de atendimento.

O portal oficial do SIAC disponibiliza informação sobre os serviços de registo civil.

**Consultar:** [https://siac.gov.ao/servico/registo-civil/](https://siac.gov.ao/servico/registo-civil/)

## 2. Que documentos são necessários?

Esta é uma das perguntas mais importantes — e houve alterações relevantes em 2026.

Em 27 de Maio de 2026, o Ministério da Justiça e dos Direitos Humanos anunciou medidas de simplificação do processo preliminar de casamento civil.

Segundo o comunicado oficial, nas conservatórias integradas na nova aplicação informática, os cidadãos nacionais podem apresentar o documento de identificação válido, deixando de ser exigida a apresentação física do assento de nascimento, do atestado de residência e do certificado de registo criminal.

Quando os dados necessários estão disponíveis nas bases dos Serviços de Justiça, a consulta do assento de nascimento pode ser efectuada pelos próprios serviços.

**Atenção:** esta simplificação não deve ser interpretada como uma regra universal para todos os casais e conservatórias.

O portal SIAC ainda apresenta uma lista de requisitos mais extensa, pelo que é importante confirmar quais as orientações efectivamente aplicáveis ao local onde pretendem iniciar o processo.

## 3. E se um dos noivos for estrangeiro?

Quando um dos nubentes é estrangeiro, podem existir exigências documentais adicionais.

O portal SIAC menciona documentos como passaporte, comprovativos da situação de residência e certificado de capacidade matrimonial, além de requisitos de tradução para português.

A documentação exacta depende da situação do cidadão estrangeiro e das regras aplicáveis.

Antes de obter certidões no estrangeiro, confirmem junto da conservatória se os documentos precisam de legalização, autenticação ou tradução.

Isso pode evitar despesas e deslocações desnecessárias.

## 4. E se algum dos noivos já foi casado?

Quando existe um casamento anterior, é necessário verificar se o estado civil actual está devidamente regularizado.

Dependendo da situação, a conservatória poderá precisar de confirmar o divórcio ou o falecimento do anterior cônjuge através dos respectivos registos.

Se o casamento anterior ocorreu fora de Angola, podem existir procedimentos adicionais de reconhecimento ou transcrição de documentos.

Não assumam que uma certidão estrangeira é automaticamente suficiente.

## 5. Como organizar o processo?

Uma sequência prática é:

**Passo 1 — Identificar a conservatória**

Escolham o serviço de registo civil onde pretendem obter orientação e confirmem a competência para o vosso processo.

**Passo 2 — Confirmar os requisitos**

Informem a nacionalidade, a situação matrimonial e outras circunstâncias relevantes para que o serviço indique os documentos aplicáveis.

**Passo 3 — Preparar os documentos**

Reúnam os documentos exigidos e verifiquem a sua validade.

**Passo 4 — Iniciar o processo preliminar**

Sigam as orientações da conservatória para dar entrada no processo e cumprir as formalidades necessárias.

**Passo 5 — Confirmar a data e o local**

Antes de assumir compromissos definitivos com fornecedores, confirmem com o serviço responsável quando e onde a cerimónia poderá realizar-se.

**Passo 6 — Obter o registo do casamento**

Após a celebração e o respectivo registo, informem-se sobre a emissão da certidão de casamento e os procedimentos posteriores eventualmente necessários.

## 6. Quanto custa casar pelo civil em Angola?

Os custos dependem dos actos solicitados, das taxas aplicáveis e de eventuais serviços adicionais.

Para evitar informações desactualizadas, não apresentamos aqui um valor fixo sem confirmação numa tabela oficial vigente.

Antes de iniciar o processo, perguntem:

- Qual é o custo do processo?
- Existem taxas adicionais para determinadas modalidades de celebração?
- Como deve ser efectuado o pagamento?
- Que comprovativos serão emitidos?
- Qual é o custo da certidão de casamento?

Solicitem sempre informação oficial e guardem os comprovativos.

## 7. Quanto tempo demora o processo?

O tempo necessário pode depender da situação documental, dos procedimentos aplicáveis e da disponibilidade do serviço.

Por isso, não é prudente assumir um prazo universal.

Se já têm uma data prevista, contactem a conservatória com antecedência e confirmem os prazos necessários para o vosso caso.

Não confundam o prazo de uma formalidade específica com a duração total do processo.

## 8. Onde obter informações oficiais?

Consultem preferencialmente estas fontes:

**Ministério da Justiça e dos Direitos Humanos**

[https://minjusdh.gov.ao/](https://minjusdh.gov.ao/)

Publica comunicados e orientações sobre serviços de justiça, incluindo alterações aos procedimentos de casamento civil.

**SIAC — Conservatória do Registo Civil**

[https://siac.gov.ao/servico/registo-civil/](https://siac.gov.ao/servico/registo-civil/)

Apresenta informações sobre os serviços de registo civil e documentação.

**Portal SIMPLIFICA**

[https://simplifica.gov.ao/](https://simplifica.gov.ao/)

Reúne informação sobre medidas de simplificação administrativa em Angola.

**Conservatória competente**

É o local adequado para confirmar os requisitos específicos, custos e procedimentos do vosso processo.

## 9. Erros que devem evitar

- Utilizar listas de documentos antigas sem confirmar alterações.
- Assumir que todas as conservatórias seguem exactamente o mesmo procedimento.
- Preparar documentos estrangeiros sem confirmar as formalidades exigidas.
- Deixar a preparação legal para as últimas semanas.
- Marcar a cerimónia sem confirmação oficial.
- Efectuar pagamentos sem os respectivos comprovativos.

## Checklist do casamento civil

- Identificámos a conservatória competente.
- Confirmámos os requisitos para a nossa situação.
- Verificámos a validade dos documentos de identificação.
- Confirmámos se existem documentos adicionais.
- Obtivemos informação sobre custos e prazos.
- Iniciámos o processo preliminar.
- Confirmámos a data e o local da cerimónia.
- Verificámos como obter a certidão de casamento.

## O próximo passo

O casamento civil não precisa de ser uma etapa confusa.

Comecem por identificar a conservatória, confirmar os requisitos e organizar os documentos necessários.

**Com a Nuvia, podem acompanhar as tarefas relacionadas com o casamento civil juntamente com o restante planeamento do vosso evento.**

**Começar o meu roteiro:** [https://nuvia.sirius.ao/](https://nuvia.sirius.ao/)

---

*Conteúdo informativo. Última revisão editorial: Novembro de 2026. A Nuvia não é uma entidade governamental e não emite documentos oficiais de casamento.*', 'Casamento Civil', 9, 5, 'PUBLISHED', false, '2026-11-19T00:00:00.000Z'::TIMESTAMP(3), CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "body" = EXCLUDED."body",
  "category" = EXCLUDED."category",
  "readingMinutes" = EXCLUDED."readingMinutes",
  "sortOrder" = EXCLUDED."sortOrder",
  "status" = 'PUBLISHED',
  "isDemo" = false,
  "reviewedAt" = EXCLUDED."reviewedAt";
