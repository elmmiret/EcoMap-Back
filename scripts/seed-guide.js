import { PrismaClient } from '@prisma/client';
import { items } from '../src/config/guide-items.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding recycling guide items...');

  let created = 0;
  let updated = 0;

  for (const item of items) {
    try {
      // Try to find existing item by Spanish name
      const existing = await prisma.recycling_guide_item.findFirst({
        where: {
          name_es: item.name_es,
        },
      });

      if (existing) {
        // Update existing item
        await prisma.recycling_guide_item.update({
          where: { item_id: existing.item_id },
          data: {
            name_es: item.name_es,
            name_en: item.name_en,
            name_ca: item.name_ca,
            container_type: item.container_type,
            keywords_es: item.keywords_es,
            keywords_en: item.keywords_en,
            keywords_ca: item.keywords_ca,
            description_es: item.description_es,
            description_en: item.description_en,
            description_ca: item.description_ca,
          },
        });
        updated++;
        console.log(`✏️  Updated: ${item.name_es}`);
      } else {
        // Create new item
        await prisma.recycling_guide_item.create({
          data: {
            name_es: item.name_es,
            name_en: item.name_en,
            name_ca: item.name_ca,
            container_type: item.container_type,
            keywords_es: item.keywords_es,
            keywords_en: item.keywords_en,
            keywords_ca: item.keywords_ca,
            description_es: item.description_es,
            description_en: item.description_en,
            description_ca: item.description_ca,
          },
        });
        created++;
        console.log(`✅ Created: ${item.name_es}`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${item.name_es}:`, error.message);
    }
  }

  console.log(`\n🎉 Seeding completed!`);
  console.log(`   Created: ${created} items`);
  console.log(`   Updated: ${updated} items`);
  console.log(`   Total: ${created + updated} items`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
