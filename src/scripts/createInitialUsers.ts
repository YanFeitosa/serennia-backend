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
        email: "admin@serenna.com",
        name: "Ana (Admin)",
        role: "admin" as const,
        passwordHash: hashedPassword,
      },
      {
        email: "manager@serenna.com",
        name: "Beatriz (Gerente)",
        role: "manager" as const,
        passwordHash: hashedPassword,
      },
      {
        email: "reception@serenna.com",
        name: "Carla (Recepcionista)",
        role: "receptionist" as const,
        passwordHash: hashedPassword,
      },
      {
        email: "diana@serenna.com",
        name: "Diana (Profissional)",
        role: "professional" as const,
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
            role: userData.role,
            passwordHash: userData.passwordHash,
          },
          create: {
            salonId,
            email: userData.email,
            name: userData.name,
            role: userData.role,
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

