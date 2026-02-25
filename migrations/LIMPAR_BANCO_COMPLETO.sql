-- ============================================
-- LIMPAR BANCO COMPLETO (sem apagar tabelas)
-- Remove TODAS as linhas de TODAS as tabelas
-- Mantém estrutura, enums, índices e constraints
-- ============================================
-- ⚠️  CUIDADO: Isso apaga TODOS os dados!
-- ⚠️  NÃO execute em produção sem backup!
-- ============================================

-- Desabilita verificação de FK temporariamente para evitar erros de ordem
SET session_replication_role = 'replica';

-- Tabelas filhas / junction tables (sem dependentes)
TRUNCATE TABLE "AppointmentService" CASCADE;
TRUNCATE TABLE "CommissionRecord" CASCADE;
TRUNCATE TABLE "CommissionPayment" CASCADE;
TRUNCATE TABLE "MessageLog" CASCADE;
TRUNCATE TABLE "AuditLog" CASCADE;
TRUNCATE TABLE "Notification" CASCADE;
TRUNCATE TABLE "Payment" CASCADE;
TRUNCATE TABLE "OrderItem" CASCADE;
TRUNCATE TABLE "Expense" CASCADE;
TRUNCATE TABLE "TotemDevice" CASCADE;
TRUNCATE TABLE "MessageTemplate" CASCADE;

-- Tabelas intermediárias
TRUNCATE TABLE "Order" CASCADE;
TRUNCATE TABLE "Appointment" CASCADE;

-- Tabelas de entidades
TRUNCATE TABLE "Service" CASCADE;
TRUNCATE TABLE "Product" CASCADE;
TRUNCATE TABLE "Category" CASCADE;
TRUNCATE TABLE "Client" CASCADE;
TRUNCATE TABLE "Collaborator" CASCADE;

-- Usuários (remove vínculo de tenantAdmin antes)
UPDATE "Salon" SET "tenantAdminId" = NULL WHERE "tenantAdminId" IS NOT NULL;
TRUNCATE TABLE "User" CASCADE;

-- Salões (por último, é a raiz de tudo)
TRUNCATE TABLE "Salon" CASCADE;

-- Reabilita verificação de FK
SET session_replication_role = 'origin';

-- ============================================
-- Verificação: todas as tabelas devem estar vazias
-- ============================================
SELECT 'Salon' AS tabela, COUNT(*) AS linhas FROM "Salon"
UNION ALL SELECT 'User', COUNT(*) FROM "User"
UNION ALL SELECT 'Client', COUNT(*) FROM "Client"
UNION ALL SELECT 'Collaborator', COUNT(*) FROM "Collaborator"
UNION ALL SELECT 'Category', COUNT(*) FROM "Category"
UNION ALL SELECT 'Service', COUNT(*) FROM "Service"
UNION ALL SELECT 'Product', COUNT(*) FROM "Product"
UNION ALL SELECT 'Appointment', COUNT(*) FROM "Appointment"
UNION ALL SELECT 'AppointmentService', COUNT(*) FROM "AppointmentService"
UNION ALL SELECT 'Order', COUNT(*) FROM "Order"
UNION ALL SELECT 'OrderItem', COUNT(*) FROM "OrderItem"
UNION ALL SELECT 'Payment', COUNT(*) FROM "Payment"
UNION ALL SELECT 'CommissionRecord', COUNT(*) FROM "CommissionRecord"
UNION ALL SELECT 'CommissionPayment', COUNT(*) FROM "CommissionPayment"
UNION ALL SELECT 'AuditLog', COUNT(*) FROM "AuditLog"
UNION ALL SELECT 'Notification', COUNT(*) FROM "Notification"
UNION ALL SELECT 'MessageTemplate', COUNT(*) FROM "MessageTemplate"
UNION ALL SELECT 'MessageLog', COUNT(*) FROM "MessageLog"
UNION ALL SELECT 'Expense', COUNT(*) FROM "Expense"
UNION ALL SELECT 'TotemDevice', COUNT(*) FROM "TotemDevice"
ORDER BY tabela;

-- ============================================
-- NOTA: A tabela _prisma_migrations NÃO é tocada.
-- O histórico de migrations permanece intacto.
-- ============================================
-- Lembre-se: se usar Supabase Auth, os usuários
-- no auth.users do Supabase continuarão existindo.
-- Para limpar também no Supabase, vá em:
-- Dashboard > Authentication > Users e remova manualmente,
-- ou execute no SQL Editor do Supabase:
--
--   DELETE FROM auth.users;
--
-- ============================================
