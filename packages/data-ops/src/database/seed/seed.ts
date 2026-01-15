import { initDatabase } from '../setup';

async function seedDb() {
  console.log('Initializing database connection...');

  const db = initDatabase({
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!
  });

  console.log('\n[START] Seeding data...\n');

  console.log('\n[END] Seeding data...\n');

  process.exit(0);
}

seedDb().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});