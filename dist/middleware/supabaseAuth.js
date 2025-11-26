"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAuthMiddleware = void 0;
const supabase_1 = require("../lib/supabase");
const prismaClient_1 = require("../prismaClient");
const supabaseAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token não fornecido' });
        return;
    }
    const token = authHeader.substring(7);
    try {
        // Verify token with Supabase
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ error: 'Token inválido ou expirado' });
            return;
        }
        // Get user metadata (salonId and role should be stored in user_metadata)
        const salonId = user.user_metadata?.salonId;
        const role = user.user_metadata?.role;
        if (!salonId || !role) {
            res.status(401).json({ error: 'Usuário não possui salonId ou role configurados' });
            return;
        }
        // Find user in our database to get the internal userId
        const dbUser = await prismaClient_1.prisma.user.findFirst({
            where: {
                email: user.email,
                salonId: salonId,
            },
            select: {
                id: true,
            },
        });
        if (!dbUser) {
            res.status(401).json({ error: 'Usuário não encontrado no banco de dados' });
            return;
        }
        req.user = {
            userId: dbUser.id,
            salonId: salonId,
            role: role,
            supabaseUserId: user.id,
        };
        next();
    }
    catch (error) {
        console.error('Error in supabaseAuthMiddleware:', error);
        res.status(401).json({ error: 'Erro ao verificar token' });
    }
};
exports.supabaseAuthMiddleware = supabaseAuthMiddleware;
