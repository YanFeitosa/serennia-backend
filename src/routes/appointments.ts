import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';
import { AppointmentStatus, AppointmentOrigin } from '../types/enums';

function mapAppointment(a: any) {
  return {
    id: a.id,
    salonId: a.salonId,
    clientId: a.clientId,
    collaboratorId: a.collaboratorId,
    serviceIds: (a.services ?? []).map((s: any) => s.serviceId),
    start: a.start.toISOString(),
    end: a.end.toISOString(),
    status: a.status,
    origin: a.origin,
    notes: a.notes ?? undefined,
    orderId: a.orderId ?? undefined,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const APPOINTMENT_BLOCKING_STATUSES: AppointmentStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'not_paid',
];

const APPOINTMENT_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['in_progress', 'canceled', 'no_show'],
  in_progress: ['completed', 'not_paid'],
  completed: ['not_paid'],
  canceled: [],
  no_show: [],
  not_paid: [],
};

async function validateAndComputeAppointment(
  salonId: string,
  clientId: string,
  collaboratorId: string,
  serviceIds: string[],
  startIso: string,
  ignoreAppointmentId?: string,
) {
  if (!serviceIds || serviceIds.length === 0) {
    throw new Error('AT_LEAST_ONE_SERVICE_REQUIRED');
  }

  const start = new Date(startIso);
  if (isNaN(start.getTime())) {
    throw new Error('INVALID_START_DATE');
  }

  const now = new Date();
  if (start <= now) {
    throw new Error('START_MUST_BE_IN_FUTURE');
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, salonId, isActive: true },
  });
  if (!client) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  const collaborator = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, salonId },
  });
  if (!collaborator) {
    throw new Error('COLLABORATOR_NOT_FOUND');
  }

  const services = await prisma.service.findMany({
    where: { salonId, id: { in: serviceIds }, isActive: true },
  });

  if (services.length !== serviceIds.length) {
    throw new Error('INVALID_SERVICE_IDS');
  }

  const totalMinutes = services.reduce((sum, s) => sum + s.duration, 0);
  const end = new Date(start.getTime() + totalMinutes * 60000);

  const overlapWhere: any = {
    salonId,
    collaboratorId,
    status: { in: APPOINTMENT_BLOCKING_STATUSES },
    start: { lt: end },
    end: { gt: start },
  };

  if (ignoreAppointmentId) {
    overlapWhere.id = { not: ignoreAppointmentId };
  }

  const overlapping = await prisma.appointment.findFirst({ where: overlapWhere });

  if (overlapping) {
    throw new Error('OVERLAPPING_APPOINTMENT');
  }

  return { start, end };
}

const appointmentsRouter = Router();

appointmentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const { dateFrom, dateTo, collaboratorId, status } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      collaboratorId?: string;
      status?: AppointmentStatus;
    };

    const where: any = { salonId };
    const andConditions: any[] = [];

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (isNaN(from.getTime())) {
        res.status(400).json({ error: 'Invalid dateFrom' });
        return;
      }
      andConditions.push({ start: { gte: from } });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (isNaN(to.getTime())) {
        res.status(400).json({ error: 'Invalid dateTo' });
        return;
      }
      andConditions.push({ start: { lte: to } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (collaboratorId) {
      where.collaboratorId = collaboratorId;
    }

    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { start: 'asc' },
      include: { services: true },
    });

    res.json(appointments.map(mapAppointment));
  } catch (error) {
    console.error('Error listing appointments', error);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

appointmentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true },
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    res.json(mapAppointment(appointment));
  } catch (error) {
    console.error('Error fetching appointment', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

appointmentsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { clientId, collaboratorId, serviceIds, start, notes, origin } =
      req.body as {
        clientId?: string;
        collaboratorId?: string;
        serviceIds?: string[];
        start?: string;
        notes?: string;
        origin?: AppointmentOrigin;
      };

    if (!clientId || !collaboratorId || !serviceIds || !start || !origin) {
      res.status(400).json({
        error: 'clientId, collaboratorId, serviceIds, start and origin are required',
      });
      return;
    }

    const salonId = await getDefaultSalonId();

    let computed;
    try {
      computed = await validateAndComputeAppointment(
        salonId,
        clientId,
        collaboratorId,
        serviceIds,
        start,
      );
    } catch (e: any) {
      switch (e.message) {
        case 'AT_LEAST_ONE_SERVICE_REQUIRED':
          res.status(400).json({ error: 'At least one service is required' });
          return;
        case 'INVALID_START_DATE':
          res.status(400).json({ error: 'Invalid start date' });
          return;
        case 'START_MUST_BE_IN_FUTURE':
          res.status(400).json({ error: 'Start time must be in the future' });
          return;
        case 'CLIENT_NOT_FOUND':
          res.status(404).json({ error: 'Client not found' });
          return;
        case 'COLLABORATOR_NOT_FOUND':
          res.status(404).json({ error: 'Collaborator not found' });
          return;
        case 'INVALID_SERVICE_IDS':
          res.status(400).json({ error: 'Invalid serviceIds' });
          return;
        case 'OVERLAPPING_APPOINTMENT':
          res
            .status(409)
            .json({ error: 'Overlapping appointment for collaborator' });
          return;
        default:
          throw e;
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        clientId,
        collaboratorId,
        start: computed.start,
        end: computed.end,
        status: 'pending',
        origin,
        notes,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: { services: true },
    });

    res.status(201).json(mapAppointment(appointment));
  } catch (error) {
    console.error('Error creating appointment', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

appointmentsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      collaboratorId,
      serviceIds,
      start,
      notes,
      origin,
    } = req.body as {
      clientId?: string;
      collaboratorId?: string;
      serviceIds?: string[];
      start?: string;
      notes?: string;
      origin?: AppointmentOrigin;
    };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (existing.status !== 'pending') {
      res
        .status(400)
        .json({ error: "Only appointments with status 'pending' can be edited" });
      return;
    }

    const finalClientId = clientId ?? existing.clientId;
    const finalCollaboratorId = collaboratorId ?? existing.collaboratorId;
    const finalServiceIds =
      serviceIds ?? (existing.services ?? []).map((s: any) => s.serviceId);
    const finalStart = start ?? existing.start.toISOString();

    let computed;
    try {
      computed = await validateAndComputeAppointment(
        salonId,
        finalClientId,
        finalCollaboratorId,
        finalServiceIds,
        finalStart,
        existing.id,
      );
    } catch (e: any) {
      switch (e.message) {
        case 'AT_LEAST_ONE_SERVICE_REQUIRED':
          res.status(400).json({ error: 'At least one service is required' });
          return;
        case 'INVALID_START_DATE':
          res.status(400).json({ error: 'Invalid start date' });
          return;
        case 'START_MUST_BE_IN_FUTURE':
          res.status(400).json({ error: 'Start time must be in the future' });
          return;
        case 'CLIENT_NOT_FOUND':
          res.status(404).json({ error: 'Client not found' });
          return;
        case 'COLLABORATOR_NOT_FOUND':
          res.status(404).json({ error: 'Collaborator not found' });
          return;
        case 'INVALID_SERVICE_IDS':
          res.status(400).json({ error: 'Invalid serviceIds' });
          return;
        case 'OVERLAPPING_APPOINTMENT':
          res
            .status(409)
            .json({ error: 'Overlapping appointment for collaborator' });
          return;
        default:
          throw e;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.appointmentService.deleteMany({
        where: { appointmentId: existing.id },
      });

      const updatedAppointment = await tx.appointment.update({
        where: { id: existing.id },
        data: {
          clientId: finalClientId,
          collaboratorId: finalCollaboratorId,
          start: computed.start,
          end: computed.end,
          origin: origin ?? existing.origin,
          notes: notes ?? existing.notes,
          services: {
            create: finalServiceIds.map((serviceId) => ({ serviceId })),
          },
        },
        include: { services: true },
      });

      return updatedAppointment;
    });

    res.json(mapAppointment(updated));
  } catch (error) {
    console.error('Error updating appointment', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

appointmentsRouter.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: AppointmentStatus };

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true },
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    const currentStatus = appointment.status as AppointmentStatus;
    const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(status)) {
      res.status(400).json({
        error: `Invalid status transition from '${currentStatus}' to '${status}'`,
      });
      return;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status },
      include: { services: true },
    });

    res.json(mapAppointment(updated));
  } catch (error) {
    console.error('Error updating appointment status', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

export { appointmentsRouter };
