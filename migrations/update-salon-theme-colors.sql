-- Migration: Atualizar cores do tema dos salões para combinar com a landing page
-- Data: 2024-11-27
-- Descrição: Atualiza as cores padrão do tema para a nova paleta roxo/indigo/rosa

-- Novo tema padrão alinhado com a landing page
-- Light: Roxo vibrante (#7c3aed), Indigo (#6366f1), Rosa (#ec4899)
-- Dark: Roxo claro (#a78bfa), Indigo claro (#818cf8), Rosa claro (#f472b6)

-- Atualizar TODOS os salões para o novo tema padrão
UPDATE "Salon"
SET theme = '{
  "light": {
    "primaryColor": "#7c3aed",
    "secondaryColor": "#6366f1",
    "accentColor": "#ec4899",
    "backgroundColor": "#faf5ff",
    "textColor": "#1e1b4b"
  },
  "dark": {
    "primaryColor": "#a78bfa",
    "secondaryColor": "#818cf8",
    "accentColor": "#f472b6",
    "backgroundColor": "#0f0a1f",
    "textColor": "#f1f5f9"
  }
}'::jsonb
WHERE theme IS NULL OR theme = '{}' OR theme = 'null';

-- Se você quiser forçar a atualização de TODOS os salões (mesmo os que já têm tema customizado):
-- UPDATE "Salon"
-- SET theme = '{
--   "light": {
--     "primaryColor": "#7c3aed",
--     "secondaryColor": "#6366f1",
--     "accentColor": "#ec4899",
--     "backgroundColor": "#faf5ff",
--     "textColor": "#1e1b4b"
--   },
--   "dark": {
--     "primaryColor": "#a78bfa",
--     "secondaryColor": "#818cf8",
--     "accentColor": "#f472b6",
--     "backgroundColor": "#0f0a1f",
--     "textColor": "#f1f5f9"
--   }
-- }'::jsonb;

-- Verificar resultado
SELECT id, name, theme FROM "Salon";
