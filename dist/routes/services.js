"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const supabaseAuth_1 = require("../middleware/supabaseAuth");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
const audit_1 = require("../services/audit");
function mapService(s) {
    return {
        id: s.id,
        salonId: s.salonId,
        name: s.name,
        category: s.category ? s.category.name : undefined,
        description: s.description ?? undefined,
        duration: s.duration,
        price: Number(s.price),
        commission: s.commission != null ? Number(s.commission) : undefined,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
    };
}
const servicesRouter = (0, express_1.Router)();
exports.servicesRouter = servicesRouter;
servicesRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const services = await prismaClient_1.prisma.service.findMany({
            where: { salonId, isActive: true, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { category: true },
        });
        res.json(services.map(mapService));
    }
    catch (error) {
        console.error('Error listing services', error);
        res.status(500).json({ error: 'Failed to list services' });
    }
});
servicesRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const service = await prismaClient_1.prisma.service.findFirst({
            where: { id: req.params.id, salonId, isActive: true, deletedAt: null },
            include: { category: true },
        });
        if (!service) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }
        res.json(mapService(service));
    }
    catch (error) {
        console.error('Error fetching service', error);
        res.status(500).json({ error: 'Failed to fetch service' });
    }
});
servicesRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, category, description, duration, price, commission, isActive, } = req.body;
        if (!name || duration == null || price == null) {
            res
                .status(400)
                .json({ error: 'name, duration and price are required' });
            return;
        }
        if (!category) {
            res.status(400).json({ error: 'category is required' });
            return;
        }
        // Validate and sanitize input
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        if (duration <= 0) {
            res.status(400).json({ error: 'duration must be greater than 0' });
            return;
        }
        if (price < 0) {
            res.status(400).json({ error: 'price must be non-negative' });
            return;
        }
        const sanitizedCategory = (0, validation_1.sanitizeString)(category);
        const sanitizedDescription = description ? (0, validation_1.sanitizeString)(description) : null;
        const salonId = req.user.salonId;
        let categoryRecord = await prismaClient_1.prisma.category.findFirst({
            where: { salonId, type: 'service', name: category },
        });
        if (!categoryRecord) {
            try {
                categoryRecord = await prismaClient_1.prisma.category.create({
                    data: {
                        salonId,
                        type: 'service',
                        name: category,
                    },
                });
            }
            catch (error) {
                if (error && error.code === 'P2002') {
                    categoryRecord = await prismaClient_1.prisma.category.findFirst({
                        where: { salonId, type: 'service', name: category },
                    });
                }
                else {
                    throw error;
                }
            }
        }
        const service = await prismaClient_1.prisma.service.create({
            data: {
                salonId,
                name: sanitizedName,
                categoryId: categoryRecord?.id,
                description: sanitizedDescription,
                duration,
                price,
                commission: commission != null && commission >= 0 ? commission : null,
                isActive: isActive ?? true,
            },
            include: { category: true },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logCreate(salonId, req.user.userId, 'services', service.id, { name: service.name, category: service.category?.name, price: Number(service.price), duration: service.duration }, ipAddress, userAgent);
        res.status(201).json(mapService(service));
    }
    catch (error) {
        console.error('Error creating service', error);
        res.status(500).json({ error: 'Failed to create service' });
    }
});
servicesRouter.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, category, description, duration, price, commission, bufferTime, isActive, } = req.body;
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.service.findFirst({
            where: { id: req.params.id, salonId, isActive: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Service not found' });
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
        if (description !== undefined) {
            data.description = description ? (0, validation_1.sanitizeString)(description) : null;
        }
        if (duration !== undefined) {
            if (duration <= 0) {
                res.status(400).json({ error: 'duration must be greater than 0' });
                return;
            }
            data.duration = duration;
        }
        if (price !== undefined) {
            if (price < 0) {
                res.status(400).json({ error: 'price must be non-negative' });
                return;
            }
            data.price = price;
        }
        if (commission !== undefined) {
            if (commission != null && (commission < 0 || commission > 1)) {
                res.status(400).json({ error: 'commission must be between 0 and 1' });
                return;
            }
            data.commission = commission;
        }
        if (isActive !== undefined)
            data.isActive = isActive;
        if (category !== undefined) {
            if (!category) {
                data.categoryId = null;
            }
            else {
                let categoryRecord = await prismaClient_1.prisma.category.findFirst({
                    where: { salonId, type: 'service', name: category },
                });
                if (!categoryRecord) {
                    try {
                        categoryRecord = await prismaClient_1.prisma.category.create({
                            data: {
                                salonId,
                                type: 'service',
                                name: category,
                            },
                        });
                    }
                    catch (error) {
                        if (error && error.code === 'P2002') {
                            categoryRecord = await prismaClient_1.prisma.category.findFirst({
                                where: { salonId, type: 'service', name: category },
                            });
                        }
                        else {
                            throw error;
                        }
                    }
                }
                data.categoryId = categoryRecord?.id;
            }
        }
        const updated = await prismaClient_1.prisma.service.update({
            where: { id: existing.id },
            data,
            include: { category: true },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logUpdate(salonId, req.user.userId, 'services', updated.id, { name: existing.name, price: Number(existing.price), duration: existing.duration, isActive: existing.isActive }, { name: updated.name, price: Number(updated.price), duration: updated.duration, isActive: updated.isActive }, ipAddress, userAgent);
        res.json(mapService(updated));
    }
    catch (error) {
        console.error('Error updating service', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});
servicesRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Check permission to delete services
        const canDelete = await (0, supabaseAuth_1.hasPermission)(req.user, 'podeDeletarServico');
        if (!canDelete) {
            res.status(403).json({ error: 'Você não tem permissão para excluir serviços' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.service.findFirst({
            where: { id: req.params.id, salonId, deletedAt: null },
        });
        if (!existing) {
            res.status(404).json({ error: 'Service not found' });
            return;
        }
        await prismaClient_1.prisma.service.update({
            where: { id: existing.id },
            data: { isActive: false, deletedAt: new Date() },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logDelete(salonId, req.user.userId, 'services', existing.id, { name: existing.name, price: Number(existing.price), duration: existing.duration }, ipAddress, userAgent);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting service', error);
        res.status(500).json({ error: 'Failed to delete service' });
    }
});
