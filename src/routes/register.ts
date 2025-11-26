import { Router, Request, Response } from "express";
import { prisma } from "../prismaClient";
import { sanitizeString, validateEmail } from "../utils/validation";
import { supabaseAdmin } from "../lib/supabase";
import { sendWelcomeEmail } from "../lib/email";
import rateLimit from "express-rate-limit";

const registerRouter = Router();

// Rate limiter for registration (stricter - 5 per hour per IP)
const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour
  message: "Muitas tentativas de registro. Tente novamente em 1 hora.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: "Muitas tentativas de registro. Tente novamente em 1 hora.",
    });
  },
});

interface RegisterBody {
  salonName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  salonId?: string;
  userId?: string;
}

registerRouter.post("/", registerRateLimiter, async (req: Request, res: Response) => {
  try {
    console.log("Registration request received:", {
      body: { ...req.body, password: req.body.password ? '[REDACTED]' : undefined },
      headers: req.headers,
    });
    
    const { salonName, name, email, phone, password } = req.body as RegisterBody;

    // Validate required fields and types
    if (!salonName || typeof salonName !== 'string') {
      res.status(400).json({ error: "Nome do salão é obrigatório e deve ser uma string" });
      return;
    }

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: "Nome é obrigatório e deve ser uma string" });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: "Email é obrigatório e deve ser uma string" });
      return;
    }

    if (!phone || typeof phone !== 'string') {
      res.status(400).json({ error: "Telefone é obrigatório e deve ser uma string" });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: "Senha é obrigatória e deve ser uma string" });
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      res.status(400).json({ error: "Formato de email inválido" });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      res.status(400).json({ error: "A senha deve ter no mínimo 8 caracteres" });
      return;
    }

    // Sanitize inputs (now guaranteed to be strings)
    const sanitizedSalonName = sanitizeString(salonName);
    const sanitizedName = sanitizeString(name);
    const sanitizedEmail = sanitizeString(email).toLowerCase();
    const sanitizedPhone = sanitizeString(phone);

    if (sanitizedSalonName.length < 2) {
      res.status(400).json({ error: "Nome do salão deve ter no mínimo 2 caracteres" });
      return;
    }

    if (sanitizedName.length < 2) {
      res.status(400).json({ error: "Nome deve ter no mínimo 2 caracteres" });
      return;
    }

    // Check if email exists in our database first (faster)
    // Only select email and id to avoid issues with missing columns
    // Using raw query to avoid Prisma schema validation issues if columns don't exist yet
    let existingDbUser;
    try {
      existingDbUser = await prisma.user.findFirst({
        where: { email: sanitizedEmail },
        select: { email: true, id: true },
      });
    } catch (prismaError: any) {
      // If Prisma error is about missing columns, try raw query
      if (prismaError.code === 'P2022' || prismaError.message?.includes('does not exist')) {
        console.warn('⚠️ Prisma schema out of sync, using raw query to check email');
        const result = await prisma.$queryRaw<Array<{ email: string; id: string }>>`
          SELECT "email", "id" FROM "User" WHERE "email" = ${sanitizedEmail} LIMIT 1
        `;
        existingDbUser = result[0] || null;
      } else {
        throw prismaError;
      }
    }

    if (existingDbUser) {
      res.status(409).json({ error: "Este email já está cadastrado" });
      return;
    }

    // Check if email already exists in Supabase (using listUsers with filter)
    console.log("Checking if email exists in Supabase Auth...");
    try {
      // List users and filter by email (Supabase doesn't have direct getUserByEmail in admin API)
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Adjust if you have more users
      });
      
      if (listError) {
        console.warn("⚠️ Error listing Supabase users (continuing anyway):", listError);
      } else if (existingUsers?.users) {
        const emailExists = existingUsers.users.some(u => 
          u.email?.toLowerCase() === sanitizedEmail.toLowerCase()
        );
        if (emailExists) {
          console.log("❌ Email already exists in Supabase Auth");
          res.status(409).json({ error: "Este email já está cadastrado" });
          return;
        }
        console.log("✅ Email not found in Supabase Auth, proceeding with registration");
      }
    } catch (supabaseCheckError) {
      console.warn("⚠️ Error checking Supabase users (continuing anyway):", supabaseCheckError);
      // Continue with registration even if Supabase check fails
      // The createUser call will fail if email exists anyway
    }

    // Create user in Supabase Auth
    // Try creating without metadata first to avoid trigger issues, then update metadata
    console.log("Creating user in Supabase Auth (without metadata first)...");
    let authData, authError;
    
    // First attempt: create user without metadata
    const createResult = await supabaseAdmin.auth.admin.createUser({
      email: sanitizedEmail,
      password: password,
      email_confirm: true, // Auto-confirm email
      // Don't include user_metadata initially to avoid trigger issues
    });
    
    authData = createResult.data;
    authError = createResult.error;
    
    // If that fails, try with minimal metadata
    if (authError && authError.message.includes('Database error')) {
      console.log("⚠️ First attempt failed, trying with minimal metadata...");
      const retryResult = await supabaseAdmin.auth.admin.createUser({
        email: sanitizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: sanitizedName,
        },
      });
      authData = retryResult.data;
      authError = retryResult.error;
    }
    
    // If still fails, try with all metadata (original approach)
    if (authError && authError.message.includes('Database error')) {
      console.log("⚠️ Second attempt failed, trying with full metadata...");
      const finalResult = await supabaseAdmin.auth.admin.createUser({
        email: sanitizedEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: sanitizedName,
          phone: sanitizedPhone,
        },
      });
      authData = finalResult.data;
      authError = finalResult.error;
    }

    // Check if user was created despite the error (sometimes Supabase creates user but returns error)
    if (authError && !authData?.user) {
      console.error("❌ Error creating user in Supabase:", authError);
      console.error("Auth error details:", {
        message: authError?.message,
        status: authError?.status,
        code: authError?.code,
        name: authError?.name,
      });
      
      const errorMessage = authError?.message || "Erro desconhecido ao criar usuário";
      const errorCode = (authError as any)?.code;
      
      // Try to check if user was actually created (sometimes happens with database errors)
      if (errorMessage.includes('Database error') || errorCode === 'unexpected_failure') {
        console.log("🔍 Checking if user was created despite error...");
        try {
          // Wait a bit for the user to be created (if it was)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try to get user by email directly
          const { data: checkUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
          });
          
          if (!checkError && checkUser?.users) {
            const userExists = checkUser.users.find(u => 
              u.email?.toLowerCase() === sanitizedEmail.toLowerCase()
            );
            
            if (userExists) {
              console.log("✅ User was actually created! Using existing user:", userExists.id);
              console.log("   User details:", {
                id: userExists.id,
                email: userExists.email,
                created_at: userExists.created_at,
              });
              authData = { user: userExists };
              authError = null;
            } else {
              console.log("❌ User was not created - all attempts failed");
              console.log("   This indicates a database trigger or function is failing");
              console.log("   Please check Supabase dashboard > Database > Functions");
            }
          } else if (checkError) {
            console.warn("⚠️ Error checking if user exists:", checkError);
          }
        } catch (checkErr) {
          console.warn("⚠️ Error checking if user exists:", checkErr);
        }
      }
      
      // If still have error, handle it
      if (authError && !authData?.user) {
        // Handle specific Supabase errors
        if (errorMessage.includes('already registered') || 
            errorMessage.includes('already exists') ||
            errorMessage.includes('User already registered')) {
          res.status(409).json({ error: "Este email já está cadastrado" });
          return;
        }
        
        // Handle database errors from Supabase
        if (errorMessage.includes('Database error') || errorCode === 'unexpected_failure') {
          console.error("⚠️ Supabase database error - this might be a configuration issue");
          console.error("💡 Possible causes:");
          console.error("   1. Database trigger or function failing (most common)");
          console.error("   2. Check Supabase dashboard > Database > Functions for triggers on auth.users");
          console.error("   3. There might be a trigger trying to create a User record automatically");
          console.error("   4. Check Supabase logs (Logs > Postgres Logs) for detailed error");
          console.error("");
          console.error("🔧 Solution:");
          console.error("   1. Go to Supabase dashboard > Database > Functions");
          console.error("   2. Look for triggers on auth.users table");
          console.error("   3. Disable or fix any trigger that tries to INSERT into public.User table");
          console.error("   4. Or modify the trigger to handle the case when User doesn't exist yet");
          
          // Provide a more helpful error message
          const helpfulMessage = "Erro ao criar usuário no banco de dados do Supabase. " +
            "Isso geralmente acontece quando há um trigger no banco de dados que está falhando. " +
            "Verifique o dashboard do Supabase > Database > Functions e desabilite ou corrija triggers na tabela auth.users.";
          
          res.status(500).json({ 
            error: helpfulMessage
          });
          return;
        }
        
        res.status(500).json({ 
          error: `Erro ao criar usuário: ${errorMessage}. Código: ${errorCode || 'N/A'}. Tente novamente.` 
        });
        return;
      }
    }
    
    // Final check
    if (!authData?.user) {
      res.status(500).json({ 
        error: "Erro desconhecido ao criar usuário. Tente novamente." 
      });
      return;
    }

    console.log("User created in Supabase:", authData.user.id);

    // Create salon
    console.log("Creating salon with data:", {
      name: sanitizedSalonName,
      status: "active",
      defaultCommissionRate: 0.5,
      commissionMode: "professional",
    });
    
    let salon;
    try {
      salon = await prisma.salon.create({
        data: {
          name: sanitizedSalonName,
          status: "active", // Auto-activate (can be changed to 'pending' if approval needed)
          defaultCommissionRate: 0.5,
          commissionMode: "professional",
        },
      });
      console.log("✅ Salon created:", salon.id);
    } catch (salonError: any) {
      console.error("❌ Error creating salon:", salonError);
      console.error("Salon error details:", {
        code: salonError.code,
        message: salonError.message,
        meta: salonError.meta,
      });
      throw new Error(`Erro ao criar salão: ${salonError.message || 'Erro desconhecido'}`);
    }

    // Create user in database as Tenant Admin
    console.log("Creating user in database with data:", {
      id: authData.user.id,
      salonId: salon.id,
      name: sanitizedName,
      email: sanitizedEmail,
      phone: sanitizedPhone,
      platformRole: "tenant_admin",
    });
    
    let user;
    try {
      // Try to create user with all fields first
      user = await prisma.user.create({
        data: {
          id: authData.user.id, // Use Supabase user ID
          salonId: salon.id,
          name: sanitizedName,
          email: sanitizedEmail,
          phone: sanitizedPhone,
          passwordHash: null, // Not used anymore (Supabase handles auth)
          platformRole: "tenant_admin",
          tenantRole: null, // Tenant Admin doesn't have tenantRole
        },
      });
      console.log("✅ User created in database:", user.id);
    } catch (userError: any) {
      console.error("❌ Error creating user:", userError);
      console.error("User error details:", {
        code: userError.code,
        message: userError.message,
        meta: userError.meta,
      });
      
      // If error is about missing columns (P2022), try with minimal fields
      if (userError.code === 'P2022' || userError.message?.includes('does not exist')) {
        console.warn("⚠️ Schema out of sync, trying to create user with minimal fields...");
        try {
          // Try creating with only required fields that should exist
          user = await prisma.user.create({
            data: {
              id: authData.user.id,
              salonId: salon.id,
              name: sanitizedName,
              email: sanitizedEmail,
              phone: sanitizedPhone,
              passwordHash: null,
            },
          });
          console.log("✅ User created with minimal fields:", user.id);
          console.warn("⚠️ IMPORTANT: Run migrations to add platformRole and tenantRole columns");
        } catch (minimalError: any) {
          console.error("❌ Failed even with minimal fields:", minimalError);
          // Try to clean up salon if user creation fails
          try {
            await prisma.salon.delete({ where: { id: salon.id } });
            console.log("🧹 Cleaned up salon after user creation failure");
          } catch (cleanupError) {
            console.error("⚠️ Error cleaning up salon:", cleanupError);
          }
          throw new Error(`Erro ao criar usuário: Schema do banco está desincronizado. Execute as migrations SQL manuais primeiro.`);
        }
      } else {
        // Try to clean up salon if user creation fails
        try {
          await prisma.salon.delete({ where: { id: salon.id } });
          console.log("🧹 Cleaned up salon after user creation failure");
        } catch (cleanupError) {
          console.error("⚠️ Error cleaning up salon:", cleanupError);
        }
        
        throw new Error(`Erro ao criar usuário: ${userError.message || 'Erro desconhecido'}`);
      }
    }

    // Update salon with tenantAdminId
    console.log("Updating salon with tenantAdminId:", user.id);
    try {
      await prisma.salon.update({
        where: { id: salon.id },
        data: { tenantAdminId: user.id },
      });
      console.log("✅ Salon updated with tenantAdminId");
    } catch (updateError: any) {
      console.error("❌ Error updating salon with tenantAdminId:", updateError);
      // Don't fail registration if this update fails - it's not critical
      console.warn("⚠️ Continuing despite salon update error");
    }

    // Update Supabase user metadata with salonId and role
    console.log("Updating Supabase user metadata...");
    try {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
        user_metadata: {
          salonId: salon.id,
          platformRole: "tenant_admin",
          role: "tenant_admin", // Legacy field
          name: sanitizedName,
          phone: sanitizedPhone,
        },
      });

      if (updateError) {
        console.error("❌ Error updating Supabase user metadata:", updateError);
        // Don't fail registration if metadata update fails - it's not critical
        console.warn("⚠️ Continuing despite metadata update error");
      } else {
        console.log("✅ Supabase user metadata updated");
      }
    } catch (metadataError: any) {
      console.error("❌ Error updating Supabase user metadata:", metadataError);
      // Don't fail registration if metadata update fails - it's not critical
      console.warn("⚠️ Continuing despite metadata update error");
    }

    // Send welcome email
    try {
      await sendWelcomeEmail(sanitizedEmail, sanitizedName, sanitizedSalonName);
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // Don't fail registration if email fails
    }

    const response: RegisterResponse = {
      success: true,
      message: "Conta criada com sucesso! Você pode fazer login agora.",
      salonId: salon.id,
      userId: user.id,
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("=".repeat(50));
    console.error("❌ ERROR IN REGISTRATION ROUTE");
    console.error("=".repeat(50));
    console.error("Error:", error);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("Error name:", error?.name);
    console.error("Error code:", error?.code);
    console.error("Error meta:", error?.meta);
    console.error("Error cause:", error?.cause);
    console.error("=".repeat(50));

    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      if (field === "email") {
        res.status(409).json({ error: "Este email já está cadastrado" });
        return;
      }
      res.status(409).json({ 
        error: `Já existe um registro com este ${field}. Tente outro valor.` 
      });
      return;
    }

    // Handle Prisma errors
    if (error.code && error.code.startsWith('P')) {
      console.error("Prisma error:", error);
      res.status(500).json({ 
        error: `Erro no banco de dados: ${error.message || 'Erro desconhecido'}. Tente novamente mais tarde.` 
      });
      return;
    }

    // Handle Supabase errors
    if (error.message && (error.message.includes('Supabase') || error.message.includes('supabase'))) {
      console.error("Supabase error:", error);
      res.status(500).json({ 
        error: `Erro ao criar usuário: ${error.message || 'Erro desconhecido'}. Verifique os dados e tente novamente.` 
      });
      return;
    }

    // Return more detailed error in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const errorMessage = isDevelopment 
      ? `Erro ao criar conta: ${error.message || 'Erro desconhecido'}. Stack: ${error.stack || 'N/A'}`
      : "Erro ao criar conta. Tente novamente mais tarde.";

    res.status(500).json({ 
      error: errorMessage 
    });
  }
});

export { registerRouter };

