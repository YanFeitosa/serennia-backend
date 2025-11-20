import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
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

const CORS_ORIGIN = process.env.FRONTEND_ORIGIN;

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

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

function mapAppointment(a: any) {
  return {
    id: a.id,
    salonId: a.salonId,
    clientId: a.clientId,
    collaboratorId: a.collaboratorId,
    serviceIds: (a.services ?? []).map((s: any) => s.serviceId),
    start: a.start.toISOString(),
    end: a.end.toISOString(),
    status: a.status,
    origin: a.origin,
    notes: a.notes ?? undefined,
    orderId: a.orderId ?? undefined,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

function mapOrderItem(item: any) {
  return {
    id: item.id,
    salonId: item.salonId,
    type: item.type,
    serviceId: item.serviceId ?? undefined,
    productId: item.productId ?? undefined,
    collaboratorId: item.collaboratorId ?? undefined,
    quantity: item.quantity ?? undefined,
    price: Number(item.price),
    commission: Number(item.commission),
  };
}

function mapOrder(o: any) {
  return {
    id: o.id,
    salonId: o.salonId,
    clientId: o.clientId,
    items: (o.items ?? []).map(mapOrderItem),
    status: o.status,
    finalValue: Number(o.finalValue),
    createdAt: o.createdAt.toISOString(),
    closedAt: o.closedAt ? o.closedAt.toISOString() : undefined,
    appointmentId: o.appointment ? o.appointment.id : undefined,
    createdByUserId: o.createdByUserId ?? undefined,
    updatedAt: o.updatedAt ? o.updatedAt.toISOString() : undefined,
  };
}

const APPOINTMENT_BLOCKING_STATUSES: AppointmentStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "not_paid",
];

const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  pending: ["in_progress", "canceled", "no_show"],
  in_progress: ["completed", "not_paid"],
  completed: ["not_paid"],
  canceled: [],
  no_show: [],
  not_paid: [],
};

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
      where: { salonId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(clients.map(mapClient));
  } catch (error) {
    console.error("Error listing clients", error);
    res.status(500).json({ error: "Failed to list clients" });
  }
});

app.post("/clients", async (req: Request, res: Response) => {
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

app.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
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

app.patch("/clients/:id", async (req: Request, res: Response) => {
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

app.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    await prisma.client.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
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

app.post("/collaborators", async (req: Request, res: Response) => {
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

app.get("/collaborators/:id", async (req: Request, res: Response) => {
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

app.patch("/collaborators/:id", async (req: Request, res: Response) => {
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

app.delete("/collaborators/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.collaborator.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Collaborator not found" });
      return;
    }

    await prisma.collaborator.update({
      where: { id: existing.id },
      data: { status: "inactive" },
    });

    res.status(204).send();
  } catch (error) {
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

app.post("/categories", async (req: Request, res: Response) => {
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

app.delete("/categories/:id", async (req: Request, res: Response) => {
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
      where: { salonId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });

    res.json(services.map(mapService));
  } catch (error) {
    console.error("Error listing services", error);
    res.status(500).json({ error: "Failed to list services" });
  }
});

app.get("/services/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const service = await prisma.service.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
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

app.post("/services", async (req: Request, res: Response) => {
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

app.patch("/services/:id", async (req: Request, res: Response) => {
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
      res.status(404).json({ error: "Service not found" });
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

app.delete("/services/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.service.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    await prisma.service.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting service", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

app.get("/products", async (_req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const products = await prisma.product.findMany({
      where: { salonId, isActive: true },
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });

    res.json(products.map(mapProduct));
  } catch (error) {
    console.error("Error listing products", error);
    res.status(500).json({ error: "Failed to list products" });
  }
});

app.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, salonId, isActive: true },
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

app.post("/products", async (req: Request, res: Response) => {
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

app.patch("/products/:id", async (req: Request, res: Response) => {
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

app.delete("/products/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, salonId },
    });

    if (!existing) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    await prisma.product.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting product", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

app.get("/appointments", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const { dateFrom, dateTo, collaboratorId, status } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      collaboratorId?: string;
      status?: AppointmentStatus;
    };

    const where: any = { salonId };
    const andConditions: any[] = [];

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (isNaN(from.getTime())) {
        res.status(400).json({ error: "Invalid dateFrom" });
        return;
      }
      andConditions.push({ start: { gte: from } });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (isNaN(to.getTime())) {
        res.status(400).json({ error: "Invalid dateTo" });
        return;
      }
      andConditions.push({ start: { lte: to } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (collaboratorId) {
      where.collaboratorId = collaboratorId;
    }

    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { start: "asc" },
      include: { services: true },
    });

    res.json(appointments.map(mapAppointment));
  } catch (error) {
    console.error("Error listing appointments", error);
    res.status(500).json({ error: "Failed to list appointments" });
  }
});

app.get("/appointments/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true },
    });

    if (!appointment) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    res.json(mapAppointment(appointment));
  } catch (error) {
    console.error("Error fetching appointment", error);
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

async function validateAndComputeAppointment(
  salonId: string,
  clientId: string,
  collaboratorId: string,
  serviceIds: string[],
  startIso: string,
  ignoreAppointmentId?: string
) {
  if (!serviceIds || serviceIds.length === 0) {
    throw new Error("AT_LEAST_ONE_SERVICE_REQUIRED");
  }

  const start = new Date(startIso);
  if (isNaN(start.getTime())) {
    throw new Error("INVALID_START_DATE");
  }

  const now = new Date();
  if (start <= now) {
    throw new Error("START_MUST_BE_IN_FUTURE");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, salonId, isActive: true },
  });
  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const collaborator = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, salonId },
  });
  if (!collaborator) {
    throw new Error("COLLABORATOR_NOT_FOUND");
  }

  const services = await prisma.service.findMany({
    where: { salonId, id: { in: serviceIds }, isActive: true },
  });

  if (services.length !== serviceIds.length) {
    throw new Error("INVALID_SERVICE_IDS");
  }

  const totalMinutes = services.reduce((sum, s) => {
    return sum + s.duration;
  }, 0);

  const end = new Date(start.getTime() + totalMinutes * 60000);

  const overlapWhere: any = {
    salonId,
    collaboratorId,
    status: { in: APPOINTMENT_BLOCKING_STATUSES },
    start: { lt: end },
    end: { gt: start },
  };

  if (ignoreAppointmentId) {
    overlapWhere.id = { not: ignoreAppointmentId };
  }

  const overlapping = await prisma.appointment.findFirst({
    where: overlapWhere,
  });

  if (overlapping) {
    throw new Error("OVERLAPPING_APPOINTMENT");
  }

  return { start, end };
}

app.post("/appointments", async (req: Request, res: Response) => {
  try {
    const { clientId, collaboratorId, serviceIds, start, notes, origin } =
      req.body as {
        clientId?: string;
        collaboratorId?: string;
        serviceIds?: string[];
        start?: string;
        notes?: string;
        origin?: AppointmentOrigin;
      };

    if (!clientId || !collaboratorId || !serviceIds || !start || !origin) {
      res.status(400).json({
        error: "clientId, collaboratorId, serviceIds, start and origin are required",
      });
      return;
    }

    const salonId = await getDefaultSalonId();

    let computed;
    try {
      computed = await validateAndComputeAppointment(
        salonId,
        clientId,
        collaboratorId,
        serviceIds,
        start
      );
    } catch (e: any) {
      switch (e.message) {
        case "AT_LEAST_ONE_SERVICE_REQUIRED":
          res.status(400).json({ error: "At least one service is required" });
          return;
        case "INVALID_START_DATE":
          res.status(400).json({ error: "Invalid start date" });
          return;
        case "START_MUST_BE_IN_FUTURE":
          res.status(400).json({ error: "Start time must be in the future" });
          return;
        case "CLIENT_NOT_FOUND":
          res.status(404).json({ error: "Client not found" });
          return;
        case "COLLABORATOR_NOT_FOUND":
          res.status(404).json({ error: "Collaborator not found" });
          return;
        case "INVALID_SERVICE_IDS":
          res.status(400).json({ error: "Invalid serviceIds" });
          return;
        case "OVERLAPPING_APPOINTMENT":
          res
            .status(409)
            .json({ error: "Overlapping appointment for collaborator" });
          return;
        default:
          throw e;
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        clientId,
        collaboratorId,
        start: computed.start,
        end: computed.end,
        status: "pending",
        origin,
        notes,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: { services: true },
    });

    res.status(201).json(mapAppointment(appointment));
  } catch (error) {
    console.error("Error creating appointment", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

app.patch("/appointments/:id", async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      collaboratorId,
      serviceIds,
      start,
      notes,
      origin,
    } = req.body as {
      clientId?: string;
      collaboratorId?: string;
      serviceIds?: string[];
      start?: string;
      notes?: string;
      origin?: AppointmentOrigin;
    };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Appointment not found" });
      return;
    }

    if (existing.status !== "pending") {
      res
        .status(400)
        .json({ error: "Only appointments with status 'pending' can be edited" });
      return;
    }

    const finalClientId = clientId ?? existing.clientId;
    const finalCollaboratorId = collaboratorId ?? existing.collaboratorId;
    const finalServiceIds =
      serviceIds ?? (existing.services ?? []).map((s: any) => s.serviceId);
    const finalStart = start ?? existing.start.toISOString();

    let computed;
    try {
      computed = await validateAndComputeAppointment(
        salonId,
        finalClientId,
        finalCollaboratorId,
        finalServiceIds,
        finalStart,
        existing.id
      );
    } catch (e: any) {
      switch (e.message) {
        case "AT_LEAST_ONE_SERVICE_REQUIRED":
          res.status(400).json({ error: "At least one service is required" });
          return;
        case "INVALID_START_DATE":
          res.status(400).json({ error: "Invalid start date" });
          return;
        case "START_MUST_BE_IN_FUTURE":
          res.status(400).json({ error: "Start time must be in the future" });
          return;
        case "CLIENT_NOT_FOUND":
          res.status(404).json({ error: "Client not found" });
          return;
        case "COLLABORATOR_NOT_FOUND":
          res.status(404).json({ error: "Collaborator not found" });
          return;
        case "INVALID_SERVICE_IDS":
          res.status(400).json({ error: "Invalid serviceIds" });
          return;
        case "OVERLAPPING_APPOINTMENT":
          res
            .status(409)
            .json({ error: "Overlapping appointment for collaborator" });
          return;
        default:
          throw e;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.appointmentService.deleteMany({
        where: { appointmentId: existing.id },
      });

      const updatedAppointment = await tx.appointment.update({
        where: { id: existing.id },
        data: {
          clientId: finalClientId,
          collaboratorId: finalCollaboratorId,
          start: computed.start,
          end: computed.end,
          origin: origin ?? existing.origin,
          notes: notes ?? existing.notes,
          services: {
            create: finalServiceIds.map((serviceId) => ({ serviceId })),
          },
        },
        include: { services: true },
      });

      return updatedAppointment;
    });

    res.json(mapAppointment(updated));
  } catch (error) {
    console.error("Error updating appointment", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

app.post(
  "/appointments/:id/status",
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body as { status?: AppointmentStatus };

      if (!status) {
        res.status(400).json({ error: "status is required" });
        return;
      }

      const salonId = await getDefaultSalonId();

      const appointment = await prisma.appointment.findFirst({
        where: { id: req.params.id, salonId },
        include: { services: true },
      });

      if (!appointment) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      const currentStatus = appointment.status as AppointmentStatus;
      const allowed = APPOINTMENT_STATUS_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(status)) {
        res.status(400).json({
          error: `Invalid status transition from '${currentStatus}' to '${status}'`,
        });
        return;
      }

      const updated = await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status },
        include: { services: true },
      });

      res.json(mapAppointment(updated));
    } catch (error) {
      console.error("Error updating appointment status", error);
      res
        .status(500)
        .json({ error: "Failed to update appointment status" });
    }
  }
);

app.get("/orders", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const { status, clientId, dateFrom, dateTo, search } = req.query as {
      status?: OrderStatus;
      clientId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    };

    const where: any = { salonId };
    const andConditions: any[] = [];

    if (status) {
      where.status = status;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (isNaN(from.getTime())) {
        res.status(400).json({ error: "Invalid dateFrom" });
        return;
      }
      andConditions.push({ createdAt: { gte: from } });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (isNaN(to.getTime())) {
        res.status(400).json({ error: "Invalid dateTo" });
        return;
      }
      andConditions.push({ createdAt: { lte: to } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (search) {
      where.OR = [
        { id: { contains: search } },
        { client: { name: { contains: search } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true, appointment: true, client: true },
    });

    res.json(orders.map(mapOrder));
  } catch (error) {
    console.error("Error listing orders", error);
    res.status(500).json({ error: "Failed to list orders" });
  }
});

app.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json(mapOrder(order));
  } catch (error) {
    console.error("Error fetching order", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.post("/orders", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body as { clientId?: string };

    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    const salonId = await getDefaultSalonId();

    const client = await prisma.client.findFirst({
      where: { id: clientId, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: "Client not found" });
      return;
    }

    const order = await prisma.order.create({
      data: {
        salonId,
        clientId,
        status: "open",
        finalValue: 0,
      },
      include: { items: true, appointment: true },
    });

    res.status(201).json(mapOrder(order));
  } catch (error) {
    console.error("Error creating order", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.patch("/orders/:id", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body as { clientId?: string };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (existing.status !== "open") {
      res.status(400).json({ error: "Only open orders can be edited" });
      return;
    }

    const data: any = {};

    if (clientId && clientId !== existing.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, salonId, isActive: true },
      });

      if (!client) {
        res.status(404).json({ error: "Client not found" });
        return;
      }

      data.clientId = clientId;
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data,
      include: { items: true, appointment: true },
    });

    res.json(mapOrder(updated));
  } catch (error) {
    console.error("Error updating order", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

app.post("/orders/:id/items", async (req: Request, res: Response) => {
  try {
    const {
      type,
      serviceId,
      productId,
      collaboratorId,
      quantity,
    } = req.body as {
      type?: OrderItemType;
      serviceId?: string;
      productId?: string;
      collaboratorId?: string;
      quantity?: number;
    };

    if (!type) {
      res.status(400).json({ error: "type is required" });
      return;
    }

    const salonId = await getDefaultSalonId();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: req.params.id, salonId },
      });

      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }

      if (order.status !== "open") {
        throw new Error("ORDER_NOT_OPEN");
      }

      const qty = quantity && quantity > 0 ? quantity : 1;

      let priceNumber = 0;
      let serviceIdValue: string | undefined;
      let productIdValue: string | undefined;
      let collaboratorIdValue: string | undefined = collaboratorId;

      if (type === "service") {
        if (!serviceId) {
          throw new Error("SERVICE_ID_REQUIRED");
        }

        const service = await tx.service.findFirst({
          where: { id: serviceId, salonId, isActive: true },
        });

        if (!service) {
          throw new Error("SERVICE_NOT_FOUND");
        }

        serviceIdValue = serviceId;
        priceNumber = Number(service.price);

        if (collaboratorId) {
          const collaborator = await tx.collaborator.findFirst({
            where: { id: collaboratorId, salonId },
          });

          if (!collaborator) {
            throw new Error("COLLABORATOR_NOT_FOUND");
          }
        }
      } else if (type === "product") {
        if (!productId) {
          throw new Error("PRODUCT_ID_REQUIRED");
        }

        const product = await tx.product.findFirst({
          where: { id: productId, salonId, isActive: true },
        });

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        productIdValue = productId;
        priceNumber = Number(product.price);
      } else {
        throw new Error("INVALID_TYPE");
      }

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          salonId,
          type,
          serviceId: serviceIdValue,
          productId: productIdValue,
          collaboratorId: collaboratorIdValue,
          quantity: qty,
          price: priceNumber,
          commission: 0,
        },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id, salonId },
      });

      const finalValue = items.reduce((sum, it) => {
        const q = it.quantity ?? 1;
        return sum + Number(it.price) * q;
      }, 0);

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { finalValue },
        include: { items: true, appointment: true },
      });

      return updatedOrder;
    });

    res.status(201).json(mapOrder(result));
  } catch (error: any) {
    if (error && error.message) {
      switch (error.message) {
        case "ORDER_NOT_FOUND":
          res.status(404).json({ error: "Order not found" });
          return;
        case "ORDER_NOT_OPEN":
          res.status(400).json({ error: "Only open orders can receive items" });
          return;
        case "SERVICE_ID_REQUIRED":
          res.status(400).json({ error: "serviceId is required for service items" });
          return;
        case "PRODUCT_ID_REQUIRED":
          res.status(400).json({ error: "productId is required for product items" });
          return;
        case "SERVICE_NOT_FOUND":
          res.status(404).json({ error: "Service not found" });
          return;
        case "PRODUCT_NOT_FOUND":
          res.status(404).json({ error: "Product not found" });
          return;
        case "COLLABORATOR_NOT_FOUND":
          res.status(404).json({ error: "Collaborator not found" });
          return;
        case "INVALID_TYPE":
          res.status(400).json({ error: "Invalid item type" });
          return;
      }
    }

    console.error("Error adding order item", error);
    res.status(500).json({ error: "Failed to add order item" });
  }
});

app.delete(
  "/orders/:id/items/:itemId",
  async (req: Request, res: Response) => {
    try {
      const salonId = await getDefaultSalonId();

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: req.params.id, salonId },
        });

        if (!order) {
          throw new Error("ORDER_NOT_FOUND");
        }

        if (order.status !== "open") {
          throw new Error("ORDER_NOT_OPEN");
        }

        const item = await tx.orderItem.findFirst({
          where: { id: req.params.itemId, orderId: order.id, salonId },
        });

        if (!item) {
          throw new Error("ITEM_NOT_FOUND");
        }

        await tx.orderItem.delete({
          where: { id: item.id },
        });

        const items = await tx.orderItem.findMany({
          where: { orderId: order.id, salonId },
        });

        const finalValue = items.reduce((sum, it) => {
          const q = it.quantity ?? 1;
          return sum + Number(it.price) * q;
        }, 0);

        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: { finalValue },
          include: { items: true, appointment: true },
        });

        return updatedOrder;
      });

      res.status(200).json(mapOrder(result));
    } catch (error: any) {
      if (error && error.message) {
        switch (error.message) {
          case "ORDER_NOT_FOUND":
            res.status(404).json({ error: "Order not found" });
            return;
          case "ORDER_NOT_OPEN":
            res.status(400).json({ error: "Only open orders can be modified" });
            return;
          case "ITEM_NOT_FOUND":
            res.status(404).json({ error: "Order item not found" });
            return;
        }
      }

      console.error("Error deleting order item", error);
      res.status(500).json({ error: "Failed to delete order item" });
    }
  }
);

app.post("/orders/:id/close", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (existing.status !== "open") {
      res.status(400).json({ error: "Only open orders can be closed" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: "closed",
        closedAt: new Date(),
      },
      include: { items: true, appointment: true },
    });

    res.json(mapOrder(updated));
  } catch (error) {
    console.error("Error closing order", error);
    res.status(500).json({ error: "Failed to close order" });
  }
});

app.post("/orders/:id/pay", async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (existing.status !== "closed") {
      res
        .status(400)
        .json({ error: "Only closed orders can be marked as paid" });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: "paid",
        closedAt: existing.closedAt ?? new Date(),
      },
      include: { items: true, appointment: true },
    });

    res.json(mapOrder(updated));
  } catch (error) {
    console.error("Error paying order", error);
    res.status(500).json({ error: "Failed to pay order" });
  }
});

app.post(
  "/appointments/:id/order/ensure",
  async (req: Request, res: Response) => {
    try {
      const salonId = await getDefaultSalonId();

      const appointment = await prisma.appointment.findFirst({
        where: { id: req.params.id, salonId },
        include: { services: true, order: true },
      });

      if (!appointment) {
        res.status(404).json({ error: "Appointment not found" });
        return;
      }

      // Tenta encontrar ordem já vinculada
      let existingOrder = await prisma.order.findFirst({
        where: {
          salonId,
          appointment: { id: appointment.id },
        },
        include: { items: true, appointment: true },
      });

      if (!existingOrder && appointment.orderId) {
        existingOrder = await prisma.order.findFirst({
          where: { id: appointment.orderId, salonId },
          include: { items: true, appointment: true },
        });
      }

      if (!existingOrder) {
        existingOrder = await prisma.order.findFirst({
          where: {
            salonId,
            clientId: appointment.clientId,
            status: "open",
            appointment: null,
          },
          include: { items: true, appointment: true },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        let order = existingOrder;

        if (!order) {
          order = await tx.order.create({
            data: {
              salonId,
              clientId: appointment.clientId,
              status: "open",
              finalValue: 0,
            },
            include: { items: true, appointment: true },
          });
        } else {
          order = await tx.order.findFirst({
            where: { id: order.id },
            include: { items: true, appointment: true },
          });
        }

        if (!order) {
          throw new Error("ORDER_CREATION_FAILED");
        }

        if (!appointment.orderId || appointment.orderId !== order.id) {
          await tx.appointment.update({
            where: { id: appointment.id },
            data: { orderId: order.id },
          });
        }

        const serviceIds = (appointment.services ?? []).map(
          (s: any) => s.serviceId
        );

        const services = await tx.service.findMany({
          where: { salonId, id: { in: serviceIds } },
        });

        const servicesById = new Map<string, any>();
        for (const s of services) {
          servicesById.set(s.id, s);
        }

        const existingItems = await tx.orderItem.findMany({
          where: { orderId: order.id, salonId },
        });

        for (const apService of appointment.services ?? []) {
          const serviceId = apService.serviceId;
          const alreadyExists = existingItems.some((it) => {
            return (
              it.type === "service" &&
              it.serviceId === serviceId &&
              it.collaboratorId === appointment.collaboratorId
            );
          });

          if (alreadyExists) {
            continue;
          }

          const service = servicesById.get(serviceId);
          if (!service) {
            continue;
          }

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              salonId,
              type: "service",
              serviceId,
              collaboratorId: appointment.collaboratorId,
              quantity: 1,
              price: Number(service.price),
              commission: 0,
            },
          });
        }

        const allItems = await tx.orderItem.findMany({
          where: { orderId: order.id, salonId },
        });

        const finalValue = allItems.reduce((sum, it) => {
          const q = it.quantity ?? 1;
          return sum + Number(it.price) * q;
        }, 0);

        const finalOrder = await tx.order.update({
          where: { id: order.id },
          data: { finalValue },
          include: { items: true, appointment: true },
        });

        return finalOrder;
      });

      res.json(mapOrder(result));
    } catch (error) {
      console.error("Error ensuring order for appointment", error);
      res
        .status(500)
        .json({ error: "Failed to ensure order for appointment" });
    }
  }
);
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
