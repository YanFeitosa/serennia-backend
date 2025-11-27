"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAuthMiddleware = void 0;
exports.isAdminLike = isAdminLike;
exports.getEffectiveRole = getEffectiveRole;
const supabase_1 = require("../lib/supabase");
const prismaClient_1 = require("../prismaClient");
/**
 * Helper function to check if user has admin-like permissions
 * Returns true for tenant_admin, super_admin, or legacy 'admin' role
 */
function isAdminLike(user) {
    if (!user)
        return false;
    return user.platformRole === 'tenant_admin' || user.platformRole === 'super_admin';
}
/**
 * Helper function to get effective role for permission checks
 * Returns tenantRole if present, otherwise platformRole, otherwise 'admin' as fallback
 */
function getEffectiveRole(user) {
    if (!user)
        return 'admin';
    return user.tenantRole || user.platformRole || 'admin';
}
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
        // Get user metadata
        const salonId = user.user_metadata?.salonId || null;
        const platformRole = user.user_metadata?.platformRole;
        const role = user.user_metadata?.role;
        // Find user in our database
        let dbUser;
        // Check for x-salon-id header for context switching (Super Admin only)
        const contextSalonId = req.headers['x-salon-id'];
        if (platformRole === 'super_admin') {
            // SuperAdmin doesn't need salonId by default, but can impersonate/context switch
            dbUser = await prismaClient_1.prisma.user.findFirst({
                where: {
                    email: user.email,
                    platformRole: 'super_admin',
                },
                select: {
                    id: true,
                    salonId: true,
                    platformRole: true,
                    tenantRole: true,
                },
            });
            // If context switching is requested
            if (dbUser && contextSalonId) {
                // Verify if salon exists (optional but recommended)
                const salonExists = await prismaClient_1.prisma.salon.findUnique({
                    where: { id: contextSalonId }
                });
                if (salonExists) {
                    // Override salonId for this request context
                    dbUser.salonId = contextSalonId;
                }
            }
        }
        else {
            // Tenant Admin and Tenant Users need salonId
            if (!salonId) {
                res.status(401).json({ error: 'Usuário não possui salonId configurado' });
                return;
            }
            dbUser = await prismaClient_1.prisma.user.findFirst({
                where: {
                    email: user.email,
                    salonId: salonId,
                },
                select: {
                    id: true,
                    salonId: true,
                    platformRole: true,
                    tenantRole: true,
                },
            });
        }
        if (!dbUser) {
            res.status(401).json({ error: 'Usuário não encontrado no banco de dados' });
            return;
        }
        // Derive role for backward compatibility
        // tenant_admin and super_admin should be treated as 'admin' for legacy code
        const derivedRole = dbUser.tenantRole ||
            (dbUser.platformRole === 'tenant_admin' ? 'admin' :
                dbUser.platformRole === 'super_admin' ? 'super_admin' :
                    dbUser.platformRole || 'admin');
        req.user = {
            userId: dbUser.id,
            salonId: dbUser.salonId,
            platformRole: dbUser.platformRole,
            tenantRole: dbUser.tenantRole,
            role: derivedRole, // Legacy compatibility field
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
