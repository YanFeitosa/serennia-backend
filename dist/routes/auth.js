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
        const { email, password } = req.body;
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
        // Get user metadata (salonId and role)
        const salonId = authData.user.user_metadata?.salonId;
        const role = authData.user.user_metadata?.role;
        if (!salonId || !role) {
            res.status(401).json({ error: "Usuário não possui salonId ou role configurados" });
            return;
        }
        // Find user in our database
        const user = await prismaClient_1.prisma.user.findUnique({
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
                role: true,
                avatarUrl: true,
            },
        });
        if (!user) {
            res.status(401).json({ error: "Usuário não encontrado no banco de dados" });
            return;
        }
        const response = {
            accessToken: authData.session?.access_token || '',
            user: {
                id: user.id,
                salonId: user.salonId,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl || undefined,
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
                role: true,
                avatarUrl: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: "Usuário não encontrado" });
            return;
        }
        res.json({
            id: user.id,
            salonId: user.salonId,
            name: user.name,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl || undefined,
        });
    }
    catch (error) {
        console.error("Error in /me", error);
        res.status(500).json({ error: "Erro ao buscar usuário" });
    }
});
