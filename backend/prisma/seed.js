import bcrypt from 'bcryptjs';
import prisma from '../src/config/database.js';
import logger from '../src/utils/logger.js';

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pitchking.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@pitchking.com',
      phoneNumber: '254700000000',
      password: adminPassword,
      role: 'ADMIN',
      walletBalance: 0,
      isActive: true
    }
  });
  
  logger.info('Admin user created:', admin.email);
  
  // Create sample player
  const playerPassword = await bcrypt.hash('Player@123', 10);
  const player = await prisma.user.upsert({
    where: { email: 'player1@example.com' },
    update: {},
    create: {
      name: 'Test Player',
      email: 'player1@example.com',
      phoneNumber: '254711222333',
      password: playerPassword,
      role: 'PLAYER',
      walletBalance: 1000,
      isActive: true
    }
  });
  
  logger.info('Sample player created:', player.email);
  
  // Create sample fan
  const fanPassword = await bcrypt.hash('Fan@123', 10);
  const fan = await prisma.user.upsert({
    where: { email: 'fan1@example.com' },
    update: {},
    create: {
      name: 'Test Fan',
      email: 'fan1@example.com',
      phoneNumber: '254722333444',
      password: fanPassword,
      role: 'FAN',
      walletBalance: 500,
      isActive: true
    }
  });
  
  logger.info('Sample fan created:', fan.email);
}

main()
  .catch((e) => {
    logger.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });