import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../prismaClient';

export interface SupabaseAuthRequest extends Request {
  user?: {
    userId: string;
    salonId: string | null; // null for super_admin
    platformRole: 'super_admin' | 'tenant_admin' | null;
    tenantRole: 'manager' | 'receptionist' | 'professional' | null;
    role: string; // Legacy field: maps to tenantRole or platformRole for backward compatibility
    supabaseUserId: string;
  };
}

/**
 * Helper function to check if user has admin-like permissions
 * Returns true for tenant_admin, super_admin, or legacy 'admin' role
 */
export function isAdminLike(user: SupabaseAuthRequest['user']): boolean {
  if (!user) return false;
  return user.platformRole === 'tenant_admin' || user.platformRole === 'super_admin';
}

/**
 * Helper function to get effective role for permission checks
 * Returns tenantRole if present, otherwise platformRole, otherwise 'admin' as fallback
 */
export function getEffectiveRole(user: SupabaseAuthRequest['user']): string {
  if (!user) return 'admin';
  return user.tenantRole || user.platformRole || 'admin';
}

/**
 * Check if user has a specific permission based on role and salon settings
 * @param user - The authenticated user
 * @param permission - The permission key to check
 * @param rolePermissions - Optional custom role permissions from salon settings
 */
export async function hasPermission(
  user: SupabaseAuthRequest['user'],
  permission: string,
  rolePermissions?: Record<string, string[]> | null
): Promise<boolean> {
  if (!user) return false;
  
  // Super admin and tenant_admin have all permissions
  if (isAdminLike(user)) return true;
  
  const effectiveRole = getEffectiveRole(user);
  
  // If custom role permissions provided, use them
  if (rolePermissions && rolePermissions[effectiveRole]) {
    return rolePermissions[effectiveRole].includes(permission);
  }
  
  // Otherwise, fetch from salon settings
  if (user.salonId) {
    const salon = await prisma.salon.findUnique({
      where: { id: user.salonId },
      select: { rolePermissions: true }
    });
    
    const perms = salon?.rolePermissions as Record<string, string[]> | null;
    if (perms && perms[effectiveRole]) {
      return perms[effectiveRole].includes(permission);
    }
  }
  
  // Default permissions by role
  const defaultPermissions: Record<string, string[]> = {
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

export const supabaseAuthMiddleware = async (
  req: SupabaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Token inválido ou expirado' });
      return;
    }

    // Get user metadata
    const metadataSalonId = user.user_metadata?.salonId || null;
    const metadataPlatformRole = user.user_metadata?.platformRole as 'super_admin' | 'tenant_admin' | null;

    // Check for x-salon-id header for context switching (Super Admin only)
    const contextSalonId = req.headers['x-salon-id'] as string;

    // First, try to find user in database to get their actual platformRole
    // This is more reliable than metadata which might be out of sync
    let dbUser = await prisma.user.findFirst({
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

    // Debug log
    console.log('[Auth Debug]', {
      email: user.email,
      metadataPlatformRole,
      dbPlatformRole: dbUser?.platformRole,
      metadataSalonId,
      dbSalonId: dbUser?.salonId,
      contextSalonId,
    });

    if (!dbUser) {
      res.status(401).json({ error: 'Usuário não encontrado no banco de dados' });
      return;
    }

    // Use database platformRole as source of truth, fallback to metadata
    const platformRole = dbUser.platformRole || metadataPlatformRole;

    // Handle Super Admin context switching
    if (platformRole === 'super_admin') {
      // If context switching is requested via header
      if (contextSalonId) {
        const salonExists = await prisma.salon.findUnique({
          where: { id: contextSalonId }
        });

        if (salonExists) {
          // Override salonId for this request context
          dbUser = { ...dbUser, salonId: contextSalonId };
        }
      }
    } else {
      // Non-super_admin users must have a salonId
      const effectiveSalonId = dbUser.salonId || metadataSalonId;
      if (!effectiveSalonId) {
        res.status(401).json({ error: 'Usuário não possui salonId configurado' });
        return;
      }
      dbUser = { ...dbUser, salonId: effectiveSalonId };
    }

    // Derive role for backward compatibility
    // tenant_admin and super_admin should be treated as 'admin' for legacy code
    const derivedRole = dbUser.tenantRole || 
      (platformRole === 'tenant_admin' ? 'admin' : 
       platformRole === 'super_admin' ? 'super_admin' : 
       platformRole || 'admin');

    req.user = {
      userId: dbUser.id,
      salonId: dbUser.salonId,
      platformRole: platformRole,
      tenantRole: dbUser.tenantRole,
      role: derivedRole, // Legacy compatibility field
      supabaseUserId: user.id,
    };

    next();
  } catch (error) {
    console.error('Error in supabaseAuthMiddleware:', error);
    res.status(401).json({ error: 'Erro ao verificar token' });
  }
};


