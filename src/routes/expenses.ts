import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { sanitizeString } from '../utils/validation';
import { ExpenseType } from '../types/enums';

function mapExpense(e: any) {
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

const expensesRouter = Router();

// GET /expenses - List all expenses for the salon
expensesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const expenses = await prisma.expense.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(expenses.map(mapExpense));
  } catch (error) {
    console.error('Error listing expenses', error);
    res.status(500).json({ error: 'Failed to list expenses' });
  }
});

// POST /expenses - Create a new expense
expensesRouter.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, amount, type } = req.body as {
      name?: string;
      amount?: number;
      type?: ExpenseType;
    };

    if (!name || amount === undefined || !type) {
      res.status(400).json({ error: 'name, amount, and type are required' });
      return;
    }

    const sanitizedName = sanitizeString(name);
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

    const expense = await prisma.expense.create({
      data: {
        salonId,
        name: sanitizedName,
        amount,
        type,
      },
    });

    res.status(201).json(mapExpense(expense));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res.status(409).json({ error: 'An expense with this name already exists' });
      return;
    }
    console.error('Error creating expense', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PATCH /expenses/:id - Update an expense
expensesRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    const { name, amount, type } = req.body as {
      name?: string;
      amount?: number;
      type?: ExpenseType;
    };

    const data: any = {};

    if (name !== undefined) {
      const sanitizedName = sanitizeString(name);
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

    const updated = await prisma.expense.update({
      where: { id: existing.id },
      data,
    });

    res.json(mapExpense(updated));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res.status(409).json({ error: 'An expense with this name already exists' });
      return;
    }
    console.error('Error updating expense', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /expenses/:id - Delete an expense
expensesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    await prisma.expense.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting expense', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export { expensesRouter };

