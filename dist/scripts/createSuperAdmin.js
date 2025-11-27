"use strict";
/**
 * Script para criar Super Admin a partir de variáveis de ambiente
 *
 * Variáveis necessárias no .env:
 * - SUPER_ADMIN_EMAIL: Email do super admin
 * - SUPER_ADMIN_PASSWORD: Senha do super admin
 * - SUPER_ADMIN_NAME: Nome do super admin (opcional, usa email se não fornecido)
 *
 * Execute com: npm run create-super-admin
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prismaClient_1 = require("../prismaClient");
const supabase_1 = require("../lib/supabase");
async function createSuperAdmin() {
    try {
        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        const name = process.env.SUPER_ADMIN_NAME || email?.split('@')[0] || 'Super Admin';
        if (!email) {
            console.error("❌ Erro: SUPER_ADMIN_EMAIL não encontrado no .env");
            console.error("   Adicione SUPER_ADMIN_EMAIL=seu@email.com no arquivo .env");
            process.exit(1);
        }
        if (!password) {
            console.error("❌ Erro: SUPER_ADMIN_PASSWORD não encontrado no .env");
            console.error("   Adicione SUPER_ADMIN_PASSWORD=sua_senha_segura no arquivo .env");
            process.exit(1);
        }
        if (password.length < 8) {
            console.error("❌ Erro: A senha deve ter no mínimo 8 caracteres");
            process.exit(1);
        }
        console.log("🔧 Criando Super Admin...");
        console.log(`   Email: ${email}`);
        console.log(`   Nome: ${name}`);
        // Verificar se o usuário já existe no Supabase Auth
        console.log("\n📋 Verificando se o usuário já existe no Supabase Auth...");
        const { data: existingUsers, error: listError } = await supabase_1.supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
        });
        if (listError) {
            console.warn("⚠️ Erro ao listar usuários do Supabase:", listError);
        }
        const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            console.log("⚠️ Usuário já existe no Supabase Auth com ID:", existingUser.id);
            // Verificar se já existe no banco Prisma
            const dbUser = await prismaClient_1.prisma.user.findUnique({
                where: { id: existingUser.id },
            });
            if (dbUser) {
                // Atualizar para super admin se não for
                if (dbUser.platformRole !== 'super_admin') {
                    await prismaClient_1.prisma.user.update({
                        where: { id: existingUser.id },
                        data: {
                            platformRole: 'super_admin',
                            tenantRole: null,
                            salonId: null,
                        },
                    });
                    console.log("✅ Usuário atualizado para Super Admin no banco de dados");
                }
                else {
                    console.log("✅ Usuário já é Super Admin no banco de dados");
                }
                // Atualizar metadata no Supabase
                await supabase_1.supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                    user_metadata: {
                        platformRole: 'super_admin',
                        role: 'super_admin',
                        name: name,
                    },
                });
                console.log("✅ Metadata atualizada no Supabase Auth");
                console.log("\n✅ Super Admin já existe e foi atualizado!");
                await prismaClient_1.prisma.$disconnect();
                return;
            }
            else {
                // Usuário existe no Supabase mas não no banco - criar no banco
                console.log("📝 Criando registro no banco de dados...");
                await prismaClient_1.prisma.user.create({
                    data: {
                        id: existingUser.id,
                        email: email,
                        name: name,
                        platformRole: 'super_admin',
                        tenantRole: null,
                        salonId: null,
                        passwordHash: null,
                    },
                });
                console.log("✅ Registro criado no banco de dados");
                // Atualizar metadata no Supabase
                await supabase_1.supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                    user_metadata: {
                        platformRole: 'super_admin',
                        role: 'super_admin',
                        name: name,
                    },
                });
                console.log("✅ Metadata atualizada no Supabase Auth");
                console.log("\n✅ Super Admin configurado com sucesso!");
                await prismaClient_1.prisma.$disconnect();
                return;
            }
        }
        // Criar novo usuário no Supabase Auth
        console.log("\n📝 Criando usuário no Supabase Auth...");
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                platformRole: 'super_admin',
                role: 'super_admin',
                name: name,
            },
        });
        if (authError) {
            console.error("❌ Erro ao criar usuário no Supabase Auth:", authError);
            process.exit(1);
        }
        if (!authData.user) {
            console.error("❌ Erro: Usuário não foi criado no Supabase Auth");
            process.exit(1);
        }
        console.log("✅ Usuário criado no Supabase Auth com ID:", authData.user.id);
        // Criar registro no banco de dados
        console.log("\n📝 Criando registro no banco de dados...");
        try {
            await prismaClient_1.prisma.user.create({
                data: {
                    id: authData.user.id,
                    email: email,
                    name: name,
                    platformRole: 'super_admin',
                    tenantRole: null, // Super Admin não tem tenantRole
                    salonId: null, // Super Admin não tem salonId
                    passwordHash: null, // Não usado com Supabase Auth
                },
            });
            console.log("✅ Registro criado no banco de dados");
        }
        catch (dbError) {
            // Se der erro por coluna não existir, tentar com campos mínimos
            if (dbError.code === 'P2022' || dbError.message?.includes('does not exist')) {
                console.warn("⚠️ Schema desincronizado, tentando criar com campos mínimos...");
                try {
                    await prismaClient_1.prisma.user.create({
                        data: {
                            id: authData.user.id,
                            email: email,
                            name: name,
                            passwordHash: null,
                        },
                    });
                    console.log("✅ Registro criado com campos mínimos");
                    console.warn("⚠️ IMPORTANTE: Execute as migrations para adicionar platformRole");
                }
                catch (minimalError) {
                    console.error("❌ Erro ao criar registro mesmo com campos mínimos:", minimalError);
                    // Tentar limpar usuário do Supabase
                    await supabase_1.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                    process.exit(1);
                }
            }
            else {
                console.error("❌ Erro ao criar registro no banco:", dbError);
                // Tentar limpar usuário do Supabase
                await supabase_1.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                process.exit(1);
            }
        }
        console.log("\n✅ Super Admin criado com sucesso!");
        console.log(`\n📧 Email: ${email}`);
        console.log(`👤 Nome: ${name}`);
        console.log(`🔑 Senha: ${'*'.repeat(password.length)}`);
        console.log(`\n💡 Você pode fazer login agora com essas credenciais!`);
    }
    catch (error) {
        console.error("❌ Erro ao criar Super Admin:", error);
        process.exit(1);
    }
    finally {
        await prismaClient_1.prisma.$disconnect();
    }
}
createSuperAdmin();
