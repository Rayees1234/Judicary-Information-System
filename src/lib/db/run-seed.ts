import { seedDatabase } from './seed';

try {
  seedDatabase();
  console.log('Seed execution completed successfully.');
} catch (error) {
  console.error('Seed execution failed:', error);
  process.exit(1);
}
