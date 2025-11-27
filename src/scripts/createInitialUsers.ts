import "dotenv/config";
import { prisma } from "../prismaClient";
import { getDefaultSalonId } from "../salonContext";
import bcrypt from "bcrypt";

async function createInitialUsers() {
  try {
    const salonId = await getDefaultSalonId();
    const defaultPassword = "123456"; // Change in production!
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const users = [
      {
        email: "admin@serennia.com",
        name: "Ana (Admin)",
        platformRole: "tenant_admin" as const,
        tenantRole: null,
        passwordHash: hashedPassword,
      },
      {
        email: "manager@serennia.com",
        name: "Beatriz (Gerente)",
        platformRole: null,
        tenantRole: "manager" as const,
        passwordHash: hashedPassword,
      },
      {
        email: "reception@serennia.com",
        name: "Carla (Recepcionista)",
        platformRole: null,
        tenantRole: "receptionist" as const,
        passwordHash: hashedPassword,
      },
      {
        email: "diana@serennia.com",
        name: "Diana (Profissional)",
        platformRole: null,
        tenantRole: "professional" as const,
        passwordHash: hashedPassword,
      },
    ];

    for (const userData of users) {
      try {
        await prisma.user.upsert({
          where: {
            salonId_email: {
              salonId,
              email: userData.email,
            },
          },
          update: {
            name: userData.name,
            platformRole: userData.platformRole,
            tenantRole: userData.tenantRole,
            passwordHash: userData.passwordHash,
          },
          create: {
            salonId,
            email: userData.email,
            name: userData.name,
            platformRole: userData.platformRole,
            tenantRole: userData.tenantRole,
            passwordHash: userData.passwordHash,
          },
        });
        console.log(`✓ Usuário ${userData.email} criado/atualizado`);
      } catch (error) {
        console.error(`Erro ao criar usuário ${userData.email}:`, error);
      }
    }

    console.log("\nUsuários iniciais criados com sucesso!");
    console.log("Senha padrão para todos: 123456");
  } catch (error) {
    console.error("Erro ao criar usuários:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createInitialUsers();

