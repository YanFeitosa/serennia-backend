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
        // Check if user is a collaborator and if they're active
        if (user.tenantRole && user.salonId) {
            const collaborator = await prismaClient_1.prisma.collaborator.findFirst({
                where: {
                    userId: user.id,
                    salonId: user.salonId,
                },
                select: {
                    id: true,
                    status: true,
                },
            });
            if (collaborator && collaborator.status === 'inactive') {
                // Check if email is confirmed in Supabase
                if (!authData.user.email_confirmed_at) {
                    res.status(403).json({
                        error: "Sua conta ainda não foi ativada. Por favor, confirme seu email para acessar o sistema.",
                        code: "EMAIL_NOT_CONFIRMED"
                    });
                    return;
                }
                // Email is confirmed but status still inactive - activate now
                await prismaClient_1.prisma.collaborator.update({
                    where: { id: collaborator.id },
                    data: { status: 'active' },
                });
                console.log(`Collaborator auto-activated after confirmed email login`);
            }
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
        // For super_admin, use the context salonId (from header) if available
        // Otherwise use the user's own salonId
        const effectiveSalonId = req.user.salonId || user.salonId;
        // Fetch salon name if salonId is present
        let salonName = undefined;
        if (effectiveSalonId) {
            const salon = await prismaClient_1.prisma.salon.findUnique({
                where: { id: effectiveSalonId },
                select: { name: true }
            });
            if (salon) {
                salonName = salon.name;
            }
        }
        res.json({
            id: user.id,
            salonId: effectiveSalonId,
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
/**
 * Webhook endpoint for Supabase Auth events
 * Called when user confirms their email
 * Activates the collaborator's status
 */
authRouter.post("/webhook/email-confirmed", async (req, res) => {
    try {
        // Verify webhook secret (optional but recommended)
        const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
        if (webhookSecret) {
            const providedSecret = req.headers['x-webhook-secret'];
            if (providedSecret !== webhookSecret) {
                console.warn('Invalid webhook secret provided');
                res.status(401).json({ error: 'Invalid webhook secret' });
                return;
            }
        }
        const { type, record, old_record } = req.body;
        // Handle email confirmation event
        // Supabase sends this when email_confirmed_at changes from null to a timestamp
        if (type === 'UPDATE' && record?.email_confirmed_at && !old_record?.email_confirmed_at) {
            const userId = record.id;
            const email = record.email;
            console.log(`Email confirmed for user ${userId} (${email})`);
            // Find and activate the collaborator
            const collaborator = await prismaClient_1.prisma.collaborator.findFirst({
                where: {
                    userId: userId,
                    status: 'inactive',
                },
            });
            if (collaborator) {
                await prismaClient_1.prisma.collaborator.update({
                    where: { id: collaborator.id },
                    data: { status: 'active' },
                });
                console.log(`Collaborator ${collaborator.id} activated after email confirmation`);
            }
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error processing email confirmation webhook:", error);
        res.status(500).json({ error: "Failed to process webhook" });
    }
});
/**
 * Endpoint to manually activate collaborator after email confirmation
 * Called from frontend after user confirms email via Supabase
 */
authRouter.post("/activate-collaborator", supabaseAuth_1.supabaseAuthMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const userId = req.user.userId;
        // Find and activate the collaborator
        const collaborator = await prismaClient_1.prisma.collaborator.findFirst({
            where: {
                userId: userId,
                status: 'inactive',
            },
        });
        if (!collaborator) {
            // Maybe already active or not found
            const existingCollaborator = await prismaClient_1.prisma.collaborator.findFirst({
                where: { userId: userId },
            });
            if (existingCollaborator?.status === 'active') {
                res.json({ success: true, message: 'Conta já está ativa' });
                return;
            }
            res.status(404).json({ error: 'Colaborador não encontrado' });
            return;
        }
        await prismaClient_1.prisma.collaborator.update({
            where: { id: collaborator.id },
            data: { status: 'active' },
        });
        console.log(`Collaborator ${collaborator.id} activated via manual endpoint`);
        res.json({ success: true, message: 'Conta ativada com sucesso!' });
    }
    catch (error) {
        console.error("Error activating collaborator:", error);
        res.status(500).json({ error: "Erro ao ativar conta" });
    }
});
