import { Request, Response, NextFunction } from 'express';
import { SupabaseAuthRequest } from './supabaseAuth';

/**
 * Middleware to check if user is SuperAdmin
 * Allows access to all salons (cross-tenant operations)
 */
export const superAdminMiddleware = (
  req: SupabaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
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

/**
 * Middleware to check if user is Tenant Admin
 */
export const tenantAdminMiddleware = (
  req: SupabaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
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

/**
 * Middleware to check if user is Tenant Admin or SuperAdmin
 */
export const adminOrSuperAdminMiddleware = (
  req: SupabaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
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

