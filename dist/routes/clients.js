"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const supabaseAuth_1 = require("../middleware/supabaseAuth");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const audit_1 = require("../services/audit");
function mapClient(c) {
    return {
        id: c.id,
        salonId: c.salonId,
        name: c.name,
        phone: c.phone,
        email: c.email ?? undefined,
        lastVisit: c.lastVisit ? c.lastVisit.toISOString() : undefined,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
}
const clientsRouter = (0, express_1.Router)();
exports.clientsRouter = clientsRouter;
clientsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const clients = await prismaClient_1.prisma.client.findMany({
            where: { salonId, isActive: true, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        res.json(clients.map(mapClient));
    }
    catch (error) {
        console.error('Error listing clients:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to list clients' });
    }
});
clientsRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, phone, email } = req.body;
        if (!name || !phone) {
            res.status(400).json({ error: 'name and phone are required' });
            return;
        }
        // Validate and sanitize input
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (!sanitizedName || sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        if (!(0, validation_1.validatePhone)(phone)) {
            res.status(400).json({ error: 'Invalid phone number format' });
            return;
        }
        const sanitizedPhone = (0, validation_1.sanitizePhone)(phone);
        let sanitizedEmail;
        if (email) {
            if (!(0, validation_1.validateEmail)(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
            sanitizedEmail = (0, validation_1.sanitizeString)(email);
        }
        const salonId = req.user.salonId;
        // Check if phone already exists in salon
        const existingByPhone = await prismaClient_1.prisma.client.findFirst({
            where: { salonId, phone: sanitizedPhone, deletedAt: null },
        });
        if (existingByPhone) {
            res.status(409).json({ error: 'Já existe um cliente com este telefone' });
            return;
        }
        // Check if email already exists in salon (if provided)
        if (sanitizedEmail) {
            const existingByEmail = await prismaClient_1.prisma.client.findFirst({
                where: { salonId, email: sanitizedEmail, deletedAt: null },
            });
            if (existingByEmail) {
                res.status(409).json({ error: 'Já existe um cliente com este email' });
                return;
            }
        }
        const client = await prismaClient_1.prisma.client.create({
            data: {
                salonId,
                name: sanitizedName,
                phone: sanitizedPhone,
                email: sanitizedEmail,
            },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logCreate(salonId, req.user.userId, 'clients', client.id, { name: client.name, phone: client.phone, email: client.email }, ipAddress, userAgent);
        res.status(201).json(mapClient(client));
    }
    catch (error) {
        if (error && error.code === 'P2002') {
            res.status(409).json({ error: 'Client with this phone or email already exists' });
            return;
        }
        console.error('Error creating client:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to create client' });
    }
});
clientsRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const client = await prismaClient_1.prisma.client.findFirst({
            where: { id: req.params.id, salonId, isActive: true },
        });
        if (!client) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }
        res.json(mapClient(client));
    }
    catch (error) {
        console.error('Error fetching client:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});
clientsRouter.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, phone, email, lastVisit } = req.body;
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.client.findFirst({
            where: { id: req.params.id, salonId, isActive: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Client not found' });
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
        if (phone !== undefined) {
            if (!(0, validation_1.validatePhone)(phone)) {
                res.status(400).json({ error: 'Invalid phone number format' });
                return;
            }
            const sanitizedPhone = (0, validation_1.sanitizePhone)(phone);
            // Check if phone already exists for another client in salon
            const existingByPhone = await prismaClient_1.prisma.client.findFirst({
                where: { salonId, phone: sanitizedPhone, deletedAt: null, id: { not: existing.id } },
            });
            if (existingByPhone) {
                res.status(409).json({ error: 'Já existe um cliente com este telefone' });
                return;
            }
            data.phone = sanitizedPhone;
        }
        if (email !== undefined) {
            if (email && !(0, validation_1.validateEmail)(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
            const sanitizedEmail = email ? (0, validation_1.sanitizeString)(email) : null;
            // Check if email already exists for another client in salon
            if (sanitizedEmail) {
                const existingByEmail = await prismaClient_1.prisma.client.findFirst({
                    where: { salonId, email: sanitizedEmail, deletedAt: null, id: { not: existing.id } },
                });
                if (existingByEmail) {
                    res.status(409).json({ error: 'Já existe um cliente com este email' });
                    return;
                }
            }
            data.email = sanitizedEmail;
        }
        if (lastVisit !== undefined) {
            data.lastVisit = lastVisit ? new Date(lastVisit) : null;
        }
        const updated = await prismaClient_1.prisma.client.update({
            where: { id: existing.id },
            data,
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logUpdate(salonId, req.user.userId, 'clients', updated.id, { name: existing.name, phone: existing.phone, email: existing.email, lastVisit: existing.lastVisit }, { name: updated.name, phone: updated.phone, email: updated.email, lastVisit: updated.lastVisit }, ipAddress, userAgent);
        res.json(mapClient(updated));
    }
    catch (error) {
        if (error && error.code === 'P2002') {
            res.status(409).json({ error: 'Client with this phone or email already exists' });
            return;
        }
        console.error('Error updating client:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to update client' });
    }
});
clientsRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Check permission to delete clients
        const canDelete = await (0, supabaseAuth_1.hasPermission)(req.user, 'podeDeletarCliente');
        if (!canDelete) {
            res.status(403).json({ error: 'Você não tem permissão para excluir clientes' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.client.findFirst({
            where: { id: req.params.id, salonId, deletedAt: null },
        });
        if (!existing) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }
        await prismaClient_1.prisma.client.update({
            where: { id: existing.id },
            data: { isActive: false, deletedAt: new Date() },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logDelete(salonId, req.user.userId, 'clients', existing.id, { name: existing.name, phone: existing.phone, email: existing.email }, ipAddress, userAgent);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting client:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
