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

const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    'agenda',
    'comandas',
    'clientes',
    'servicos',
    'produtos',
    'colaboradores',
    'financeiro',
    'configuracoes',
    'auditoria',
    'notificacoes',
    'editarPerfilProfissionais',
    'podeEditarProduto',
    'podeEditarServico',
  ],
  manager: [
    'servicos',
    'produtos',
    'colaboradores',
    'financeiro',
    'configuracoes',
    'auditoria',
  ],
  receptionist: [
    'agenda',
    'comandas',
    'clientes',
    'servicos',
    'produtos',
    'colaboradores',
    'notificacoes',
  ],
  professional: [
    'agenda',
    'comandas',
    'clientes',
    'notificacoes',
  ],
  accountant: [
    'financeiro',
  ],
};

export function mapSalonSettings(s: any) {
  return {
    id: s.id,
    name: s.name,
    defaultCommissionRate:
      s.defaultCommissionRate != null ? Number(s.defaultCommissionRate) : null,
    commissionMode: s.commissionMode ?? 'professional',
    fixedCostsMonthly:
      s.fixedCostsMonthly != null ? Number(s.fixedCostsMonthly) : null,
    variableCostRate:
      s.variableCostRate != null ? Number(s.variableCostRate) : null,
    rolePermissions: s.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS,
    theme: s.theme ?? null,
  };
}
