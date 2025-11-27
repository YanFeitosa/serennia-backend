"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppConfigForSalon = getWhatsAppConfigForSalon;
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.formatPhoneNumber = formatPhoneNumber;
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.sendWhatsAppMessageForSalon = sendWhatsAppMessageForSalon;
exports.testWhatsAppConnection = testWhatsAppConnection;
// src/services/whatsapp.ts
// Serviço de integração com WhatsApp via Evolution API
const prismaClient_1 = require("../prismaClient");
// Get WhatsApp config from salon
async function getWhatsAppConfigForSalon(salonId) {
    const salon = await prismaClient_1.prisma.salon.findUnique({
        where: { id: salonId },
        select: {
            whatsappApiUrl: true,
            whatsappApiKey: true,
            whatsappInstanceId: true,
            whatsappConnected: true,
        },
    });
    if (!salon || !salon.whatsappApiUrl || !salon.whatsappApiKey || !salon.whatsappInstanceId) {
        return null;
    }
    return {
        apiUrl: salon.whatsappApiUrl,
        apiKey: salon.whatsappApiKey,
        instanceId: salon.whatsappInstanceId,
    };
}
/**
 * Substitui variáveis em um template de mensagem
 * Exemplo: "Olá {{cliente_nome}}" -> "Olá João"
 */
function replaceTemplateVariables(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        const replacement = value !== undefined && value !== null ? String(value) : '';
        result = result.replace(new RegExp(placeholder, 'g'), replacement);
    }
    return result;
}
/**
 * Formata número de telefone para formato internacional
 * Remove caracteres não numéricos e adiciona código do país se necessário
 */
function formatPhoneNumber(phone) {
    // Remove tudo exceto números
    const cleaned = phone.replace(/\D/g, '');
    // Se já começa com 55 (Brasil), retorna como está
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
        return cleaned;
    }
    // Se tem 11 dígitos e começa com 0, remove o 0 e adiciona 55
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
        return '55' + cleaned.substring(1);
    }
    // Se tem 10 ou 11 dígitos, assume que é Brasil e adiciona 55
    if (cleaned.length === 10 || cleaned.length === 11) {
        return '55' + cleaned;
    }
    return cleaned;
}
/**
 * Envia mensagem via WhatsApp usando Evolution API
 */
async function sendWhatsAppMessage(params) {
    try {
        const { to, message, config } = params;
        // Formata o número de telefone
        const formattedPhone = formatPhoneNumber(to);
        // Validação básica
        if (!formattedPhone || formattedPhone.length < 10) {
            return {
                success: false,
                error: 'Número de telefone inválido',
            };
        }
        if (!message || message.trim().length === 0) {
            return {
                success: false,
                error: 'Mensagem vazia',
            };
        }
        // Se tem configuração da Evolution API, usa ela
        if (config?.apiUrl && config?.apiKey && config?.instanceId) {
            try {
                const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.apiKey,
                    },
                    body: JSON.stringify({
                        number: formattedPhone,
                        text: message,
                    }),
                });
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Evolution API error:', errorData);
                    return {
                        success: false,
                        error: errorData.message || 'Erro ao enviar mensagem via Evolution API',
                    };
                }
                const data = await response.json();
                console.log(`[WhatsApp] Mensagem enviada para ${formattedPhone}`);
                return {
                    success: true,
                    messageId: data.key?.id || data.messageId,
                };
            }
            catch (fetchError) {
                console.error('Error calling Evolution API:', fetchError);
                return {
                    success: false,
                    error: 'Não foi possível conectar à API do WhatsApp',
                };
            }
        }
        // Fallback: simula envio se não há configuração
        console.log(`[WhatsApp Simulado] Enviando para ${formattedPhone}: ${message.substring(0, 50)}...`);
        return {
            success: true,
            messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        };
    }
    catch (error) {
        console.error('Erro ao enviar mensagem WhatsApp:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar mensagem',
        };
    }
}
/**
 * Envia mensagem via WhatsApp para um salão específico
 * Busca as configurações do salão automaticamente
 */
async function sendWhatsAppMessageForSalon(salonId, to, message) {
    const config = await getWhatsAppConfigForSalon(salonId);
    if (!config) {
        console.log(`[WhatsApp] Salão ${salonId} não tem configuração de WhatsApp, simulando envio`);
    }
    return sendWhatsAppMessage({
        to,
        message,
        config: config || undefined,
    });
}
/**
 * Testa a conexão com o serviço de WhatsApp
 */
async function testWhatsAppConnection(config) {
    try {
        // TODO: Implementar teste real de conexão
        // Por enquanto, apenas valida se as credenciais estão presentes
        if (!config.apiKey || !config.instanceId || !config.apiUrl) {
            return {
                success: false,
                error: 'Credenciais não configuradas',
            };
        }
        // Simula teste de conexão
        return {
            success: true,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao testar conexão',
        };
    }
}
