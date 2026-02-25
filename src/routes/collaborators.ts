import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { isAdminLike, hasPermission } from '../middleware/supabaseAuth';
import { UserRole, CollaboratorStatus } from '../types/enums';
import { sanitizeString, validateEmail, validatePhone, sanitizePhone } from '../utils/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { supabaseAdmin } from '../lib/supabase';
import { sendCollaboratorInviteEmail } from '../lib/email';
import { AuditService } from '../services/audit';

function mapCollaborator(c: any) {
  return {
    id: c.id,
    salonId: c.salonId,
    userId: c.userId ?? undefined,
    name: c.name,
    role: c.role,
    status: c.status,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    cpf: c.cpf ?? undefined,
    avatarUrl: c.avatarUrl ?? undefined,
    commissionRate: Number(c.commissionRate),
    commissionMode: c.commissionMode ?? null, // null = usa padrão do salon
    serviceCategories: c.serviceCategories ?? [],
    // Banking info
    pixKey: c.pixKey ?? undefined,
    pixKeyType: c.pixKeyType ?? undefined,
    bankName: c.bankName ?? undefined,
    bankAgency: c.bankAgency ?? undefined,
    bankAccount: c.bankAccount ?? undefined,
    bankAccountType: c.bankAccountType ?? undefined,
    // Address
    address: c.address ?? undefined,
    addressNumber: c.addressNumber ?? undefined,
    addressComplement: c.addressComplement ?? undefined,
    addressNeighborhood: c.addressNeighborhood ?? undefined,
    addressCity: c.addressCity ?? undefined,
    addressState: c.addressState ?? undefined,
    addressZipCode: c.addressZipCode ?? undefined,
    // Dates
    hireDate: c.hireDate ? c.hireDate.toISOString() : undefined,
    birthDate: c.birthDate ? c.birthDate.toISOString() : undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// CPF validation helper
function validateCPF(cpf: string): boolean {
  // Remove non-digits
  const cleaned = cpf.replace(/\D/g, '');
  
  // Must have 11 digits
  if (cleaned.length !== 11) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Validate check digits
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;
  
  return true;
}

// Generate default password: firstName (lowercase) + last 4 digits of CPF
function generateDefaultPassword(name: string, cpf: string): string {
  const firstName = name.split(' ')[0].toLowerCase();
  const cleanedCPF = cpf.replace(/\D/g, '');
  const lastFourDigits = cleanedCPF.slice(-4);
  return `${firstName}${lastFourDigits}`;
}

const collaboratorsRouter = Router();

collaboratorsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const collaborators = await prisma.collaborator.findMany({
      where: { salonId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    res.json(collaborators.map(mapCollaborator));
  } catch (error) {
    console.error('Error listing collaborators', error);
    res.status(500).json({ error: 'Failed to list collaborators' });
  }
});

collaboratorsRouter.post('/', createRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { 
      name, role, status, phone, email, cpf, commissionRate, serviceCategories, avatarUrl,
      commissionMode, pixKey, pixKeyType, bankName, bankAgency, bankAccount, bankAccountType,
      address, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, addressZipCode,
      hireDate, birthDate
    } =
      req.body as {
        name?: string;
        role?: UserRole;
        status?: CollaboratorStatus;
        phone?: string;
        email?: string;
        cpf?: string;
        commissionRate?: number;
        serviceCategories?: string[];
        avatarUrl?: string;
        commissionMode?: 'service' | 'professional' | null;
        pixKey?: string;
        pixKeyType?: string;
        bankName?: string;
        bankAgency?: string;
        bankAccount?: string;
        bankAccountType?: string;
        address?: string;
        addressNumber?: string;
        addressComplement?: string;
        addressNeighborhood?: string;
        addressCity?: string;
        addressState?: string;
        addressZipCode?: string;
        hireDate?: string;
        birthDate?: string;
      };

    if (!name || !role) {
      res.status(400).json({ error: 'name and role are required' });
      return;
    }

    // CPF is required
    if (!cpf) {
      res.status(400).json({ error: 'cpf is required' });
      return;
    }

    // Validate CPF format
    if (!validateCPF(cpf)) {
      res.status(400).json({ error: 'Invalid CPF format' });
      return;
    }

    // Validate and sanitize input
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      res.status(400).json({ error: 'name must be at least 2 characters long' });
      return;
    }

    if (phone && !validatePhone(phone)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }

    if (email && !validateEmail(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    const salonId = req.user.salonId;

    // Check if phone already exists in salon (if provided)
    if (phone) {
      const existingByPhone = await prisma.collaborator.findFirst({
        where: { salonId, phone: sanitizePhone(phone), deletedAt: null },
      });
      if (existingByPhone) {
        res.status(409).json({ error: 'Já existe um colaborador com este telefone' });
        return;
      }
    }

    // Check if email already exists in salon (if provided)
    if (email) {
      const existingByEmail = await prisma.collaborator.findFirst({
        where: { salonId, email: sanitizeString(email).toLowerCase(), deletedAt: null },
      });
      if (existingByEmail) {
        res.status(409).json({ error: 'Já existe um colaborador com este email' });
        return;
      }
    }

    // Check if CPF already exists in salon
    const cleanedCPFCheck = cpf.replace(/\D/g, '');
    const existingByCPF = await prisma.collaborator.findFirst({
      where: { salonId, cpf: cleanedCPFCheck, deletedAt: null },
    });
    if (existingByCPF) {
      res.status(409).json({ error: 'Já existe um colaborador com este CPF' });
      return;
    }

    // Get salon name for email
    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
      select: { name: true },
    });
    const salonName = salon?.name || 'o salão';

    let userId: string | null = null;

    // Clean CPF for storage
    const cleanedCPF = cpf.replace(/\D/g, '');

    // If email is provided, create user in Supabase and User table
    if (email) {
      try {
        // Generate default password: firstName (lowercase) + last 4 digits of CPF
        const defaultPassword = generateDefaultPassword(sanitizedName, cleanedCPF);

        // Create user in Supabase Auth with email confirmation required
        // User must confirm email to activate their account
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: sanitizeString(email).toLowerCase(),
          password: defaultPassword,
          email_confirm: false, // User must confirm email before logging in
          user_metadata: {
            salonId: salonId,
            tenantRole: role,
            name: sanitizedName,
            phone: phone ? sanitizePhone(phone) : null,
            role: role, // Legacy field
          },
        });

        if (authError) {
          console.error('Error creating user in Supabase:', authError);
          // Continue without creating user if Supabase fails
        } else if (authData?.user) {
          userId = authData.user.id;

          // Create User record in database
          try {
            await prisma.user.create({
              data: {
                id: userId,
                salonId,
                name: sanitizedName,
                email: sanitizeString(email).toLowerCase(),
                phone: phone ? sanitizePhone(phone) : null,
                tenantRole: role,
                passwordHash: null, // Not used with Supabase
              },
            });

            // Send invite email with confirmation link via Resend
            try {
              const frontendUrl = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/+$/, '');
              let confirmLink: string | undefined;

              // Generate email confirmation link via Supabase Admin API
              // Type 'signup' generates the correct confirmation link for unconfirmed users
              const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'signup',
                email: sanitizeString(email).toLowerCase(),
                password: defaultPassword,
                options: {
                  redirectTo: `${frontendUrl}/auth/callback`,
                },
              });

              if (linkError) {
                console.warn('⚠️ Failed to generate signup confirmation link:', linkError.message);
              } else if (linkData?.properties?.action_link) {
                confirmLink = linkData.properties.action_link;
                console.log('✅ Confirmation link generated successfully');
              }

              // Always send the invite email (with or without confirmation link)
              console.log('📧 Sending collaborator invite email to:', sanitizeString(email).toLowerCase());
              await sendCollaboratorInviteEmail(
                sanitizeString(email).toLowerCase(),
                sanitizedName,
                salonName,
                confirmLink,
                defaultPassword
              );
              console.log('✅ Collaborator invite email sent successfully');
            } catch (emailError) {
              console.error('❌ Error sending invite email:', emailError);
              // Don't fail collaborator creation if email fails
            }
          } catch (userError: any) {
            console.error('Error creating User record:', userError);
            // If User creation fails, try to clean up Supabase user
            if (userId) {
              try {
                await supabaseAdmin.auth.admin.deleteUser(userId);
              } catch (cleanupError) {
                console.error('Error cleaning up Supabase user:', cleanupError);
              }
            }
            // Continue without user if creation fails
            userId = null;
          }
        }
      } catch (error) {
        console.error('Error creating user for collaborator:', error);
        // Continue without user if there's an error
      }
    }

    // Collaborators start as inactive by default until manually activated
    const collaboratorStatus: CollaboratorStatus = status ?? 'inactive';

    const collaborator = await prisma.collaborator.create({
      data: {
        salonId,
        userId: userId,
        name: sanitizedName,
        role,
        status: collaboratorStatus,
        phone: phone ? sanitizePhone(phone) : null,
        email: email ? sanitizeString(email) : null,
        cpf: cleanedCPF,
        avatarUrl: avatarUrl ? sanitizeString(avatarUrl) : null,
        commissionRate: commissionRate ?? 0,
        commissionMode: commissionMode ?? null, // null = usa padrão do salon
        serviceCategories: serviceCategories ?? [],
        // Banking info
        pixKey: pixKey ? sanitizeString(pixKey) : null,
        pixKeyType: pixKeyType ? sanitizeString(pixKeyType) : null,
        bankName: bankName ? sanitizeString(bankName) : null,
        bankAgency: bankAgency ? sanitizeString(bankAgency) : null,
        bankAccount: bankAccount ? sanitizeString(bankAccount) : null,
        bankAccountType: bankAccountType ? sanitizeString(bankAccountType) : null,
        // Address
        address: address ? sanitizeString(address) : null,
        addressNumber: addressNumber ? sanitizeString(addressNumber) : null,
        addressComplement: addressComplement ? sanitizeString(addressComplement) : null,
        addressNeighborhood: addressNeighborhood ? sanitizeString(addressNeighborhood) : null,
        addressCity: addressCity ? sanitizeString(addressCity) : null,
        addressState: addressState ? sanitizeString(addressState) : null,
        addressZipCode: addressZipCode ? sanitizeString(addressZipCode).replace(/\D/g, '') : null,
        // Dates
        hireDate: hireDate ? new Date(hireDate) : null,
        birthDate: birthDate ? new Date(birthDate) : null,
      },
    });

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logCreate(
      salonId,
      req.user.userId,
      'collaborators',
      collaborator.id,
      { name: collaborator.name, role: collaborator.role, email: collaborator.email, phone: collaborator.phone },
      ipAddress,
      userAgent
    );

    res.status(201).json(mapCollaborator(collaborator));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res
        .status(409)
        .json({ error: 'Collaborator with this phone or email already exists' });
      return;
    }
    console.error('Error creating collaborator', error);
    res.status(500).json({ error: 'Failed to create collaborator' });
  }
});

collaboratorsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const collaborator = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!collaborator) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    res.json(mapCollaborator(collaborator));
  } catch (error) {
    console.error('Error fetching collaborator', error);
    res.status(500).json({ error: 'Failed to fetch collaborator' });
  }
});

collaboratorsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { 
      name, role, status, phone, email, cpf, avatarUrl, commissionRate, serviceCategories,
      commissionMode, pixKey, pixKeyType, bankName, bankAgency, bankAccount, bankAccountType,
      address, addressNumber, addressComplement, addressNeighborhood, addressCity, addressState, addressZipCode,
      hireDate, birthDate
    } =
      req.body as {
        name?: string;
        role?: UserRole;
        status?: CollaboratorStatus;
        phone?: string;
        email?: string;
        cpf?: string;
        avatarUrl?: string;
        commissionRate?: number;
        serviceCategories?: string[];
        commissionMode?: 'service' | 'professional' | null;
        pixKey?: string;
        pixKeyType?: string;
        bankName?: string;
        bankAgency?: string;
        bankAccount?: string;
        bankAccountType?: string;
        address?: string;
        addressNumber?: string;
        addressComplement?: string;
        addressNeighborhood?: string;
        addressCity?: string;
        addressState?: string;
        addressZipCode?: string;
        hireDate?: string;
        birthDate?: string;
      };

    const salonId = req.user.salonId;

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    // If editing a professional (role === 'professional'), check permission
    // Only tenant_admin, super_admin (admin-like) or manager can edit professional profiles
    const canEdit = isAdminLike(req.user) || req.user?.tenantRole === 'manager';
    if (existing.role === 'professional' && !canEdit) {
      // Check if user has permission to edit professional profiles
      res.status(403).json({ error: 'Only administrators and managers can edit professional profiles' });
      return;
    }

    const data: any = {};
    if (name !== undefined) {
      const sanitizedName = sanitizeString(name);
      if (sanitizedName.length < 2) {
        res.status(400).json({ error: 'name must be at least 2 characters long' });
        return;
      }
      data.name = sanitizedName;
    }
    if (role !== undefined) data.role = role;
    if (status !== undefined) data.status = status;
    if (phone !== undefined) {
      if (phone && !validatePhone(phone)) {
        res.status(400).json({ error: 'Invalid phone number format' });
        return;
      }
      const sanitizedPhone = phone ? sanitizePhone(phone) : null;
      // Check if phone already exists for another collaborator in salon
      if (sanitizedPhone) {
        const existingByPhone = await prisma.collaborator.findFirst({
          where: { salonId, phone: sanitizedPhone, deletedAt: null, id: { not: existing.id } },
        });
        if (existingByPhone) {
          res.status(409).json({ error: 'Já existe um colaborador com este telefone' });
          return;
        }
      }
      data.phone = sanitizedPhone;
    }
    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      const sanitizedEmail = email ? sanitizeString(email).toLowerCase() : null;
      // Check if email already exists for another collaborator in salon
      if (sanitizedEmail) {
        const existingByEmail = await prisma.collaborator.findFirst({
          where: { salonId, email: sanitizedEmail, deletedAt: null, id: { not: existing.id } },
        });
        if (existingByEmail) {
          res.status(409).json({ error: 'Já existe um colaborador com este email' });
          return;
        }
      }
      data.email = sanitizedEmail;
    }
    if (cpf !== undefined) {
      if (cpf && !validateCPF(cpf)) {
        res.status(400).json({ error: 'Invalid CPF format' });
        return;
      }
      const cleanedCPF = cpf ? cpf.replace(/\D/g, '') : null;
      // Check if CPF already exists for another collaborator in salon
      if (cleanedCPF) {
        const existingByCPF = await prisma.collaborator.findFirst({
          where: { salonId, cpf: cleanedCPF, deletedAt: null, id: { not: existing.id } },
        });
        if (existingByCPF) {
          res.status(409).json({ error: 'Já existe um colaborador com este CPF' });
          return;
        }
      }
      data.cpf = cleanedCPF;
    }
    if (avatarUrl !== undefined) {
      data.avatarUrl = avatarUrl ? sanitizeString(avatarUrl) : null;
    }
    if (commissionRate !== undefined) {
      if (commissionRate < 0 || commissionRate > 1) {
        res.status(400).json({ error: 'commissionRate must be between 0 and 1' });
        return;
      }
      data.commissionRate = commissionRate;
    }
    if (serviceCategories !== undefined) data.serviceCategories = serviceCategories;
    if (commissionMode !== undefined) data.commissionMode = commissionMode;
    
    // Banking info
    if (pixKey !== undefined) data.pixKey = pixKey ? sanitizeString(pixKey) : null;
    if (pixKeyType !== undefined) data.pixKeyType = pixKeyType ? sanitizeString(pixKeyType) : null;
    if (bankName !== undefined) data.bankName = bankName ? sanitizeString(bankName) : null;
    if (bankAgency !== undefined) data.bankAgency = bankAgency ? sanitizeString(bankAgency) : null;
    if (bankAccount !== undefined) data.bankAccount = bankAccount ? sanitizeString(bankAccount) : null;
    if (bankAccountType !== undefined) data.bankAccountType = bankAccountType ? sanitizeString(bankAccountType) : null;
    
    // Address
    if (address !== undefined) data.address = address ? sanitizeString(address) : null;
    if (addressNumber !== undefined) data.addressNumber = addressNumber ? sanitizeString(addressNumber) : null;
    if (addressComplement !== undefined) data.addressComplement = addressComplement ? sanitizeString(addressComplement) : null;
    if (addressNeighborhood !== undefined) data.addressNeighborhood = addressNeighborhood ? sanitizeString(addressNeighborhood) : null;
    if (addressCity !== undefined) data.addressCity = addressCity ? sanitizeString(addressCity) : null;
    if (addressState !== undefined) data.addressState = addressState ? sanitizeString(addressState) : null;
    if (addressZipCode !== undefined) data.addressZipCode = addressZipCode ? sanitizeString(addressZipCode).replace(/\D/g, '') : null;
    
    // Dates
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;
    if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;

    const updated = await prisma.collaborator.update({
      where: { id: existing.id },
      data,
    });

    // Se o role foi alterado e o colaborador tem um userId, atualizar também na tabela User e no Supabase Auth
    if (role !== undefined && role !== existing.role && existing.userId) {
      try {
        // Atualiza a tabela User
        await prisma.user.update({
          where: { id: existing.userId },
          data: { tenantRole: role },
        });

        // Atualiza user_metadata no Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(existing.userId, {
          user_metadata: { 
            tenantRole: role,
            role: role,
          },
        });
      } catch (userUpdateError) {
        console.error('Error updating user role in User table or Supabase Auth', userUpdateError);
        // Não falha a requisição principal, mas loga o erro
      }
    }

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logUpdate(
      salonId,
      req.user.userId,
      'collaborators',
      updated.id,
      { name: existing.name, role: existing.role, status: existing.status, email: existing.email, phone: existing.phone, commissionRate: Number(existing.commissionRate) },
      { name: updated.name, role: updated.role, status: updated.status, email: updated.email, phone: updated.phone, commissionRate: Number(updated.commissionRate) },
      ipAddress,
      userAgent
    );

    res.json(mapCollaborator(updated));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res
        .status(409)
        .json({ error: 'Collaborator with this phone or email already exists' });
      return;
    }
    console.error('Error updating collaborator', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

collaboratorsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check permission to delete collaborators
    const canDelete = await hasPermission(req.user, 'podeDeletarColaborador');
    if (!canDelete) {
      res.status(403).json({ error: 'Você não tem permissão para excluir colaboradores' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    // Soft delete the collaborator
    await prisma.collaborator.update({
      where: { id: existing.id },
      data: { status: 'inactive', deletedAt: new Date() },
    });

    // If collaborator has a linked user, clean up User record and Supabase Auth
    if (existing.userId) {
      try {
        // Soft delete User record
        await prisma.user.update({
          where: { id: existing.userId },
          data: { deletedAt: new Date() },
        });

        // Delete from Supabase Auth (hard delete - user can no longer login)
        const { error: supabaseError } = await supabaseAdmin.auth.admin.deleteUser(existing.userId);
        if (supabaseError) {
          console.error('Error deleting user from Supabase Auth:', supabaseError);
          // Don't fail the request, collaborator is already soft-deleted
        } else {
          console.log(`✅ User ${existing.userId} removed from Supabase Auth`);
        }
      } catch (userCleanupError) {
        console.error('Error cleaning up user for deleted collaborator:', userCleanupError);
        // Don't fail - the collaborator soft delete already succeeded
      }
    }

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logDelete(
      salonId,
      req.user.userId,
      'collaborators',
      existing.id,
      { name: existing.name, role: existing.role, email: existing.email, phone: existing.phone },
      ipAddress,
      userAgent
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting collaborator', error);
    res.status(500).json({ error: 'Failed to delete collaborator' });
  }
});

export { collaboratorsRouter };
