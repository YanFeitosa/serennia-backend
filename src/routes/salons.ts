import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';

const salonsRouter = Router();

// GET /salons - List all salons (Super Admin only)
salonsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only super_admin can list all salons
    if (req.user.platformRole !== 'super_admin') {
      res.status(403).json({ error: 'Acesso negado. Apenas Super Admin pode listar salões.' });
      return;
    }

    const salons = await prisma.salon.findMany({
      select: {
        id: true,
        name: true,
        document: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            collaborators: true,
            clients: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    const result = salons.map(salon => ({
      id: salon.id,
      name: salon.name,
      document: salon.document,
      status: salon.status,
      createdAt: salon.createdAt.toISOString(),
      usersCount: salon._count.users,
      collaboratorsCount: salon._count.collaborators,
      clientsCount: salon._count.clients,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error listing salons', error);
    res.status(500).json({ error: 'Failed to list salons' });
  }
});

// GET /salons/:id - Get salon details (Super Admin only)
salonsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only super_admin can view salon details
    if (req.user.platformRole !== 'super_admin') {
      res.status(403).json({ error: 'Acesso negado. Apenas Super Admin pode ver detalhes de salões.' });
      return;
    }

    const salon = await prisma.salon.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        document: true,
        status: true,
        createdAt: true,
        defaultCommissionRate: true,
        commissionMode: true,
        _count: {
          select: {
            users: true,
            collaborators: true,
            clients: true,
            services: true,
            products: true,
          }
        }
      },
    });

    if (!salon) {
      res.status(404).json({ error: 'Salão não encontrado' });
      return;
    }

    res.json({
      id: salon.id,
      name: salon.name,
      document: salon.document,
      status: salon.status,
      createdAt: salon.createdAt.toISOString(),
      defaultCommissionRate: Number(salon.defaultCommissionRate),
      commissionMode: salon.commissionMode,
      usersCount: salon._count.users,
      collaboratorsCount: salon._count.collaborators,
      clientsCount: salon._count.clients,
      servicesCount: salon._count.services,
      productsCount: salon._count.products,
    });
  } catch (error) {
    console.error('Error getting salon', error);
    res.status(500).json({ error: 'Failed to get salon' });
  }
});

// POST /salons/:id/select - Select a salon to manage (Super Admin only)
salonsRouter.post('/:id/select', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Only super_admin can switch salons
    if (req.user.platformRole !== 'super_admin') {
      res.status(403).json({ error: 'Acesso negado. Apenas Super Admin pode trocar de salão.' });
      return;
    }

    const salonId = req.params.id;

    // Verify salon exists
    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, name: true },
    });

    if (!salon) {
      res.status(404).json({ error: 'Salão não encontrado' });
      return;
    }

    // Update the super_admin's salonId
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { salonId: salonId },
    });

    res.json({ 
      success: true, 
      message: `Salão "${salon.name}" selecionado com sucesso`,
      salonId: salon.id,
      salonName: salon.name,
    });
  } catch (error) {
    console.error('Error selecting salon', error);
    res.status(500).json({ error: 'Failed to select salon' });
  }
});

export { salonsRouter };
