import { config } from 'dotenv';
import { PrismaClient } from '@casar/database';
import bcrypt from 'bcryptjs';

config({ path: new URL('../../.env', import.meta.url) });

const db = new PrismaClient();
const vendors = [
  { slug:'demo-sabor-da-festa', name:'Sabor da Festa (demonstração)', category:'Catering', province:'Luanda', municipality:'Luanda', description:'Perfil fictício para demonstrar como um serviço de catering pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Buffet para recepção','Cocktail de boas-vindas','Opções de menu para diferentes dimensões de evento'], serviceAreas:['Luanda','Icolo e Bengo'], capacityMin:50, capacityMax:300, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.', paymentTerms:'Condições de pagamento não fornecidas; confirma directamente com o prestador quando existir um perfil real.', cancellationTerms:'Política de cancelamento não fornecida.' },
  { slug:'demo-flores-e-afetos', name:'Flores & Afetos (demonstração)', category:'Decoração', province:'Luanda', municipality:'Talatona', description:'Perfil fictício para demonstrar como um serviço de decoração pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Decoração de cerimónia','Centros de mesa','Composição floral'], serviceAreas:['Luanda'], capacityMin:30, capacityMax:500, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
  { slug:'demo-luz-de-memoria', name:'Luz de Memória (demonstração)', category:'Fotografia e vídeo', province:'Luanda', municipality:'Maianga', description:'Perfil fictício para demonstrar como um serviço de fotografia pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Fotografia de cerimónia','Cobertura da recepção','Entrega digital'], serviceAreas:['Luanda','Icolo e Bengo'], bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
  { slug:'demo-doce-encanto', name:'Doce Encanto (demonstração)', category:'Bolos e doces', province:'Benguela', municipality:'Benguela', description:'Perfil fictício para demonstrar como um serviço de bolos pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Bolo de casamento','Mesa de doces','Opções de tamanho e decoração'], serviceAreas:['Benguela'], capacityMin:20, capacityMax:400, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
];
const guides = [
  { slug:'como-comecar-a-planear', title:'Como começar a planear o casamento', category:'Planeamento', summary:'Um ponto de partida leve para conversar sobre prioridades e próximos passos.', body:'Comecem por conversar sobre o que é importante para cada um. Não é preciso decidir tudo no mesmo dia.\n\nEscolham as pessoas que querem envolver e combinem como vão tomar decisões em conjunto.\n\nRegistem as ideias e as dúvidas num único lugar. Revejam o plano quando as vossas prioridades mudarem.' },
  { slug:'organizar-o-orcamento', title:'Como organizar o orçamento', category:'Orçamento', summary:'Organiza valores, decisões e despesas sem confundir estimativas com pagamentos.', body:'Registem separadamente o valor que estimam, os compromissos assumidos e o que já foi pago.\n\nGuardem a origem e a data de cada estimativa. Os preços variam conforme o serviço, o local e a data.\n\nDecidam em conjunto quais as prioridades e revejam o plano antes de assumir novas despesas.' },
  { slug:'primeira-lista-de-convidados', title:'Preparar a primeira lista de convidados', category:'Convidados', summary:'Uma forma simples de organizar nomes, grupos e confirmações.', body:'Podem começar por grupos que façam sentido para vocês, como família, amigos ou colegas.\n\nConfirmem com cada pessoa antes de registar dados de contacto. Partilhem apenas a informação necessária.\n\nUma lista inicial é uma estimativa, não uma obrigação. Ajustem-na conforme os vossos planos.' },
  { slug:'escolher-o-espaco', title:'O que considerar ao escolher um espaço', category:'Espaços', summary:'Perguntas úteis para comparar espaços antes de uma visita ou pedido de orçamento.', body:'Confirmem a capacidade, acessibilidade, localização e o que está incluído no serviço.\n\nPerguntem quais os horários disponíveis, as condições de reserva, os custos adicionais e a política de cancelamento.\n\nPeçam as condições por escrito e não assumam disponibilidade até receberem confirmação do responsável.' },
];

try {
  for (const vendor of vendors) await db.vendor.upsert({ where:{slug:vendor.slug}, update:{...vendor,isDemo:true}, create:{...vendor,isDemo:true,status:'ACTIVE'} });
  for (const guide of guides) await db.guideArticle.upsert({ where:{slug:guide.slug}, update:{...guide,status:'PUBLISHED',isDemo:true}, create:{...guide,status:'PUBLISHED',isDemo:true} });
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const email=process.env.SEED_ADMIN_EMAIL.trim().toLowerCase();
    await db.user.upsert({where:{email},update:{role:'ADMIN'},create:{email,name:'Administrador',passwordHash:await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD,12),role:'ADMIN'}});
  }
  console.log('Seed de demonstração concluído; fornecedores fictícios ficam identificados no perfil.');
} finally { await db.$disconnect(); }
