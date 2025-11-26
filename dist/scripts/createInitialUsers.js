"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prismaClient_1 = require("../prismaClient");
const salonContext_1 = require("../salonContext");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createInitialUsers() {
    try {
        const salonId = await (0, salonContext_1.getDefaultSalonId)();
        const defaultPassword = "123456"; // Change in production!
        const hashedPassword = await bcrypt_1.default.hash(defaultPassword, 10);
        const users = [
            {
                email: "admin@serenna.com",
                name: "Ana (Admin)",
                role: "admin",
                passwordHash: hashedPassword,
            },
            {
                email: "manager@serenna.com",
                name: "Beatriz (Gerente)",
                role: "manager",
                passwordHash: hashedPassword,
            },
            {
                email: "reception@serenna.com",
                name: "Carla (Recepcionista)",
                role: "receptionist",
                passwordHash: hashedPassword,
            },
            {
                email: "diana@serenna.com",
                name: "Diana (Profissional)",
                role: "professional",
                passwordHash: hashedPassword,
            },
        ];
        for (const userData of users) {
            try {
                await prismaClient_1.prisma.user.upsert({
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
            }
            catch (error) {
                console.error(`Erro ao criar usuário ${userData.email}:`, error);
            }
        }
        console.log("\nUsuários iniciais criados com sucesso!");
        console.log("Senha padrão para todos: 123456");
    }
    catch (error) {
        console.error("Erro ao criar usuários:", error);
        process.exit(1);
    }
    finally {
        await prismaClient_1.prisma.$disconnect();
    }
}
createInitialUsers();
