const { PrismaClient } = require('@prisma/client');

console.log('=== Environment Variables ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DIRECT_URL:', process.env.DIRECT_URL);

console.log('\n=== Prisma Config ===');
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Check internal datasource URL
console.log('Prisma datasource URL:', prisma._engineConfig?.datasources?.[0]?.url || 'Not accessible');

async function main() {
  try {
    console.log('\n=== Attempting Connection ===');
    await prisma.$connect();
    console.log('SUCCESS: Database connected!');
    const count = await prisma.user.count();
    console.log('User count:', count);
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('Full error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
