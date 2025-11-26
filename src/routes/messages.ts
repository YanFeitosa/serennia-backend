// src/routes/messages.ts
import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage, replaceTemplateVariables, testWhatsAppConnection } from '../services/whatsapp';
import { MessageChannel, MessageStatus } from '../types/enums';

const messagesRouter = Router();

function mapMessageTemplate(t: any) {
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

function mapMessageLog(log: any) {
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
messagesRouter.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { isActive } = req.query;

    const where: any = { salonId };
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const templates = await prisma.messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(templates.map(mapMessageTemplate));
  } catch (error) {
    console.error('Error fetching message templates', error);
    res.status(500).json({ error: 'Failed to fetch message templates' });
  }
});

// GET /messages/templates/:id - Buscar template específico
messagesRouter.get('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { id } = req.params;

    const template = await prisma.messageTemplate.findFirst({
      where: { id, salonId },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json(mapMessageTemplate(template));
  } catch (error) {
    console.error('Error fetching message template', error);
    res.status(500).json({ error: 'Failed to fetch message template' });
  }
});

// POST /messages/templates - Criar template
messagesRouter.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { name, channel, content, variables, isActive } = req.body as {
      name: string;
      channel: string;
      content: string;
      variables?: any;
      isActive?: boolean;
    };

    if (!name || !channel) {
      res.status(400).json({ error: 'Name and channel are required' });
      return;
    }
    
    // Content can be empty initially, but we'll set a default if not provided
    const templateContent = content || '';

    if (!['whatsapp', 'sms', 'email'].includes(channel)) {
      res.status(400).json({ error: 'Invalid channel. Must be whatsapp, sms, or email' });
      return;
    }

    const template = await prisma.messageTemplate.create({
      data: {
        salonId,
        name,
        channel: channel as MessageChannel,
        content: templateContent,
        variables: variables ?? null,
        isActive: isActive ?? true,
      },
    });

    res.status(201).json(mapMessageTemplate(template));
  } catch (error: any) {
    console.error('Error creating message template', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Template with this name already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create message template' });
  }
});

// PATCH /messages/templates/:id - Atualizar template
messagesRouter.patch('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { id } = req.params;
    const { name, channel, content, variables, isActive } = req.body as {
      name?: string;
      channel?: string;
      content?: string;
      variables?: any;
      isActive?: boolean;
    };

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (channel !== undefined) {
      if (!['whatsapp', 'sms', 'email'].includes(channel)) {
        res.status(400).json({ error: 'Invalid channel' });
        return;
      }
      data.channel = channel as MessageChannel;
    }
    if (content !== undefined) data.content = content;
    if (variables !== undefined) data.variables = variables;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data,
    });

    res.json(mapMessageTemplate(updated));
  } catch (error: any) {
    console.error('Error updating message template', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Template with this name already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update message template' });
  }
});

// DELETE /messages/templates/:id - Deletar template
messagesRouter.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { id } = req.params;

    const existing = await prisma.messageTemplate.findFirst({
      where: { id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await prisma.messageTemplate.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting message template', error);
    res.status(500).json({ error: 'Failed to delete message template' });
  }
});

// POST /messages/send - Enviar mensagem usando template
messagesRouter.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const {
      templateId,
      clientId,
      appointmentId,
      variables,
    } = req.body as {
      templateId: string;
      clientId: string;
      appointmentId?: string;
      variables?: Record<string, string | number>;
    };

    if (!templateId || !clientId) {
      res.status(400).json({ error: 'Template ID and client ID are required' });
      return;
    }

    // Buscar template
    const template = await prisma.messageTemplate.findFirst({
      where: { id: templateId, salonId, isActive: true },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found or inactive' });
      return;
    }

    // Buscar cliente
    const client = await prisma.client.findFirst({
      where: { id: clientId, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Buscar agendamento se fornecido
    let appointment: any = null;
    if (appointmentId) {
      appointment = await prisma.appointment.findFirst({
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
    const defaultVariables: Record<string, string | number> = {
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
          .map((as: any) => as.service.name)
          .join(', '),
      }),
      ...variables,
    };

    // Substituir variáveis no template
    const messageContent = replaceTemplateVariables(template.content, defaultVariables);

    // Criar log de mensagem
    const messageLog = await prisma.messageLog.create({
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
      const result = await sendWhatsAppMessage({
        to: client.phone,
        message: messageContent,
      });

      // Atualizar log
      await prisma.messageLog.update({
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
    } else {
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
  } catch (error) {
    console.error('Error sending message', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /messages/logs - Histórico de mensagens enviadas
messagesRouter.get('/logs', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const { clientId, appointmentId, status, limit = '50' } = req.query;

    const where: any = { salonId };
    if (clientId) where.clientId = clientId as string;
    if (appointmentId) where.appointmentId = appointmentId as string;
    if (status) where.status = status as string;

    const logs = await prisma.messageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
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
  } catch (error) {
    console.error('Error fetching message logs', error);
    res.status(500).json({ error: 'Failed to fetch message logs' });
  }
});

// POST /messages/test - Testar envio de mensagem
messagesRouter.post('/test', async (req: AuthRequest, res: Response) => {
  try {
    const { phone, message, config } = req.body as {
      phone: string;
      message: string;
      config?: {
        apiKey?: string;
        instanceId?: string;
        apiUrl?: string;
      };
    };

    if (!phone || !message) {
      res.status(400).json({ error: 'Phone and message are required' });
      return;
    }

    const result = await sendWhatsAppMessage({
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
  } catch (error) {
    console.error('Error testing message', error);
    res.status(500).json({ error: 'Failed to test message' });
  }
});

// POST /messages/test-connection - Testar conexão WhatsApp
messagesRouter.post('/test-connection', async (req: AuthRequest, res: Response) => {
  try {
    const { apiKey, instanceId, apiUrl } = req.body as {
      apiKey?: string;
      instanceId?: string;
      apiUrl?: string;
    };

    const result = await testWhatsAppConnection({
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
  } catch (error) {
    console.error('Error testing connection', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export { messagesRouter };

