import http from 'http';
import app from './app.js';
import { initializeSocket } from './sockets/index.js';
import prisma from './config/database.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Test database connection
prisma.$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    prisma.$disconnect();
  });
});