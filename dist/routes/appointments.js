"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appointmentsRouter = void 0;
exports.sendAppointmentConfirmation = sendAppointmentConfirmation;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const whatsapp_1 = require("../services/whatsapp");
const rateLimiter_1 = require("../middleware/rateLimiter");
function mapAppointment(a) {
    return {
        id: a.id,
        salonId: a.salonId,
        clientId: a.clientId,
        collaboratorId: a.collaboratorId,
        serviceIds: (a.services ?? []).map((s) => s.serviceId),
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
const APPOINTMENT_BLOCKING_STATUSES = [
    'pending',
    'in_progress',
    'completed',
    'not_paid',
];
const APPOINTMENT_STATUS_TRANSITIONS = {
    pending: ['in_progress', 'canceled', 'no_show'],
    in_progress: ['completed', 'not_paid'],
    completed: ['not_paid'],
    canceled: [],
    no_show: [],
    not_paid: [],
};
/**
 * Envia mensagem de confirmação automaticamente quando um agendamento é criado/atualizado
 */
async function sendAppointmentConfirmation(appointment) {
    try {
        const salonId = appointment.salonId; // Already validated from appointment
        // Buscar template de confirmação ativo
        const template = await prismaClient_1.prisma.messageTemplate.findFirst({
            where: {
                salonId,
                name: 'Confirmação de Agendamento',
                channel: 'whatsapp',
                isActive: true,
            },
        });
        if (!template) {
            // Se não houver template, não envia (não é erro)
            return;
        }
        const client = appointment.client;
        if (!client || !client.phone) {
            return;
        }
        // Preparar variáveis
        const variables = {
            cliente_nome: client.name,
            data: new Date(appointment.start).toLocaleDateString('pt-BR'),
            horario: new Date(appointment.start).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            }),
            colaborador: appointment.collaborator?.name || '',
            servico: appointment.services
                ?.map((as) => as.service?.name || '')
                .filter(Boolean)
                .join(', ') || '',
        };
        // Substituir variáveis
        const messageContent = (0, whatsapp_1.replaceTemplateVariables)(template.content, variables);
        // Criar log
        const messageLog = await prismaClient_1.prisma.messageLog.create({
            data: {
                salonId,
                templateId: template.id,
                appointmentId: appointment.id,
                clientId: client.id,
                channel: 'whatsapp',
                content: messageContent,
                status: 'pending',
            },
        });
        // Enviar mensagem
        const result = await (0, whatsapp_1.sendWhatsAppMessage)({
            to: client.phone,
            message: messageContent,
        });
        // Atualizar log
        await prismaClient_1.prisma.messageLog.update({
            where: { id: messageLog.id },
            data: {
                status: result.success ? 'sent' : 'failed',
                sentAt: result.success ? new Date() : null,
                errorMessage: result.error ?? null,
            },
        });
    }
    catch (error) {
        console.error('Error in sendAppointmentConfirmation', error);
        // Não propaga o erro para não bloquear a criação do agendamento
    }
}
async function validateAndComputeAppointment(salonId, clientId, collaboratorId, serviceIds, startIso, ignoreAppointmentId) {
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
    const client = await prismaClient_1.prisma.client.findFirst({
        where: { id: clientId, salonId, isActive: true },
    });
    if (!client) {
        throw new Error('CLIENT_NOT_FOUND');
    }
    const collaborator = await prismaClient_1.prisma.collaborator.findFirst({
        where: { id: collaboratorId, salonId },
    });
    if (!collaborator) {
        throw new Error('COLLABORATOR_NOT_FOUND');
    }
    const services = await prismaClient_1.prisma.service.findMany({
        where: { salonId, id: { in: serviceIds }, isActive: true },
    });
    if (services.length !== serviceIds.length) {
        throw new Error('INVALID_SERVICE_IDS');
    }
    const totalMinutes = services.reduce((sum, s) => sum + s.duration, 0);
    const end = new Date(start.getTime() + totalMinutes * 60000);
    const overlapWhere = {
        salonId,
        collaboratorId,
        status: { in: APPOINTMENT_BLOCKING_STATUSES },
        start: { lt: end },
        end: { gt: start },
    };
    if (ignoreAppointmentId) {
        overlapWhere.id = { not: ignoreAppointmentId };
    }
    const overlapping = await prismaClient_1.prisma.appointment.findFirst({ where: overlapWhere });
    if (overlapping) {
        throw new Error('OVERLAPPING_APPOINTMENT');
    }
    return { start, end };
}
const appointmentsRouter = (0, express_1.Router)();
exports.appointmentsRouter = appointmentsRouter;
appointmentsRouter.get('/', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { dateFrom, dateTo, collaboratorId, status } = req.query;
        const where = { salonId };
        const andConditions = [];
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
        const appointments = await prismaClient_1.prisma.appointment.findMany({
            where,
            orderBy: { start: 'asc' },
            include: { services: true },
        });
        res.json(appointments.map(mapAppointment));
    }
    catch (error) {
        console.error('Error listing appointments', error);
        res.status(500).json({ error: 'Failed to list appointments' });
    }
});
appointmentsRouter.get('/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const appointment = await prismaClient_1.prisma.appointment.findFirst({
            where: { id: req.params.id, salonId },
            include: { services: true },
        });
        if (!appointment) {
            res.status(404).json({ error: 'Appointment not found' });
            return;
        }
        res.json(mapAppointment(appointment));
    }
    catch (error) {
        console.error('Error fetching appointment', error);
        res.status(500).json({ error: 'Failed to fetch appointment' });
    }
});
appointmentsRouter.post('/', rateLimiter_1.createRateLimiter, async (req, res) => {
    try {
        const { clientId, collaboratorId, serviceIds, start, notes, origin } = req.body;
        if (!clientId || !collaboratorId || !serviceIds || !start || !origin) {
            res.status(400).json({
                error: 'clientId, collaboratorId, serviceIds, start and origin are required',
            });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        let computed;
        try {
            computed = await validateAndComputeAppointment(salonId, clientId, collaboratorId, serviceIds, start);
        }
        catch (e) {
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
        const appointment = await prismaClient_1.prisma.appointment.create({
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
        // Tentar enviar mensagem de confirmação automaticamente (não bloqueia se falhar)
        try {
            await sendAppointmentConfirmation(appointment);
        }
        catch (error) {
            console.error('Failed to send confirmation message (non-blocking)', error);
        }
        res.status(201).json(mapAppointment(appointment));
    }
    catch (error) {
        console.error('Error creating appointment', error);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});
appointmentsRouter.patch('/:id', async (req, res) => {
    try {
        const { clientId, collaboratorId, serviceIds, start, notes, origin, } = req.body;
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const existing = await prismaClient_1.prisma.appointment.findFirst({
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
        const finalServiceIds = serviceIds ?? (existing.services ?? []).map((s) => s.serviceId);
        const finalStart = start ?? existing.start.toISOString();
        let computed;
        try {
            computed = await validateAndComputeAppointment(salonId, finalClientId, finalCollaboratorId, finalServiceIds, finalStart, existing.id);
        }
        catch (e) {
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
        const updated = await prismaClient_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error('Error updating appointment', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
appointmentsRouter.post('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ error: 'status is required' });
            return;
        }
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const appointment = await prismaClient_1.prisma.appointment.findFirst({
            where: { id: req.params.id, salonId },
            include: { services: true },
        });
        if (!appointment) {
            res.status(404).json({ error: 'Appointment not found' });
            return;
        }
        const currentStatus = appointment.status;
        const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(status)) {
            res.status(400).json({
                error: `Invalid status transition from '${currentStatus}' to '${status}'`,
            });
            return;
        }
        const updated = await prismaClient_1.prisma.appointment.update({
            where: { id: appointment.id },
            data: { status },
            include: { services: true },
        });
        res.json(mapAppointment(updated));
    }
    catch (error) {
        console.error('Error updating appointment status', error);
        res.status(500).json({ error: 'Failed to update appointment status' });
    }
});
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
appointmentsRouter.post('/:id/order/ensure', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const appointment = await prismaClient_1.prisma.appointment.findFirst({
            where: { id: req.params.id, salonId },
            include: { services: true, order: true },
        });
        if (!appointment) {
            res.status(404).json({ error: 'Appointment not found' });
            return;
        }
        let existingOrder = await prismaClient_1.prisma.order.findFirst({
            where: {
                salonId,
                appointment: { id: appointment.id },
            },
            include: { items: true, appointment: true },
        });
        if (!existingOrder && appointment.orderId) {
            existingOrder = await prismaClient_1.prisma.order.findFirst({
                where: { id: appointment.orderId, salonId },
                include: { items: true, appointment: true },
            });
        }
        if (!existingOrder) {
            existingOrder = await prismaClient_1.prisma.order.findFirst({
                where: {
                    salonId,
                    clientId: appointment.clientId,
                    status: 'open',
                    appointment: null,
                },
                include: { items: true, appointment: true },
            });
        }
        const result = await prismaClient_1.prisma.$transaction(async (tx) => {
            let order = existingOrder;
            if (!order) {
                order = await tx.order.create({
                    data: {
                        salonId,
                        clientId: appointment.clientId,
                        status: 'open',
                        finalValue: 0,
                    },
                    include: { items: true, appointment: true },
                });
            }
            else {
                order = await tx.order.findFirst({
                    where: { id: order.id },
                    include: { items: true, appointment: true },
                });
            }
            if (!order) {
                throw new Error('ORDER_CREATION_FAILED');
            }
            if (!appointment.orderId || appointment.orderId !== order.id) {
                await tx.appointment.update({
                    where: { id: appointment.id },
                    data: { orderId: order.id },
                });
            }
            const serviceIds = (appointment.services ?? []).map((s) => s.serviceId);
            const services = await tx.service.findMany({
                where: { salonId, id: { in: serviceIds } },
            });
            const servicesById = new Map();
            for (const s of services) {
                servicesById.set(s.id, s);
            }
            const existingItems = await tx.orderItem.findMany({
                where: { orderId: order.id, salonId },
            });
            for (const apService of appointment.services ?? []) {
                const serviceId = apService.serviceId;
                const alreadyExists = existingItems.some((it) => {
                    return (it.type === 'service' &&
                        it.serviceId === serviceId &&
                        it.collaboratorId === appointment.collaboratorId);
                });
                if (alreadyExists) {
                    continue;
                }
                const service = servicesById.get(serviceId);
                if (!service) {
                    continue;
                }
                await tx.orderItem.create({
                    data: {
                        orderId: order.id,
                        salonId,
                        type: 'service',
                        serviceId,
                        collaboratorId: appointment.collaboratorId,
                        quantity: 1,
                        price: Number(service.price),
                        commission: 0,
                    },
                });
            }
            const allItems = await tx.orderItem.findMany({
                where: { orderId: order.id, salonId },
            });
            const finalValue = allItems.reduce((sum, it) => {
                const q = it.quantity ?? 1;
                return sum + Number(it.price) * q;
            }, 0);
            const finalOrder = await tx.order.update({
                where: { id: order.id },
                data: { finalValue },
                include: { items: true, appointment: true },
            });
            return finalOrder;
        });
        res.json(mapOrder(result));
    }
    catch (error) {
        console.error('Error ensuring order for appointment', error);
        res.status(500).json({ error: 'Failed to ensure order for appointment' });
    }
});
// POST /appointments/:id/send-confirmation - Enviar confirmação manualmente
appointmentsRouter.post('/:id/send-confirmation', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { id } = req.params;
        const { templateId } = req.body;
        const appointment = await prismaClient_1.prisma.appointment.findFirst({
            where: { id, salonId },
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
        if (!appointment) {
            res.status(404).json({ error: 'Appointment not found' });
            return;
        }
        if (!appointment.client.phone) {
            res.status(400).json({ error: 'Client does not have a phone number' });
            return;
        }
        // Se templateId fornecido, usar esse template, senão buscar o padrão
        let template;
        if (templateId) {
            template = await prismaClient_1.prisma.messageTemplate.findFirst({
                where: { id: templateId, salonId, isActive: true },
            });
        }
        else {
            template = await prismaClient_1.prisma.messageTemplate.findFirst({
                where: {
                    salonId,
                    name: 'Confirmação de Agendamento',
                    channel: 'whatsapp',
                    isActive: true,
                },
            });
        }
        if (!template) {
            res.status(404).json({ error: 'No active confirmation template found' });
            return;
        }
        // Preparar variáveis
        const variables = {
            cliente_nome: appointment.client.name,
            data: new Date(appointment.start).toLocaleDateString('pt-BR'),
            horario: new Date(appointment.start).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            }),
            colaborador: appointment.collaborator?.name || '',
            servico: appointment.services
                ?.map((as) => as.service?.name || '')
                .filter(Boolean)
                .join(', ') || '',
        };
        // Substituir variáveis
        const messageContent = (0, whatsapp_1.replaceTemplateVariables)(template.content, variables);
        // Criar log
        const messageLog = await prismaClient_1.prisma.messageLog.create({
            data: {
                salonId,
                templateId: template.id,
                appointmentId: appointment.id,
                clientId: appointment.client.id,
                channel: 'whatsapp',
                content: messageContent,
                status: 'pending',
            },
        });
        // Enviar mensagem
        const result = await (0, whatsapp_1.sendWhatsAppMessage)({
            to: appointment.client.phone,
            message: messageContent,
        });
        // Atualizar log
        await prismaClient_1.prisma.messageLog.update({
            where: { id: messageLog.id },
            data: {
                status: result.success ? 'sent' : 'failed',
                sentAt: result.success ? new Date() : null,
                errorMessage: result.error ?? null,
            },
        });
        if (!result.success) {
            res.status(500).json({
                error: 'Failed to send message',
                details: result.error,
                logId: messageLog.id,
            });
            return;
        }
        res.json({
            success: true,
            logId: messageLog.id,
            message: messageContent,
        });
    }
    catch (error) {
        console.error('Error sending confirmation', error);
        res.status(500).json({ error: 'Failed to send confirmation' });
    }
});
