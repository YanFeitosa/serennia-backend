// src/services/audit.ts
import { prisma } from '../prismaClient';
import { AuditAction } from '../types/enums';

export interface AuditLogData {
  salonId: string;
  userId: string;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Serviço de auditoria para registrar todas as mudanças no sistema
 */
export class AuditService {
  /**
   * Registra uma ação de auditoria no banco de dados
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
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
    } catch (error) {
      // Log de erro silencioso para não impactar a operação principal
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Registra uma criação (INSERT)
   */
  static async logCreate(
    salonId: string,
    userId: string,
    tableName: string,
    recordId: string,
    newValue: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      salonId,
      userId,
      action: AuditAction.INSERT,
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
  static async logUpdate(
    salonId: string,
    userId: string,
    tableName: string,
    recordId: string,
    oldValue: Record<string, any>,
    newValue: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      salonId,
      userId,
      action: AuditAction.UPDATE,
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
  static async logDelete(
    salonId: string,
    userId: string,
    tableName: string,
    recordId: string,
    oldValue: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      salonId,
      userId,
      action: AuditAction.DELETE,
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
  private static sanitizeValue(value: Record<string, any>): Record<string, any> {
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
  static getRequestInfo(req: any): { ipAddress?: string; userAgent?: string } {
    return {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  }
}

export default AuditService;
