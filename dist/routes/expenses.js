"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesRouter = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const validation_1 = require("../utils/validation");
function mapExpense(e) {
    return {
        id: e.id,
        salonId: e.salonId,
        name: e.name,
        amount: Number(e.amount),
        type: e.type,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
    };
}
const expensesRouter = (0, express_1.Router)();
exports.expensesRouter = expensesRouter;
// GET /expenses - List all expenses for the salon
expensesRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const expenses = await prismaClient_1.prisma.expense.findMany({
            where: { salonId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        res.json(expenses.map(mapExpense));
    }
    catch (error) {
        console.error('Error listing expenses', error);
        res.status(500).json({ error: 'Failed to list expenses' });
    }
});
// POST /expenses - Create a new expense
expensesRouter.post('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { name, amount, type } = req.body;
        if (!name || amount === undefined || !type) {
            res.status(400).json({ error: 'name, amount, and type are required' });
            return;
        }
        const sanitizedName = (0, validation_1.sanitizeString)(name);
        if (!sanitizedName || sanitizedName.length < 2) {
            res.status(400).json({ error: 'name must be at least 2 characters long' });
            return;
        }
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
            res.status(400).json({ error: 'amount must be a non-negative number' });
            return;
        }
        if (type !== 'FIXED' && type !== 'VARIABLE') {
            res.status(400).json({ error: "type must be 'FIXED' or 'VARIABLE'" });
            return;
        }
        const salonId = req.user.salonId;
        const expense = await prismaClient_1.prisma.expense.create({
            data: {
                salonId,
                name: sanitizedName,
                amount,
                type,
            },
        });
        res.status(201).json(mapExpense(expense));
    }
    catch (error) {
        if (error && error.code === 'P2002') {
            res.status(409).json({ error: 'An expense with this name already exists' });
            return;
        }
        console.error('Error creating expense', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
});
// PATCH /expenses/:id - Update an expense
expensesRouter.patch('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.expense.findFirst({
            where: { id: req.params.id, salonId, deletedAt: null },
        });
        if (!existing) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }
        const { name, amount, type } = req.body;
        const data = {};
        if (name !== undefined) {
            const sanitizedName = (0, validation_1.sanitizeString)(name);
            if (!sanitizedName || sanitizedName.length < 2) {
                res.status(400).json({ error: 'name must be at least 2 characters long' });
                return;
            }
            data.name = sanitizedName;
        }
        if (amount !== undefined) {
            if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
                res.status(400).json({ error: 'amount must be a non-negative number' });
                return;
            }
            data.amount = amount;
        }
        if (type !== undefined) {
            if (type !== 'FIXED' && type !== 'VARIABLE') {
                res.status(400).json({ error: "type must be 'FIXED' or 'VARIABLE'" });
                return;
            }
            data.type = type;
        }
        const updated = await prismaClient_1.prisma.expense.update({
            where: { id: existing.id },
            data,
        });
        res.json(mapExpense(updated));
    }
    catch (error) {
        if (error && error.code === 'P2002') {
            res.status(409).json({ error: 'An expense with this name already exists' });
            return;
        }
        console.error('Error updating expense', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
});
// DELETE /expenses/:id - Soft delete an expense
expensesRouter.delete('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.expense.findFirst({
            where: { id: req.params.id, salonId, deletedAt: null },
        });
        if (!existing) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }
        await prismaClient_1.prisma.expense.update({
            where: { id: existing.id },
            data: { deletedAt: new Date() },
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting expense', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});
