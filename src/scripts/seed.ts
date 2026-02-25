/**
 * Seed Script — Popula o banco com dados de teste
 *
 * Cria: 1 Salão, 1 Tenant Admin (no Supabase + DB),
 *       Categorias, Serviços, Produtos, Colaboradores, Clientes,
 *       Agendamentos e Comandas de exemplo.
 *
 * Variáveis obrigatórias no .env:
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY
 *
 * Variáveis opcionais:
 *   SEED_ADMIN_EMAIL    (default: admin@serennia.dev)
 *   SEED_ADMIN_PASSWORD (default: serennia123)
 *
 * Execute com: npm run seed
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@serennia.dev";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "serennia123";

async function seed() {
  console.log("🌱 Iniciando seed do banco de dados...\n");

  // ─── 1. Salon ───────────────────────────────────────────
  console.log("🏠 Criando salão...");
  const salon = await prisma.salon.create({
    data: {
      name: "Salão Serennia Demo",
      document: "12.345.678/0001-99",
      defaultCommissionRate: 0.5,
      commissionMode: "professional",
      stockControlEnabled: true,
      status: "active",
      theme: {
        light: {
          primary: "#7C3AED",
          secondary: "#EC4899",
          accent: "#F59E0B",
          background: "#FFFFFF",
          foreground: "#1F2937",
        },
        dark: {
          primary: "#A78BFA",
          secondary: "#F472B6",
          accent: "#FBBF24",
          background: "#111827",
          foreground: "#F9FAFB",
        },
      },
      rolePermissions: {
        manager: [
          "agenda", "comandas", "clientes", "servicos", "produtos",
          "colaboradores", "financeiro", "configuracoes", "auditoria",
          "notificacoes", "podeDeletarCliente", "podeDeletarColaborador",
          "podeDeletarProduto", "podeDeletarServico",
        ],
        receptionist: [
          "agenda", "comandas", "clientes", "servicos", "produtos",
          "colaboradores", "notificacoes",
        ],
        professional: ["agenda", "comandas", "clientes", "notificacoes"],
      },
    },
  });
  console.log(`   ✅ Salão "${salon.name}" criado (${salon.id})`);

  // ─── 2. Admin User (Supabase + DB) ─────────────────────
  console.log("\n👤 Criando admin no Supabase Auth...");
  let supabaseUserId: string;

  // Verificar se já existe
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    filter: ADMIN_EMAIL,
  } as any);

  const existingUser = existing?.users?.find(
    (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  if (existingUser) {
    supabaseUserId = existingUser.id;
    console.log(`   ⚠️  Usuário já existe no Supabase (${supabaseUserId})`);
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Erro ao criar user Supabase: ${error.message}`);
    supabaseUserId = data.user!.id;
    console.log(`   ✅ Criado no Supabase (${supabaseUserId})`);
  }

  const adminUser = await prisma.user.create({
    data: {
      id: supabaseUserId,
      salonId: salon.id,
      name: "Admin Demo",
      email: ADMIN_EMAIL,
      phone: "(11) 99999-0000",
      platformRole: "tenant_admin",
      tenantRole: null,
    },
  });

  // Vincular admin como tenantAdmin do salão
  await prisma.salon.update({
    where: { id: salon.id },
    data: { tenantAdminId: adminUser.id },
  });
  console.log(`   ✅ Admin "${adminUser.name}" vinculado ao salão`);

  // ─── 3. Categories ─────────────────────────────────────
  console.log("\n📂 Criando categorias...");
  const catCabelo = await prisma.category.create({
    data: { salonId: salon.id, type: "service", name: "Cabelo" },
  });
  const catUnhas = await prisma.category.create({
    data: { salonId: salon.id, type: "service", name: "Unhas" },
  });
  const catEstetica = await prisma.category.create({
    data: { salonId: salon.id, type: "service", name: "Estética" },
  });
  const catProdutos = await prisma.category.create({
    data: { salonId: salon.id, type: "product", name: "Produtos Capilares" },
  });
  const catAcessorios = await prisma.category.create({
    data: { salonId: salon.id, type: "product", name: "Acessórios" },
  });
  console.log("   ✅ 5 categorias criadas");

  // ─── 4. Services ───────────────────────────────────────
  console.log("\n✂️  Criando serviços...");
  const services = await Promise.all([
    prisma.service.create({
      data: { salonId: salon.id, name: "Corte Feminino", categoryId: catCabelo.id, duration: 60, price: 80, commission: 0.5 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Corte Masculino", categoryId: catCabelo.id, duration: 30, price: 45, commission: 0.5 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Escova Progressiva", categoryId: catCabelo.id, duration: 180, price: 250, commission: 0.4 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Coloração", categoryId: catCabelo.id, duration: 120, price: 180, commission: 0.4 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Manicure", categoryId: catUnhas.id, duration: 45, price: 35, commission: 0.5 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Pedicure", categoryId: catUnhas.id, duration: 45, price: 40, commission: 0.5 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Limpeza de Pele", categoryId: catEstetica.id, duration: 90, price: 120, commission: 0.45 },
    }),
    prisma.service.create({
      data: { salonId: salon.id, name: "Design de Sobrancelha", categoryId: catEstetica.id, duration: 30, price: 50, commission: 0.5 },
    }),
  ]);
  console.log(`   ✅ ${services.length} serviços criados`);

  // ─── 5. Products ───────────────────────────────────────
  console.log("\n📦 Criando produtos...");
  const products = await Promise.all([
    prisma.product.create({
      data: { salonId: salon.id, name: "Shampoo Profissional 500ml", categoryId: catProdutos.id, price: 65, costPrice: 30, stock: 20 },
    }),
    prisma.product.create({
      data: { salonId: salon.id, name: "Condicionador Profissional 500ml", categoryId: catProdutos.id, price: 60, costPrice: 28, stock: 18 },
    }),
    prisma.product.create({
      data: { salonId: salon.id, name: "Máscara Capilar 300g", categoryId: catProdutos.id, price: 85, costPrice: 40, stock: 12 },
    }),
    prisma.product.create({
      data: { salonId: salon.id, name: "Óleo Reparador 100ml", categoryId: catProdutos.id, price: 45, costPrice: 18, stock: 25 },
    }),
    prisma.product.create({
      data: { salonId: salon.id, name: "Escova de Cabelo Profissional", categoryId: catAcessorios.id, price: 35, costPrice: 12, stock: 10 },
    }),
  ]);
  console.log(`   ✅ ${products.length} produtos criados`);

  // ─── 6. Collaborators ──────────────────────────────────
  console.log("\n👥 Criando colaboradores...");
  const collabs = await Promise.all([
    prisma.collaborator.create({
      data: {
        salonId: salon.id, name: "Maria Silva", role: "professional",
        status: "active", phone: "(11) 98888-1111", email: "maria@serennia.dev",
        commissionRate: 0.5, serviceCategories: ["Cabelo", "Estética"],
        pixKey: "maria@serennia.dev", pixKeyType: "email",
      },
    }),
    prisma.collaborator.create({
      data: {
        salonId: salon.id, name: "João Santos", role: "professional",
        status: "active", phone: "(11) 98888-2222", email: "joao@serennia.dev",
        commissionRate: 0.5, serviceCategories: ["Cabelo"],
        pixKey: "11988882222", pixKeyType: "phone",
      },
    }),
    prisma.collaborator.create({
      data: {
        salonId: salon.id, name: "Ana Oliveira", role: "professional",
        status: "active", phone: "(11) 98888-3333", email: "ana@serennia.dev",
        commissionRate: 0.5, serviceCategories: ["Unhas", "Estética"],
      },
    }),
    prisma.collaborator.create({
      data: {
        salonId: salon.id, name: "Carlos Pereira", role: "receptionist",
        status: "active", phone: "(11) 98888-4444", email: "carlos@serennia.dev",
        commissionRate: 0,
      },
    }),
  ]);
  console.log(`   ✅ ${collabs.length} colaboradores criados`);

  // ─── 7. Clients ────────────────────────────────────────
  console.log("\n🧑 Criando clientes...");
  const clients = await Promise.all([
    prisma.client.create({ data: { salonId: salon.id, name: "Fernanda Costa", phone: "(11) 97777-1111", email: "fernanda@email.com" } }),
    prisma.client.create({ data: { salonId: salon.id, name: "Roberto Lima", phone: "(11) 97777-2222", email: "roberto@email.com" } }),
    prisma.client.create({ data: { salonId: salon.id, name: "Juliana Souza", phone: "(11) 97777-3333", email: "juliana@email.com" } }),
    prisma.client.create({ data: { salonId: salon.id, name: "Patricia Mendes", phone: "(11) 97777-4444" } }),
    prisma.client.create({ data: { salonId: salon.id, name: "Lucas Ferreira", phone: "(11) 97777-5555" } }),
    prisma.client.create({ data: { salonId: salon.id, name: "Camila Rodrigues", phone: "(11) 97777-6666", email: "camila@email.com" } }),
  ]);
  console.log(`   ✅ ${clients.length} clientes criados`);

  // ─── 8. Expenses ───────────────────────────────────────
  console.log("\n💰 Criando despesas...");
  await Promise.all([
    prisma.expense.create({ data: { salonId: salon.id, name: "Aluguel", amount: 3500, type: "FIXED" } }),
    prisma.expense.create({ data: { salonId: salon.id, name: "Energia Elétrica", amount: 800, type: "FIXED" } }),
    prisma.expense.create({ data: { salonId: salon.id, name: "Água", amount: 200, type: "FIXED" } }),
    prisma.expense.create({ data: { salonId: salon.id, name: "Internet", amount: 150, type: "FIXED" } }),
    prisma.expense.create({ data: { salonId: salon.id, name: "Produtos de Limpeza", amount: 300, type: "VARIABLE" } }),
  ]);
  console.log("   ✅ 5 despesas criadas");

  // ─── 9. Totem Device ───────────────────────────────────
  console.log("\n📱 Criando dispositivo totem...");
  await prisma.totemDevice.create({
    data: {
      salonId: salon.id,
      name: "Totem Recepção",
      accessCode: "123456",
      isActive: true,
    },
  });
  console.log("   ✅ Totem criado (código: 123456)");

  // ─── 10. Sample Appointments ───────────────────────────
  console.log("\n📅 Criando agendamentos de exemplo...");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const apt1Start = new Date(tomorrow);
  apt1Start.setHours(9, 0, 0, 0);
  const apt1End = new Date(apt1Start);
  apt1End.setHours(10, 0, 0, 0);

  const apt2Start = new Date(tomorrow);
  apt2Start.setHours(10, 30, 0, 0);
  const apt2End = new Date(apt2Start);
  apt2End.setMinutes(apt2Start.getMinutes() + 45);

  const apt3Start = new Date(tomorrow);
  apt3Start.setHours(14, 0, 0, 0);
  const apt3End = new Date(apt3Start);
  apt3End.setHours(16, 0, 0, 0);

  const appointments = await Promise.all([
    prisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: clients[0].id,
        collaboratorId: collabs[0].id,
        start: apt1Start,
        end: apt1End,
        status: "pending",
        origin: "reception",
        services: { create: [{ serviceId: services[0].id }] },
      },
    }),
    prisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: clients[1].id,
        collaboratorId: collabs[2].id,
        start: apt2Start,
        end: apt2End,
        status: "pending",
        origin: "app",
        services: { create: [{ serviceId: services[4].id }] },
      },
    }),
    prisma.appointment.create({
      data: {
        salonId: salon.id,
        clientId: clients[2].id,
        collaboratorId: collabs[0].id,
        start: apt3Start,
        end: apt3End,
        status: "pending",
        origin: "whatsapp",
        services: {
          create: [
            { serviceId: services[3].id },
          ],
        },
      },
    }),
  ]);
  console.log(`   ✅ ${appointments.length} agendamentos criados para amanhã`);

  // ─── Resumo ────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 Seed concluído com sucesso!");
  console.log("═".repeat(50));
  console.log(`\n📋 Resumo:`);
  console.log(`   🏠 1 Salão: "${salon.name}"`);
  console.log(`   👤 1 Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`   📂 5 Categorias`);
  console.log(`   ✂️  ${services.length} Serviços`);
  console.log(`   📦 ${products.length} Produtos`);
  console.log(`   👥 ${collabs.length} Colaboradores`);
  console.log(`   🧑 ${clients.length} Clientes`);
  console.log(`   💰 5 Despesas`);
  console.log(`   📱 1 Totem (código: 123456)`);
  console.log(`   📅 ${appointments.length} Agendamentos`);
  console.log(`\n🔑 Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}\n`);
}

seed()
  .catch((e) => {
    console.error("\n❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
