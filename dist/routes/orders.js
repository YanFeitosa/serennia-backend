"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const rateLimiter_1 = require("../middleware/rateLimiter");
const audit_1 = require("../services/audit");
function mapOrderItem(item) {
    return {
        id: item.id,
        salonId: item.salonId,
        type: item.type,
        serviceId: item.serviceId ?? undefined,
        productId: item.productId ?? undefined,
        collaboratorId: item.collaboratorId ?? undefined,
        quantity: item.quantity ?? undefined,
        price: Number(item.price),
        commission: Number(item.commission),
    };
}
function mapOrder(o) {
    return {
        id: o.id,
        salonId: o.salonId,
        clientId: o.clientId,
        items: (o.items ?? []).map(mapOrderItem),
        status: o.status,
        finalValue: Number(o.finalValue),
        createdAt: o.createdAt.toISOString(),
        closedAt: o.closedAt ? o.closedAt.toISOString() : undefined,
        appointmentId: o.appointment ? o.appointment.id : undefined,
        createdByUserId: o.createdByUserId ?? undefined,
        updatedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
    };
}
const ordersRouter = (0, express_1.Router)();
exports.ordersRouter = ordersRouter;
ordersRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { status, clientId, dateFrom, dateTo, search } = req.query;
        const where = { salonId };
        const andConditions = [];
        if (status) {
            where.status = status;
        }
        if (clientId) {
            where.clientId = clientId;
        }
        if (dateFrom) {
            const from = new Date(dateFrom);
            if (isNaN(from.getTime())) {
                res.status(400).json({ error: 'Invalid dateFrom' });
                return;
            }
            andConditions.push({ createdAt: { gte: from } });
        }
        if (dateTo) {
            const to = new Date(dateTo);
            if (isNaN(to.getTime())) {
                res.status(400).json({ error: 'Invalid dateTo' });
                return;
            }
            andConditions.push({ createdAt: { lte: to } });
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
        if (search) {
            where.OR = [
                { id: { contains: search, mode: 'insensitive' } },
                { client: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const orders = await prismaClient_1.prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { items: { where: { deletedAt: null } }, appointment: true, client: true },
        });
        res.json(orders.map(mapOrder));
    }
    catch (error) {
        console.error('Error listing orders', error);
        res.status(500).json({ error: 'Failed to list orders' });
    }
});
ordersRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const order = await prismaClient_1.prisma.order.findFirst({
            where: { id: req.params.id, salonId },
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        res.json(mapOrder(order));
    }
    catch (error) {
        console.error('Error fetching order', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});
ordersRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ error: 'clientId is required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const client = await prismaClient_1.prisma.client.findFirst({
            where: { id: clientId, salonId, isActive: true },
        });
        if (!client) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }
        // Use transaction to create order and update client's lastVisit atomically
        const order = await prismaClient_1.prisma.$transaction(async (tx) => {
            // Create the order
            const newOrder = await tx.order.create({
                data: {
                    salonId,
                    clientId,
                    status: 'open',
                    finalValue: 0,
                },
                include: { items: { where: { deletedAt: null } }, appointment: true },
            });
            // Update client's lastVisit to current date
            await tx.client.update({
                where: { id: clientId },
                data: { lastVisit: new Date() },
            });
            return newOrder;
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logCreate(salonId, req.user.userId, 'orders', order.id, { clientId: order.clientId, status: order.status }, ipAddress, userAgent);
        res.status(201).json(mapOrder(order));
    }
    catch (error) {
        console.error('Error creating order', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});
ordersRouter.patch('/:id', async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.order.findFirst({
            where: { id: req.params.id, salonId },
            include: { items: true, appointment: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        if (existing.status !== 'open') {
            res.status(400).json({ error: 'Only open orders can be edited' });
            return;
        }
        const data = {};
        if (clientId && clientId !== existing.clientId) {
            const client = await prismaClient_1.prisma.client.findFirst({
                where: { id: clientId, salonId, isActive: true },
            });
            if (!client) {
                res.status(404).json({ error: 'Client not found' });
                return;
            }
            data.clientId = clientId;
        }
        const updated = await prismaClient_1.prisma.order.update({
            where: { id: existing.id },
            data,
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        res.json(mapOrder(updated));
    }
    catch (error) {
        console.error('Error updating order', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
});
ordersRouter.post('/:id/items', async (req, res) => {
    try {
        const { type, serviceId, productId, collaboratorId, quantity } = req.body;
        if (!type) {
            res.status(400).json({ error: 'type is required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const result = await prismaClient_1.prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: req.params.id, salonId },
            });
            if (!order) {
                throw new Error('ORDER_NOT_FOUND');
            }
            if (order.status !== 'open') {
                throw new Error('ORDER_NOT_OPEN');
            }
            const qty = quantity && quantity > 0 ? quantity : 1;
            let priceNumber = 0;
            let serviceIdValue;
            let productIdValue;
            let collaboratorIdValue = collaboratorId;
            if (type === 'service') {
                if (!serviceId) {
                    throw new Error('SERVICE_ID_REQUIRED');
                }
                const service = await tx.service.findFirst({
                    where: { id: serviceId, salonId, isActive: true },
                });
                if (!service) {
                    throw new Error('SERVICE_NOT_FOUND');
                }
                serviceIdValue = serviceId;
                priceNumber = Number(service.price);
                if (collaboratorId) {
                    const collaborator = await tx.collaborator.findFirst({
                        where: { id: collaboratorId, salonId },
                    });
                    if (!collaborator) {
                        throw new Error('COLLABORATOR_NOT_FOUND');
                    }
                }
            }
            else if (type === 'product') {
                if (!productId) {
                    throw new Error('PRODUCT_ID_REQUIRED');
                }
                const product = await tx.product.findFirst({
                    where: { id: productId, salonId, isActive: true },
                });
                if (!product) {
                    throw new Error('PRODUCT_NOT_FOUND');
                }
                productIdValue = productId;
                priceNumber = Number(product.price);
            }
            else {
                throw new Error('INVALID_TYPE');
            }
            await tx.orderItem.create({
                data: {
                    orderId: order.id,
                    salonId,
                    type,
                    serviceId: serviceIdValue,
                    productId: productIdValue,
                    collaboratorId: collaboratorIdValue,
                    quantity: qty,
                    price: priceNumber,
                    commission: 0,
                },
            });
            const items = await tx.orderItem.findMany({
                where: { orderId: order.id, salonId, deletedAt: null },
            });
            const finalValue = items.reduce((sum, it) => {
                const q = it.quantity ?? 1;
                return sum + Number(it.price) * q;
            }, 0);
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { finalValue },
                include: { items: { where: { deletedAt: null } }, appointment: true },
            });
            return updatedOrder;
        });
        res.status(201).json(mapOrder(result));
    }
    catch (error) {
        if (error && error.message) {
            switch (error.message) {
                case 'ORDER_NOT_FOUND':
                    res.status(404).json({ error: 'Order not found' });
                    return;
                case 'ORDER_NOT_OPEN':
                    res.status(400).json({ error: 'Only open orders can receive items' });
                    return;
                case 'SERVICE_ID_REQUIRED':
                    res
                        .status(400)
                        .json({ error: 'serviceId is required for service items' });
                    return;
                case 'PRODUCT_ID_REQUIRED':
                    res
                        .status(400)
                        .json({ error: 'productId is required for product items' });
                    return;
                case 'SERVICE_NOT_FOUND':
                    res.status(404).json({ error: 'Service not found' });
                    return;
                case 'PRODUCT_NOT_FOUND':
                    res.status(404).json({ error: 'Product not found' });
                    return;
                case 'COLLABORATOR_NOT_FOUND':
                    res.status(404).json({ error: 'Collaborator not found' });
                    return;
                case 'INVALID_TYPE':
                    res.status(400).json({ error: 'Invalid item type' });
                    return;
            }
        }
        console.error('Error adding order item', error);
        res.status(500).json({ error: 'Failed to add order item' });
    }
});
ordersRouter.delete('/:id/items/:itemId', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const result = await prismaClient_1.prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: req.params.id, salonId },
            });
            if (!order) {
                throw new Error('ORDER_NOT_FOUND');
            }
            if (order.status !== 'open') {
                throw new Error('ORDER_NOT_OPEN');
            }
            const item = await tx.orderItem.findFirst({
                where: { id: req.params.itemId, orderId: order.id, salonId, deletedAt: null },
            });
            if (!item) {
                throw new Error('ITEM_NOT_FOUND');
            }
            // Soft delete the order item
            await tx.orderItem.update({
                where: { id: item.id },
                data: { deletedAt: new Date() },
            });
            // Recalculate total excluding soft deleted items
            const items = await tx.orderItem.findMany({
                where: { orderId: order.id, salonId, deletedAt: null },
            });
            const finalValue = items.reduce((sum, it) => {
                const q = it.quantity ?? 1;
                return sum + Number(it.price) * q;
            }, 0);
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { finalValue },
                include: {
                    items: { where: { deletedAt: null } },
                    appointment: true
                },
            });
            return updatedOrder;
        });
        res.status(200).json(mapOrder(result));
    }
    catch (error) {
        if (error && error.message) {
            switch (error.message) {
                case 'ORDER_NOT_FOUND':
                    res.status(404).json({ error: 'Order not found' });
                    return;
                case 'ORDER_NOT_OPEN':
                    res.status(400).json({ error: 'Only open orders can be modified' });
                    return;
                case 'ITEM_NOT_FOUND':
                    res.status(404).json({ error: 'Order item not found' });
                    return;
            }
        }
        console.error('Error deleting order item', error);
        res.status(500).json({ error: 'Failed to delete order item' });
    }
});
ordersRouter.post('/:id/close', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.order.findFirst({
            where: { id: req.params.id, salonId },
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        if (existing.status !== 'open') {
            res.status(400).json({ error: 'Only open orders can be closed' });
            return;
        }
        const updated = await prismaClient_1.prisma.order.update({
            where: { id: existing.id },
            data: {
                status: 'closed',
                closedAt: new Date(),
            },
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logUpdate(salonId, req.user.userId, 'orders', updated.id, { status: existing.status }, { status: updated.status, finalValue: Number(updated.finalValue) }, ipAddress, userAgent);
        res.json(mapOrder(updated));
    }
    catch (error) {
        console.error('Error closing order', error);
        res.status(500).json({ error: 'Failed to close order' });
    }
});
ordersRouter.post('/:id/pay', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.order.findFirst({
            where: { id: req.params.id, salonId },
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        if (existing.status !== 'closed') {
            res.status(400).json({ error: 'Only closed orders can be marked as paid' });
            return;
        }
        const updated = await prismaClient_1.prisma.order.update({
            where: { id: existing.id },
            data: {
                status: 'paid',
                closedAt: existing.closedAt ?? new Date(),
            },
            include: { items: { where: { deletedAt: null } }, appointment: true },
        });
        // Log de auditoria
        const { ipAddress, userAgent } = audit_1.AuditService.getRequestInfo(req);
        await audit_1.AuditService.logUpdate(salonId, req.user.userId, 'orders', updated.id, { status: existing.status }, { status: 'paid', finalValue: Number(updated.finalValue) }, ipAddress, userAgent);
        res.json(mapOrder(updated));
    }
    catch (error) {
        console.error('Error paying order', error);
        res.status(500).json({ error: 'Failed to pay order' });
    }
});
