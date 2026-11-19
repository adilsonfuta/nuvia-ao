ALTER TABLE "Venue" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Venue" (
  "id", "slug", "name", "venueType", "description", "capacityMin", "capacityMax",
  "amenities", "eventTypes", "galleryUrls", "status", "isDemo", "createdAt", "updatedAt"
)
VALUES (
  'nuvia-demo-venue-quinta',
  'quinta-nuvia-demo',
  'Quinta Nuvia · Demonstração',
  'Quinta',
  'Perfil fictício criado para demonstrar a apresentação dos espaços na Nuvia. Não representa um local real, não recebe reservas e a lotação e as características são apenas ilustrativas.',
  80,
  250,
  ARRAY['Jardim', 'Estacionamento', 'Área de cerimónia']::TEXT[],
  ARRAY['Casamento', 'Alambamento', 'Festa']::TEXT[],
  ARRAY['/guias/escolher-o-espaco.webp']::TEXT[],
  'PUBLISHED',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;
