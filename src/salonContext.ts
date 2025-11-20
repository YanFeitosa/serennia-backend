import { prisma } from './prismaClient';

export async function getDefaultSalonId(): Promise<string> {
  const existing = await prisma.salon.findFirst();
  if (existing) {
    return existing.id;
  }

  const created = await prisma.salon.create({
    data: {
      name: 'Default Salon',
      defaultCommissionRate: 0.5,
      commissionMode: 'professional',
    },
  });

  return created.id;
}

export function mapSalonSettings(s: any) {
  return {
    id: s.id,
    name: s.name,
    defaultCommissionRate:
      s.defaultCommissionRate != null ? Number(s.defaultCommissionRate) : null,
    commissionMode: s.commissionMode ?? 'professional',
  };
}
