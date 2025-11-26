/**
 * Email service for sending transactional emails
 * Currently a placeholder - implement with your email provider (SendGrid, AWS SES, etc.)
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  // TODO: Implement email sending
  // Options:
  // 1. SendGrid
  // 2. AWS SES
  // 3. Resend
  // 4. Nodemailer with SMTP
  
  console.log('📧 Email would be sent:', {
    to: options.to,
    subject: options.subject,
  });
  
  // For now, just log. Implement actual email sending later.
  // Example with Nodemailer:
  // const transporter = nodemailer.createTransport({...});
  // await transporter.sendMail({...});
}

export async function sendWelcomeEmail(
  email: string,
  name: string,
  salonName: string,
  resetLink?: string,
  tempPassword?: string
): Promise<void> {
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
  } else if (tempPassword) {
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
        .header { background-color: #25445A; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #25445A; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Bem-vindo ao Serenna!</h1>
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
          <p>Atenciosamente,<br>Equipe Serenna</p>
        </div>
        <div class="footer">
          <p>Este é um email automático, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Bem-vindo ao Serenna!
    
    Olá ${name},
    
    Sua conta foi criada com sucesso para o salão ${salonName}.
    ${resetLink ? `Para definir sua senha, acesse: ${resetLink}` : tempPassword ? `Sua senha temporária é: ${tempPassword}\nPor favor, altere esta senha no primeiro acesso.` : 'Você já pode fazer login e começar a usar o sistema!'}
    
    Acesse: ${buttonLink}
    
    Atenciosamente,
    Equipe Serenna
  `;

  await sendEmail({
    to: email,
    subject: 'Bem-vindo ao Serenna!',
    html,
    text,
  });
}

