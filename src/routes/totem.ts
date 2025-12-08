// src/routes/totem.ts
// Rotas públicas do totem (sem autenticação JWT completa)
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';
import { AppointmentOrigin, AppointmentStatus } from '../types/enums';

const totemRouter = Router();

const APPOINTMENT_BLOCKING_STATUSES: AppointmentStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'not_paid',
];

// POST /totem/client/login - Login por telefone
totemRouter.post('/client/login', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const { phone } = req.body as { phone: string };

    if (!phone) {
      res.status(400).json({ error: 'Phone is required' });
      return;
    }

    // Limpar telefone (remover caracteres não numéricos)
    const cleanedPhone = phone.replace(/\D/g, '');

    // Validar comprimento mínimo do telefone para evitar matches incorretos
    if (cleanedPhone.length < 10) {
      res.status(400).json({ error: 'Número de telefone inválido. Informe o número completo com DDD.' });
      return;
    }

    const client = await prisma.client.findFirst({
      where: {
        salonId,
        phone: cleanedPhone, // Match exato em vez de contains
        isActive: true,
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Retornar dados básicos do cliente (sem informações sensíveis)
    res.json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email ?? undefined,
    });
  } catch (error) {
    console.error('Error in totem client login', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /totem/client/register - Cadastro rápido de cliente
totemRouter.post('/client/register', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const { name, phone, email } = req.body as {
      name: string;
      phone: string;
      email?: string;
    };

    if (!name || !phone) {
      res.status(400).json({ error: 'Name and phone are required' });
      return;
    }

    // Limpar telefone
    const cleanedPhone = phone.replace(/\D/g, '');

    // Validar comprimento mínimo do telefone
    if (cleanedPhone.length < 10) {
      res.status(400).json({ error: 'Número de telefone inválido. Informe o número completo com DDD.' });
      return;
    }

    // Verificar se já existe
    const existing = await prisma.client.findFirst({
      where: {
        salonId,
        phone: cleanedPhone, // Match exato
      },
    });

    if (existing) {
      if (existing.isActive) {
        res.status(409).json({
          error: 'Client already exists',
          client: {
            id: existing.id,
            name: existing.name,
            phone: existing.phone,
          },
        });
        return;
      } else {
        // Reativar cliente existente
        const reactivated = await prisma.client.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            name,
            email: email ?? existing.email,
          },
        });

        res.json({
          id: reactivated.id,
          name: reactivated.name,
          phone: reactivated.phone,
          email: reactivated.email ?? undefined,
        });
        return;
      }
    }

    // Criar novo cliente
    const client = await prisma.client.create({
      data: {
        salonId,
        name,
        phone: cleanedPhone,
        email: email ?? null,
      },
    });

    res.status(201).json({
      id: client.id,
      name: client.name,
      phone: client.phone,
      email: client.email ?? undefined,
    });
  } catch (error: any) {
    console.error('Error in totem client register', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Phone already registered' });
      return;
    }
    res.status(500).json({ error: 'Failed to register client' });
  }
});

// GET /totem/services - Listar serviços ativos (público)
totemRouter.get('/services', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const services = await prisma.service.findMany({
      where: {
        salonId,
        isActive: true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    res.json(
      services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? undefined,
        duration: s.duration,
        price: Number(s.price),
        category: s.category
          ? {
              id: s.category.id,
              name: s.category.name,
            }
          : undefined,
      }))
    );
  } catch (error) {
    console.error('Error fetching totem services', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /totem/collaborators - Listar profissionais ativos
totemRouter.get('/collaborators', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const { serviceCategoryIds } = req.query as {
      serviceCategoryIds?: string;
    };

    const where: any = {
      salonId,
      status: 'active',
    };

    // Se fornecido, filtrar por categorias de serviços
    if (serviceCategoryIds) {
      const categoryIds = (serviceCategoryIds as string).split(',');
      where.serviceCategories = {
        hasSome: categoryIds,
      };
    }

    const collaborators = await prisma.collaborator.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.json(
      collaborators.map((c) => ({
        id: c.id,
        name: c.name,
        serviceCategories: c.serviceCategories,
      }))
    );
  } catch (error) {
    console.error('Error fetching totem collaborators', error);
    res.status(500).json({ error: 'Failed to fetch collaborators' });
  }
});

// GET /totem/availability - Verificar disponibilidade
totemRouter.get('/availability', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const { collaboratorId, date, duration } = req.query as {
      collaboratorId: string;
      date: string; // YYYY-MM-DD
      duration: string; // minutos
    };

    if (!collaboratorId || !date || !duration) {
      res.status(400).json({
        error: 'collaboratorId, date, and duration are required',
      });
      return;
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    const durationMinutes = parseInt(duration, 10);
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      res.status(400).json({ error: 'Invalid duration' });
      return;
    }

    // Verificar se colaborador existe
    const collaborator = await prisma.collaborator.findFirst({
      where: { id: collaboratorId, salonId, status: 'active' },
    });

    if (!collaborator) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    // Definir horário de trabalho (pode ser configurável no futuro)
    const workStart = 9; // 9h
    const workEnd = 18; // 18h
    const slotDuration = 30; // 30 minutos por slot

    // Buscar agendamentos do dia
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        salonId,
        collaboratorId,
        status: { in: APPOINTMENT_BLOCKING_STATUSES },
        start: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { start: 'asc' },
    });

    // Calcular slots disponíveis
    const availableSlots: string[] = [];
    const slots: Date[] = [];

    // Gerar todos os slots do dia
    for (let hour = workStart; hour < workEnd; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const slot = new Date(targetDate);
        slot.setHours(hour, minute, 0, 0);
        slots.push(slot);
      }
    }

    // Verificar cada slot
    for (const slotStart of slots) {
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

      // Verificar se o slot está no horário de trabalho
      if (slotEnd.getHours() > workEnd || slotEnd.getHours() === workEnd && slotEnd.getMinutes() > 0) {
        continue;
      }

      // Verificar se há conflito com agendamentos existentes
      const hasConflict = appointments.some((apt) => {
        const aptStart = new Date(apt.start);
        const aptEnd = new Date(apt.end);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      if (!hasConflict && slotStart > new Date()) {
        // Slot disponível e no futuro
        availableSlots.push(slotStart.toISOString());
      }
    }

    res.json({
      collaboratorId,
      date,
      availableSlots,
      totalSlots: availableSlots.length,
    });
  } catch (error) {
    console.error('Error checking availability', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// POST /totem/appointments - Criar agendamento pelo totem
totemRouter.post('/appointments', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const { clientId, collaboratorId, serviceIds, start } = req.body as {
      clientId: string;
      collaboratorId: string;
      serviceIds: string[];
      start: string; // ISO string
    };

    if (!clientId || !collaboratorId || !serviceIds || !start) {
      res.status(400).json({
        error: 'clientId, collaboratorId, serviceIds, and start are required',
      });
      return;
    }

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      res.status(400).json({ error: 'At least one service is required' });
      return;
    }

    // Validar cliente
    const client = await prisma.client.findFirst({
      where: { id: clientId, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Validar colaborador
    const collaborator = await prisma.collaborator.findFirst({
      where: { id: collaboratorId, salonId, status: 'active' },
    });

    if (!collaborator) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    // Validar serviços
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        salonId,
        isActive: true,
      },
    });

    if (services.length !== serviceIds.length) {
      res.status(400).json({ error: 'Invalid service IDs' });
      return;
    }

    // Validar data
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) {
      res.status(400).json({ error: 'Invalid start date' });
      return;
    }

    if (startDate <= new Date()) {
      res.status(400).json({ error: 'Start time must be in the future' });
      return;
    }

    // Calcular duração total
    const totalMinutes = services.reduce((sum, s) => sum + s.duration, 0);
    const endDate = new Date(startDate.getTime() + totalMinutes * 60000);

    // Verificar conflitos
    const overlapping = await prisma.appointment.findFirst({
      where: {
        salonId,
        collaboratorId,
        status: { in: APPOINTMENT_BLOCKING_STATUSES },
        start: { lt: endDate },
        end: { gt: startDate },
      },
    });

    if (overlapping) {
      res.status(409).json({ error: 'Time slot not available' });
      return;
    }

    // Criar agendamento
    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        clientId,
        collaboratorId,
        start: startDate,
        end: endDate,
        status: 'pending',
        origin: 'totem',
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        collaborator: true,
        client: true,
      },
    });

    // Tentar enviar mensagem de confirmação (não bloqueia se falhar)
    // Por enquanto, apenas log. A mensagem será enviada automaticamente pelo sistema
    // quando o agendamento for processado

    res.status(201).json({
      id: appointment.id,
      clientId: appointment.clientId,
      collaboratorId: appointment.collaboratorId,
      serviceIds: appointment.services.map((as: any) => as.serviceId),
      start: appointment.start.toISOString(),
      end: appointment.end.toISOString(),
      status: appointment.status,
      origin: appointment.origin,
    });
  } catch (error) {
    console.error('Error creating totem appointment', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

export { totemRouter };

