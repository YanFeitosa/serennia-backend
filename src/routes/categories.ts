import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { CategoryType } from '../types/enums';
import { sanitizeString } from '../utils/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { AuditService } from '../services/audit';

function mapCategory(c: any) {
  return {
    id: c.id,
    salonId: c.salonId,
    type: c.type,
    name: c.name,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

const categoriesRouter = Router();

categoriesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const type = req.query.type as CategoryType | undefined;

    if (!type || (type !== 'service' && type !== 'product')) {
      res
        .status(400)
        .json({ error: "type query param must be 'service' or 'product'" });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { salonId, type, deletedAt: null },
      orderBy: { name: 'asc' },
    });

    res.json(categories.map(mapCategory));
  } catch (error) {
    console.error('Error listing categories', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

categoriesRouter.post('/', createRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { type, name } = req.body as {
      type?: CategoryType;
      name?: string;
    };

    if (!type || (type !== 'service' && type !== 'product')) {
      res.status(400).json({ error: "type must be 'service' or 'product'" });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;
    const sanitizedName = sanitizeString(name);
    if (sanitizedName.length < 2) {
      res.status(400).json({ error: 'name must be at least 2 characters long' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        salonId,
        type,
        name: sanitizedName,
      },
    });

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logCreate(
      salonId,
      req.user.userId,
      'categories',
      category.id,
      { name: category.name, type: category.type },
      ipAddress,
      userAgent
    );

    res.status(201).json(mapCategory(category));
  } catch (error: any) {
    if (error && error.code === 'P2002') {
      res
        .status(409)
        .json({ error: 'Category with this name and type already exists' });
      return;
    }
    console.error('Error creating category', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

categoriesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, salonId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    try {
      const tx: any[] = [];

      // Sempre limpar categoryId de serviços e produtos que usavam essa categoria
      tx.push(
        prisma.service.updateMany({
          where: { salonId, categoryId: existing.id },
          data: { categoryId: null },
        })
      );

      tx.push(
        prisma.product.updateMany({
          where: { salonId, categoryId: existing.id },
          data: { categoryId: null },
        })
      );

      // Se for categoria de serviço, remover o nome da categoria das serviceCategories dos colaboradores
      if (existing.type === 'service') {
        const collaborators = await prisma.collaborator.findMany({
          where: {
            salonId,
            serviceCategories: { has: existing.name },
          },
        });

        for (const collaborator of collaborators) {
          const filteredCategories = (collaborator.serviceCategories ?? []).filter(
            (name: string) => name !== existing.name
          );

          tx.push(
            prisma.collaborator.update({
              where: { id: collaborator.id },
              data: { serviceCategories: filteredCategories },
            })
          );
        }
      }

      // Soft delete
      tx.push(
        prisma.category.update({
          where: { id: existing.id },
          data: { isActive: false, deletedAt: new Date() },
        })
      );

      await prisma.$transaction(tx);

      // Log de auditoria
      const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
      await AuditService.logDelete(
        salonId,
        req.user.userId,
        'categories',
        existing.id,
        { name: existing.name, type: existing.type },
        ipAddress,
        userAgent
      );
    } catch (error: any) {
      if (error && error.code === 'P2003') {
        res.status(409).json({
          error: 'Category has related records and cannot be deleted',
        });
        return;
      }
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting category', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export { categoriesRouter };
