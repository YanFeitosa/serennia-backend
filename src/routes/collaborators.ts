import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';
import { UserRole, CollaboratorStatus } from '../types/enums';

function mapCollaborator(c: any) {
  return {
    id: c.id,
    salonId: c.salonId,
    userId: c.userId ?? undefined,
    name: c.name,
    role: c.role,
    status: c.status,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    commissionRate: Number(c.commissionRate),
    serviceCategories: c.serviceCategories ?? [],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const collaboratorsRouter = Router();

collaboratorsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const collaborators = await prisma.collaborator.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(collaborators.map(mapCollaborator));
  } catch (error) {
    console.error('Error listing collaborators', error);
    res.status(500).json({ error: 'Failed to list collaborators' });
  }
});

collaboratorsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, role, status, phone, email, commissionRate, serviceCategories } =
      req.body as {
        name?: string;
        role?: UserRole;
        status?: CollaboratorStatus;
        phone?: string;
        email?: string;
        commissionRate?: number;
        serviceCategories?: string[];
      };

    if (!name || !role) {
      res.status(400).json({ error: 'name and role are required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    const collaborator = await prisma.collaborator.create({
      data: {
        salonId,
        name,
        role,
        status: status ?? 'active',
        phone,
        email,
        commissionRate: commissionRate ?? 0,
        serviceCategories: serviceCategories ?? [],
      },
    });

    res.status(201).json(mapCollaborator(collaborator));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res
        .status(409)
        .json({ error: 'Collaborator with this phone or email already exists' });
      return;
    }
    console.error('Error creating collaborator', error);
    res.status(500).json({ error: 'Failed to create collaborator' });
  }
});

collaboratorsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const collaborator = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!collaborator) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    res.json(mapCollaborator(collaborator));
  } catch (error) {
    console.error('Error fetching collaborator', error);
    res.status(500).json({ error: 'Failed to fetch collaborator' });
  }
});

collaboratorsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, role, status, phone, email, commissionRate, serviceCategories } =
      req.body as {
        name?: string;
        role?: UserRole;
        status?: CollaboratorStatus;
        phone?: string;
        email?: string;
        commissionRate?: number;
        serviceCategories?: string[];
      };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (status !== undefined) data.status = status;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (commissionRate !== undefined) data.commissionRate = commissionRate;
    if (serviceCategories !== undefined) data.serviceCategories = serviceCategories;

    const updated = await prisma.collaborator.update({
      where: { id: existing.id },
      data,
    });

    res.json(mapCollaborator(updated));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res
        .status(409)
        .json({ error: 'Collaborator with this phone or email already exists' });
      return;
    }
    console.error('Error updating collaborator', error);
    res.status(500).json({ error: 'Failed to update collaborator' });
  }
});

collaboratorsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Collaborator not found' });
      return;
    }

    await prisma.collaborator.update({
      where: { id: existing.id },
      data: { status: 'inactive' },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting collaborator', error);
    res.status(500).json({ error: 'Failed to delete collaborator' });
  }
});

export { collaboratorsRouter };
