"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesRouter = void 0;
// src/routes/messages.ts
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const whatsapp_1 = require("../services/whatsapp");
const messagesRouter = (0, express_1.Router)();
exports.messagesRouter = messagesRouter;
function mapMessageTemplate(t) {
    return {
        id: t.id,
        salonId: t.salonId,
        name: t.name,
        channel: t.channel,
        content: t.content,
        variables: t.variables ?? undefined,
        isActive: t.isActive,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    };
}
function mapMessageLog(log) {
    return {
        id: log.id,
        salonId: log.salonId,
        templateId: log.templateId ?? undefined,
        appointmentId: log.appointmentId ?? undefined,
        clientId: log.clientId,
        channel: log.channel,
        content: log.content,
        status: log.status,
        sentAt: log.sentAt?.toISOString() ?? undefined,
        errorMessage: log.errorMessage ?? undefined,
        createdAt: log.createdAt.toISOString(),
    };
}
// GET /messages/templates - Listar templates do salão
messagesRouter.get('/templates', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { isActive } = req.query;
        const where = { salonId };
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }
        const templates = await prismaClient_1.prisma.messageTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        res.json(templates.map(mapMessageTemplate));
    }
    catch (error) {
        console.error('Error fetching message templates', error);
        res.status(500).json({ error: 'Failed to fetch message templates' });
    }
});
// GET /messages/templates/:id - Buscar template específico
messagesRouter.get('/templates/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { id } = req.params;
        const template = await prismaClient_1.prisma.messageTemplate.findFirst({
            where: { id, salonId },
        });
        if (!template) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }
        res.json(mapMessageTemplate(template));
    }
    catch (error) {
        console.error('Error fetching message template', error);
        res.status(500).json({ error: 'Failed to fetch message template' });
    }
});
// POST /messages/templates - Criar template
messagesRouter.post('/templates', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { name, channel, content, variables, isActive } = req.body;
        if (!name || !channel || !content) {
            res.status(400).json({ error: 'Name, channel, and content are required' });
            return;
        }
        if (!['whatsapp', 'sms', 'email'].includes(channel)) {
            res.status(400).json({ error: 'Invalid channel. Must be whatsapp, sms, or email' });
            return;
        }
        const template = await prismaClient_1.prisma.messageTemplate.create({
            data: {
                salonId,
                name,
                channel: channel,
                content,
                variables: variables ?? null,
                isActive: isActive ?? true,
            },
        });
        res.status(201).json(mapMessageTemplate(template));
    }
    catch (error) {
        console.error('Error creating message template', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Template with this name already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to create message template' });
    }
});
// PATCH /messages/templates/:id - Atualizar template
messagesRouter.patch('/templates/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { id } = req.params;
        const { name, channel, content, variables, isActive } = req.body;
        const existing = await prismaClient_1.prisma.messageTemplate.findFirst({
            where: { id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (channel !== undefined) {
            if (!['whatsapp', 'sms', 'email'].includes(channel)) {
                res.status(400).json({ error: 'Invalid channel' });
                return;
            }
            data.channel = channel;
        }
        if (content !== undefined)
            data.content = content;
        if (variables !== undefined)
            data.variables = variables;
        if (isActive !== undefined)
            data.isActive = isActive;
        const updated = await prismaClient_1.prisma.messageTemplate.update({
            where: { id },
            data,
        });
        res.json(mapMessageTemplate(updated));
    }
    catch (error) {
        console.error('Error updating message template', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Template with this name already exists' });
            return;
        }
        res.status(500).json({ error: 'Failed to update message template' });
    }
});
// DELETE /messages/templates/:id - Deletar template
messagesRouter.delete('/templates/:id', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { id } = req.params;
        const existing = await prismaClient_1.prisma.messageTemplate.findFirst({
            where: { id, salonId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Template not found' });
            return;
        }
        await prismaClient_1.prisma.messageTemplate.delete({
            where: { id },
        });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting message template', error);
        res.status(500).json({ error: 'Failed to delete message template' });
    }
});
// POST /messages/send - Enviar mensagem usando template
messagesRouter.post('/send', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { templateId, clientId, appointmentId, variables, } = req.body;
        if (!templateId || !clientId) {
            res.status(400).json({ error: 'Template ID and client ID are required' });
            return;
        }
        // Buscar template
        const template = await prismaClient_1.prisma.messageTemplate.findFirst({
            where: { id: templateId, salonId, isActive: true },
        });
        if (!template) {
            res.status(404).json({ error: 'Template not found or inactive' });
            return;
        }
        // Buscar cliente
        const client = await prismaClient_1.prisma.client.findFirst({
            where: { id: clientId, salonId, isActive: true },
        });
        if (!client) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }
        // Buscar agendamento se fornecido
        let appointment = null;
        if (appointmentId) {
            appointment = await prismaClient_1.prisma.appointment.findFirst({
                where: { id: appointmentId, salonId },
                include: {
                    services: {
                        include: {
                            service: true,
                        },
                    },
                    collaborator: true,
                },
            });
        }
        // Preparar variáveis padrão
        const defaultVariables = {
            cliente_nome: client.name,
            cliente_telefone: client.phone,
            ...(appointment && {
                data: new Date(appointment.start).toLocaleDateString('pt-BR'),
                horario: new Date(appointment.start).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                colaborador: appointment.collaborator.name,
                servico: appointment.services
                    .map((as) => as.service.name)
                    .join(', '),
            }),
            ...variables,
        };
        // Substituir variáveis no template
        const messageContent = (0, whatsapp_1.replaceTemplateVariables)(template.content, defaultVariables);
        // Criar log de mensagem
        const messageLog = await prismaClient_1.prisma.messageLog.create({
            data: {
                salonId,
                templateId,
                appointmentId: appointmentId ?? null,
                clientId,
                channel: template.channel,
                content: messageContent,
                status: 'pending',
            },
        });
        // Enviar mensagem (apenas WhatsApp por enquanto)
        if (template.channel === 'whatsapp') {
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
            if (!result.success) {
                res.status(500).json({
                    error: 'Failed to send message',
                    details: result.error,
                    logId: messageLog.id,
                });
                return;
            }
        }
        else {
            // Para SMS e Email, apenas criar o log por enquanto
            // TODO: Implementar envio de SMS e Email
            res.status(501).json({
                error: 'SMS and Email sending not yet implemented',
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
        console.error('Error sending message', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
// GET /messages/logs - Histórico de mensagens enviadas
messagesRouter.get('/logs', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const { clientId, appointmentId, status, limit = '50' } = req.query;
        const where = { salonId };
        if (clientId)
            where.clientId = clientId;
        if (appointmentId)
            where.appointmentId = appointmentId;
        if (status)
            where.status = status;
        const logs = await prismaClient_1.prisma.messageLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit, 10),
            include: {
                template: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                client: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
        });
        res.json(logs.map(mapMessageLog));
    }
    catch (error) {
        console.error('Error fetching message logs', error);
        res.status(500).json({ error: 'Failed to fetch message logs' });
    }
});
// POST /messages/test - Testar envio de mensagem
messagesRouter.post('/test', async (req, res) => {
    try {
        const { phone, message, config } = req.body;
        if (!phone || !message) {
            res.status(400).json({ error: 'Phone and message are required' });
            return;
        }
        const result = await (0, whatsapp_1.sendWhatsAppMessage)({
            to: phone,
            message,
            config,
        });
        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
            });
            return;
        }
        res.json({
            success: true,
            messageId: result.messageId,
        });
    }
    catch (error) {
        console.error('Error testing message', error);
        res.status(500).json({ error: 'Failed to test message' });
    }
});
// POST /messages/test-connection - Testar conexão WhatsApp
messagesRouter.post('/test-connection', async (req, res) => {
    try {
        const { apiKey, instanceId, apiUrl } = req.body;
        const result = await (0, whatsapp_1.testWhatsAppConnection)({
            apiKey,
            instanceId,
            apiUrl,
        });
        if (!result.success) {
            res.status(500).json({
                success: false,
                error: result.error,
            });
            return;
        }
        res.json({
            success: true,
        });
    }
    catch (error) {
        console.error('Error testing connection', error);
        res.status(500).json({ error: 'Failed to test connection' });
    }
});
