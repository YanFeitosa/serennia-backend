import { PrismaClient } from './generated/prisma/client';

const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Fix for "prepared statement already exists" error with Supabase transaction pooler
  // This error happens when using PgBouncer (Supavisor) without the pgbouncer=true flag
  // We automatically append it if we detect port 6543 (Supabase pooler) or if explicitly needed
  if ((url.includes('6543') || url.includes('pooler')) && !url.includes('pgbouncer=true')) {
    const separator = url.includes('?') ? '&' : '?';
    console.log('🔌 Appending pgbouncer=true to database URL for transaction pooling compatibility');
    return `${url}${separator}pgbouncer=true`;
  }
  
  return url;
};

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});
