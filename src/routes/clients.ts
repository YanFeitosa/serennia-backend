import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { sanitizeString, validateEmail, validatePhone, sanitizePhone } from '../utils/validation';
import { createRateLimiter } from '../middleware/rateLimiter';

function mapClient(c: any) {
  return {
    id: c.id,
    salonId: c.salonId,
    name: c.name,
    phone: c.phone,
    email: c.email ?? undefined,
    lastVisit: c.lastVisit ? c.lastVisit.toISOString() : undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const clientsRouter = Router();

clientsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const clients = await prisma.client.findMany({
      where: { salonId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(clients.map(mapClient));
  } catch (error) {
    console.error('Error listing clients:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

clientsRouter.post('/', createRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, phone, email } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
    };

    if (!name || !phone) {
      res.status(400).json({ error: 'name and phone are required' });
      return;
    }

    // Validate and sanitize input
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName || sanitizedName.length < 2) {
      res.status(400).json({ error: 'name must be at least 2 characters long' });
      return;
    }

    if (!validatePhone(phone)) {
      res.status(400).json({ error: 'Invalid phone number format' });
      return;
    }
    const sanitizedPhone = sanitizePhone(phone);

    let sanitizedEmail: string | undefined;
    if (email) {
      if (!validateEmail(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      sanitizedEmail = sanitizeString(email);
    }

    const salonId = req.user.salonId;

    const client = await prisma.client.create({
      data: {
        salonId,
        name: sanitizedName,
        phone: sanitizedPhone,
        email: sanitizedEmail,
      },
    });

    res.status(201).json(mapClient(client));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res.status(409).json({ error: 'Client with this phone or email already exists' });
      return;
    }
    console.error('Error creating client:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to create client' });
  }
});

clientsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(mapClient(client));
  } catch (error) {
    console.error('Error fetching client:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

clientsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, phone, email, lastVisit } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      lastVisit?: string | null;
    };

    const salonId = req.user.salonId;

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) {
      const sanitizedName = sanitizeString(name);
      if (sanitizedName.length < 2) {
        res.status(400).json({ error: 'name must be at least 2 characters long' });
        return;
      }
      data.name = sanitizedName;
    }
    if (phone !== undefined) {
      if (!validatePhone(phone)) {
        res.status(400).json({ error: 'Invalid phone number format' });
        return;
      }
      data.phone = sanitizePhone(phone);
    }
    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
      data.email = email ? sanitizeString(email) : null;
    }
    if (lastVisit !== undefined) {
      data.lastVisit = lastVisit ? new Date(lastVisit) : null;
    }

    const updated = await prisma.client.update({
      where: { id: existing.id },
      data,
    });

    res.json(mapClient(updated));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res.status(409).json({ error: 'Client with this phone or email already exists' });
      return;
    }
    console.error('Error updating client:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to update client' });
  }
});

clientsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await prisma.client.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export { clientsRouter };
