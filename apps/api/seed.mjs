import { config } from 'dotenv';
import { PrismaClient } from '@casar/database';
import { readFileSync } from 'node:fs';

config({ path: new URL('../../.env', import.meta.url) });

const db = new PrismaClient();
const vendors = [
  { slug:'demo-sabor-da-festa', name:'Sabor da Festa (demonstração)', category:'Catering', province:'Luanda', municipality:'Luanda', description:'Perfil fictício para demonstrar como um serviço de catering pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Buffet para recepção','Cocktail de boas-vindas','Opções de menu para diferentes dimensões de evento'], serviceAreas:['Luanda','Icolo e Bengo'], capacityMin:50, capacityMax:300, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.', paymentTerms:'Condições de pagamento não fornecidas; confirma directamente com o prestador quando existir um perfil real.', cancellationTerms:'Política de cancelamento não fornecida.' },
  { slug:'demo-flores-e-afetos', name:'Flores & Afetos (demonstração)', category:'Decoração', province:'Luanda', municipality:'Talatona', description:'Perfil fictício para demonstrar como um serviço de decoração pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Decoração de cerimónia','Centros de mesa','Composição floral'], serviceAreas:['Luanda'], capacityMin:30, capacityMax:500, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
  { slug:'demo-luz-de-memoria', name:'Luz de Memória (demonstração)', category:'Fotografia e vídeo', province:'Luanda', municipality:'Maianga', description:'Perfil fictício para demonstrar como um serviço de fotografia pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Fotografia de cerimónia','Cobertura da recepção','Entrega digital'], serviceAreas:['Luanda','Icolo e Bengo'], bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
  { slug:'demo-doce-encanto', name:'Doce Encanto (demonstração)', category:'Bolos e doces', province:'Benguela', municipality:'Benguela', description:'Perfil fictício para demonstrar como um serviço de bolos pode apresentar a sua oferta. Não representa um fornecedor real.', services:['Bolo de casamento','Mesa de doces','Opções de tamanho e decoração'], serviceAreas:['Benguela'], capacityMin:20, capacityMax:400, bookingTerms:'Exemplo demonstrativo. Confirmação de data e reserva não disponíveis.' },
];
const guides = JSON.parse(readFileSync(new URL('./content/guides.json', import.meta.url), 'utf8'));

try {
  for (const vendor of vendors) await db.vendor.upsert({ where:{slug:vendor.slug}, update:{...vendor,isDemo:true}, create:{...vendor,isDemo:true,status:'ACTIVE'} });
  for (const guide of guides) {
    const { reviewedAt, ...guideData } = guide;
    await db.guideArticle.upsert({
      where: { slug: guide.slug },
      update: { ...guideData, reviewedAt: reviewedAt ? new Date(reviewedAt) : null },
      create: { ...guideData, reviewedAt: reviewedAt ? new Date(reviewedAt) : null },
    });
  }
  console.log('Seed de demonstração concluído; fornecedores fictícios ficam identificados no perfil.');
} finally { await db.$disconnect(); }
