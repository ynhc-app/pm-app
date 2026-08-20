const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.project.updateMany({
    data: { name: 'Pembangunan Gedung TPA Nurul Hikmah' }
  });
  console.log('Done');
}
main().catch(console.error).finally(() => prisma.$disconnect());
