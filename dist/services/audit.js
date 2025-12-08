"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
// src/services/audit.ts
const prismaClient_1 = require("../prismaClient");
/**
 * Serviço de auditoria para registrar todas as mudanças no sistema
 */
class AuditService {
    /**
     * Registra uma ação de auditoria no banco de dados
     */
    static async log(data) {
        try {
            await prismaClient_1.prisma.auditLog.create({
                data: {
                    salonId: data.salonId,
                    userId: data.userId,
                    action: data.action,
                    tableName: data.tableName,
                    recordId: data.recordId,
                    oldValue: data.oldValue ?? undefined,
                    newValue: data.newValue ?? undefined,
                    ipAddress: data.ipAddress ?? undefined,
                    userAgent: data.userAgent ?? undefined,
                },
            });
        }
        catch (error) {
            // Log de erro silencioso para não impactar a operação principal
            console.error('Failed to create audit log:', error);
        }
    }
    /**
     * Registra uma criação (INSERT)
     */
    static async logCreate(salonId, userId, tableName, recordId, newValue, ipAddress, userAgent) {
        await this.log({
            salonId,
            userId,
            action: 'INSERT',
            tableName,
            recordId,
            newValue: this.sanitizeValue(newValue),
            ipAddress,
            userAgent,
        });
    }
    /**
     * Registra uma atualização (UPDATE)
     */
    static async logUpdate(salonId, userId, tableName, recordId, oldValue, newValue, ipAddress, userAgent) {
        await this.log({
            salonId,
            userId,
            action: 'UPDATE',
            tableName,
            recordId,
            oldValue: this.sanitizeValue(oldValue),
            newValue: this.sanitizeValue(newValue),
            ipAddress,
            userAgent,
        });
    }
    /**
     * Registra uma exclusão (DELETE)
     */
    static async logDelete(salonId, userId, tableName, recordId, oldValue, ipAddress, userAgent) {
        await this.log({
            salonId,
            userId,
            action: 'DELETE',
            tableName,
            recordId,
            oldValue: this.sanitizeValue(oldValue),
            ipAddress,
            userAgent,
        });
    }
    /**
     * Remove campos sensíveis antes de salvar no log
     */
    static sanitizeValue(value) {
        const sensitiveFields = ['passwordHash', 'password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secretKey'];
        const sanitized = { ...value };
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    /**
     * Extrai informações de IP e User-Agent da requisição
     */
    static getRequestInfo(req) {
        return {
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            userAgent: req.headers['user-agent'],
        };
    }
}
exports.AuditService = AuditService;
exports.default = AuditService;
