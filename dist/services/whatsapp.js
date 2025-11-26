"use strict";
// src/services/whatsapp.ts
// Serviço de integração com WhatsApp
// Por enquanto, implementação básica que pode ser estendida com Evolution API, Twilio, etc.
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.formatPhoneNumber = formatPhoneNumber;
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.testWhatsAppConnection = testWhatsAppConnection;
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
 * Envia mensagem via WhatsApp
 * Por enquanto, apenas simula o envio.
 * Para produção, integrar com Evolution API, Twilio, ou WhatsApp Business API
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
        // TODO: Implementar integração real com WhatsApp
        // Exemplo com Evolution API:
        // if (config?.apiUrl && config?.apiKey && config?.instanceId) {
        //   const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceId}`, {
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //       'apikey': config.apiKey,
        //     },
        //     body: JSON.stringify({
        //       number: formattedPhone,
        //       text: message,
        //     }),
        //   });
        //   
        //   if (!response.ok) {
        //     const error = await response.json();
        //     return {
        //       success: false,
        //       error: error.message || 'Erro ao enviar mensagem',
        //     };
        //   }
        //   
        //   const data = await response.json();
        //   return {
        //     success: true,
        //     messageId: data.key?.id,
        //   };
        // }
        // Por enquanto, apenas simula sucesso
        // Em produção, isso deve ser substituído pela integração real
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
