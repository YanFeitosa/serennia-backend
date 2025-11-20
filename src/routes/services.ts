import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';

function mapService(s: any) {
  return {
    id: s.id,
    salonId: s.salonId,
    name: s.name,
    category: s.category ? s.category.name : undefined,
    description: s.description ?? undefined,
    duration: s.duration,
    price: Number(s.price),
    commission: s.commission != null ? Number(s.commission) : undefined,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

const servicesRouter = Router();

servicesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const services = await prisma.service.findMany({
      where: { salonId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });

    res.json(services.map(mapService));
  } catch (error) {
    console.error('Error listing services', error);
    res.status(500).json({ error: 'Failed to list services' });
  }
});

servicesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const service = await prisma.service.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
      include: { category: true },
    });

    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    res.json(mapService(service));
  } catch (error) {
    console.error('Error fetching service', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

servicesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      description,
      duration,
      price,
      commission,
      isActive,
    } = req.body as {
      name?: string;
      category?: string;
      description?: string;
      duration?: number;
      price?: number;
      commission?: number;
      isActive?: boolean;
    };

    if (!name || duration == null || price == null) {
      res
        .status(400)
        .json({ error: 'name, duration and price are required' });
      return;
    }

    if (!category) {
      res.status(400).json({ error: 'category is required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    let categoryRecord = await prisma.category.findFirst({
      where: { salonId, type: 'service', name: category },
    });

    if (!categoryRecord) {
      try {
        categoryRecord = await prisma.category.create({
          data: {
            salonId,
            type: 'service',
            name: category,
          },
        });
      } catch (error: any) {
        if (error && error.code === 'P2002') {
          categoryRecord = await prisma.category.findFirst({
            where: { salonId, type: 'service', name: category },
          });
        } else {
          throw error;
        }
      }
    }

    const service = await prisma.service.create({
      data: {
        salonId,
        name,
        categoryId: categoryRecord?.id,
        description,
        duration,
        price,
        commission,
        isActive: isActive ?? true,
      },
      include: { category: true },
    });

    res.status(201).json(mapService(service));
  } catch (error) {
    console.error('Error creating service', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

servicesRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const {
      name,
      category,
      description,
      duration,
      price,
      commission,
      bufferTime,
      isActive,
    } = req.body as {
      name?: string;
      category?: string;
      description?: string;
      duration?: number;
      price?: number;
      commission?: number;
      bufferTime?: number;
      isActive?: boolean;
    };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (duration !== undefined) data.duration = duration;
    if (price !== undefined) data.price = price;
    if (commission !== undefined) data.commission = commission;
    if (isActive !== undefined) data.isActive = isActive;

    if (category !== undefined) {
      if (!category) {
        data.categoryId = null;
      } else {
        let categoryRecord = await prisma.category.findFirst({
          where: { salonId, type: 'service', name: category },
        });

        if (!categoryRecord) {
          try {
            categoryRecord = await prisma.category.create({
              data: {
                salonId,
                type: 'service',
                name: category,
              },
            });
          } catch (error: any) {
            if (error && error.code === 'P2002') {
              categoryRecord = await prisma.category.findFirst({
                where: { salonId, type: 'service', name: category },
              });
            } else {
              throw error;
            }
          }
        }

        data.categoryId = categoryRecord?.id;
      }
    }

    const updated = await prisma.service.update({
      where: { id: existing.id },
      data,
      include: { category: true },
    });

    res.json(mapService(updated));
  } catch (error) {
    console.error('Error updating service', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

servicesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    await prisma.service.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting service', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

export { servicesRouter };
