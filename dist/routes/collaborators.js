"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collaboratorsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const supabaseAuth_1 = require("../middleware/supabaseAuth");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const supabase_1 = require("../lib/supabase");
const email_1 = require("../lib/email");
const audit_1 = require("../services/audit");
function mapCollaborator(c) {
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
        serviceCategories: c.serviceCategories ?? [],
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
}
// CPF validation helper
function validateCPF(cpf) {
    // Remove non-digits
    const cleaned = cpf.replace(/\D/g, '');
    // Must have 11 digits
    if (cleaned.length !== 11)
        return false;
    // Check for known invalid patterns
    if (/^(\d)\1{10}$/.test(cleaned))
        return false;
    // Validate check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11)
        remainder = 0;
    if (remainder !== parseInt(cleaned.charAt(9)))
        return false;
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11)
        remainder = 0;
    if (remainder !== parseInt(cleaned.charAt(10)))
        return false;
    return true;
}
// Generate default password: firstName (lowercase) + last 4 digits of CPF
function generateDefaultPassword(name, cpf) {
    const firstName = name.split(' ')[0].toLowerCase();
    const cleanedCPF = cpf.replace(/\D/g, '');
    const lastFourDigits = cleanedCPF.slice(-4);
    return `${firstName}${lastFourDigits}`;
}
const collaboratorsRouter = (0, express_1.Router)();
exports.collaboratorsRouter = collaboratorsRouter;
collaboratorsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const collaborators = await prismaClient_1.prisma.collaborator.findMany({
            where: { salonId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(collaborators.map(mapCollaborator));
    }
    catch (error) {
        console.error('Error listing collaborators', error);
        res.status(500).json({ error: 'Failed to list collaborators' });
    }
});
collaboratorsRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, role, status, phone, email, cpf, commissionRate, serviceCategories, avatarUrl } = req.body;
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
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (!sanitizedName || sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        if (phone && !(0, validation_1.validatePhone)(phone)) {
            res.status(400).json({ error: 'Invalid phone number format' });
            return;
        }
        if (email && !(0, validation_1.validateEmail)(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }
        const salonId = req.user.salonId;
        // Check if phone already exists in salon (if provided)
        if (phone) {
            const existingByPhone = await prismaClient_1.prisma.collaborator.findFirst({
                where: { salonId, phone: (0, validation_1.sanitizePhone)(phone), deletedAt: null },
            });
            if (existingByPhone) {
                res.status(409).json({ error: 'Já existe um colaborador com este telefone' });
                return;
            }
        }
        // Check if email already exists in salon (if provided)
        if (email) {
            const existingByEmail = await prismaClient_1.prisma.collaborator.findFirst({
                where: { salonId, email: (0, validation_1.sanitizeString)(email).toLowerCase(), deletedAt: null },
            });
            if (existingByEmail) {
                res.status(409).json({ error: 'Já existe um colaborador com este email' });
                return;
            }
        }
        // Check if CPF already exists in salon
        const cleanedCPFCheck = cpf.replace(/\D/g, '');
        const existingByCPF = await prismaClient_1.prisma.collaborator.findFirst({
            where: { salonId, cpf: cleanedCPFCheck, deletedAt: null },
        });
        if (existingByCPF) {
            res.status(409).json({ error: 'Já existe um colaborador com este CPF' });
            return;
        }
        // Get salon name for email
        const salon = await prismaClient_1.prisma.salon.findUnique({
            where: { id: salonId },
            select: { name: true },
        });
        const salonName = salon?.name || 'o salão';
        let userId = null;
        // Clean CPF for storage
        const cleanedCPF = cpf.replace(/\D/g, '');
        // If email is provided, create user in Supabase and User table
        if (email) {
            try {
                // Generate default password: firstName (lowercase) + last 4 digits of CPF
                const defaultPassword = generateDefaultPassword(sanitizedName, cleanedCPF);
                // Create user in Supabase Auth
                const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
                    email: (0, validation_1.sanitizeString)(email).toLowerCase(),
                    password: defaultPassword,
                    email_confirm: false, // Require email confirmation
                    user_metadata: {
                        salonId: salonId,
                        tenantRole: role,
                        name: sanitizedName,
                        phone: phone ? (0, validation_1.sanitizePhone)(phone) : null,
                        role: role, // Legacy field
                    },
                });
                if (authError) {
                    console.error('Error creating user in Supabase:', authError);
                    // Continue without creating user if Supabase fails
                }
                else if (authData?.user) {
                    userId = authData.user.id;
                    // Create User record in database
                    try {
                        await prismaClient_1.prisma.user.create({
                            data: {
                                id: userId,
                                salonId,
                                name: sanitizedName,
                                email: (0, validation_1.sanitizeString)(email).toLowerCase(),
                                phone: phone ? (0, validation_1.sanitizePhone)(phone) : null,
                                tenantRole: role,
                                passwordHash: null, // Not used with Supabase
                            },
                        });
                        // Send welcome email with password reset link
                        try {
                            // Generate password reset link
                            const { data: resetData, error: resetError } = await supabase_1.supabaseAdmin.auth.admin.generateLink({
                                type: 'recovery',
                                email: (0, validation_1.sanitizeString)(email).toLowerCase(),
                            });
                            if (!resetError && resetData?.properties?.action_link) {
                                await (0, email_1.sendWelcomeEmail)((0, validation_1.sanitizeString)(email).toLowerCase(), sanitizedName, salonName, resetData.properties.action_link);
                            }
                            else {
                                // Fallback: send email with default password
                                await (0, email_1.sendWelcomeEmail)((0, validation_1.sanitizeString)(email).toLowerCase(), sanitizedName, salonName, undefined, defaultPassword);
                            }
                        }
                        catch (emailError) {
                            console.error('Error sending welcome email:', emailError);
                            // Don't fail collaborator creation if email fails
                        }
                    }
                    catch (userError) {
                        console.error('Error creating User record:', userError);
                        // If User creation fails, try to clean up Supabase user
                        if (userId) {
                            try {
                                await supabase_1.supabaseAdmin.auth.admin.deleteUser(userId);
                            }
                            catch (cleanupError) {
                                console.error('Error cleaning up Supabase user:', cleanupError);
                            }
                        }
                        // Continue without user if creation fails
                        userId = null;
                    }
                }
            }
            catch (error) {
                console.error('Error creating user for collaborator:', error);
                // Continue without user if there's an error
            }
        }
        const collaborator = await prismaClient_1.prisma.collaborator.create({
            data: {
                salonId,
                userId: userId,
                name: sanitizedName,
                role,
                status: status ?? 'active',
                phone: phone ? (0, validation_1.sanitizePhone)(phone) : null,
                email: email ? (0, validation_1.sanitizeString)(email) : null,
                cpf: cleanedCPF,
                avatarUrl: avatarUrl ? (0, validation_1.sanitizeString)(avatarUrl) : null,
                commissionRate: commissionRate ?? 0,
                serviceCategories: serviceCategories ?? [],
            },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logCreate(salonId, req.user.userId, 'collaborators', collaborator.id, { name: collaborator.name, role: collaborator.role, email: collaborator.email, phone: collaborator.phone }, ipAddress, userAgent);
        res.status(201).json(mapCollaborator(collaborator));
    }
    catch (error) {
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
collaboratorsRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const collaborator = await prismaClient_1.prisma.collaborator.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!collaborator) {
            res.status(404).json({ error: 'Collaborator not found' });
            return;
        }
        res.json(mapCollaborator(collaborator));
    }
    catch (error) {
        console.error('Error fetching collaborator', error);
        res.status(500).json({ error: 'Failed to fetch collaborator' });
    }
});
collaboratorsRouter.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, role, status, phone, email, cpf, avatarUrl, commissionRate, serviceCategories } = req.body;
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.collaborator.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Collaborator not found' });
            return;
        }
        // If editing a professional (role === 'professional'), check permission
        // Only tenant_admin, super_admin (admin-like) or manager can edit professional profiles
        const canEdit = (0, supabaseAuth_1.isAdminLike)(req.user) || req.user?.tenantRole === 'manager';
        if (existing.role === 'professional' && !canEdit) {
            // Check if user has permission to edit professional profiles
            res.status(403).json({ error: 'Only administrators and managers can edit professional profiles' });
            return;
        }
        const data = {};
        if (name !== undefined) {
            const sanitizedName = (0, validation_1.sanitizeString)(name);
            if (sanitizedName.length < 2) {
                res.status(400).json({ error: 'name must be at least 2 characters long' });
                return;
            }
            data.name = sanitizedName;
        }
        if (role !== undefined)
            data.role = role;
        if (status !== undefined)
            data.status = status;
        if (phone !== undefined) {
            if (phone && !(0, validation_1.validatePhone)(phone)) {
                res.status(400).json({ error: 'Invalid phone number format' });
                return;
            }
            const sanitizedPhone = phone ? (0, validation_1.sanitizePhone)(phone) : null;
            // Check if phone already exists for another collaborator in salon
            if (sanitizedPhone) {
                const existingByPhone = await prismaClient_1.prisma.collaborator.findFirst({
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
            if (email && !(0, validation_1.validateEmail)(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
            const sanitizedEmail = email ? (0, validation_1.sanitizeString)(email).toLowerCase() : null;
            // Check if email already exists for another collaborator in salon
            if (sanitizedEmail) {
                const existingByEmail = await prismaClient_1.prisma.collaborator.findFirst({
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
                const existingByCPF = await prismaClient_1.prisma.collaborator.findFirst({
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
            data.avatarUrl = avatarUrl ? (0, validation_1.sanitizeString)(avatarUrl) : null;
        }
        if (commissionRate !== undefined) {
            if (commissionRate < 0 || commissionRate > 1) {
                res.status(400).json({ error: 'commissionRate must be between 0 and 1' });
                return;
            }
            data.commissionRate = commissionRate;
        }
        if (serviceCategories !== undefined)
            data.serviceCategories = serviceCategories;
        const updated = await prismaClient_1.prisma.collaborator.update({
            where: { id: existing.id },
            data,
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logUpdate(salonId, req.user.userId, 'collaborators', updated.id, { name: existing.name, role: existing.role, status: existing.status, email: existing.email, phone: existing.phone, commissionRate: Number(existing.commissionRate) }, { name: updated.name, role: updated.role, status: updated.status, email: updated.email, phone: updated.phone, commissionRate: Number(updated.commissionRate) }, ipAddress, userAgent);
        res.json(mapCollaborator(updated));
    }
    catch (error) {
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
collaboratorsRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Check permission to delete collaborators
        const canDelete = await (0, supabaseAuth_1.hasPermission)(req.user, 'podeDeletarColaborador');
        if (!canDelete) {
            res.status(403).json({ error: 'Você não tem permissão para excluir colaboradores' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.collaborator.findFirst({
            where: { id: req.params.id, salonId, deletedAt: null },
        });
        if (!existing) {
            res.status(404).json({ error: 'Collaborator not found' });
            return;
        }
        await prismaClient_1.prisma.collaborator.update({
            where: { id: existing.id },
            data: { status: 'inactive', deletedAt: new Date() },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logDelete(salonId, req.user.userId, 'collaborators', existing.id, { name: existing.name, role: existing.role, email: existing.email, phone: existing.phone }, ipAddress, userAgent);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting collaborator', error);
        res.status(500).json({ error: 'Failed to delete collaborator' });
    }
});
