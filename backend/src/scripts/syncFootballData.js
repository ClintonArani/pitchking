import { FootballDataService } from '../services/footballDataService.js';
import logger from '../utils/logger.js';

async function sync() {
  try {
    logger.info('Starting football data sync...');
    await FootballDataService.syncTeamsAndPlayers();
    logger.info('Football data sync completed successfully');
  } catch (error) {
    logger.error('Sync failed:', error);
    process.exit(1);
  }
}

sync();