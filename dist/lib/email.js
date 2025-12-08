"use strict";
/**
 * Email service for sending transactional emails
 * Uses Resend as the email provider
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendCollaboratorInviteEmail = sendCollaboratorInviteEmail;
const resend_1 = require("resend");
// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
// Email sender address (must be verified in Resend)
const FROM_EMAIL = process.env.EMAIL_FROM || 'Serennia <onboarding@resend.dev>';
async function sendEmail(options) {
    if (!resend) {
        console.warn('⚠️ RESEND_API_KEY not configured. Email not sent.');
        console.log('📧 Email would be sent:', {
            to: options.to,
            subject: options.subject,
        });
        return;
    }
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });
        if (error) {
            console.error('❌ Error sending email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
        console.log('✅ Email sent successfully:', data?.id);
    }
    catch (err) {
        console.error('❌ Error sending email:', err);
        throw err;
    }
}
async function sendWelcomeEmail(email, name, salonName, resetLink, tempPassword) {
    const frontendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    let passwordSection = '';
    let buttonLink = `${frontendUrl}/login`;
    let buttonText = 'Fazer Login';
    if (resetLink) {
        // Use password reset link
        passwordSection = `
      <p>Para definir sua senha e ativar sua conta, clique no botão abaixo:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">
          Definir Senha
        </a>
      </p>
      <p><strong>Importante:</strong> Este link expira em 24 horas. Se o link expirar, entre em contato com o administrador do salão.</p>
    `;
        buttonLink = resetLink;
        buttonText = 'Definir Senha';
    }
    else if (tempPassword) {
        // Use temporary password
        passwordSection = `
      <p>Uma senha temporária foi gerada para você:</p>
      <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <strong style="font-size: 18px; letter-spacing: 2px;">${tempPassword}</strong>
      </div>
      <p><strong>Importante:</strong> Por favor, altere esta senha no primeiro acesso por questões de segurança.</p>
    `;
    }
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #faf5ff; }
        .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bem-vindo ao Serennia!</h1>
        </div>
        <div class="content">
          <p>Olá ${name},</p>
          <p>Sua conta foi criada com sucesso para o salão <strong>${salonName}</strong>.</p>
          ${passwordSection}
          <p style="text-align: center;">
            <a href="${buttonLink}" class="button">
              ${buttonText}
            </a>
          </p>
          <p>Se você tiver alguma dúvida, não hesite em nos contatar.</p>
          <p>Atenciosamente,<br>Equipe Serennia</p>
        </div>
        <div class="footer">
          <p>Este é um email automático, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
    const text = `
    Bem-vindo ao Serennia!
    
    Olá ${name},
    
    Sua conta foi criada com sucesso para o salão ${salonName}.
    ${resetLink ? `Para definir sua senha, acesse: ${resetLink}` : tempPassword ? `Sua senha temporária é: ${tempPassword}\nPor favor, altere esta senha no primeiro acesso.` : 'Você já pode fazer login e começar a usar o sistema!'}
    
    Acesse: ${buttonLink}
    
    Atenciosamente,
    Equipe Serennia
  `;
    await sendEmail({
        to: email,
        subject: 'Bem-vindo ao Serennia!',
        html,
        text,
    });
}
/**
 * Send invite email to new collaborator
 * Includes confirmation link and default password
 */
async function sendCollaboratorInviteEmail(email, name, salonName, confirmLink, defaultPassword) {
    const frontendUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
    let passwordSection = '';
    let buttonLink = confirmLink || `${frontendUrl}/login`;
    let buttonText = confirmLink ? 'Confirmar Email e Ativar Conta' : 'Fazer Login';
    if (defaultPassword) {
        passwordSection = `
      <p>Sua senha inicial é:</p>
      <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <strong style="font-size: 18px; letter-spacing: 2px;">${defaultPassword}</strong>
      </div>
      <p><strong>Dica:</strong> A senha é seu primeiro nome (minúsculo) + os 4 últimos dígitos do seu CPF.</p>
      <p><strong>Importante:</strong> Recomendamos alterar esta senha após o primeiro acesso.</p>
    `;
    }
    const confirmSection = confirmLink ? `
    <p style="margin-top: 20px;"><strong>Para ativar sua conta, clique no botão abaixo:</strong></p>
    <p style="text-align: center;">
      <a href="${confirmLink}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
        ${buttonText}
      </a>
    </p>
    <p style="color: #666; font-size: 12px;">Sua conta ficará inativa até que você confirme seu email.</p>
  ` : '';
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { padding: 20px; background-color: #faf5ff; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Você foi convidado!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          <p>Você foi adicionado como colaborador no salão <strong>${salonName}</strong> no sistema Serennia!</p>
          ${passwordSection}
          ${confirmSection}
          <p>Se você tiver alguma dúvida, entre em contato com o administrador do salão.</p>
          <p>Atenciosamente,<br>Equipe Serennia</p>
        </div>
        <div class="footer">
          <p>Este é um email automático, por favor não responda.</p>
          <p>Se você não reconhece este convite, pode ignorar este email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
    const text = `
    Você foi convidado para o Serennia!
    
    Olá ${name},
    
    Você foi adicionado como colaborador no salão ${salonName} no sistema Serennia.
    
    ${defaultPassword ? `Sua senha inicial é: ${defaultPassword}\n(Primeiro nome em minúsculo + 4 últimos dígitos do CPF)\n` : ''}
    ${confirmLink ? `Para ativar sua conta, acesse: ${confirmLink}\n\nSua conta ficará inativa até que você confirme seu email.` : `Acesse: ${frontendUrl}/login`}
    
    Atenciosamente,
    Equipe Serennia
  `;
    await sendEmail({
        to: email,
        subject: `Você foi convidado para o ${salonName} - Serennia`,
        html,
        text,
    });
}
