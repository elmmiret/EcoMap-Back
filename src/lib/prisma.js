import { PrismaClient } from '@prisma/client';

// Aseguramos que en entornos de desarrollo (hot-reload) reutilizamos
// la misma instancia de Prisma y no creamos múltiples conexiones.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
