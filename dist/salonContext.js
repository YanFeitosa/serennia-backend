"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultSalonId = getDefaultSalonId;
exports.mapSalonSettings = mapSalonSettings;
const prismaClient_1 = require("./prismaClient");
async function getDefaultSalonId() {
    const existing = await prismaClient_1.prisma.salon.findFirst();
    if (existing) {
        return existing.id;
    }
    const created = await prismaClient_1.prisma.salon.create({
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
        'podeDeletarCliente',
        'podeDeletarColaborador',
        'podeDeletarProduto',
        'podeDeletarServico',
    ],
    manager: [
        'servicos',
        'produtos',
        'colaboradores',
        'financeiro',
        'configuracoes',
        'auditoria',
        'podeDeletarCliente',
        'podeDeletarColaborador',
        'podeDeletarProduto',
        'podeDeletarServico',
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
function mapSalonSettings(s) {
    return {
        id: s.id,
        name: s.name,
        defaultCommissionRate: s.defaultCommissionRate != null ? Number(s.defaultCommissionRate) : null,
        commissionMode: s.commissionMode ?? 'professional',
        fixedCostsMonthly: s.fixedCostsMonthly != null ? Number(s.fixedCostsMonthly) : null,
        variableCostRate: s.variableCostRate != null ? Number(s.variableCostRate) : null,
        rolePermissions: s.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS,
        theme: s.theme ?? null,
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
