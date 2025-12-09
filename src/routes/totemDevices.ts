// src/routes/totemDevices.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { supabaseAuthMiddleware, type SupabaseAuthRequest, hasPermission } from '../middleware/supabaseAuth';

const totemDevicesRouter = Router();

// Generate a unique 6-digit access code
const generateAccessCode = async (): Promise<string> => {
  let code: string;
  let exists = true;
  
  while (exists) {
    // Generate 6-digit code
    code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if it already exists
    const existing = await prisma.totemDevice.findUnique({
      where: { accessCode: code }
    });
    
    exists = !!existing;
  }
  
  return code!;
};

// GET /totem-devices - List all totem devices for the salon
totemDevicesRouter.get('/', supabaseAuthMiddleware, async (req: SupabaseAuthRequest, res: Response) => {
  try {
    const salonId = req.user?.salonId;
    if (!salonId) {
      res.status(400).json({ error: 'Salon context required' });
      return;
    }

    // Check permission
    if (!hasPermission(req.user, 'configuracoes')) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const devices = await prisma.totemDevice.findMany({
      where: { salonId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(devices);
  } catch (error) {
    console.error('Error fetching totem devices:', error);
    res.status(500).json({ error: 'Failed to fetch totem devices' });
  }
});

// POST /totem-devices - Create a new totem device
totemDevicesRouter.post('/', supabaseAuthMiddleware, async (req: SupabaseAuthRequest, res: Response) => {
  try {
    const salonId = req.user?.salonId;
    if (!salonId) {
      res.status(400).json({ error: 'Salon context required' });
      return;
    }

    // Check permission
    if (!hasPermission(req.user, 'configuracoes')) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { name } = req.body as { name: string };

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Nome do totem é obrigatório' });
      return;
    }

    const accessCode = await generateAccessCode();

    const device = await prisma.totemDevice.create({
      data: {
        salonId,
        name: name.trim(),
        accessCode,
        isActive: true,
      }
    });

    res.status(201).json(device);
  } catch (error) {
    console.error('Error creating totem device:', error);
    res.status(500).json({ error: 'Failed to create totem device' });
  }
});

// PUT /totem-devices/:id - Update a totem device
totemDevicesRouter.put('/:id', supabaseAuthMiddleware, async (req: SupabaseAuthRequest, res: Response) => {
  try {
    const salonId = req.user?.salonId;
    if (!salonId) {
      res.status(400).json({ error: 'Salon context required' });
      return;
    }

    // Check permission
    if (!hasPermission(req.user, 'configuracoes')) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { id } = req.params;
    const { name, isActive } = req.body as { name?: string; isActive?: boolean };

    // Verify the device belongs to this salon
    const existing = await prisma.totemDevice.findFirst({
      where: { id, salonId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Totem device not found' });
      return;
    }

    const device = await prisma.totemDevice.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json(device);
  } catch (error) {
    console.error('Error updating totem device:', error);
    res.status(500).json({ error: 'Failed to update totem device' });
  }
});

// POST /totem-devices/:id/regenerate-code - Regenerate access code
totemDevicesRouter.post('/:id/regenerate-code', supabaseAuthMiddleware, async (req: SupabaseAuthRequest, res: Response) => {
  try {
    const salonId = req.user?.salonId;
    if (!salonId) {
      res.status(400).json({ error: 'Salon context required' });
      return;
    }

    // Check permission
    if (!hasPermission(req.user, 'configuracoes')) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { id } = req.params;

    // Verify the device belongs to this salon
    const existing = await prisma.totemDevice.findFirst({
      where: { id, salonId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Totem device not found' });
      return;
    }

    const newCode = await generateAccessCode();

    const device = await prisma.totemDevice.update({
      where: { id },
      data: { accessCode: newCode }
    });

    res.json(device);
  } catch (error) {
    console.error('Error regenerating access code:', error);
    res.status(500).json({ error: 'Failed to regenerate access code' });
  }
});

// DELETE /totem-devices/:id - Delete a totem device
totemDevicesRouter.delete('/:id', supabaseAuthMiddleware, async (req: SupabaseAuthRequest, res: Response) => {
  try {
    const salonId = req.user?.salonId;
    if (!salonId) {
      res.status(400).json({ error: 'Salon context required' });
      return;
    }

    // Check permission
    if (!hasPermission(req.user, 'configuracoes')) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const { id } = req.params;

    // Verify the device belongs to this salon
    const existing = await prisma.totemDevice.findFirst({
      where: { id, salonId }
    });

    if (!existing) {
      res.status(404).json({ error: 'Totem device not found' });
      return;
    }

    await prisma.totemDevice.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting totem device:', error);
    res.status(500).json({ error: 'Failed to delete totem device' });
  }
});

export default totemDevicesRouter;
