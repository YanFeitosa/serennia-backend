"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
// src/routes/payments.ts
const express_1 = require("express");
const payments_1 = require("../services/payments");
const prismaClient_1 = require("../prismaClient");
const paymentsRouter = (0, express_1.Router)();
exports.paymentsRouter = paymentsRouter;
// Get payment config for current salon (public keys only)
paymentsRouter.get('/config', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const salonId = req.user.salonId;
        const salon = await prismaClient_1.prisma.salon.findUnique({
            where: { id: salonId },
            select: {
                paymentProvider: true,
                mpPublicKey: true,
                stripePublishableKey: true,
            },
        });
        if (!salon || !salon.paymentProvider) {
            res.json({ configured: false });
            return;
        }
        res.json({
            configured: true,
            provider: salon.paymentProvider,
            publicKey: salon.paymentProvider === 'mercadopago' ? salon.mpPublicKey : salon.stripePublishableKey,
        });
    }
    catch (error) {
        console.error('Error getting payment config', error);
        res.status(500).json({ error: 'Failed to get payment config' });
    }
});
// Create PIX payment
paymentsRouter.post('/pix', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { orderId, amount, description, payerEmail, payerName } = req.body;
        if (!orderId || !amount) {
            res.status(400).json({ error: 'orderId and amount are required' });
            return;
        }
        const salonId = req.user.salonId;
        // Verify order belongs to salon
        const order = await prismaClient_1.prisma.order.findFirst({
            where: { id: orderId, salonId },
            include: { client: true },
        });
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const result = await (0, payments_1.createPixPayment)({
            salonId,
            orderId,
            amount,
            description: description || `Pagamento Comanda #${orderId.slice(0, 6)}`,
            payerEmail: payerEmail || order.client.email || undefined,
            payerName: payerName || order.client.name,
        });
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error creating PIX payment', error);
        res.status(500).json({ error: 'Failed to create PIX payment' });
    }
});
// Create card payment (Mercado Pago)
paymentsRouter.post('/card', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { orderId, amount, token, payerEmail, installments } = req.body;
        if (!orderId || !amount || !token || !payerEmail) {
            res.status(400).json({ error: 'orderId, amount, token and payerEmail are required' });
            return;
        }
        const salonId = req.user.salonId;
        // Verify order belongs to salon
        const order = await prismaClient_1.prisma.order.findFirst({
            where: { id: orderId, salonId },
        });
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const config = await (0, payments_1.getPaymentConfigForSalon)(salonId);
        if (!config) {
            res.status(400).json({ error: 'No payment gateway configured' });
            return;
        }
        if (config.provider === 'mercadopago') {
            const result = await (0, payments_1.createCardPaymentMercadoPago)({
                salonId,
                orderId,
                amount,
                description: `Pagamento Comanda #${orderId.slice(0, 6)}`,
                token,
                payerEmail,
                installments,
            });
            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }
            res.json(result);
        }
        else if (config.provider === 'stripe') {
            // For Stripe, we create a payment intent
            const result = await (0, payments_1.createStripePaymentIntent)({
                salonId,
                orderId,
                amount,
                description: `Pagamento Comanda #${orderId.slice(0, 6)}`,
            });
            if (!result.success) {
                res.status(400).json({ error: result.error });
                return;
            }
            res.json(result);
        }
        else {
            res.status(400).json({ error: 'Unsupported payment provider' });
        }
    }
    catch (error) {
        console.error('Error creating card payment', error);
        res.status(500).json({ error: 'Failed to create card payment' });
    }
});
// Create Stripe payment intent
paymentsRouter.post('/stripe/intent', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { orderId, amount, description } = req.body;
        if (!orderId || !amount) {
            res.status(400).json({ error: 'orderId and amount are required' });
            return;
        }
        const salonId = req.user.salonId;
        // Verify order belongs to salon
        const order = await prismaClient_1.prisma.order.findFirst({
            where: { id: orderId, salonId },
        });
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        const result = await (0, payments_1.createStripePaymentIntent)({
            salonId,
            orderId,
            amount,
            description: description || `Pagamento Comanda #${orderId.slice(0, 6)}`,
        });
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error creating Stripe payment intent', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});
// Check payment status
paymentsRouter.get('/status/:paymentId', async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { paymentId } = req.params;
        const salonId = req.user.salonId;
        const result = await (0, payments_1.checkPaymentStatus)(salonId, paymentId);
        if (!result.success) {
            res.status(400).json({ error: result.error });
            return;
        }
        res.json({ status: result.status });
    }
    catch (error) {
        console.error('Error checking payment status', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});
// Webhook for Mercado Pago
paymentsRouter.post('/webhooks/mercadopago', async (req, res) => {
    try {
        const { type, data } = req.body;
        if (type === 'payment') {
            const paymentId = data?.id;
            if (paymentId) {
                console.log(`[Webhook MP] Payment ${paymentId} received`);
                // TODO: Update order status based on payment status
                // This would require storing the payment ID with the order
            }
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error processing Mercado Pago webhook', error);
        res.sendStatus(500);
    }
});
// Webhook for Stripe
paymentsRouter.post('/webhooks/stripe', async (req, res) => {
    try {
        const event = req.body;
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            console.log(`[Webhook Stripe] Payment ${paymentIntent.id} succeeded`);
            // TODO: Update order status based on payment
        }
        res.sendStatus(200);
    }
    catch (error) {
        console.error('Error processing Stripe webhook', error);
        res.sendStatus(500);
    }
});
