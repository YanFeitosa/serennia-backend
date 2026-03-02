import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { AuditService } from '../services/audit';

function mapQueueEntry(q: any) {
  return {
    id: q.id,
    salonId: q.salonId,
    clientId: q.clientId,
    collaboratorId: q.collaboratorId,
    appointmentId: q.appointmentId,
    position: q.position,
    notes: q.notes ?? undefined,
    arrivedAt: q.arrivedAt.toISOString(),
    createdAt: q.createdAt.toISOString(),
    client: q.client ? {
      id: q.client.id,
      name: q.client.name,
      phone: q.client.phone,
    } : undefined,
    collaborator: q.collaborator ? {
      id: q.collaborator.id,
      name: q.collaborator.name,
      role: q.collaborator.role,
      avatarUrl: q.collaborator.avatarUrl ?? undefined,
    } : undefined,
    appointment: q.appointment ? {
      id: q.appointment.id,
      start: q.appointment.start.toISOString(),
      end: q.appointment.end.toISOString(),
      status: q.appointment.status,
    } : undefined,
  };
}

export const queueRouter = Router();

// GET / — List today's queue entries with their appointment status
queueRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const entries = await prisma.queueEntry.findMany({
      where: {
        salonId,
        arrivedAt: { gte: today, lt: tomorrow },
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        collaborator: { select: { id: true, name: true, role: true, avatarUrl: true } },
        appointment: { select: { id: true, start: true, end: true, status: true } },
      },
      orderBy: { position: 'asc' },
    });

    res.json(entries.map(mapQueueEntry));
  } catch (error) {
    console.error('Error listing queue:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to list queue entries' });
  }
});

// POST /add — Add client to queue with automatic round-robin assignment + appointment creation
queueRouter.post('/add', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { clientId, notes } = req.body as {
      clientId: string;
      notes?: string;
    };

    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }

    const salonId = req.user.salonId;

    // Verify client exists
    const client = await prisma.client.findFirst({
      where: { id: clientId, salonId, isActive: true, deletedAt: null },
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if client already has an active queue entry today
    const existingEntry = await prisma.queueEntry.findFirst({
      where: {
        salonId,
        clientId,
        arrivedAt: { gte: today, lt: tomorrow },
        appointment: { status: { notIn: ['canceled', 'completed', 'no_show'] } },
      },
    });

    if (existingEntry) {
      res.status(409).json({ error: 'Cliente já está na fila de espera' });
      return;
    }

    // Get next position
    const lastEntry = await prisma.queueEntry.findFirst({
      where: { salonId, arrivedAt: { gte: today, lt: tomorrow } },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastEntry?.position ?? 0) + 1;

    // Find active professionals
    const activeCollaborators = await prisma.collaborator.findMany({
      where: {
        salonId,
        status: 'active',
        role: 'professional',
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    if (activeCollaborators.length === 0) {
      res.status(400).json({ error: 'Nenhum profissional disponível no momento' });
      return;
    }

    // Round-robin: count today's queue assignments per collaborator
    const todayAssignments = await prisma.queueEntry.groupBy({
      by: ['collaboratorId'],
      where: {
        salonId,
        arrivedAt: { gte: today, lt: tomorrow },
      },
      _count: { id: true },
    });

    const assignmentMap = new Map<string, number>();
    for (const a of todayAssignments) {
      assignmentMap.set(a.collaboratorId, a._count.id);
    }

    // Pick collaborator with fewest assignments
    let selectedCollaborator = activeCollaborators[0];
    let minAssignments = assignmentMap.get(selectedCollaborator.id) ?? 0;

    for (const collab of activeCollaborators) {
      const count = assignmentMap.get(collab.id) ?? 0;
      if (count < minAssignments) {
        minAssignments = count;
        selectedCollaborator = collab;
      }
    }

    // Find next available time slot for this collaborator
    const now = new Date();
    const defaultDuration = 30; // minutes

    const collaboratorAppointments = await prisma.appointment.findMany({
      where: {
        salonId,
        collaboratorId: selectedCollaborator.id,
        start: { gte: now },
        status: { notIn: ['canceled', 'no_show'] },
      },
      orderBy: { start: 'asc' },
    });

    const busySlots = collaboratorAppointments.map(apt => ({
      start: apt.start,
      end: apt.end,
    }));

    // Round up to next 15-min interval
    let startTime = new Date(now);
    const roundedMinutes = Math.ceil(startTime.getMinutes() / 15) * 15;
    startTime.setMinutes(roundedMinutes, 0, 0);

    for (const slot of busySlots) {
      const proposedEnd = new Date(startTime.getTime() + defaultDuration * 60000);
      if (startTime < slot.end && proposedEnd > slot.start) {
        startTime = new Date(slot.end);
      }
    }

    const endTime = new Date(startTime.getTime() + defaultDuration * 60000);

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        clientId,
        collaboratorId: selectedCollaborator.id,
        start: startTime,
        end: endTime,
        status: 'pending',
        origin: 'reception',
        notes: notes ? `[Fila] ${notes}` : '[Fila] Agendamento por ordem de chegada',
      },
    });

    // Create queue entry (just metadata linking client -> appointment)
    const queueEntry = await prisma.queueEntry.create({
      data: {
        salonId,
        clientId,
        collaboratorId: selectedCollaborator.id,
        appointmentId: appointment.id,
        position: nextPosition,
        notes,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        collaborator: { select: { id: true, name: true, role: true, avatarUrl: true } },
        appointment: { select: { id: true, start: true, end: true, status: true } },
      },
    });

    // Log audit
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logCreate(
      salonId,
      req.user.userId,
      'queue_entries',
      queueEntry.id,
      { clientId, collaboratorId: selectedCollaborator.id, position: nextPosition },
      ipAddress,
      userAgent
    );

    res.status(201).json(mapQueueEntry(queueEntry));
  } catch (error) {
    console.error('Error adding to queue:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to add to queue' });
  }
});

// DELETE /:id — Remove queue entry and cancel its appointment
queueRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const entry = await prisma.queueEntry.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!entry) {
      res.status(404).json({ error: 'Queue entry not found' });
      return;
    }

    // Cancel linked appointment
    await prisma.appointment.update({
      where: { id: entry.appointmentId },
      data: { status: 'canceled' },
    });

    await prisma.queueEntry.delete({
      where: { id: entry.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting queue entry:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to delete queue entry' });
  }
});
