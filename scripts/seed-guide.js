import { PrismaClient } from '@prisma/client';
import { items } from '../src/config/guide-items.js';

const prisma = new PrismaClient();

async function main() {
  for (const item of items) {
    await prisma.recycling_guide_item.upsert({
      where: { name: item.name },
      update: {},
      create: {
        name: item.name,
        container_type: item.container_type,
        keywords: item.keywords,
        description: item.description
      }
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });