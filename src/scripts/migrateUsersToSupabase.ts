/**
 * Script to migrate existing users from local authentication to Supabase Auth
 * 
 * This script:
 * 1. Reads all users from the database
 * 2. Creates corresponding users in Supabase Auth
 * 3. Stores salonId and role in user_metadata
 * 
 * Run with: npx ts-node src/scripts/migrateUsersToSupabase.ts
 */

import { prisma } from '../prismaClient';
import { supabaseAdmin } from '../lib/supabase';

async function migrateUsers() {
  console.log('Starting user migration to Supabase...');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      salonId: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
    },
  });

  console.log(`Found ${users.length} users to migrate`);

  for (const user of users) {
    try {
      console.log(`Migrating user: ${user.email}`);

      // Note: We can't migrate the password hash directly to Supabase
      // Supabase requires the actual password to create users
      // Options:
      // 1. Set a temporary password and require users to reset
      // 2. Use admin API to create user without password (requires email confirmation)
      
      // For now, we'll create the user with a temporary password
      // You should notify users to reset their password after migration
      const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!`;

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          salonId: user.salonId,
          role: user.role,
          name: user.name,
          migratedUserId: user.id, // Keep reference to original user ID
        },
      });

      if (error) {
        console.error(`Error migrating user ${user.email}:`, error.message);
        continue;
      }

      console.log(`✓ Successfully migrated user ${user.email} (Supabase ID: ${data.user.id})`);
      console.log(`  Temporary password: ${tempPassword}`);
      console.log(`  ⚠ User must reset password on first login`);

    } catch (error) {
      console.error(`Error migrating user ${user.email}:`, error);
    }
  }

  console.log('\nMigration completed!');
  console.log('\n⚠ IMPORTANT:');
  console.log('1. Users have been created with temporary passwords');
  console.log('2. Users must reset their passwords on first login');
  console.log('3. Consider implementing a password reset flow');
  console.log('4. You may want to remove passwordHash from User model after migration');
}

migrateUsers()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


