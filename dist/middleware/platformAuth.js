"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOrSuperAdminMiddleware = exports.tenantAdminMiddleware = exports.superAdminMiddleware = void 0;
/**
 * Middleware to check if user is SuperAdmin
 * Allows access to all salons (cross-tenant operations)
 */
const superAdminMiddleware = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
    }
    if (req.user.platformRole !== 'super_admin') {
        res.status(403).json({ error: 'Acesso negado. Apenas SuperAdmin pode realizar esta ação.' });
        return;
    }
    next();
};
exports.superAdminMiddleware = superAdminMiddleware;
/**
 * Middleware to check if user is Tenant Admin
 */
const tenantAdminMiddleware = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
    }
    if (req.user.platformRole !== 'tenant_admin') {
        res.status(403).json({ error: 'Acesso negado. Apenas Tenant Admin pode realizar esta ação.' });
        return;
    }
    next();
};
exports.tenantAdminMiddleware = tenantAdminMiddleware;
/**
 * Middleware to check if user is Tenant Admin or SuperAdmin
 */
const adminOrSuperAdminMiddleware = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Não autenticado' });
        return;
    }
    if (req.user.platformRole !== 'super_admin' && req.user.platformRole !== 'tenant_admin') {
        res.status(403).json({ error: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
        return;
    }
    next();
};
exports.adminOrSuperAdminMiddleware = adminOrSuperAdminMiddleware;
