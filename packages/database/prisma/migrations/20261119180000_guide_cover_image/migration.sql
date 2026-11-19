ALTER TABLE "GuideArticle" ADD COLUMN "coverImage" TEXT;

UPDATE "GuideArticle" SET "coverImage" = CASE "slug"
  WHEN 'como-comecar-a-planear' THEN '/guias/como-comecar-a-planear.webp'
  WHEN 'organizar-o-orcamento' THEN '/guias/organizar-o-orcamento.webp'
  WHEN 'primeira-lista-de-convidados' THEN '/guias/primeira-lista-de-convidados.webp'
  WHEN 'escolher-o-espaco' THEN '/guias/escolher-o-espaco.webp'
  WHEN 'casamento-civil-documentos-angola' THEN '/guias/casamento-civil-documentos-angola.webp'
  ELSE NULL
END
WHERE "slug" IN (
  'como-comecar-a-planear',
  'organizar-o-orcamento',
  'primeira-lista-de-convidados',
  'escolher-o-espaco',
  'casamento-civil-documentos-angola'
);
