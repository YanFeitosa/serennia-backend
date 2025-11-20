import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';

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
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const productsRouter = Router();

productsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const products = await prisma.product.findMany({
      where: { salonId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });

    res.json(products.map(mapProduct));
  } catch (error) {
    console.error('Error listing products', error);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

productsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
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

productsRouter.post('/', async (req: Request, res: Response) => {
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

    const salonId = await getDefaultSalonId();

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

    const product = await prisma.product.create({
      data: {
        salonId,
        name,
        categoryId: categoryRecord?.id,
        description,
        price,
        costPrice,
        stock,
        isActive: isActive ?? true,
      },
      include: { category: true },
    });

    res.status(201).json(mapProduct(product));
  } catch (error) {
    console.error('Error creating product', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

productsRouter.patch('/:id', async (req: Request, res: Response) => {
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

    const salonId = await getDefaultSalonId();

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = price;
    if (costPrice !== undefined) data.costPrice = costPrice;
    if (stock !== undefined) data.stock = stock;
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

    res.json(mapProduct(updated));
  } catch (error) {
    console.error('Error updating product', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

productsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export { productsRouter };
