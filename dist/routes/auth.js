"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const supabase_1 = require("../lib/supabase");
const supabaseAuth_1 = require("../middleware/supabaseAuth");
const authRouter = (0, express_1.Router)();
exports.authRouter = authRouter;
authRouter.post("/login", rateLimiter_1.loginRateLimiter, async (req, res) => {
    try {
        const { email, password, salonId: requestedSalonId } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "Email e senha são obrigatórios" });
            return;
        }
        // Validate email format
        if (!(0, validation_1.validateEmail)(email)) {
            res.status(400).json({ error: "Formato de email inválido" });
            return;
        }
        const sanitizedEmail = (0, validation_1.sanitizeString)(email).toLowerCase();
        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email: sanitizedEmail,
            password: password,
        });
        if (authError || !authData.user) {
            res.status(401).json({ error: "Credenciais inválidas" });
            return;
        }
        // Get user metadata
        const salonId = authData.user.user_metadata?.salonId || null;
        const platformRole = authData.user.user_metadata?.platformRole;
        // Find user in our database
        let user;
        if (platformRole === 'super_admin') {
            // SuperAdmin doesn't need salonId
            user = await prismaClient_1.prisma.user.findFirst({
                where: {
                    email: sanitizedEmail,
                    platformRole: 'super_admin',
                },
                select: {
                    id: true,
                    salonId: true,
                    name: true,
                    email: true,
                    platformRole: true,
                    tenantRole: true,
                    avatarUrl: true,
                },
            });
        }
        else {
            // Tenant Admin and Tenant Users need salonId
            if (!salonId) {
                res.status(401).json({ error: "Usuário não possui salonId configurado" });
                return;
            }
            user = await prismaClient_1.prisma.user.findUnique({
                where: {
                    salonId_email: {
                        salonId,
                        email: sanitizedEmail,
                    },
                },
                select: {
                    id: true,
                    salonId: true,
                    name: true,
                    email: true,
                    platformRole: true,
                    tenantRole: true,
                    avatarUrl: true,
                },
            });
        }
        if (!user) {
            res.status(401).json({ error: "Usuário não encontrado no banco de dados" });
            return;
        }
        // If Super Admin requested a specific salon context, verify it exists and return it
        let activeSalonId = user.salonId || '';
        let activeSalonName = undefined;
        if (platformRole === 'super_admin' && requestedSalonId) {
            const salon = await prismaClient_1.prisma.salon.findUnique({
                where: { id: requestedSalonId },
                select: { id: true, name: true }
            });
            if (salon) {
                activeSalonId = salon.id;
                activeSalonName = salon.name;
            }
        }
        else if (user.salonId) {
            // Fetch salon name for normal users
            const salon = await prismaClient_1.prisma.salon.findUnique({
                where: { id: user.salonId },
                select: { name: true }
            });
            if (salon) {
                activeSalonName = salon.name;
            }
        }
        const response = {
            accessToken: authData.session?.access_token || '',
            user: {
                id: user.id,
                salonId: activeSalonId,
                name: user.name,
                email: user.email,
                role: user.tenantRole || user.platformRole || '', // Legacy compatibility
                avatarUrl: user.avatarUrl || undefined,
                salonName: activeSalonName,
            },
        };
        res.json(response);
    }
    catch (error) {
        console.error("Error in login", error);
        res.status(500).json({ error: "Erro ao fazer login" });
    }
});
authRouter.get("/me", supabaseAuth_1.supabaseAuthMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Usuário não autenticado" });
            return;
        }
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                salonId: true,
                name: true,
                email: true,
                platformRole: true,
                tenantRole: true,
                avatarUrl: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        // Fetch salon name if salonId is present
        let salonName = undefined;
        if (user.salonId) {
            const salon = await prismaClient_1.prisma.salon.findUnique({
                where: { id: user.salonId },
                select: { name: true }
            });
            if (salon) {
                salonName = salon.name;
            }
        }
        res.json({
            id: user.id,
            salonId: user.salonId,
            name: user.name,
            email: user.email,
            platformRole: user.platformRole,
            tenantRole: user.tenantRole,
            role: user.tenantRole || user.platformRole || null, // Legacy compatibility
            avatarUrl: user.avatarUrl || undefined,
            salonName,
        });
    }
    catch (error) {
        console.error("Error in /me", error);
        res.status(500).json({ error: "Erro ao buscar usuário" });
    }
});
// PATCH /auth/password - Change password
authRouter.patch("/password", rateLimiter_1.apiRateLimiter, supabaseAuth_1.supabaseAuthMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: "Usuário não autenticado" });
            return;
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
            return;
        }
        if (newPassword.length < 8) {
            res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres" });
            return;
        }
        // Get user email from database
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { email: true },
        });
        if (!user) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        // Verify current password
        const { data: verifyData, error: verifyError } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
        });
        if (verifyError || !verifyData.user) {
            res.status(401).json({ error: "Senha atual incorreta" });
            return;
        }
        // Update password in Supabase
        const { error: updateError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(req.user.supabaseUserId, { password: newPassword });
        if (updateError) {
            console.error("Error updating password:", updateError);
            res.status(500).json({ error: "Erro ao atualizar senha" });
            return;
        }
        res.json({ success: true, message: "Senha atualizada com sucesso" });
    }
    catch (error) {
        console.error("Error in /password", error);
        res.status(500).json({ error: "Erro ao alterar senha" });
    }
});
// POST /auth/forgot-password - Request password reset
authRouter.post("/forgot-password", rateLimiter_1.apiRateLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: "Email é obrigatório" });
            return;
        }
        if (!(0, validation_1.validateEmail)(email)) {
            res.status(400).json({ error: "Formato de email inválido" });
            return;
        }
        const sanitizedEmail = (0, validation_1.sanitizeString)(email).toLowerCase();
        // Check if user exists in our database
        const user = await prismaClient_1.prisma.user.findFirst({
            where: { email: sanitizedEmail },
            select: { id: true, email: true },
        });
        // Always return success to prevent email enumeration
        if (!user) {
            res.json({ success: true, message: "Se o email existir, você receberá um link de recuperação" });
            return;
        }
        // Request password reset via Supabase
        const { error } = await supabase_1.supabaseAdmin.auth.resetPasswordForEmail(sanitizedEmail, {
            redirectTo: `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/login?reset=true`,
        });
        if (error) {
            console.error("Error requesting password reset:", error);
            // Still return success to prevent email enumeration
        }
        res.json({ success: true, message: "Se o email existir, você receberá um link de recuperação" });
    }
    catch (error) {
        console.error("Error in /forgot-password", error);
        res.status(500).json({ error: "Erro ao solicitar recuperação de senha" });
    }
});
