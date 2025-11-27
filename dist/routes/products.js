"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
const rateLimiter_1 = require("../middleware/rateLimiter");
function mapProduct(p) {
    return {
        id: p.id,
        salonId: p.salonId,
        name: p.name,
        category: p.category ? p.category.name : undefined,
        description: p.description ?? undefined,
        price: Number(p.price),
        costPrice: p.costPrice != null ? Number(p.costPrice) : undefined,
        stock: p.stock,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}
const productsRouter = (0, express_1.Router)();
exports.productsRouter = productsRouter;
productsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const products = await prismaClient_1.prisma.product.findMany({
            where: { salonId, isActive: true },
            orderBy: { createdAt: 'desc' },
            include: { category: true },
        });
        res.json(products.map(mapProduct));
    }
    catch (error) {
        console.error('Error listing products', error);
        res.status(500).json({ error: 'Failed to list products' });
    }
});
productsRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const product = await prismaClient_1.prisma.product.findFirst({
            where: { id: req.params.id, salonId, isActive: true },
            include: { category: true },
        });
        if (!product) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        res.json(mapProduct(product));
    }
    catch (error) {
        console.error('Error fetching product', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});
productsRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        const { name, category, description, price, costPrice, stock, isActive, } = req.body;
        if (!name || price == null || stock == null) {
            res
                .status(400)
                .json({ error: 'name, price and stock are required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        let categoryRecord = null;
        if (category) {
            categoryRecord = await prismaClient_1.prisma.category.findFirst({
                where: { salonId, type: 'product', name: category },
            });
            if (!categoryRecord) {
                try {
                    categoryRecord = await prismaClient_1.prisma.category.create({
                        data: {
                            salonId,
                            type: 'product',
                            name: category,
                        },
                    });
                }
                catch (error) {
                    if (error && error.code === 'P2002') {
                        categoryRecord = await prismaClient_1.prisma.category.findFirst({
                            where: { salonId, type: 'product', name: category },
                        });
                    }
                    else {
                        throw error;
                    }
                }
            }
        }
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        const sanitizedDescription = description ? (0, validation_1.sanitizeString)(description) : null;
        const product = await prismaClient_1.prisma.product.create({
            data: {
                salonId,
                name: sanitizedName,
                categoryId: categoryRecord?.id,
                description: sanitizedDescription,
                price,
                costPrice: costPrice != null ? costPrice : null,
                stock: stock ?? 0,
                isActive: isActive ?? true,
            },
            include: { category: true },
        });
        res.status(201).json(mapProduct(product));
    }
    catch (error) {
        console.error('Error creating product', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});
productsRouter.patch('/:id', async (req, res) => {
    try {
        const { name, category, description, price, costPrice, stock, isActive, } = req.body;
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.product.findFirst({
            where: { id: req.params.id, salonId, isActive: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Product not found' });
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
        if (price !== undefined) {
            if (price < 0) {
                res.status(400).json({ error: 'price must be non-negative' });
                return;
            }
            data.price = price;
        }
        if (costPrice !== undefined) {
            if (costPrice != null && costPrice < 0) {
                res.status(400).json({ error: 'costPrice must be non-negative' });
                return;
            }
            data.costPrice = costPrice;
        }
        if (stock !== undefined) {
            if (stock < 0) {
                res.status(400).json({ error: 'stock must be non-negative' });
                return;
            }
            data.stock = stock;
        }
        if (isActive !== undefined)
            data.isActive = isActive;
        if (category !== undefined) {
            if (!category) {
                data.categoryId = null;
            }
            else {
                let categoryRecord = await prismaClient_1.prisma.category.findFirst({
                    where: { salonId, type: 'product', name: category },
                });
                if (!categoryRecord) {
                    try {
                        categoryRecord = await prismaClient_1.prisma.category.create({
                            data: {
                                salonId,
                                type: 'product',
                                name: category,
                            },
                        });
                    }
                    catch (error) {
                        if (error && error.code === 'P2002') {
                            categoryRecord = await prismaClient_1.prisma.category.findFirst({
                                where: { salonId, type: 'product', name: category },
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
        const updated = await prismaClient_1.prisma.product.update({
            where: { id: existing.id },
            data,
            include: { category: true },
        });
        res.json(mapProduct(updated));
    }
    catch (error) {
        console.error('Error updating product', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});
productsRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.product.findFirst({
            where: { id: req.params.id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        await prismaClient_1.prisma.product.update({
            where: { id: existing.id },
            data: { isActive: false },
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting product', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
