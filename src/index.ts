import "dotenv/config";
import express, { Request, Response } from "express";
import { PrismaClient } from "./generated/prisma/client";
import {
  UserRole,
  CollaboratorStatus,
  AppointmentStatus,
  AppointmentOrigin,
  OrderStatus,
  OrderItemType,
  PaymentMethod,
  PaymentStatus,
  NotificationType,
  AuditAction,
  CategoryType,
} from "./types/enums";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

async function getDefaultSalonId(): Promise<string> {
  const existing = await prisma.salon.findFirst();
  if (existing) {
    return existing.id;
  }

  const created = await prisma.salon.create({
    data: {
      name: "Default Salon",
    },
  });

  return created.id;
}

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
    bufferTime: s.bufferTime ?? undefined,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

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

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    console.error("Health check failed", error);
    res.status(500).json({ status: "error", database: "down" });
  }
});

app.get("/clients", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const clients = await prisma.client.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
    });

    res.json(clients.map(mapClient));
  } catch (error) {
    console.error("Error listing clients", error);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

app.post("/client", async (req: Request, res: Response) => {
  try {
    const { name, phone, email } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
    };

    if (!name || !phone) {
      res.status(400).json({ error: "name and phone are required" });
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
    if (error && error.code === "P2002") {
      res.status(409).json({ error: "Client with this phone or email already exists" });
      return;
    }
    console.error("Error creating client", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

app.get("/client/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    res.json(mapClient(client));
  } catch (error) {
    console.error("Error fetching client", error);
    res.status(500).json({ error: "Failed to fetch client" });
  }
});

app.patch("/client/:id", async (req: Request, res: Response) => {
  try {
    const { name, phone, email, lastVisit } = req.body as {
      name?: string;
      phone?: string;
      email?: string;
      lastVisit?: string | null;
    };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Client not found" });
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
    if (error && error.code === "P2002") {
      res.status(409).json({ error: "Client with this phone or email already exists" });
      return;
    }
    console.error("Error updating client", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

app.delete("/client/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    await prisma.client.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error && error.code === "P2003") {
      res
        .status(409)
        .json({ error: "Client has related records and cannot be deleted" });
      return;
    }
    console.error("Error deleting client", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

app.get("/collaborators", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const collaborators = await prisma.collaborator.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
    });

    res.json(collaborators.map(mapCollaborator));
  } catch (error) {
    console.error("Error listing collaborators", error);
    res.status(500).json({ error: "Failed to list collaborators" });
  }
});

app.post("/collaborator", async (req: Request, res: Response) => {
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
      res.status(400).json({ error: "name and role are required" });
      return;
    }

    const salonId = await getDefaultSalonId();

    const collaborator = await prisma.collaborator.create({
      data: {
        salonId,
        name,
        role,
        status: status ?? "active",
        phone,
        email,
        commissionRate: commissionRate ?? 0,
        serviceCategories: serviceCategories ?? [],
      },
    });

    res.status(201).json(mapCollaborator(collaborator));
  } catch (error: any) {
    if (error && error.code === "P2002") {
      res
        .status(409)
        .json({ error: "Collaborator with this phone or email already exists" });
      return;
    }
    console.error("Error creating collaborator", error);
    res.status(500).json({ error: "Failed to create collaborator" });
  }
});

app.get("/collaborator/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const collaborator = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!collaborator) {
      res.status(404).json({ error: "Collaborator not found" });
      return;
    }

    res.json(mapCollaborator(collaborator));
  } catch (error) {
    console.error("Error fetching collaborator", error);
    res.status(500).json({ error: "Failed to fetch collaborator" });
  }
});

app.patch("/collaborator/:id", async (req: Request, res: Response) => {
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
      res.status(404).json({ error: "Collaborator not found" });
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
    if (error && error.code === "P2002") {
      res
        .status(409)
        .json({ error: "Collaborator with this phone or email already exists" });
      return;
    }
    console.error("Error updating collaborator", error);
    res.status(500).json({ error: "Failed to update collaborator" });
  }
});

app.delete("/collaborator/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Collaborator not found" });
      return;
    }

    await prisma.collaborator.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error && error.code === "P2003") {
      res
        .status(409)
        .json({
          error: "Collaborator has related records and cannot be deleted",
        });
      return;
    }
    console.error("Error deleting collaborator", error);
    res.status(500).json({ error: "Failed to delete collaborator" });
  }
});

app.get("/categories", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const type = req.query.type as CategoryType | undefined;

    if (!type || (type !== "service" && type !== "product")) {
      res
        .status(400)
        .json({ error: "type query param must be 'service' or 'product'" });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { salonId, type },
      orderBy: { name: "asc" },
    });

    res.json(categories.map(mapCategory));
  } catch (error) {
    console.error("Error listing categories", error);
    res.status(500).json({ error: "Failed to list categories" });
  }
});

app.post("/category", async (req: Request, res: Response) => {
  try {
    const { type, name } = req.body as {
      type?: CategoryType;
      name?: string;
    };

    if (!type || (type !== "service" && type !== "product")) {
      res.status(400).json({ error: "type must be 'service' or 'product'" });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "name is required" });
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
    if (error && error.code === "P2002") {
      res
        .status(409)
        .json({ error: "Category with this name and type already exists" });
      return;
    }
    console.error("Error creating category", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

app.delete("/category/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.category.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Category not found" });
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
      if (existing.type === "service") {
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
      if (error && error.code === "P2003") {
        res.status(409).json({
          error: "Category has related records and cannot be deleted",
        });
        return;
      }
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting category", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.get("/services", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const services = await prisma.service.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });

    res.json(services.map(mapService));
  } catch (error) {
    console.error("Error listing services", error);
    res.status(500).json({ error: "Failed to list services" });
  }
});

app.get("/service/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const service = await prisma.service.findFirst({
      where: { id: req.params.id, salonId },
      include: { category: true },
    });

    if (!service) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    res.json(mapService(service));
  } catch (error) {
    console.error("Error fetching service", error);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

app.post("/service", async (req: Request, res: Response) => {
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

    if (!name || duration == null || price == null) {
      res
        .status(400)
        .json({ error: "name, duration and price are required" });
      return;
    }

    if (!category) {
      res.status(400).json({ error: "category is required" });
      return;
    }

    const salonId = await getDefaultSalonId();

    let categoryRecord = await prisma.category.findFirst({
      where: { salonId, type: "service", name: category },
    });

    if (!categoryRecord) {
      try {
        categoryRecord = await prisma.category.create({
          data: {
            salonId,
            type: "service",
            name: category,
          },
        });
      } catch (error: any) {
        if (error && error.code === "P2002") {
          categoryRecord = await prisma.category.findFirst({
            where: { salonId, type: "service", name: category },
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
        bufferTime,
        isActive: isActive ?? true,
      },
      include: { category: true },
    });

    res.status(201).json(mapService(service));
  } catch (error) {
    console.error("Error creating service", error);
    res.status(500).json({ error: "Failed to create service" });
  }
});

app.patch("/service/:id", async (req: Request, res: Response) => {
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
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (duration !== undefined) data.duration = duration;
    if (price !== undefined) data.price = price;
    if (commission !== undefined) data.commission = commission;
    if (bufferTime !== undefined) data.bufferTime = bufferTime;
    if (isActive !== undefined) data.isActive = isActive;

    if (category !== undefined) {
      if (!category) {
        data.categoryId = null;
      } else {
        let categoryRecord = await prisma.category.findFirst({
          where: { salonId, type: "service", name: category },
        });

        if (!categoryRecord) {
          try {
            categoryRecord = await prisma.category.create({
              data: {
                salonId,
                type: "service",
                name: category,
              },
            });
          } catch (error: any) {
            if (error && error.code === "P2002") {
              categoryRecord = await prisma.category.findFirst({
                where: { salonId, type: "service", name: category },
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
    console.error("Error updating service", error);
    res.status(500).json({ error: "Failed to update service" });
  }
});

app.delete("/service/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    await prisma.service.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error && error.code === "P2003") {
      res
        .status(409)
        .json({ error: "Service has related records and cannot be deleted" });
      return;
    }
    console.error("Error deleting service", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

app.get("/products", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const products = await prisma.product.findMany({
      where: { salonId },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });

    res.json(products.map(mapProduct));
  } catch (error) {
    console.error("Error listing products", error);
    res.status(500).json({ error: "Failed to list products" });
  }
});

app.get("/product/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, salonId },
      include: { category: true },
    });

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    res.json(mapProduct(product));
  } catch (error) {
    console.error("Error fetching product", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

app.post("/product", async (req: Request, res: Response) => {
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
        .json({ error: "name, price and stock are required" });
      return;
    }

    const salonId = await getDefaultSalonId();

    let categoryRecord = null;
    if (category) {
      categoryRecord = await prisma.category.findFirst({
        where: { salonId, type: "product", name: category },
      });

      if (!categoryRecord) {
        try {
          categoryRecord = await prisma.category.create({
            data: {
              salonId,
              type: "product",
              name: category,
            },
          });
        } catch (error: any) {
          if (error && error.code === "P2002") {
            categoryRecord = await prisma.category.findFirst({
              where: { salonId, type: "product", name: category },
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
    console.error("Error creating product", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.patch("/product/:id", async (req: Request, res: Response) => {
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
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
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
          where: { salonId, type: "product", name: category },
        });

        if (!categoryRecord) {
          try {
            categoryRecord = await prisma.category.create({
              data: {
                salonId,
                type: "product",
                name: category,
              },
            });
          } catch (error: any) {
            if (error && error.code === "P2002") {
              categoryRecord = await prisma.category.findFirst({
                where: { salonId, type: "product", name: category },
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
    console.error("Error updating product", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/product/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await prisma.product.delete({
      where: { id: existing.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error && error.code === "P2003") {
      res
        .status(409)
        .json({ error: "Product has related records and cannot be deleted" });
      return;
    }
    console.error("Error deleting product", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
