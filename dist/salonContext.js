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
    };
}
