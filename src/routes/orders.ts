import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { getDefaultSalonId } from '../salonContext';
import { OrderStatus, OrderItemType } from '../types/enums';

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

const ordersRouter = Router();

ordersRouter.get('/', async (req: Request, res: Response) => {
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
        res.status(400).json({ error: 'Invalid dateFrom' });
        return;
      }
      andConditions.push({ createdAt: { gte: from } });
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (isNaN(to.getTime())) {
        res.status(400).json({ error: 'Invalid dateTo' });
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
      orderBy: { createdAt: 'desc' },
      include: { items: true, appointment: true, client: true },
    });

    res.json(orders.map(mapOrder));
  } catch (error) {
    console.error('Error listing orders', error);
    res.status(500).json({ error: 'Failed to list orders' });
  }
});

ordersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(mapOrder(order));
  } catch (error) {
    console.error('Error fetching order', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

ordersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body as { clientId?: string };

    if (!clientId) {
      res.status(400).json({ error: 'clientId is required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    const client = await prisma.client.findFirst({
      where: { id: clientId, salonId, isActive: true },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const order = await prisma.order.create({
      data: {
        salonId,
        clientId,
        status: 'open',
        finalValue: 0,
      },
      include: { items: true, appointment: true },
    });

    res.status(201).json(mapOrder(order));
  } catch (error) {
    console.error('Error creating order', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

ordersRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body as { clientId?: string };

    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status !== 'open') {
      res.status(400).json({ error: 'Only open orders can be edited' });
      return;
    }

    const data: any = {};

    if (clientId && clientId !== existing.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, salonId, isActive: true },
      });

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
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
    console.error('Error updating order', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

ordersRouter.post('/:id/items', async (req: Request, res: Response) => {
  try {
    const { type, serviceId, productId, collaboratorId, quantity } =
      req.body as {
        type?: OrderItemType;
        serviceId?: string;
        productId?: string;
        collaboratorId?: string;
        quantity?: number;
      };

    if (!type) {
      res.status(400).json({ error: 'type is required' });
      return;
    }

    const salonId = await getDefaultSalonId();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: req.params.id, salonId },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      if (order.status !== 'open') {
        throw new Error('ORDER_NOT_OPEN');
      }

      const qty = quantity && quantity > 0 ? quantity : 1;

      let priceNumber = 0;
      let serviceIdValue: string | undefined;
      let productIdValue: string | undefined;
      let collaboratorIdValue: string | undefined = collaboratorId;

      if (type === 'service') {
        if (!serviceId) {
          throw new Error('SERVICE_ID_REQUIRED');
        }

        const service = await tx.service.findFirst({
          where: { id: serviceId, salonId, isActive: true },
        });

        if (!service) {
          throw new Error('SERVICE_NOT_FOUND');
        }

        serviceIdValue = serviceId;
        priceNumber = Number(service.price);

        if (collaboratorId) {
          const collaborator = await tx.collaborator.findFirst({
            where: { id: collaboratorId, salonId },
          });

          if (!collaborator) {
            throw new Error('COLLABORATOR_NOT_FOUND');
          }
        }
      } else if (type === 'product') {
        if (!productId) {
          throw new Error('PRODUCT_ID_REQUIRED');
        }

        const product = await tx.product.findFirst({
          where: { id: productId, salonId, isActive: true },
        });

        if (!product) {
          throw new Error('PRODUCT_NOT_FOUND');
        }

        productIdValue = productId;
        priceNumber = Number(product.price);
      } else {
        throw new Error('INVALID_TYPE');
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
        case 'ORDER_NOT_FOUND':
          res.status(404).json({ error: 'Order not found' });
          return;
        case 'ORDER_NOT_OPEN':
          res.status(400).json({ error: 'Only open orders can receive items' });
          return;
        case 'SERVICE_ID_REQUIRED':
          res
            .status(400)
            .json({ error: 'serviceId is required for service items' });
          return;
        case 'PRODUCT_ID_REQUIRED':
          res
            .status(400)
            .json({ error: 'productId is required for product items' });
          return;
        case 'SERVICE_NOT_FOUND':
          res.status(404).json({ error: 'Service not found' });
          return;
        case 'PRODUCT_NOT_FOUND':
          res.status(404).json({ error: 'Product not found' });
          return;
        case 'COLLABORATOR_NOT_FOUND':
          res.status(404).json({ error: 'Collaborator not found' });
          return;
        case 'INVALID_TYPE':
          res.status(400).json({ error: 'Invalid item type' });
          return;
      }
    }

    console.error('Error adding order item', error);
    res.status(500).json({ error: 'Failed to add order item' });
  }
});

ordersRouter.delete('/:id/items/:itemId', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: req.params.id, salonId },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      if (order.status !== 'open') {
        throw new Error('ORDER_NOT_OPEN');
      }

      const item = await tx.orderItem.findFirst({
        where: { id: req.params.itemId, orderId: order.id, salonId },
      });

      if (!item) {
        throw new Error('ITEM_NOT_FOUND');
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
        case 'ORDER_NOT_FOUND':
          res.status(404).json({ error: 'Order not found' });
          return;
        case 'ORDER_NOT_OPEN':
          res.status(400).json({ error: 'Only open orders can be modified' });
          return;
        case 'ITEM_NOT_FOUND':
          res.status(404).json({ error: 'Order item not found' });
          return;
      }
    }

    console.error('Error deleting order item', error);
    res.status(500).json({ error: 'Failed to delete order item' });
  }
});

ordersRouter.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status !== 'open') {
      res.status(400).json({ error: 'Only open orders can be closed' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'closed',
        closedAt: new Date(),
      },
      include: { items: true, appointment: true },
    });

    res.json(mapOrder(updated));
  } catch (error) {
    console.error('Error closing order', error);
    res.status(500).json({ error: 'Failed to close order' });
  }
});

ordersRouter.post('/:id/pay', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, salonId },
      include: { items: true, appointment: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    if (existing.status !== 'closed') {
      res.status(400).json({ error: 'Only closed orders can be marked as paid' });
      return;
    }

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'paid',
        closedAt: existing.closedAt ?? new Date(),
      },
      include: { items: true, appointment: true },
    });

    res.json(mapOrder(updated));
  } catch (error) {
    console.error('Error paying order', error);
    res.status(500).json({ error: 'Failed to pay order' });
  }
});

ordersRouter.post('/appointments/:id/order/ensure', async (req: Request, res: Response) => {
  try {
    const salonId = await getDefaultSalonId();

    const appointment = await prisma.appointment.findFirst({
      where: { id: req.params.id, salonId },
      include: { services: true, order: true },
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

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
          status: 'open',
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
            status: 'open',
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
        throw new Error('ORDER_CREATION_FAILED');
      }

      if (!appointment.orderId || appointment.orderId !== order.id) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: { orderId: order.id },
        });
      }

      const serviceIds = (appointment.services ?? []).map((s: any) => s.serviceId);

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
            it.type === 'service' &&
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
            type: 'service',
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
    console.error('Error ensuring order for appointment', error);
    res.status(500).json({ error: 'Failed to ensure order for appointment' });
  }
});

export { ordersRouter };
