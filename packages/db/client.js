const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across hot-reloads (Next.js dev) and
// across the bot process, instead of opening a new connection pool per import.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__dclogPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__dclogPrisma = prisma;
}

module.exports = { prisma };
