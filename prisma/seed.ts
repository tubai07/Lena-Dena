import { seedDemoData } from '../src/lib/seed';
import { db } from '../src/lib/db';

if (require.main === module) {
  seedDemoData()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
