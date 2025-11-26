"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
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
            where: { salonId, isActive: true },
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
        const client = await prismaClient_1.prisma.client.create({
            data: {
                salonId,
                name: sanitizedName,
                phone: sanitizedPhone,
                email: sanitizedEmail,
            },
        });
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
            data.phone = (0, validation_1.sanitizePhone)(phone);
        }
        if (email !== undefined) {
            if (email && !(0, validation_1.validateEmail)(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
            data.email = email ? (0, validation_1.sanitizeString)(email) : null;
        }
        if (lastVisit !== undefined) {
            data.lastVisit = lastVisit ? new Date(lastVisit) : null;
        }
        const updated = await prismaClient_1.prisma.client.update({
            where: { id: existing.id },
            data,
        });
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
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.client.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }
        await prismaClient_1.prisma.client.update({
            where: { id: existing.id },
            data: { isActive: false },
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting client:', error instanceof Error ? error.message : 'Unknown error');
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
