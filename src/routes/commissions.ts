// src/routes/commissions.ts
import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';

const commissionsRouter = Router();

// Get all commission records
commissionsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { collaboratorId, startDate, endDate, paid } = req.query as {
      collaboratorId?: string;
      startDate?: string;
      endDate?: string;
      paid?: string;
    };

    const where: any = { salonId };

    if (collaboratorId) {
      where.collaboratorId = collaboratorId;
    }

    if (paid !== undefined) {
      where.paid = paid === 'true';
    }

    // Filter by date using the order's createdAt
    if (startDate || endDate) {
      where.order = { createdAt: {} };
      if (startDate) {
        where.order.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.order.createdAt.lte = new Date(endDate + 'T23:59:59');
      }
    }

    const records = await prisma.commissionRecord.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            createdAt: true,
          },
        },
        orderItem: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        order: {
          createdAt: 'desc',
        },
      },
    });

    const result = records.map(r => ({
      id: r.id,
      salonId: r.salonId,
      collaboratorId: r.collaboratorId,
      orderId: r.orderId,
      orderItemId: r.orderItemId,
      amount: Number(r.amount),
      paid: r.paid,
      paymentDate: r.paymentDate?.toISOString() || null,
      periodStart: r.periodStart?.toISOString() || null,
      periodEnd: r.periodEnd?.toISOString() || null,
      description: r.orderItem?.name || 'Serviço',
      createdAt: r.order?.createdAt?.toISOString() || null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching commission records', error);
    res.status(500).json({ error: 'Failed to fetch commission records' });
  }
});

// Get pending commissions by collaborator
commissionsRouter.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const where: any = {
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
    const commissionRecords = await prisma.commissionRecord.findMany({
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
    const byCollaborator = new Map<string, {
      collaborator: { id: string; name: string; avatarUrl: string | null };
      totalAmount: number;
      recordCount: number;
      records: Array<{
        id: string;
        amount: number;
        orderId: string;
        orderDate: string;
      }>;
    }>();

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
      } else {
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
  } catch (error) {
    console.error('Error fetching pending commissions', error);
    res.status(500).json({ error: 'Failed to fetch pending commissions' });
  }
});

// Pay commissions for a collaborator
commissionsRouter.post('/pay', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { collaboratorId, recordIds, periodStart, periodEnd, notes } = req.body as {
      collaboratorId: string;
      recordIds?: string[];
      periodStart?: string;
      periodEnd?: string;
      notes?: string;
    };

    if (!collaboratorId) {
      res.status(400).json({ error: 'collaboratorId is required' });
      return;
    }

    // Get records to pay
    const where: any = {
      salonId,
      collaboratorId,
      paid: false,
    };

    if (recordIds && recordIds.length > 0) {
      where.id = { in: recordIds };
    }

    const recordsToPay = await prisma.commissionRecord.findMany({
      where,
    });

    if (recordsToPay.length === 0) {
      res.status(400).json({ error: 'No pending commissions found' });
      return;
    }

    const totalAmount = recordsToPay.reduce((sum, r) => sum + Number(r.amount), 0);

    // Create commission payment record
    const payment = await prisma.commissionPayment.create({
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
    await prisma.commissionRecord.updateMany({
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
  } catch (error) {
    console.error('Error paying commissions', error);
    res.status(500).json({ error: 'Failed to pay commissions' });
  }
});

// Get commission payment history
commissionsRouter.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { collaboratorId, limit = '20' } = req.query as { collaboratorId?: string; limit?: string };

    const where: any = { salonId };
    if (collaboratorId) {
      where.collaboratorId = collaboratorId;
    }

    const payments = await prisma.commissionPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      take: parseInt(limit, 10),
    });

    // Get collaborator names
    const collaboratorIds = [...new Set(payments.map(p => p.collaboratorId))];
    const collaborators = await prisma.collaborator.findMany({
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
  } catch (error) {
    console.error('Error fetching commission history', error);
    res.status(500).json({ error: 'Failed to fetch commission history' });
  }
});

export { commissionsRouter };

