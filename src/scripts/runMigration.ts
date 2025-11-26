import 'dotenv/config';
import { prisma } from '../prismaClient';

async function runMigration() {
  console.log('🔄 Starting manual migration...');
  
  try {
    // 1. Add 'theme' column to Salon table
    console.log('\n⏳ Adding theme column to Salon...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Salon" ADD COLUMN "theme" JSONB;`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42701') { // column already exists
        console.log('   ⚠️ Column already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 2. Add 'cpf' column to Collaborator table
    console.log('\n⏳ Adding cpf column to Collaborator...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Collaborator" ADD COLUMN "cpf" TEXT;`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42701') {
        console.log('   ⚠️ Column already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 2b. Add 'avatarUrl' column to Collaborator table
    console.log('\n⏳ Adding avatarUrl column to Collaborator...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Collaborator" ADD COLUMN "avatarUrl" TEXT;`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42701') {
        console.log('   ⚠️ Column already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 3. Create unique index for CPF per salon
    console.log('\n⏳ Creating unique index for CPF...');
    try {
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Collaborator_salonId_cpf_key" ON "Collaborator"("salonId", "cpf");`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42P07' || error.message?.includes('already exists')) {
        console.log('   ⚠️ Index already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 4. Create ExpenseType enum
    console.log('\n⏳ Creating ExpenseType enum...');
    try {
      await prisma.$executeRawUnsafe(`CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42710' || error.message?.includes('already exists')) {
        console.log('   ⚠️ Enum already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 5. Create Expense table
    console.log('\n⏳ Creating Expense table...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "Expense" (
          "id" TEXT NOT NULL,
          "salonId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "amount" DECIMAL(65,30) NOT NULL,
          "type" "ExpenseType" NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
        );
      `);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42P07' || error.message?.includes('already exists')) {
        console.log('   ⚠️ Table already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 6. Create unique index for expense name per salon
    console.log('\n⏳ Creating unique index for Expense name...');
    try {
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "Expense_salonId_name_key" ON "Expense"("salonId", "name");`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42P07' || error.message?.includes('already exists')) {
        console.log('   ⚠️ Index already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 7. Add foreign key constraint for Expense -> Salon
    console.log('\n⏳ Adding foreign key constraint for Expense...');
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Expense" ADD CONSTRAINT "Expense_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`);
      console.log('   ✅ Success');
    } catch (error: any) {
      if (error.code === '42710' || error.message?.includes('already exists')) {
        console.log('   ⚠️ Constraint already exists');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
