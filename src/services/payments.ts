    // src/services/payments.ts
// Serviço de integração com gateways de pagamento (Mercado Pago e Stripe)
import { prisma } from '../prismaClient';

export interface PaymentConfig {
  provider: 'mercadopago' | 'stripe';
  // Mercado Pago
  mpAccessToken?: string;
  mpPublicKey?: string;
  // Stripe
  stripeSecretKey?: string;
  stripePublishableKey?: string;
}

export interface CreatePixPaymentParams {
  salonId: string;
  orderId: string;
  amount: number;
  description: string;
  payerEmail?: string;
  payerName?: string;
}

export interface PixPaymentResult {
  success: boolean;
  qrCode?: string;
  qrCodeBase64?: string;
  copyPaste?: string;
  expirationDate?: string;
  paymentId?: string;
  error?: string;
}

export interface CreateCardPaymentParams {
  salonId: string;
  orderId: string;
  amount: number;
  description: string;
  token: string; // Card token from frontend
  payerEmail: string;
  installments?: number;
}

export interface CardPaymentResult {
  success: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
}

// Get payment config from salon
export async function getPaymentConfigForSalon(salonId: string): Promise<PaymentConfig | null> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: {
      paymentProvider: true,
      mpAccessToken: true,
      mpPublicKey: true,
      stripeSecretKey: true,
      stripePublishableKey: true,
    },
  });

  if (!salon || !salon.paymentProvider) {
    return null;
  }

  return {
    provider: salon.paymentProvider as 'mercadopago' | 'stripe',
    mpAccessToken: salon.mpAccessToken || undefined,
    mpPublicKey: salon.mpPublicKey || undefined,
    stripeSecretKey: salon.stripeSecretKey || undefined,
    stripePublishableKey: salon.stripePublishableKey || undefined,
  };
}

/**
 * Create PIX payment via Mercado Pago
 */
export async function createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
  const { salonId, orderId, amount, description, payerEmail, payerName } = params;

  const config = await getPaymentConfigForSalon(salonId);

  if (!config) {
    return { success: false, error: 'Nenhum gateway de pagamento configurado' };
  }

  if (config.provider !== 'mercadopago') {
    return { success: false, error: 'PIX só está disponível com Mercado Pago' };
  }

  if (!config.mpAccessToken) {
    return { success: false, error: 'Access Token do Mercado Pago não configurado' };
  }

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.mpAccessToken}`,
        'X-Idempotency-Key': `${orderId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        payment_method_id: 'pix',
        payer: {
          email: payerEmail || 'cliente@serennia.com.br',
          first_name: payerName?.split(' ')[0] || 'Cliente',
          last_name: payerName?.split(' ').slice(1).join(' ') || 'Serennia',
        },
        external_reference: orderId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Mercado Pago PIX error:', errorData);
      return {
        success: false,
        error: errorData.message || 'Erro ao criar pagamento PIX',
      };
    }

    const data = await response.json();

    return {
      success: true,
      qrCode: data.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      copyPaste: data.point_of_interaction?.transaction_data?.qr_code,
      expirationDate: data.date_of_expiration,
      paymentId: data.id?.toString(),
    };
  } catch (error: any) {
    console.error('Error creating PIX payment:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar pagamento PIX',
    };
  }
}

/**
 * Create card payment via Mercado Pago
 */
export async function createCardPaymentMercadoPago(params: CreateCardPaymentParams): Promise<CardPaymentResult> {
  const { salonId, orderId, amount, description, token, payerEmail, installments = 1 } = params;

  const config = await getPaymentConfigForSalon(salonId);

  if (!config || config.provider !== 'mercadopago') {
    return { success: false, error: 'Mercado Pago não configurado' };
  }

  if (!config.mpAccessToken) {
    return { success: false, error: 'Access Token do Mercado Pago não configurado' };
  }

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.mpAccessToken}`,
        'X-Idempotency-Key': `${orderId}-card-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description,
        token: token,
        installments: installments,
        payer: {
          email: payerEmail,
        },
        external_reference: orderId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Mercado Pago card error:', errorData);
      return {
        success: false,
        error: errorData.message || 'Erro ao processar pagamento com cartão',
      };
    }

    const data = await response.json();

    return {
      success: data.status === 'approved',
      paymentId: data.id?.toString(),
      status: data.status,
      error: data.status !== 'approved' ? `Pagamento ${data.status_detail || data.status}` : undefined,
    };
  } catch (error: any) {
    console.error('Error creating card payment:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar pagamento com cartão',
    };
  }
}

/**
 * Create payment intent via Stripe
 */
export async function createStripePaymentIntent(params: {
  salonId: string;
  orderId: string;
  amount: number;
  description: string;
}): Promise<{ success: boolean; clientSecret?: string; paymentIntentId?: string; error?: string }> {
  const { salonId, orderId, amount, description } = params;

  const config = await getPaymentConfigForSalon(salonId);

  if (!config || config.provider !== 'stripe') {
    return { success: false, error: 'Stripe não configurado' };
  }

  if (!config.stripeSecretKey) {
    return { success: false, error: 'Secret Key do Stripe não configurada' };
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${config.stripeSecretKey}`,
      },
      body: new URLSearchParams({
        amount: Math.round(amount * 100).toString(), // Stripe uses cents
        currency: 'brl',
        description: description,
        'metadata[orderId]': orderId,
        'metadata[salonId]': salonId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Stripe error:', errorData);
      return {
        success: false,
        error: errorData.error?.message || 'Erro ao criar pagamento',
      };
    }

    const data = await response.json();

    return {
      success: true,
      clientSecret: data.client_secret,
      paymentIntentId: data.id,
    };
  } catch (error: any) {
    console.error('Error creating Stripe payment intent:', error);
    return {
      success: false,
      error: error.message || 'Erro ao processar pagamento',
    };
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(salonId: string, paymentId: string): Promise<{
  success: boolean;
  status?: string;
  error?: string;
}> {
  const config = await getPaymentConfigForSalon(salonId);

  if (!config) {
    return { success: false, error: 'Gateway não configurado' };
  }

  try {
    if (config.provider === 'mercadopago' && config.mpAccessToken) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${config.mpAccessToken}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: 'Erro ao consultar pagamento' };
      }

      const data = await response.json();
      return {
        success: true,
        status: data.status,
      };
    }

    if (config.provider === 'stripe' && config.stripeSecretKey) {
      const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${config.stripeSecretKey}`,
        },
      });

      if (!response.ok) {
        return { success: false, error: 'Erro ao consultar pagamento' };
      }

      const data = await response.json();
      return {
        success: true,
        status: data.status,
      };
    }

    return { success: false, error: 'Provedor não suportado' };
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return {
      success: false,
      error: error.message || 'Erro ao consultar pagamento',
    };
  }
}

