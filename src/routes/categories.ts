import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';
import { CategoryType } from '../types/enums';

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

categoriesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const type = req.query.type as CategoryType | undefined;

    if (!type || (type !== 'service' && type !== 'product')) {
      res
        .status(400)
        .json({ error: "type query param must be 'service' or 'product'" });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { salonId, type },
      orderBy: { name: 'asc' },
    });

    res.json(categories.map(mapCategory));
  } catch (error) {
    console.error('Error listing categories', error);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

categoriesRouter.post('/', async (req: Request, res: Response) => {
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

    const salonId = await getDefaultSalonId();

    const category = await prisma.category.create({
      data: {
        salonId,
        type,
        name,
      },
    });

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

categoriesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, salonId },
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

      tx.push(
        prisma.category.delete({
          where: { id: existing.id },
        })
      );

      await prisma.$transaction(tx);
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
