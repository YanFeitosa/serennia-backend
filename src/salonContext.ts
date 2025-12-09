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
    'comissoes',
    'configuracoes',
    'auditoria',
    'notificacoes',
    'editarPerfilProfissionais',
    'podeEditarProduto',
    'podeEditarServico',
    'podeDeletarCliente',
    'podeDeletarColaborador',
    'podeDeletarProduto',
    'podeDeletarServico',
    'verDadosBancariosColaborador',
  ],
  manager: [
    'servicos',
    'produtos',
    'colaboradores',
    'financeiro',
    'comissoes',
    'configuracoes',
    'auditoria',
    'podeDeletarCliente',
    'podeDeletarColaborador',
    'podeDeletarProduto',
    'podeDeletarServico',
    'verDadosBancariosColaborador',
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
    'comissoes',
    'verDadosBancariosColaborador',
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
    stockControlEnabled: s.stockControlEnabled ?? true,
    // WhatsApp Integration
    whatsappApiUrl: s.whatsappApiUrl ?? null,
    whatsappApiKey: s.whatsappApiKey ?? null,
    whatsappInstanceId: s.whatsappInstanceId ?? null,
    whatsappPhone: s.whatsappPhone ?? null,
    whatsappConnected: s.whatsappConnected ?? false,
    // Payment Integration
    paymentProvider: s.paymentProvider ?? null,
    mpAccessToken: s.mpAccessToken ?? null,
    mpPublicKey: s.mpPublicKey ?? null,
    stripeSecretKey: s.stripeSecretKey ?? null,
    stripePublishableKey: s.stripePublishableKey ?? null,
  };
}
