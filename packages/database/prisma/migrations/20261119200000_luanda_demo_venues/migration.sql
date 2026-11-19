INSERT INTO "Venue" (
  "id", "slug", "name", "venueType", "description", "province", "municipality", "address",
  "amenities", "eventTypes", "galleryUrls", "status", "isDemo", "createdAt", "updatedAt"
)
VALUES
  (
    'nuvia-demo-space-kissewas', 'kissewas-eventos-demo', 'Kissewas Eventos', 'Salão de festas',
    'Perfil demonstrativo Nuvia. A localização é uma referência pública ainda por confirmar com o responsável. A imagem é uma ilustração conceptual, não uma fotografia do estabelecimento.',
    'Luanda', 'Luanda Sul', 'Via Luanda Sul, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/kissewas-eventos.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  ),
  (
    'nuvia-demo-space-pingo-douro', 'pingo-douro-centro-eventos-demo', 'PINGO D´OURO - Centro de Eventos', 'Centro de eventos',
    'Perfil demonstrativo Nuvia. A localização é uma referência pública ainda por confirmar com o responsável. A imagem é uma ilustração conceptual, não uma fotografia do estabelecimento.',
    'Luanda', 'Luanda', 'Avenida Fidel Castro, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/pingo-douro-centro-eventos.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  ),
  (
    'nuvia-demo-space-zuka', 'zuka-eventos-demo', 'Zuka Eventos', 'Salão de eventos',
    'Perfil demonstrativo Nuvia. A referência pública de localização é Morro Bento, Talatona; a morada exacta deve ser confirmada com o responsável. A imagem é uma ilustração conceptual, não uma fotografia do estabelecimento.',
    'Luanda', 'Talatona', 'Morro Bento, Talatona, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/zuka-eventos.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  ),
  (
    'nuvia-demo-space-taliana', 'espaco-taliana-grupo-real-demo', 'Espaço Taliana by Grupo Real', 'Espaço de eventos',
    'Perfil demonstrativo Nuvia. A localização de referência é Via C3, Talatona. A imagem é uma ilustração conceptual, não uma fotografia do estabelecimento; condições e dados comerciais carecem de confirmação pelo responsável.',
    'Luanda', 'Talatona', 'Via C3, Talatona, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/espaco-taliana.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  ),
  (
    'nuvia-demo-space-herdade', 'salao-herdade-demo', 'Salão Herdade', 'Salão de festas',
    'Perfil demonstrativo Nuvia. A localização de referência é Bairro do Sossego, junto à Via Expressa. A imagem é uma ilustração conceptual, não uma fotografia do estabelecimento; capacidade, preços e condições não estão confirmados.',
    'Luanda', 'Bairro do Sossego', 'Via Expressa, Bairro do Sossego, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/salao-herdade.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  ),
  (
    'nuvia-demo-space-palmeiras', 'palmeiras-hotel-luanda-demo', 'Palmeiras Hotel Luanda', 'Hotel',
    'Perfil demonstrativo Nuvia. O hotel publica informação sobre salas para eventos no seu site oficial. A imagem apresentada é conceptual e não representa uma fotografia do hotel. Capacidade, disponibilidade, preços e condições devem ser confirmados directamente com o estabelecimento.',
    'Luanda', 'Talatona', 'Rua Dubai, Via AL15, Talatona, Luanda, Angola',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[], ARRAY['/espacos/demo/palmeiras-hotel-luanda.webp']::TEXT[], 'PUBLISHED', true, NOW(), NOW()
  )
ON CONFLICT ("slug") DO NOTHING;
