"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAuthMiddleware = void 0;
exports.isAdminLike = isAdminLike;
exports.getEffectiveRole = getEffectiveRole;
exports.hasPermission = hasPermission;
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
/**
 * Check if user has a specific permission based on role and salon settings
 * @param user - The authenticated user
 * @param permission - The permission key to check
 * @param rolePermissions - Optional custom role permissions from salon settings
 */
async function hasPermission(user, permission, rolePermissions) {
    if (!user)
        return false;
    // Super admin and tenant_admin have all permissions
    if (isAdminLike(user))
        return true;
    const effectiveRole = getEffectiveRole(user);
    // If custom role permissions provided, use them
    if (rolePermissions && rolePermissions[effectiveRole]) {
        return rolePermissions[effectiveRole].includes(permission);
    }
    // Otherwise, fetch from salon settings
    if (user.salonId) {
        const salon = await prismaClient_1.prisma.salon.findUnique({
            where: { id: user.salonId },
            select: { rolePermissions: true }
        });
        const perms = salon?.rolePermissions;
        if (perms && perms[effectiveRole]) {
            return perms[effectiveRole].includes(permission);
        }
    }
    // Default permissions by role
    const defaultPermissions = {
        manager: [
            'servicos', 'produtos', 'colaboradores', 'financeiro', 'configuracoes', 'auditoria',
            'podeDeletarCliente', 'podeDeletarColaborador', 'podeDeletarProduto', 'podeDeletarServico'
        ],
        receptionist: ['agenda', 'comandas', 'clientes', 'servicos', 'produtos', 'colaboradores', 'notificacoes'],
        professional: ['agenda', 'comandas', 'clientes', 'notificacoes'],
        accountant: ['financeiro'],
    };
    return defaultPermissions[effectiveRole]?.includes(permission) ?? false;
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
        const metadataSalonId = user.user_metadata?.salonId || null;
        const metadataPlatformRole = user.user_metadata?.platformRole;
        // Find user in database to get their actual platformRole and salonId
        // This is more reliable than metadata which might be out of sync
        const dbUser = await prismaClient_1.prisma.user.findFirst({
            where: {
                email: user.email,
            },
            select: {
                id: true,
                salonId: true,
                platformRole: true,
                tenantRole: true,
            },
        });
        if (!dbUser) {
            res.status(401).json({ error: 'Usuário não encontrado no banco de dados' });
            return;
        }
        // Use database as source of truth
        const platformRole = dbUser.platformRole || metadataPlatformRole;
        const effectiveSalonId = dbUser.salonId || metadataSalonId;
        // Non-super_admin users must have a salonId
        if (platformRole !== 'super_admin' && !effectiveSalonId) {
            res.status(401).json({ error: 'Usuário não possui salonId configurado' });
            return;
        }
        // Derive role for backward compatibility
        // tenant_admin and super_admin should be treated as 'admin' for legacy code
        const derivedRole = dbUser.tenantRole ||
            (platformRole === 'tenant_admin' ? 'admin' :
                platformRole === 'super_admin' ? 'super_admin' :
                    platformRole || 'admin');
        req.user = {
            userId: dbUser.id,
            salonId: effectiveSalonId,
            platformRole: platformRole,
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
