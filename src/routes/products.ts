import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { AuthRequest } from '../middleware/auth';
import { hasPermission } from '../middleware/supabaseAuth';
import { sanitizeString } from '../utils/validation';
import { createRateLimiter } from '../middleware/rateLimiter';
import { AuditService } from '../services/audit';

function mapProduct(p: any) {
  return {
    id: p.id,
    salonId: p.salonId,
    name: p.name,
    category: p.category ? p.category.name : undefined,
    description: p.description ?? undefined,
    price: Number(p.price),
    costPrice: p.costPrice != null ? Number(p.costPrice) : undefined,
    stock: p.stock,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const productsRouter = Router();

productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const products = await prisma.product.findMany({
      where: { salonId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });

    res.json(products.map(mapProduct));
  } catch (error) {
    console.error('Error listing products', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, isActive: true, deletedAt: null },
      include: { category: true },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json(mapProduct(product));
  } catch (error) {
    console.error('Error fetching product', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

productsRouter.post('/', createRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      category,
      description,
      price,
      costPrice,
      stock,
      isActive,
    } = req.body as {
      name?: string;
      category?: string;
      description?: string;
      price?: number;
      costPrice?: number;
      stock?: number;
      isActive?: boolean;
    };

    if (!name || price == null || stock == null) {
      res
        .status(400)
        .json({ error: 'name, price and stock are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    let categoryRecord = null;
    if (category) {
      categoryRecord = await prisma.category.findFirst({
        where: { salonId, type: 'product', name: category },
      });

      if (!categoryRecord) {
        try {
          categoryRecord = await prisma.category.create({
            data: {
              salonId,
              type: 'product',
              name: category,
            },
          });
        } catch (error: any) {
          if (error && error.code === 'P2002') {
            categoryRecord = await prisma.category.findFirst({
              where: { salonId, type: 'product', name: category },
            });
          } else {
            throw error;
          }
        }
      }
    }

    const sanitizedName = sanitizeString(name);
    if (sanitizedName.length < 2) {
      res.status(400).json({ error: 'name must be at least 2 characters long' });
      return;
    }

    const sanitizedDescription = description ? sanitizeString(description) : null;

    const product = await prisma.product.create({
      data: {
        salonId,
        name: sanitizedName,
        categoryId: categoryRecord?.id,
        description: sanitizedDescription,
        price,
        costPrice: costPrice != null ? costPrice : null,
        stock: stock ?? 0,
        isActive: isActive ?? true,
      },
      include: { category: true },
    });

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logCreate(
      salonId,
      req.user.userId,
      'products',
      product.id,
      { name: product.name, category: product.category?.name, price: Number(product.price), stock: product.stock },
      ipAddress,
      userAgent
    );

    res.status(201).json(mapProduct(product));
  } catch (error) {
    console.error('Error creating product', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

productsRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      category,
      description,
      price,
      costPrice,
      stock,
      isActive,
    } = req.body as {
      name?: string;
      category?: string;
      description?: string;
      price?: number;
      costPrice?: number;
      stock?: number;
      isActive?: boolean;
    };

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
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
    if (description !== undefined) {
      data.description = description ? sanitizeString(description) : null;
    }
    if (price !== undefined) {
      if (price < 0) {
        res.status(400).json({ error: 'price must be non-negative' });
        return;
      }
      data.price = price;
    }
    if (costPrice !== undefined) {
      if (costPrice != null && costPrice < 0) {
        res.status(400).json({ error: 'costPrice must be non-negative' });
        return;
      }
      data.costPrice = costPrice;
    }
    if (stock !== undefined) {
      if (stock < 0) {
        res.status(400).json({ error: 'stock must be non-negative' });
        return;
      }
      data.stock = stock;
    }
    if (isActive !== undefined) data.isActive = isActive;

    if (category !== undefined) {
      if (!category) {
        data.categoryId = null;
      } else {
        let categoryRecord = await prisma.category.findFirst({
          where: { salonId, type: 'product', name: category },
        });

        if (!categoryRecord) {
          try {
            categoryRecord = await prisma.category.create({
              data: {
                salonId,
                type: 'product',
                name: category,
              },
            });
          } catch (error: any) {
            if (error && error.code === 'P2002') {
              categoryRecord = await prisma.category.findFirst({
                where: { salonId, type: 'product', name: category },
              });
            } else {
              throw error;
            }
          }
        }

        data.categoryId = categoryRecord?.id;
      }
    }

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data,
      include: { category: true },
    });

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logUpdate(
      salonId,
      req.user.userId,
      'products',
      updated.id,
      { name: existing.name, price: Number(existing.price), stock: existing.stock },
      { name: updated.name, price: Number(updated.price), stock: updated.stock },
      ipAddress,
      userAgent
    );

    res.json(mapProduct(updated));
  } catch (error) {
    console.error('Error updating product', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

productsRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check permission to delete products
    const canDelete = await hasPermission(req.user, 'podeDeletarProduto');
    if (!canDelete) {
      res.status(403).json({ error: 'Você não tem permissão para excluir produtos' });
      return;
    }

    const salonId = req.user.salonId;

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, deletedAt: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    // Log de auditoria
    const { ipAddress, userAgent } = AuditService.getRequestInfo(req);
    await AuditService.logDelete(
      salonId,
      req.user.userId,
      'products',
      existing.id,
      { name: existing.name, price: Number(existing.price), stock: existing.stock },
      ipAddress,
      userAgent
    );

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export { productsRouter };
