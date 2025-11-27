"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionsRouter = void 0;
// src/routes/commissions.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const commissionsRouter = (0, express_1.Router)();
exports.commissionsRouter = commissionsRouter;
// Get pending commissions by collaborator
commissionsRouter.get('/pending', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { startDate, endDate } = req.query;
        const where = {
            salonId,
            paid: false,
        };
        // Filter by date range if provided
        if (startDate || endDate) {
            where.order = {
                createdAt: {},
            };
            if (startDate) {
                where.order.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.order.createdAt.lte = new Date(endDate);
            }
        }
        // Get unpaid commission records grouped by collaborator
        const commissionRecords = await prismaClient_1.prisma.commissionRecord.findMany({
            where,
            include: {
                collaborator: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                    },
                },
                order: {
                    select: {
                        id: true,
                        createdAt: true,
                        finalValue: true,
                    },
                },
            },
            orderBy: {
                order: {
                    createdAt: 'desc',
                },
            },
        });
        // Group by collaborator
        const byCollaborator = new Map();
        for (const record of commissionRecords) {
            const collabId = record.collaboratorId;
            const existing = byCollaborator.get(collabId);
            if (existing) {
                existing.totalAmount += Number(record.amount);
                existing.recordCount += 1;
                existing.records.push({
                    id: record.id,
                    amount: Number(record.amount),
                    orderId: record.orderId,
                    orderDate: record.order.createdAt.toISOString(),
                });
            }
            else {
                byCollaborator.set(collabId, {
                    collaborator: {
                        id: record.collaborator.id,
                        name: record.collaborator.name,
                        avatarUrl: record.collaborator.avatarUrl,
                    },
                    totalAmount: Number(record.amount),
                    recordCount: 1,
                    records: [{
                            id: record.id,
                            amount: Number(record.amount),
                            orderId: record.orderId,
                            orderDate: record.order.createdAt.toISOString(),
                        }],
                });
            }
        }
        const result = Array.from(byCollaborator.values()).sort((a, b) => b.totalAmount - a.totalAmount);
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching pending commissions', error);
        res.status(500).json({ error: 'Failed to fetch pending commissions' });
    }
});
// Pay commissions for a collaborator
commissionsRouter.post('/pay', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { collaboratorId, recordIds, periodStart, periodEnd, notes } = req.body;
        if (!collaboratorId) {
            res.status(400).json({ error: 'collaboratorId is required' });
            return;
        }
        // Get records to pay
        const where = {
            salonId,
            collaboratorId,
            paid: false,
        };
        if (recordIds && recordIds.length > 0) {
            where.id = { in: recordIds };
        }
        const recordsToPay = await prismaClient_1.prisma.commissionRecord.findMany({
            where,
        });
        if (recordsToPay.length === 0) {
            res.status(400).json({ error: 'No pending commissions found' });
            return;
        }
        const totalAmount = recordsToPay.reduce((sum, r) => sum + Number(r.amount), 0);
        // Create commission payment record
        const payment = await prismaClient_1.prisma.commissionPayment.create({
            data: {
                salonId,
                collaboratorId,
                amount: totalAmount,
                periodStart: periodStart ? new Date(periodStart) : recordsToPay[recordsToPay.length - 1].periodStart || new Date(),
                periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
                notes,
            },
        });
        // Mark commission records as paid
        await prismaClient_1.prisma.commissionRecord.updateMany({
            where: {
                id: { in: recordsToPay.map(r => r.id) },
            },
            data: {
                paid: true,
                paymentDate: new Date(),
            },
        });
        res.json({
            success: true,
            paymentId: payment.id,
            amount: totalAmount,
            recordsPaid: recordsToPay.length,
        });
    }
    catch (error) {
        console.error('Error paying commissions', error);
        res.status(500).json({ error: 'Failed to pay commissions' });
    }
});
// Get commission payment history
commissionsRouter.get('/history', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { collaboratorId, limit = '20' } = req.query;
        const where = { salonId };
        if (collaboratorId) {
            where.collaboratorId = collaboratorId;
        }
        const payments = await prismaClient_1.prisma.commissionPayment.findMany({
            where,
            orderBy: { paidAt: 'desc' },
            take: parseInt(limit, 10),
        });
        // Get collaborator names
        const collaboratorIds = [...new Set(payments.map(p => p.collaboratorId))];
        const collaborators = await prismaClient_1.prisma.collaborator.findMany({
            where: { id: { in: collaboratorIds } },
            select: { id: true, name: true },
        });
        const collaboratorMap = new Map(collaborators.map(c => [c.id, c.name]));
        const result = payments.map(p => ({
            id: p.id,
            collaboratorId: p.collaboratorId,
            collaboratorName: collaboratorMap.get(p.collaboratorId) || 'Desconhecido',
            amount: Number(p.amount),
            periodStart: p.periodStart.toISOString(),
            periodEnd: p.periodEnd.toISOString(),
            paidAt: p.paidAt.toISOString(),
            notes: p.notes,
        }));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching commission history', error);
        res.status(500).json({ error: 'Failed to fetch commission history' });
    }
});
