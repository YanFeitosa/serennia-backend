"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
function mapCategory(c) {
    return {
        id: c.id,
        salonId: c.salonId,
        type: c.type,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    };
}
const categoriesRouter = (0, express_1.Router)();
exports.categoriesRouter = categoriesRouter;
categoriesRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const type = req.query.type;
        if (!type || (type !== 'service' && type !== 'product')) {
            res
                .status(400)
                .json({ error: "type query param must be 'service' or 'product'" });
            return;
        }
        const categories = await prismaClient_1.prisma.category.findMany({
            where: { salonId, type },
            orderBy: { name: 'asc' },
        });
        res.json(categories.map(mapCategory));
    }
    catch (error) {
        console.error('Error listing categories', error);
        res.status(500).json({ error: 'Failed to list categories' });
    }
});
categoriesRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        const { type, name } = req.body;
        if (!type || (type !== 'service' && type !== 'product')) {
            res.status(400).json({ error: "type must be 'service' or 'product'" });
            return;
        }
        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        const category = await prismaClient_1.prisma.category.create({
            data: {
                salonId,
                type,
                name: sanitizedName,
            },
        });
        res.status(201).json(mapCategory(category));
    }
    catch (error) {
        if (error && error.code === 'P2002') {
            res
                .status(409)
                .json({ error: 'Category with this name and type already exists' });
            return;
        }
        console.error('Error creating category', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
categoriesRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.category.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        try {
            const tx = [];
            // Sempre limpar categoryId de serviços e produtos que usavam essa categoria
            tx.push(prismaClient_1.prisma.service.updateMany({
                where: { salonId, categoryId: existing.id },
                data: { categoryId: null },
            }));
            tx.push(prismaClient_1.prisma.product.updateMany({
                where: { salonId, categoryId: existing.id },
                data: { categoryId: null },
            }));
            // Se for categoria de serviço, remover o nome da categoria das serviceCategories dos colaboradores
            if (existing.type === 'service') {
                const collaborators = await prismaClient_1.prisma.collaborator.findMany({
                    where: {
                        salonId,
                        serviceCategories: { has: existing.name },
                    },
                });
                for (const collaborator of collaborators) {
                    const filteredCategories = (collaborator.serviceCategories ?? []).filter((name) => name !== existing.name);
                    tx.push(prismaClient_1.prisma.collaborator.update({
                        where: { id: collaborator.id },
                        data: { serviceCategories: filteredCategories },
                    }));
                }
            }
            tx.push(prismaClient_1.prisma.category.delete({
                where: { id: existing.id },
            }));
            await prismaClient_1.prisma.$transaction(tx);
        }
        catch (error) {
            if (error && error.code === 'P2003') {
                res.status(409).json({
                    error: 'Category has related records and cannot be deleted',
                });
                return;
            }
            throw error;
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting category', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});
