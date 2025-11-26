// src/services/whatsapp.ts
// Serviço de integração com WhatsApp via Evolution API
import { prisma } from '../prismaClient';

export interface WhatsAppConfig {
  apiKey?: string;
  instanceId?: string;
  apiUrl?: string;
}

// Get WhatsApp config from salon
export async function getWhatsAppConfigForSalon(salonId: string): Promise<WhatsAppConfig | null> {
  const salon = await prisma.salon.findUnique({
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

export interface SendMessageParams {
  to: string; // Número de telefone (formato: 5511999999999)
  message: string;
  config?: WhatsAppConfig;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Substitui variáveis em um template de mensagem
 * Exemplo: "Olá {{cliente_nome}}" -> "Olá João"
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
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
export function formatPhoneNumber(phone: string): string {
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
export async function sendWhatsAppMessage(
  params: SendMessageParams
): Promise<SendMessageResult> {
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
      } catch (fetchError: any) {
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
  } catch (error) {
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
export async function sendWhatsAppMessageForSalon(
  salonId: string,
  to: string,
  message: string
): Promise<SendMessageResult> {
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
export async function testWhatsAppConnection(
  config: WhatsAppConfig
): Promise<{ success: boolean; error?: string }> {
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao testar conexão',
    };
  }
}

