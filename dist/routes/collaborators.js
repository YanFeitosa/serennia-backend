"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collaboratorsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
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
        commissionRate: Number(c.commissionRate),
        serviceCategories: c.serviceCategories ?? [],
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
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
        const { name, role, status, phone, email, commissionRate, serviceCategories } = req.body;
        if (!name || !role) {
            res.status(400).json({ error: 'name and role are required' });
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
        const collaborator = await prismaClient_1.prisma.collaborator.create({
            data: {
                salonId,
                name: sanitizedName,
                role,
                status: status ?? 'active',
                phone: phone ? (0, validation_1.sanitizePhone)(phone) : null,
                email: email ? (0, validation_1.sanitizeString)(email) : null,
                commissionRate: commissionRate ?? 0,
                serviceCategories: serviceCategories ?? [],
            },
        });
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
        const { name, role, status, phone, email, commissionRate, serviceCategories } = req.body;
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.collaborator.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Collaborator not found' });
            return;
        }
        // If editing a professional (role === 'professional'), check permission
        if (existing.role === 'professional' && req.user.role !== 'admin' && req.user.role !== 'manager') {
            // Check if user has permission to edit professional profiles
            // This would ideally check against the permissions system, but for now we'll restrict to admin/manager
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
            data.phone = phone ? (0, validation_1.sanitizePhone)(phone) : null;
        }
        if (email !== undefined) {
            if (email && !(0, validation_1.validateEmail)(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
            data.email = email ? (0, validation_1.sanitizeString)(email) : null;
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
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.collaborator.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Collaborator not found' });
            return;
        }
        await prismaClient_1.prisma.collaborator.update({
            where: { id: existing.id },
            data: { status: 'inactive' },
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting collaborator', error);
        res.status(500).json({ error: 'Failed to delete collaborator' });
    }
});
