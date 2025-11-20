import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';

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

clientsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const clients = await prisma.client.findMany({
      where: { salonId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(clients.map(mapClient));
  } catch (error) {
    console.error('Error listing clients', error);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

clientsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, phone, email } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
    };

    if (!name || !phone) {
      res.status(400).json({ error: 'name and phone are required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    const client = await prisma.client.create({
      data: {
        salonId,
        name,
        phone,
        email,
      },
    });

    res.status(201).json(mapClient(client));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res.status(409).json({ error: 'Client with this phone or email already exists' });
      return;
    }
    console.error('Error creating client', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

clientsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(mapClient(client));
  } catch (error) {
    console.error('Error fetching client', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

clientsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, phone, email, lastVisit } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      lastVisit?: string | null;
    };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
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
    console.error('Error updating client', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

clientsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

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
    console.error('Error deleting client', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export { clientsRouter };
